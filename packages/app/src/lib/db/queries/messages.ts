/**
 * @module @bangui/app/lib/db/queries/messages
 * Message-related database queries using Supabase
 */

import type { Db } from '../client';
import type {
  MessageRow,
  MessageInsert,
  Sender,
  PaginationParams,
  Json,
} from '../types';

/**
 * Input for creating a message
 */
export interface CreateMessageInput {
  readonly conversationId: string;
  readonly sender: Sender;
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Creates a message and updates conversation timestamp
 */
export const createMessage = async (
  db: Db,
  input: CreateMessageInput
): Promise<MessageRow> => {
  const insert: MessageInsert = {
    conversation_id: input.conversationId,
    sender: input.sender,
    content: input.content,
    metadata: (input.metadata ?? null) as Json | null,
  };

  const { data: message, error: messageError } = await db
    .from('messages')
    .insert(insert)
    .select()
    .single();

  if (messageError || !message) {
    throw messageError ?? new Error('Failed to create message');
  }

  // Update conversation last_message_at
  const { error: updateError } = await db
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', input.conversationId);

  if (updateError) {
    console.error('Failed to update conversation timestamp:', updateError);
  }

  return message;
};

/**
 * Gets messages for a conversation with pagination
 */
export const getConversationMessages = async (
  db: Db,
  conversationId: string,
  pagination?: PaginationParams
): Promise<MessageRow[]> => {
  let query = db
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });

  if (pagination) {
    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
};
