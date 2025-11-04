#!/usr/bin/env tsx
/**
 * Deposit USDFC to Payments contract
 */

import { Synapse, RPC_URLS } from '@filoz/synapse-sdk'
import type { Hex } from 'viem'
import { parseUnits, formatUnits } from 'viem'

const CONFIG = {
  privateKey: process.env.PRIVATE_KEY as Hex,
  rpcUrl: process.env.RPC_URL || RPC_URLS.calibration.http,
}

async function main() {
  const amount = process.argv[2]

  if (!amount) {
    console.error('Usage: npm run deposit <amount>')
    console.error('Example: npm run deposit 10')
    process.exit(1)
  }

  console.log('💰 Depositing USDFC to Payments Contract\n')

  if (!CONFIG.privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required')
  }

  // Initialize SDK
  const synapse = await Synapse.create({
    privateKey: CONFIG.privateKey,
    rpcURL: CONFIG.rpcUrl,
  })

  const address = await synapse.getClient().getAddress()
  const amountWei = parseUnits(amount, 18)

  console.log(`Wallet: ${address}`)
  console.log(`Amount: ${amount} USDFC\n`)

  // Check wallet balance
  const walletBalance = await synapse.payments.walletBalance('USDFC')
  console.log(`Wallet Balance: ${formatUnits(walletBalance, 18)} USDFC`)

  if (walletBalance < amountWei) {
    console.error(`\n❌ Insufficient USDFC in wallet!`)
    console.error(`Need: ${amount} USDFC`)
    console.error(`Have: ${formatUnits(walletBalance, 6)} USDFC`)
    process.exit(1)
  }

  // Check current deposit
  const currentDeposit = await synapse.payments.balance('USDFC')
  console.log(`Current Deposit: ${formatUnits(currentDeposit, 18)} USDFC\n`)

  console.log('Depositing...')

  // Deposit
  const txResponse = await synapse.payments.deposit(amountWei, 'USDFC')
  console.log(`✓ Transaction sent: ${txResponse.hash}`)
  console.log('Waiting for confirmation...')

  // Wait for transaction
  await txResponse.wait()

  // Check new balance
  const newDeposit = await synapse.payments.balance('USDFC')
  console.log(`\n✓ Deposit complete!`)
  console.log(`New Deposit Balance: ${formatUnits(newDeposit, 18)} USDFC`)
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
