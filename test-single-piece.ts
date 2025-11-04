#!/usr/bin/env tsx
/**
 * Test single piece migration to verify CID preservation
 */

import { Synapse, RPC_URLS } from '@filoz/synapse-sdk'
import { asPieceCID, asLegacyPieceCID } from '@filoz/synapse-sdk/piece'
import { readFile } from 'fs/promises'
import type { Hex } from 'viem'

const CONFIG = {
  privateKey: process.env.PRIVATE_KEY as Hex,
  rpcUrl: process.env.RPC_URL || RPC_URLS.calibration.http,
  providerId: parseInt(process.env.PROVIDER_ID || '0'),
  testFile: '/filecoin-storage/piece/s-t00-16201',
  expectedCid: 'baga6ea4seaqpss756prtkiynrewq4fqfaornk3zux2hldv4xduchtxz63s2osbq',
}

async function main() {
  console.log('🧪 Testing Single Piece Migration\n')
  console.log('='.repeat(60))

  if (!CONFIG.privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required')
  }
  if (!CONFIG.providerId) {
    throw new Error('PROVIDER_ID environment variable is required')
  }

  console.log(`Test File: ${CONFIG.testFile}`)
  console.log(`Expected CID: ${CONFIG.expectedCid}`)
  console.log(`Target Provider: ${CONFIG.providerId}`)
  console.log('='.repeat(60))
  console.log('')

  // Read test file
  console.log('📖 Reading test file...')
  const fileData = await readFile(CONFIG.testFile)
  console.log(`✓ Read ${fileData.length} bytes (${(fileData.length / 1024 / 1024).toFixed(2)} MB)\n`)

  // Initialize Synapse SDK
  console.log('🔧 Initializing Synapse SDK...')
  const synapse = await Synapse.create({
    privateKey: CONFIG.privateKey,
    rpcURL: CONFIG.rpcUrl,
  })
  console.log('✓ SDK initialized\n')

  // Create storage context
  console.log('📦 Creating storage context...')
  const context = await synapse.storage.createContext({
    providerId: CONFIG.providerId,
    metadata: {
      test: 'single-piece-migration',
      originalFile: CONFIG.testFile,
    },
  })
  console.log('✓ Storage context created\n')

  // Upload piece
  console.log('⬆️  Uploading piece...')
  const startTime = Date.now()

  try {
    const result = await context.upload(fileData, {
      metadata: {
        testPiece: 'true',
        originalFilename: 's-t00-1',
      },
    })

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✓ Upload complete in ${duration}s\n`)

    // Results
    console.log('='.repeat(60))
    console.log('📊 RESULTS')
    console.log('='.repeat(60))
    console.log(`Original CID: ${CONFIG.expectedCid}`)
    console.log(`Response CID: ${result.pieceCid}`)
    console.log('')

    // Convert both CIDs to legacy format for comparison
    const originalLegacy = asLegacyPieceCID(CONFIG.expectedCid)
    const responseLegacy = asLegacyPieceCID(result.pieceCid)

    if (originalLegacy == null || responseLegacy == null) {
      console.log('⚠️  Could not parse CIDs')
      return
    }

    console.log(`Original (legacy format): ${originalLegacy.toString()}`)
    console.log(`Response (legacy format): ${responseLegacy.toString()}`)
    console.log('')

    const samePiece = originalLegacy.toString() === responseLegacy.toString()
    console.log(`Match: ${samePiece ? 'YES ✅' : 'NO ❌'}`)
    console.log('')

    if (samePiece) {
      console.log('✅ SUCCESS: CIDs represent the SAME piece data!')
      console.log('')
      console.log('The SDK converts both CID formats to the same legacy CID,')
      console.log('confirming they reference the same piece.')
      console.log('')
      console.log('Original CID URL on new node:')
      console.log(`  https://calib2.ezpdpz.net/piece/${CONFIG.expectedCid}`)
      console.log('')
      console.log('🎉 Migration will preserve CID accessibility!')
    } else {
      console.log('❌ FAILURE: CIDs represent DIFFERENT pieces!')
      console.log('')
      console.log('The uploaded piece does not match the original.')
      console.log('Migration will NOT preserve original CIDs.')
    }

    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Upload failed!')
    console.error('Error:', error instanceof Error ? error.message : String(error))

    if (error instanceof Error && error.message.includes('InsufficientFunds')) {
      console.error('\n💡 Tip: Run `npm run deposit 50` to add USDFC to Payments contract')
    }

    process.exit(1)
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  console.error(error.stack)
  process.exit(1)
})
