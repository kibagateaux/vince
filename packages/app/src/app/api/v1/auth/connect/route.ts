/**
 * POST /api/v1/auth/connect
 * Initializes user session, creates user if needed
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import {
  findUserByWalletAddress,
  createUser,
  findOrCreateConversation,
  findOrCreateWallet,
} from '@bangui/db';
import type { AuthConnectRequest, AuthConnectResponse, UUID } from '@bangui/types';

export async function POST(request: NextRequest) {
  const db = getDb();
  const body: AuthConnectRequest = await request.json();
  const { platform, walletAddress } = body;

  let user = walletAddress
    ? await findUserByWalletAddress(db, walletAddress)
    : null;

  if (!user) {
    user = await createUser(db, {});
  }

  // Associate wallet with user so they can be found on future connections
  if (walletAddress) {
    await findOrCreateWallet(db, user.id as UUID, walletAddress, 'ethereum');
  }

  const conversation = await findOrCreateConversation(
    db,
    user.id as UUID,
    platform
  );

  const response: AuthConnectResponse = {
    sessionId: crypto.randomUUID(),
    userId: user.id as UUID,
    conversationId: conversation.id as UUID,
  };

  return NextResponse.json(response);
}
