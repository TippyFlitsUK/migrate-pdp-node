#!/usr/bin/env tsx
/**
 * Check what CIDs are actually in dataset 74 on-chain
 */

import { Synapse, RPC_URLS } from '@filoz/synapse-sdk'
import type { Hex } from 'viem'

const CONFIG = {
  privateKey: process.env.PRIVATE_KEY as Hex,
  rpcUrl: process.env.RPC_URL || RPC_URLS.calibration.http,
  datasetId: 74,
}

async function main() {
  console.log('🔍 Checking Dataset CIDs On-Chain\n')

  if (!CONFIG.privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required')
  }

  // Initialize Synapse SDK
  console.log('Initializing Synapse SDK...')
  const synapse = await Synapse.create({
    privateKey: CONFIG.privateKey,
    rpcURL: CONFIG.rpcUrl,
  })
  console.log('✓ SDK initialized\n')

  // Get dataset info
  console.log(`Fetching datasets for provider 2...`)

  try {
    // Import viem to create publicClient
    const { createPublicClient, http } = await import('viem')
    const { filecoinCalibration } = await import('viem/chains')

    const client = createPublicClient({
      chain: filecoinCalibration,
      transport: http(CONFIG.rpcUrl)
    })

    // WarmStorage contract address on Calibration (checksummed)
    const warmStorageAddress = '0x8f23bb38b5b8ee212ec08f32f7c37d84e60b8149' as const

    // ABI for getDataSetInfo
    const abi = [{
      name: 'getDataSetInfo',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'dataSetId', type: 'uint256' }],
      outputs: [{
        type: 'tuple',
        components: [
          { name: 'pieceIds', type: 'bytes32[]' },
          { name: 'provider', type: 'address' },
          { name: 'created', type: 'uint256' }
        ]
      }]
    }]

    console.log(`\nQuerying dataset ${CONFIG.datasetId} on-chain...`)

    const result = await client.readContract({
      address: warmStorageAddress,
      abi,
      functionName: 'getDataSetInfo',
      args: [BigInt(CONFIG.datasetId)]
    })

    console.log(`\nDataset ${CONFIG.datasetId} has ${result.pieceIds.length} pieces:`)
    result.pieceIds.slice(0, 10).forEach((pieceId, i) => {
      console.log(`  ${i + 1}. ${pieceId}`)
    })

    if (result.pieceIds.length > 10) {
      console.log(`  ... and ${result.pieceIds.length - 10} more`)
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
  }
}

main().catch(console.error)
