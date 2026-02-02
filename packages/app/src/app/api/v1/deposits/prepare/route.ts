/**
 * POST /api/v1/deposits/prepare
 * Prepares deposit transaction for user to sign
 * Returns approve tx (if needed) and deposit tx
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, type Chain as ViemChain } from 'viem';
import { mainnet, polygon, arbitrum, base, sepolia, baseSepolia } from 'viem/chains';
import {
  getSupabase,
  findOrCreateWallet,
  createDeposit,
} from '../../../../../lib/db';
import { prepareDepositTransactions, simulateTx } from '@bangui/agents';
import { getPrimaryVault } from '../../../../../lib/vaults';
import { DEFAULT_RPC_URL } from '../../../../../lib/chains';
import type {
  DepositPrepareRequest,
  DepositPrepareResponse,
  UUID,
  Address,
  Chain,
} from '@bangui/types';

/** Minimal ABI for reading reserveToken from AiETH contract */
const aiETHAbi = [
  {
    name: 'reserveToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

/** Chain config mapping */
const CHAIN_CONFIG: Record<Chain, { chain: ViemChain; rpcEnvVar: string }> = {
  ethereum: { chain: mainnet, rpcEnvVar: 'ETH_RPC_URL' },
  polygon: { chain: polygon, rpcEnvVar: 'POLYGON_RPC_URL' },
  arbitrum: { chain: arbitrum, rpcEnvVar: 'ARB_RPC_URL' },
  base: { chain: base, rpcEnvVar: 'BASE_RPC_URL' },
  sepolia: { chain: sepolia, rpcEnvVar: 'NEXT_PUBLIC_DEFAULT_RPC_URL' },
  base_sepolia: { chain: baseSepolia, rpcEnvVar: 'BASE_SEPOLIA_RPC_URL' },
};

export async function POST(request: NextRequest) {
  const db = getSupabase();
  const body: DepositPrepareRequest & { walletAddress: Address } = await request.json();
  const { userId, amount, token, chain, walletAddress } = body;

  // Get chain config and RPC URL
  const chainConfig = CHAIN_CONFIG[chain];
  if (!chainConfig) {
    return NextResponse.json(
      { error: `Unsupported chain: ${chain}` },
      { status: 400 }
    );
  }

  // Get vault for this chain (uses chain-specific env vars like NEXT_PUBLIC_DAF_CONTRACT_SEPOLIA)
  const vault = getPrimaryVault(chain);
  if (!vault) {
    return NextResponse.json(
      { error: `No vault configured for chain: ${chain}` },
      { status: 400 }
    );
  }

  const contractAddress = vault.address;
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    return NextResponse.json(
      { error: `Vault contract not deployed for ${chain}. Check NEXT_PUBLIC_DAF_CONTRACT_* env vars.` },
      { status: 500 }
    );
  }

  // Get RPC URL - use default for testnets if specific one not set
  let rpcUrl = process.env[chainConfig.rpcEnvVar];
  if (!rpcUrl && (chain === 'sepolia' || chain === 'base_sepolia')) {
    rpcUrl = DEFAULT_RPC_URL;
  }
  if (!rpcUrl) {
    return NextResponse.json(
      { error: `RPC URL not configured for ${chain}. Set ${chainConfig.rpcEnvVar}` },
      { status: 500 }
    );
  }

  // Create viem public client
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(rpcUrl),
  });

  // Read reserve token address from the vault contract
  let reserveTokenAddress: Address;
  try {
    console.log(`[deposits/prepare] Reading reserveToken from vault ${contractAddress} on ${chain}`);
    reserveTokenAddress = await publicClient.readContract({
      address: contractAddress,
      abi: aiETHAbi,
      functionName: 'reserveToken',
    });
    console.log(`[deposits/prepare] Vault reserveToken: ${reserveTokenAddress}`);
  } catch (error) {
    console.error('[deposits/prepare] Failed to read reserveToken from vault:', error);
    return NextResponse.json(
      { error: `Failed to read reserve token from vault at ${contractAddress} on ${chain}. Is the contract deployed?` },
      { status: 500 }
    );
  }

  // Get or create wallet
  const wallet = await findOrCreateWallet(db, userId, walletAddress, chain);

  // Create pending deposit record with full tracking data
  const deposit = await createDeposit(db, {
    userId,
    walletId: wallet.id as UUID,
    amount,
    token,
    tokenAddress: reserveTokenAddress,
    vaultAddress: contractAddress,
    chain,
  });

  // Build transactions (checks allowance and returns approve tx if needed)
  const { approveTx, depositTx } = await prepareDepositTransactions(
    {
      contractAddress,
      userAddress: walletAddress,
      amount,
      chain,
      tokenAddress: reserveTokenAddress,
    },
    publicClient
  );

  // Simulate deposit tx
  const simulation = await simulateTx(depositTx);

  console.log(`[deposits/prepare] Built transactions:`, {
    approveTxTo: approveTx?.to,
    depositTxTo: depositTx.to,
    vaultAddress: contractAddress,
    reserveToken: reserveTokenAddress,
  });

  const response: DepositPrepareResponse = {
    depositId: deposit.id as UUID,
    approveTx,
    depositTx,
    simulation,
  };

  return NextResponse.json(response);
}
