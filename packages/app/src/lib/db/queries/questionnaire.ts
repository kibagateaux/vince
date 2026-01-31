/**
 * @module @bangui/app/lib/db/queries/questionnaire
 * Questionnaire-related database queries using Supabase
 */

import type { Db } from '../client';
import type { QuestionnaireResponseRow, QuestionnaireResponseInsert, Json } from '../types';

/**
 * Input for saving a questionnaire response
 */
export interface SaveResponseInput {
  readonly userId: string;
  readonly questionId: string;
  readonly response: unknown;
  readonly responseTimeMs?: number;
}

/**
 * Saves a questionnaire response
 */
export const saveQuestionnaireResponse = async (
  db: Db,
  input: SaveResponseInput
): Promise<QuestionnaireResponseRow> => {
  const insert: QuestionnaireResponseInsert = {
    user_id: input.userId,
    question_id: input.questionId,
    response: input.response as Json,
    response_time_ms: input.responseTimeMs ?? null,
  };

  const { data, error } = await db
    .from('questionnaire_responses')
    .insert(insert)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to save questionnaire response');
  }

  return data;
};

/**
 * Gets all questionnaire responses for a user
 */
export const getQuestionnaireResponses = async (
  db: Db,
  userId: string
): Promise<QuestionnaireResponseRow[]> => {
  const { data, error } = await db
    .from('questionnaire_responses')
    .select('*')
    .eq('user_id', userId)
    .order('answered_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

/**
 * Gets set of answered question IDs for a user
 */
export const getQuestionnaireProgress = async (
  db: Db,
  userId: string
): Promise<Set<string>> => {
  const { data, error } = await db
    .from('questionnaire_responses')
    .select('question_id')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((r) => r.question_id));
};
