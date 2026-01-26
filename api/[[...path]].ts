/**
 * Vercel serverless function entry point for Hono API
 * Handles all /api/* routes
 */
import { handle } from 'hono/vercel';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createDb, type Db } from '@bangui/db';
import { createAuthRoutes } from '../packages/api/src/routes/auth.js';
import { createQuestionnaireRoutes } from '../packages/api/src/routes/questionnaire.js';
import { createDepositsRoutes } from '../packages/api/src/routes/deposits.js';
import { createStoriesRoutes } from '../packages/api/src/routes/stories.js';
import { createAdminRoutes } from '../packages/api/src/routes/admin.js';
import { createChatRoutes } from '../packages/api/src/routes/chat.js';
import type { Address } from '@bangui/types';

/** App context type */
type AppContext = {
  Variables: {
    db: Db;
    dafContractAddress: Address;
  };
};

// Lazy initialization for serverless - connection created once per cold start
let db: Db | null = null;

const getDb = (): Db => {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    db = createDb({
      connectionString: process.env.DATABASE_URL,
      maxConnections: 1, // Reduced for serverless
    });
  }
  return db;
};

const app = new Hono<AppContext>().basePath('/api');

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['*'],
    credentials: true,
  })
);

// Inject dependencies
app.use('*', async (c, next) => {
  c.set('db', getDb());
  c.set(
    'dafContractAddress',
    (process.env.DAF_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address
  );
  await next();
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// API routes
app.route('/v1/auth', createAuthRoutes());
app.route('/v1/questionnaire', createQuestionnaireRoutes());
app.route('/v1/deposits', createDepositsRoutes());
app.route('/v1/stories', createStoriesRoutes());
app.route('/v1/admin', createAdminRoutes());
app.route('/v1/chat', createChatRoutes());

// Export for Vercel
export default handle(app);
