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
import { createAuthRoutes } from './routes/auth.js';
import { createQuestionnaireRoutes } from './routes/questionnaire.js';
import { createDepositsRoutes } from './routes/deposits.js';
import { createStoriesRoutes } from './routes/stories.js';
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
  const db = createDb({ connectionString: config.databaseUrl });
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
  app.route('/api/v1/auth', createAuthRoutes());
  app.route('/api/v1/questionnaire', createQuestionnaireRoutes());
  app.route('/api/v1/deposits', createDepositsRoutes());
  app.route('/api/v1/stories', createStoriesRoutes());

  return { app, db };
};

/**
 * Starts the server
 * @param config - Server configuration
 */
export const startServer = (config: ServerConfig) => {
  const { app, db } = createApp(config);
  const port = config.port ?? 3001;

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`API server running on http://localhost:${info.port}`);
  });

  // Set up WebSocket server
  const wss = createChatServer({ db });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '', 'http://localhost');
    if (url.pathname === '/ws/chat') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

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
