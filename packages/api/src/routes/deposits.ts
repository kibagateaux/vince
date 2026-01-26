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
import { buildDepositTx, simulateTx, logDeposit, logTX, logDB, logTimed } from '@bangui/agent';
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
    const done = logTimed('DEPOSIT', '/deposits/prepare');

    const db = c.get('db');
    const contractAddress = c.get('dafContractAddress');
    const body = await c.req.json<DepositPrepareRequest & { walletAddress: Address }>();
    const { userId, amount, token, chain, walletAddress } = body;

    logDeposit.info('Deposit prepare request', {
      userId,
      amount,
      token,
      chain,
      walletPreview: walletAddress.substring(0, 10) + '...',
    });

    // Get or create wallet
    logDB.debug('Finding or creating wallet', { userId, chain });
    const wallet = await findOrCreateWallet(db, userId, walletAddress, chain);
    logDB.debug('Wallet ready', { walletId: wallet.id });

    // Create pending deposit record
    logDB.debug('Creating pending deposit record', { userId, amount, token });
    const deposit = await createDeposit(db, {
      userId,
      walletId: wallet.id as UUID,
      amount,
      token,
    });
    logDeposit.info('Deposit record created', { depositId: deposit.id, status: 'pending' });

    // Build transaction
    logTX.info('Building deposit transaction', { chain, amount });
    const tx = buildDepositTx({
      contractAddress,
      userAddress: walletAddress,
      amount,
      chain,
    });

    // Simulate
    logTX.info('Simulating transaction');
    const simulation = await simulateTx(tx);
    logTX.info('Simulation complete', {
      success: simulation.success,
      gasUsed: simulation.gasUsed,
      warnings: simulation.warnings,
    });

    const response: DepositPrepareResponse = {
      depositId: deposit.id as UUID,
      transaction: tx,
      simulation,
    };

    logDeposit.info('Deposit prepare complete', {
      depositId: deposit.id,
      simulationSuccess: simulation.success,
    });

    done();
    return c.json(response);
  });

  /**
   * POST /api/v1/deposits/confirm
   * Confirms deposit after transaction is mined
   */
  router.post('/confirm', async (c) => {
    const done = logTimed('DEPOSIT', '/deposits/confirm');

    const db = c.get('db');
    const body = await c.req.json<{ depositId: UUID; txHash: string }>();
    const { depositId, txHash } = body;

    logDeposit.info('Deposit confirm request', {
      depositId,
      txHashPreview: txHash.substring(0, 10) + '...',
    });

    await updateDepositStatus(db, depositId, 'confirmed', txHash);
    const deposit = await getDeposit(db, depositId);

    logDeposit.info('Deposit confirmed', {
      depositId,
      status: 'confirmed',
      txHash,
    });

    done();
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

    logDeposit.debug('Fetching deposit status', { depositId });

    const deposit = await getDeposit(db, depositId);
    if (!deposit) {
      logDeposit.warn('Deposit not found', { depositId });
      return c.json({ error: 'Deposit not found' }, 404);
    }

    logDeposit.debug('Deposit found', { depositId, status: deposit.status });
    return c.json(deposit);
  });

  return router;
};
