/**
 * POST /api/v1/auth/connect
 * Initializes user session, creates user if needed
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabase,
  findUserByWalletAddress,
  createUser,
  findOrCreateConversation,
  findOrCreateWallet,
} from '../../../../../lib/db';
import type { AuthConnectRequest, AuthConnectResponse, UUID } from '@bangui/types';

export async function POST(request: NextRequest) {
  try {
    const db = getSupabase();
    const body: AuthConnectRequest = await request.json();
    const { platform, walletAddress } = body;

    console.log('[Auth Connect] Request:', { platform, walletAddress: walletAddress?.slice(0, 10) + '...' });

    let user = walletAddress
      ? await findUserByWalletAddress(db, walletAddress)
      : null;

    if (!user) {
      console.log('[Auth Connect] Creating new user');
      user = await createUser(db, {});
    } else {
      console.log('[Auth Connect] Found existing user:', user.id);
    }

    // Associate wallet with user so they can be found on future connections
    // Use 'base' as default - it exists in the DB enum and is the primary chain for the app
    if (walletAddress) {
      await findOrCreateWallet(db, user.id as UUID, walletAddress, 'base');
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

    console.log('[Auth Connect] Success:', { userId: response.userId, conversationId: response.conversationId });
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Auth Connect] Error:', error);
    // Better error serialization
    let details: string;
    if (error instanceof Error) {
      details = error.message;
    } else if (typeof error === 'object' && error !== null) {
      details = JSON.stringify(error, null, 2);
    } else {
      details = String(error);
    }
    return NextResponse.json(
      { error: 'Failed to connect', details },
      { status: 500 }
    );
  }
}
