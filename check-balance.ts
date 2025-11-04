#!/usr/bin/env tsx
/**
 * Check USDFC balance and deposits in Payments contract
 */

import { Synapse, RPC_URLS } from '@filoz/synapse-sdk'
import type { Hex } from 'viem'
import { formatUnits } from 'viem'

const CONFIG = {
  privateKey: process.env.PRIVATE_KEY as Hex,
  rpcUrl: process.env.RPC_URL || RPC_URLS.calibration.http,
}

async function main() {
  console.log('💰 Checking USDFC Balance & Deposits\n')

  if (!CONFIG.privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required')
  }

  // Initialize SDK
  const synapse = await Synapse.create({
    privateKey: CONFIG.privateKey,
    rpcURL: CONFIG.rpcUrl,
  })

  const address = await synapse.getClient().getAddress()
  console.log(`Wallet Address: ${address}\n`)

  // Get USDFC token balance in wallet
  const walletBalance = await synapse.payments.walletBalance('USDFC')
  console.log(`USDFC in Wallet: ${formatUnits(walletBalance, 18)} USDFC`)

  // Get deposited balance in Payments contract
  const depositBalance = await synapse.payments.balance('USDFC')
  console.log(`USDFC Deposited: ${formatUnits(depositBalance, 18)} USDFC`)

  console.log('\n' + '='.repeat(60))

  if (depositBalance === 0n) {
    console.log('⚠️  WARNING: No USDFC deposited in Payments contract!')
    console.log('\nYou need to deposit USDFC before migrating pieces.')
    console.log('Run: npm run deposit <amount>')
    console.log('Example: npm run deposit 50')
  } else {
    console.log('✓ Ready to migrate!')
  }
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
