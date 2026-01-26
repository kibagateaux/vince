/**
 * @module @bangui/api/routes/deposits
 * Deposit preparation and confirmation routes
 * @see {@link @bangui/types#DepositPrepareRequest}
 */

import { Hono } from 'hono';
import type { Db } from '@bangui/db';
import {
  findOrCreateWallet,
  createDeposit,
  updateDepositStatus,
  getDeposit,
} from '@bangui/db';
import { buildDepositTx, simulateTx } from '@bangui/agent';
import type {
  DepositPrepareRequest,
  DepositPrepareResponse,
  UUID,
  Address,
  BigIntString,
} from '@bangui/types';

/** Route context with database */
export interface DepositsContext {
  Variables: {
    db: Db;
    dafContractAddress: Address;
  };
}

/**
 * Creates deposit routes
 * @returns Hono router with deposit endpoints
 */
export const createDepositsRoutes = () => {
  const router = new Hono<DepositsContext>();

  /**
   * POST /api/v1/deposits/prepare
   * Prepares deposit transaction for user to sign
   */
  router.post('/prepare', async (c) => {
    const db = c.get('db');
    const contractAddress = c.get('dafContractAddress');
    const body = await c.req.json<DepositPrepareRequest & { walletAddress: Address }>();
    const { userId, amount, token, chain, walletAddress } = body;

    // Get or create wallet
    const wallet = await findOrCreateWallet(db, userId, walletAddress, chain);

    // Create pending deposit record
    const deposit = await createDeposit(db, {
      userId,
      walletId: wallet.id as UUID,
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

    return c.json(response);
  });

  /**
   * POST /api/v1/deposits/confirm
   * Confirms deposit after transaction is mined
   */
  router.post('/confirm', async (c) => {
    const db = c.get('db');
    const body = await c.req.json<{ depositId: UUID; txHash: string }>();
    const { depositId, txHash } = body;

    await updateDepositStatus(db, depositId, 'confirmed', txHash);
    const deposit = await getDeposit(db, depositId);

    return c.json({
      success: true,
      deposit,
    });
  });

  /**
   * GET /api/v1/deposits/:depositId
   * Gets deposit status
   */
  router.get('/:depositId', async (c) => {
    const db = c.get('db');
    const depositId = c.req.param('depositId') as UUID;

    const deposit = await getDeposit(db, depositId);
    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404);
    }

    return c.json(deposit);
  });

  return router;
};
