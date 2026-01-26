/**
 * @module @bangui/api/routes/stories
 * Investment stories/opportunities routes
 * @see {@link @bangui/types#Story}
 */

import { Hono } from 'hono';
import type { Db } from '@bangui/db';
import {
  getActiveStories,
  getStoriesByCauseCategories,
  getUserProfile,
} from '@bangui/db';
import type { UUID } from '@bangui/types';

/** Route context with database */
export interface StoriesContext {
  Variables: { db: Db };
}

/**
 * Creates stories routes
 * @returns Hono router with stories endpoints
 */
export const createStoriesRoutes = () => {
  const router = new Hono<StoriesContext>();

  /**
   * GET /api/v1/stories
   * Gets all active stories
   */
  router.get('/', async (c) => {
    const db = c.get('db');
    const limit = Number(c.req.query('limit')) || 20;
    const stories = await getActiveStories(db, limit);
    return c.json({ stories });
  });

  /**
   * GET /api/v1/stories/recommended/:userId
   * Gets stories recommended for user based on their profile
   */
  router.get('/recommended/:userId', async (c) => {
    const db = c.get('db');
    const userId = c.req.param('userId') as UUID;
    const limit = Number(c.req.query('limit')) || 5;

    const profile = await getUserProfile(db, userId);
    if (!profile || profile.causeAffinities.length === 0) {
      // Return general recommendations if no profile
      const stories = await getActiveStories(db, limit);
      return c.json({ stories, personalized: false });
    }

    // Get top cause categories
    const topCauses = profile.causeAffinities
      .sort((a, b) => Number(b.affinityScore) - Number(a.affinityScore))
      .slice(0, 3)
      .map((a) => a.causeCategory);

    const stories = await getStoriesByCauseCategories(db, topCauses, limit);

    return c.json({
      stories,
      personalized: true,
      matchedCauses: topCauses,
    });
  });

  return router;
};
