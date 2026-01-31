/**
 * @module @bangui/app/lib/db/queries/conversations
 * Conversation-related database queries using Supabase
 */

import type { Db } from '../client';
import type {
  ConversationRow,
  ConversationInsert,
  Platform,
  ConversationState,
  PaginationParams,
} from '../types';

/**
 * Finds or creates a conversation for a user on a platform
 */
export const findOrCreateConversation = async (
  db: Db,
  userId: string,
  platform: Platform
): Promise<ConversationRow> => {
  // Try to find existing conversation
  const { data: existing, error: findError } = await db
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single();

  if (findError && findError.code !== 'PGRST116') {
    throw findError;
  }

  if (existing) {
    return existing;
  }

  // Create new conversation
  const insert: ConversationInsert = {
    user_id: userId,
    platform,
  };

  const { data: conversation, error: insertError } = await db
    .from('conversations')
    .insert(insert)
    .select()
    .single();

  if (insertError || !conversation) {
    throw insertError ?? new Error('Failed to create conversation');
  }

  return conversation;
};

/**
 * Updates conversation state
 */
export const updateConversationState = async (
  db: Db,
  id: string,
  state: ConversationState
): Promise<void> => {
  const { error } = await db
    .from('conversations')
    .update({
      state,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw error;
  }
};

/**
 * Gets conversation with current state
 */
export const getConversation = async (
  db: Db,
  id: string
): Promise<ConversationRow | null> => {
  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data;
};

/**
 * Gets all conversations with their user and messages
 */
export const getAllConversations = async (
  db: Db,
  pagination?: PaginationParams
): Promise<Array<ConversationRow & { user: unknown; messages: unknown[] }>> => {
  let query = db
    .from('conversations')
    .select(`
      *,
      user:users(*),
      messages(*)
    `)
    .order('last_message_at', { ascending: false });

  if (pagination) {
    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // Sort messages by sent_at
  return (data ?? []).map((conv) => ({
    ...conv,
    messages: (conv.messages ?? []).sort(
      (a: { sent_at: string }, b: { sent_at: string }) =>
        new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    ),
  }));
};

/**
 * Gets a single conversation with all messages for detailed view
 */
export const getConversationWithMessages = async (
  db: Db,
  conversationId: string
): Promise<(ConversationRow & { user: unknown; messages: unknown[] }) | null> => {
  const { data, error } = await db
    .from('conversations')
    .select(`
      *,
      user:users(
        *,
        profile:user_profiles(*),
        deposits(*)
      ),
      messages(*)
    `)
    .eq('id', conversationId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) return null;

  // Sort messages by sent_at
  return {
    ...data,
    messages: (data.messages ?? []).sort(
      (a: { sent_at: string }, b: { sent_at: string }) =>
        new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    ),
  };
};

/**
 * Gets total count of conversations
 */
export const getConversationsCount = async (db: Db): Promise<number> => {
  const { count, error } = await db
    .from('conversations')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw error;
  }
  return count ?? 0;
};
