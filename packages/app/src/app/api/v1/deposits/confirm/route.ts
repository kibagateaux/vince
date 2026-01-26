/**
 * POST /api/v1/deposits/confirm
 * Confirms deposit after transaction is mined
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import {
  updateDepositStatus,
  getDeposit,
} from '@bangui/db';
import type { UUID } from '@bangui/types';

export async function POST(request: NextRequest) {
  const db = getDb();
  const { depositId, txHash } = await request.json() as { depositId: UUID; txHash: string };

  await updateDepositStatus(db, depositId, 'confirmed', txHash);
  const deposit = await getDeposit(db, depositId);

  return NextResponse.json({
    success: true,
    deposit,
  });
}
