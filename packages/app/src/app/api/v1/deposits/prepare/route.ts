/**
 * POST /api/v1/deposits/prepare
 * Prepares deposit transaction for user to sign
 * Returns approve tx (if needed) and deposit tx
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, type Chain as ViemChain } from 'viem';
import { mainnet, polygon, arbitrum, base } from 'viem/chains';
import {
  getSupabase,
  findOrCreateWallet,
  createDeposit,
} from '../../../../../lib/db';
import { prepareDepositTransactions, simulateTx } from '@bangui/agents';
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
};

export async function POST(request: NextRequest) {
  const db = getSupabase();
  const body: DepositPrepareRequest & { walletAddress: Address } = await request.json();
  const { userId, amount, token, chain, walletAddress } = body;

  // Validate required env vars
  const contractAddress = process.env.DAF_CONTRACT_ADDRESS as Address | undefined;
  if (!contractAddress) {
    return NextResponse.json(
      { error: 'DAF_CONTRACT_ADDRESS environment variable is not configured' },
      { status: 500 }
    );
  }

  // Get chain config and RPC URL
  const chainConfig = CHAIN_CONFIG[chain];
  if (!chainConfig) {
    return NextResponse.json(
      { error: `Unsupported chain: ${chain}` },
      { status: 400 }
    );
  }

  const rpcUrl = process.env[chainConfig.rpcEnvVar];
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
    reserveTokenAddress = await publicClient.readContract({
      address: contractAddress,
      abi: aiETHAbi,
      functionName: 'reserveToken',
    });
  } catch (error) {
    console.error('Failed to read reserveToken from vault:', error);
    return NextResponse.json(
      { error: 'Failed to read reserve token from vault contract. Is the contract deployed?' },
      { status: 500 }
    );
  }

  // Get or create wallet
  const wallet = await findOrCreateWallet(db, userId, walletAddress, chain);

  // Create pending deposit record
  const deposit = await createDeposit(db, {
    userId,
    walletId: wallet.id as UUID,
    amount,
    token,
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

  const response: DepositPrepareResponse = {
    depositId: deposit.id as UUID,
    approveTx,
    depositTx,
    simulation,
  };

  return NextResponse.json(response);
}
