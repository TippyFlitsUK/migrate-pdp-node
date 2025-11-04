#!/usr/bin/env tsx
/**
 * Approve Warm Storage contract as operator
 */

import { Synapse, RPC_URLS } from '@filoz/synapse-sdk'
import type { Hex } from 'viem'
import { parseUnits } from 'viem'

const CONFIG = {
  privateKey: process.env.PRIVATE_KEY as Hex,
  rpcUrl: process.env.RPC_URL || RPC_URLS.calibration.http,
}

async function main() {
  console.log('🔐 Approving Warm Storage as Operator\n')

  if (!CONFIG.privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required')
  }

  // Initialize SDK
  const synapse = await Synapse.create({
    privateKey: CONFIG.privateKey,
    rpcURL: CONFIG.rpcUrl,
  })

  const address = await synapse.getClient().getAddress()
  const warmStorageAddress = synapse.getWarmStorageAddress()

  console.log(`Wallet: ${address}`)
  console.log(`Warm Storage: ${warmStorageAddress}\n`)

  console.log('Setting operator approval...')
  console.log('This allows Warm Storage to create payment rails on your behalf.\n')

  // Approve with generous allowances
  // These values allow the service to create payment rails with reasonable limits
  const tx = await synapse.payments.approveService(
    warmStorageAddress,
    parseUnits('1000', 18),  // Rate allowance: 1000 USDFC/epoch
    parseUnits('100', 18),   // Lockup allowance: 100 USDFC
    BigInt(365 * 24 * 60 * 2), // Max lockup period: ~1 year in epochs (30s each)
    'USDFC'
  )

  console.log(`✓ Transaction sent: ${tx.hash}`)
  console.log('Waiting for confirmation...')

  await tx.wait()

  console.log('\n✓ Operator approved!')
  console.log('\nYou can now create datasets and upload pieces.')
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
