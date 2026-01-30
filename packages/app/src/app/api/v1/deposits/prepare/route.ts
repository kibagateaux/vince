/**
 * POST /api/v1/deposits/prepare
 * Prepares deposit transaction for user to sign
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  findOrCreateWallet,
  createDeposit,
} from '../../../../../lib/db';
import { buildDepositTx, simulateTx } from '@bangui/agent';
import type {
  DepositPrepareRequest,
  DepositPrepareResponse,
  UUID,
  Address,
} from '@bangui/types';

export async function POST(request: NextRequest) {
  const db = getSupabase();
  const body: DepositPrepareRequest & { walletAddress: Address } = await request.json();
  const { userId, amount, token, chain, walletAddress } = body;

  const contractAddress = (process.env.DAF_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address;

  // Get or create wallet
  const wallet = await findOrCreateWallet(db, userId as string, walletAddress, chain);

  // Create pending deposit record
  const deposit = await createDeposit(db, {
    userId: userId as string,
    walletId: wallet.id,
    amount,
    token,
  });

  // Build transaction
  const tx = buildDepositTx({
    contractAddress,
    userAddress: walletAddress,
    amount,
    chain,
  });

  // Simulate
  const simulation = await simulateTx(tx);

  const response: DepositPrepareResponse = {
    depositId: deposit.id as UUID,
    transaction: tx,
    simulation,
  };

  return NextResponse.json(response);
}
