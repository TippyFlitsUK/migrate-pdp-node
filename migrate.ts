#!/usr/bin/env tsx
/**
 * Simple Parallel PDP Piece Migration Tool
 * Uploads all pieces from /filecoin-storage/piece/ to a new Filecoin node
 */

import { Synapse, RPC_URLS } from '@filoz/synapse-sdk'
import { readdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import pLimit from 'p-limit'
import type { Hex } from 'viem'

// Configuration from environment
const CONFIG = {
  privateKey: process.env.PRIVATE_KEY as Hex,
  rpcUrl: process.env.RPC_URL || RPC_URLS.calibration.http,
  providerId: parseInt(process.env.PROVIDER_ID || '0'),
  sourcePath: process.env.SOURCE_PATH || '/filecoin-storage/piece',
  concurrency: parseInt(process.env.CONCURRENCY || '20'),
  logInterval: parseInt(process.env.LOG_INTERVAL || '50'),
  progressFile: 'migration-progress.json',
  batchSize: parseInt(process.env.BATCH_SIZE || '100'),
}

// Progress tracking
interface MigrationProgress {
  lastUpdated: string
  totalFiles: number
  migratedCount: number
  migratedFiles: Set<string>
}

const stats = {
  total: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now(),
  errors: [] as Array<{ file: string; error: string; timestamp: string }>,
}

async function loadProgress(): Promise<MigrationProgress> {
  if (existsSync(CONFIG.progressFile)) {
    const data = await readFile(CONFIG.progressFile, 'utf-8')
    const progress = JSON.parse(data)
    return {
      ...progress,
      migratedFiles: new Set(progress.migratedFiles),
    }
  }
  return {
    lastUpdated: new Date().toISOString(),
    totalFiles: 0,
    migratedCount: 0,
    migratedFiles: new Set(),
  }
}

async function saveProgress(progress: MigrationProgress) {
  const data = {
    ...progress,
    migratedFiles: Array.from(progress.migratedFiles),
  }
  await writeFile(CONFIG.progressFile, JSON.stringify(data, null, 2))
}

async function main() {
  console.log('🚀 Filecoin PDP Piece Migration Tool\n')

  // Validate configuration
  if (!CONFIG.privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required')
  }
  if (!CONFIG.providerId) {
    throw new Error('PROVIDER_ID environment variable is required')
  }

  console.log('Configuration:')
  console.log(`  Source: ${CONFIG.sourcePath}`)
  console.log(`  RPC URL: ${CONFIG.rpcUrl}`)
  console.log(`  Provider ID: ${CONFIG.providerId}`)
  console.log(`  Concurrency: ${CONFIG.concurrency}`)
  console.log('')

  // Initialize Synapse SDK
  console.log('Initializing Synapse SDK...')
  const synapse = await Synapse.create({
    privateKey: CONFIG.privateKey,
    rpcURL: CONFIG.rpcUrl,
  })
  console.log('✓ SDK initialized\n')

  // Create storage context (single dataset for all pieces)
  console.log('Creating storage context...')
  const context = await synapse.storage.createContext({
    providerId: CONFIG.providerId,
    metadata: {
      migrationDate: new Date().toISOString(),
      source: CONFIG.sourcePath,
    },
  })
  console.log('✓ Storage context created\n')

  // Load progress from previous run
  console.log('Loading migration progress...')
  const progress = await loadProgress()

  if (progress.migratedCount > 0) {
    console.log(`✓ Found existing progress: ${progress.migratedCount} files already migrated`)
    stats.skipped = progress.migratedCount
  } else {
    console.log('✓ Starting fresh migration')
  }
  console.log('')

  // Get all piece files
  console.log('Scanning piece files...')
  const files = await readdir(CONFIG.sourcePath)
  const pieceFiles = files.filter((f) => f.startsWith('s-t00-'))
  stats.total = pieceFiles.length

  // Filter out already migrated files
  const remainingFiles = pieceFiles.filter((f) => !progress.migratedFiles.has(f))

  console.log(`✓ Found ${stats.total} total piece files`)
  console.log(`✓ Already migrated: ${progress.migratedCount}`)
  console.log(`✓ Remaining to migrate: ${remainingFiles.length}\n`)

  if (remainingFiles.length === 0) {
    console.log('✅ All files already migrated!')
    return
  }

  console.log('Starting migration...\n')

  // Update progress total
  progress.totalFiles = stats.total

  // Upload with concurrency limit in batches
  const limit = pLimit(CONFIG.concurrency)
  const batches = []

  for (let i = 0; i < remainingFiles.length; i += CONFIG.batchSize) {
    batches.push(remainingFiles.slice(i, i + CONFIG.batchSize))
  }

  console.log(`Processing ${batches.length} batches of up to ${CONFIG.batchSize} files each\n`)

  for (const [batchIndex, batch] of batches.entries()) {
    console.log(`Batch ${batchIndex + 1}/${batches.length}: ${batch.length} files`)

    const tasks = batch.map((file) =>
      limit(async () => {
        try {
          const filePath = join(CONFIG.sourcePath, file)
          const data = await readFile(filePath)

          await context.upload(data, {
            metadata: {
              originalFilename: file,
              originalPath: filePath,
            },
          })

          stats.completed++
          progress.migratedFiles.add(file)
          progress.migratedCount++

          // Progress logging
          if (stats.completed % CONFIG.logInterval === 0) {
            logProgress()
          }

          return { success: true, file }
        } catch (error) {
          stats.failed++
          const errorMessage = error instanceof Error ? error.message : String(error)
          stats.errors.push({
            file,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          })

          console.error(`✗ Failed: ${file} - ${errorMessage}`)
          return { success: false, file, error: errorMessage }
        }
      })
    )

    // Wait for batch to complete
    await Promise.allSettled(tasks)

    // Save progress after each batch
    progress.lastUpdated = new Date().toISOString()
    await saveProgress(progress)
    console.log(`✓ Batch ${batchIndex + 1} complete. Progress saved.\n`)
  }

  // Final report
  console.log('\n' + '='.repeat(60))
  console.log('Migration Complete')
  console.log('='.repeat(60))
  console.log(`Total files: ${stats.total}`)
  console.log(`Already migrated (skipped): ${stats.skipped}`)
  console.log(`Newly migrated: ${stats.completed}`)
  console.log(`Failed: ${stats.failed}`)
  console.log(`Total now migrated: ${progress.migratedCount} / ${stats.total}`)

  const duration = (Date.now() - stats.startTime) / 1000
  const minutes = Math.floor(duration / 60)
  const seconds = Math.floor(duration % 60)
  console.log(`Duration: ${minutes}m ${seconds}s`)
  if (stats.completed > 0) {
    console.log(`Throughput: ${(stats.completed / duration).toFixed(1)} pieces/sec`)
  }

  // Save error log if there were failures
  if (stats.failed > 0) {
    const errorLogPath = 'migration-errors.json'
    await writeFile(errorLogPath, JSON.stringify(stats.errors, null, 2))
    console.log(`\n⚠ Error log saved to: ${errorLogPath}`)
    console.log('Review failed pieces and re-run migration to retry.')
  }

  // Save final progress
  await saveProgress(progress)

  if (progress.migratedCount === stats.total && stats.failed === 0) {
    console.log('\n✅ All files successfully migrated!')
  } else if (stats.failed > 0) {
    console.log('\n⚠️  Migration completed with errors. Re-run to retry failed files.')
  } else {
    console.log('\n✓ Migration batch finished!')
  }
}

function logProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000
  const rate = stats.completed / elapsed
  const remaining = stats.total - stats.completed
  const eta = remaining / rate

  const etaMinutes = Math.floor(eta / 60)
  const etaSeconds = Math.floor(eta % 60)

  console.log(
    `Progress: ${stats.completed}/${stats.total} ` +
      `(${((stats.completed / stats.total) * 100).toFixed(1)}%) | ` +
      `Rate: ${rate.toFixed(1)}/s | ` +
      `ETA: ${etaMinutes}m ${etaSeconds}s`
  )
}

// Run with error handling
main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  console.error(error.stack)
  process.exit(1)
})
