/**
 * @module @bangui/api
 * API server for Bangui DAF platform
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from monorepo root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDb, type Db } from '@bangui/db';
import { logSystem, logWS } from '@bangui/agent';
import { createAuthRoutes } from './routes/auth.js';
import { createQuestionnaireRoutes } from './routes/questionnaire.js';
import { createDepositsRoutes } from './routes/deposits.js';
import { createStoriesRoutes } from './routes/stories.js';
import { createAdminRoutes } from './routes/admin.js';
import { createChatServer } from './websocket/chat.js';
import type { Address } from '@bangui/types';

/** Server configuration */
export interface ServerConfig {
  /** PostgreSQL connection string */
  databaseUrl: string;
  /** DAF contract address */
  dafContractAddress: Address;
  /** Server port */
  port?: number;
  /** Allowed CORS origins */
  corsOrigins?: string[];
}

/** App context type */
type AppContext = {
  Variables: {
    db: Db;
    dafContractAddress: Address;
  };
};

/**
 * Creates and configures the API server
 * @param config - Server configuration
 * @returns Configured Hono app
 */
export const createApp = (config: ServerConfig) => {
  logSystem.info('Creating API application', {
    hasDatabaseUrl: !!config.databaseUrl,
    dafContractAddress: config.dafContractAddress?.substring(0, 10) + '...',
    corsOrigins: config.corsOrigins,
  });

  const db = createDb({ connectionString: config.databaseUrl });
  logSystem.info('Database connection created');

  const app = new Hono<AppContext>();

  // Middleware
  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: config.corsOrigins ?? ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
    })
  );

  // Inject dependencies
  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('dafContractAddress', config.dafContractAddress);
    await next();
  });

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // API routes
  logSystem.debug('Registering API routes');
  app.route('/api/v1/auth', createAuthRoutes());
  app.route('/api/v1/questionnaire', createQuestionnaireRoutes());
  app.route('/api/v1/deposits', createDepositsRoutes());
  app.route('/api/v1/stories', createStoriesRoutes());
  app.route('/api/v1/admin', createAdminRoutes());
  logSystem.debug('API routes registered');

  return { app, db };
};

/**
 * Starts the server
 * @param config - Server configuration
 */
export const startServer = (config: ServerConfig) => {
  logSystem.info('Starting Bangui API server', {
    port: config.port ?? 3001,
  });

  const { app, db } = createApp(config);
  const port = config.port ?? 3001;

  const server = serve({ fetch: app.fetch, port }, (info) => {
    logSystem.info('API server started', {
      url: `http://localhost:${info.port}`,
      port: info.port,
    });
    console.log(`API server running on http://localhost:${info.port}`);
  });

  // Set up WebSocket server
  logWS.info('Setting up WebSocket server');
  const wss = createChatServer({ db });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '', 'http://localhost');
    logWS.debug('WebSocket upgrade request', { pathname: url.pathname });
    if (url.pathname === '/ws/chat') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      logWS.debug('Rejected WebSocket upgrade - invalid path', { pathname: url.pathname });
      socket.destroy();
    }
  });

  logSystem.info('Server startup complete', { port });
  return server;
};

// Start server if run directly
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  const config: ServerConfig = {
    databaseUrl: process.env.DATABASE_URL!,
    dafContractAddress: (process.env.DAF_CONTRACT_ADDRESS ??
      '0x0000000000000000000000000000000000000000') as Address,
    port: Number(process.env.PORT) || 3001,
    corsOrigins: process.env.CORS_ORIGINS?.split(','),
  };

  if (!config.databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  startServer(config);
}

export { createChatServer } from './websocket/chat.js';
