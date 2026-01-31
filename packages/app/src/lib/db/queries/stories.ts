/**
 * @module @bangui/app/lib/db/queries/stories
 * Story-related database queries using Supabase
 */

import type { Db } from '../client';
import type { StoryRow } from '../types';

/**
 * Gets stories matching user's cause affinities
 */
export const getStoriesByCauseCategories = async (
  db: Db,
  causeCategories: readonly string[],
  limit = 10
): Promise<StoryRow[]> => {
  const { data, error } = await db
    .from('stories')
    .select('*')
    .eq('active', true)
    .in('cause_category', [...causeCategories])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
};

/**
 * Gets all active stories
 */
export const getActiveStories = async (
  db: Db,
  limit = 20
): Promise<StoryRow[]> => {
  const { data, error } = await db
    .from('stories')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
};
