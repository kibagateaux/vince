/**
 * @module @bangui/api/routes/auth
 * Authentication routes
 * @see {@link @bangui/types#AuthConnectRequest}
 */

import { Hono } from 'hono';
import type { Db } from '@bangui/db';
import {
  findUserByWalletAddress,
  createUser,
  findOrCreateConversation,
} from '@bangui/db';
import type {
  AuthConnectRequest,
  AuthConnectResponse,
  Platform,
  UUID,
  Address,
} from '@bangui/types';

/** Auth route context with database */
export interface AuthContext {
  Variables: { db: Db };
}

/**
 * Creates auth routes
 * @param db - Database instance
 * @returns Hono router with auth endpoints
 */
export const createAuthRoutes = () => {
  const router = new Hono<AuthContext>();

  /**
   * POST /api/v1/auth/connect
   * Initializes user session, creates user if needed
   */
  router.post('/connect', async (c) => {
    const db = c.get('db');
    const body = await c.req.json<AuthConnectRequest>();
    const { platform, walletAddress } = body;

    let user = walletAddress
      ? await findUserByWalletAddress(db, walletAddress)
      : null;

    if (!user) {
      user = await createUser(db, {});
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

    return c.json(response);
  });

  return router;
};
