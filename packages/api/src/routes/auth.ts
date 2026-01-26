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
  findOrCreateWallet,
} from '@bangui/db';
import { logAuth, logUser, logTimed } from '@bangui/agent';
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
    const done = logTimed('AUTH', '/auth/connect');

    const db = c.get('db');
    const body = await c.req.json<AuthConnectRequest>();
    const { platform, walletAddress } = body;

    logAuth.info('Auth connect request', {
      platform,
      hasWallet: !!walletAddress,
      walletPreview: walletAddress ? walletAddress.substring(0, 10) + '...' : null,
    });

    let user = walletAddress
      ? await findUserByWalletAddress(db, walletAddress)
      : null;

    const isNewUser = !user;
    if (!user) {
      logUser.info('Creating new user');
      user = await createUser(db, {});
    } else {
      logUser.debug('Found existing user', { userId: user.id });
    }

    // Associate wallet with user so they can be found on future connections
    if (walletAddress) {
      logAuth.debug('Associating wallet with user', {
        userId: user.id,
        walletPreview: walletAddress.substring(0, 10) + '...',
      });
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

    logAuth.info('Auth connect successful', {
      userId: user.id,
      conversationId: conversation.id,
      isNewUser,
      platform,
    });

    done();
    return c.json(response);
  });

  return router;
};
