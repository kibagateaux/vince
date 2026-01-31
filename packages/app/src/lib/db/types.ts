/**
 * @module @bangui/app/lib/db/types
 * Supabase database type definitions
 * Generated schema types for type-safe database operations
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================================
// Enum Types
// ============================================================================

export type UserStatus = 'active' | 'inactive' | 'suspended';
export type Platform = 'web' | 'telegram' | 'discord';
export type Sender = 'user' | 'vince' | 'kincho' | 'system';
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';
export type DepositStatus = 'pending' | 'confirmed' | 'failed';
export type Chain = 'ethereum' | 'polygon' | 'arbitrum' | 'base';
export type Archetype =
  | 'impact_maximizer'
  | 'community_builder'
  | 'system_changer'
  | 'values_expresser'
  | 'legacy_creator'
  | 'opportunistic_giver';
export type ConversationState =
  | 'idle'
  | 'questionnaire_in_progress'
  | 'questionnaire_complete'
  | 'investment_suggestions'
  | 'deposit_intent'
  | 'deposit_pending'
  | 'deposit_confirmed';
export type AllocationStatus = 'pending' | 'processing' | 'approved' | 'modified' | 'rejected';
export type AllocationDecisionType = 'approved' | 'modified' | 'rejected';

// ============================================================================
// Database Schema Types
// ============================================================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          telegram_id: string | null;
          discord_id: string | null;
          created_at: string;
          last_active: string;
          status: UserStatus;
        };
        Insert: {
          id?: string;
          email?: string | null;
          telegram_id?: string | null;
          discord_id?: string | null;
          created_at?: string;
          last_active?: string;
          status?: UserStatus;
        };
        Update: {
          id?: string;
          email?: string | null;
          telegram_id?: string | null;
          discord_id?: string | null;
          created_at?: string;
          last_active?: string;
          status?: UserStatus;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          demographics: Json | null;
          location_data: Json | null;
          social_profiles: Json | null;
          risk_tolerance: RiskTolerance | null;
          estimated_net_worth: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          demographics?: Json | null;
          location_data?: Json | null;
          social_profiles?: Json | null;
          risk_tolerance?: RiskTolerance | null;
          estimated_net_worth?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          demographics?: Json | null;
          location_data?: Json | null;
          social_profiles?: Json | null;
          risk_tolerance?: RiskTolerance | null;
          estimated_net_worth?: string | null;
          updated_at?: string;
        };
      };
      questionnaire_responses: {
        Row: {
          id: string;
          user_id: string;
          question_id: string;
          response: Json;
          answered_at: string;
          response_time_ms: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          question_id: string;
          response: Json;
          answered_at?: string;
          response_time_ms?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          question_id?: string;
          response?: Json;
          answered_at?: string;
          response_time_ms?: number | null;
        };
      };
      archetype_scores: {
        Row: {
          id: string;
          profile_id: string;
          archetype: Archetype;
          score: string;
          confidence: string | null;
          calculated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          archetype: Archetype;
          score: string;
          confidence?: string | null;
          calculated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          archetype?: Archetype;
          score?: string;
          confidence?: string | null;
          calculated_at?: string;
        };
      };
      cause_affinities: {
        Row: {
          id: string;
          profile_id: string;
          cause_category: string;
          affinity_score: string;
          reasoning: Json | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          cause_category: string;
          affinity_score: string;
          reasoning?: Json | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          cause_category?: string;
          affinity_score?: string;
          reasoning?: Json | null;
        };
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          address: string;
          chain: Chain;
          is_primary: boolean;
          onchain_analysis: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          address: string;
          chain: Chain;
          is_primary?: boolean;
          onchain_analysis?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          address?: string;
          chain?: Chain;
          is_primary?: boolean;
          onchain_analysis?: Json | null;
        };
      };
      deposits: {
        Row: {
          id: string;
          user_id: string;
          wallet_id: string;
          tx_hash: string | null;
          amount: string;
          token: string;
          deposited_at: string | null;
          status: DepositStatus;
        };
        Insert: {
          id?: string;
          user_id: string;
          wallet_id: string;
          tx_hash?: string | null;
          amount: string;
          token: string;
          deposited_at?: string | null;
          status?: DepositStatus;
        };
        Update: {
          id?: string;
          user_id?: string;
          wallet_id?: string;
          tx_hash?: string | null;
          amount?: string;
          token?: string;
          deposited_at?: string | null;
          status?: DepositStatus;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          platform: Platform;
          platform_thread_id: string | null;
          state: ConversationState;
          started_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          platform: Platform;
          platform_thread_id?: string | null;
          state?: ConversationState;
          started_at?: string;
          last_message_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          platform?: Platform;
          platform_thread_id?: string | null;
          state?: ConversationState;
          started_at?: string;
          last_message_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender: Sender;
          content: string;
          metadata: Json | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender: Sender;
          content: string;
          metadata?: Json | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender?: Sender;
          content?: string;
          metadata?: Json | null;
          sent_at?: string;
        };
      };
      stories: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          cause_category: string;
          impact_metrics: Json | null;
          min_investment: string | null;
          risk_level: RiskTolerance | null;
          created_at: string;
          active: boolean;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          cause_category: string;
          impact_metrics?: Json | null;
          min_investment?: string | null;
          risk_level?: RiskTolerance | null;
          created_at?: string;
          active?: boolean;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          cause_category?: string;
          impact_metrics?: Json | null;
          min_investment?: string | null;
          risk_level?: RiskTolerance | null;
          created_at?: string;
          active?: boolean;
        };
      };
      allocation_requests: {
        Row: {
          id: string;
          deposit_id: string | null;
          user_id: string;
          conversation_id: string | null;
          amount: string;
          user_preferences: Json;
          vince_recommendation: Json;
          status: AllocationStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          deposit_id?: string | null;
          user_id: string;
          conversation_id?: string | null;
          amount: string;
          user_preferences: Json;
          vince_recommendation: Json;
          status?: AllocationStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          deposit_id?: string | null;
          user_id?: string;
          conversation_id?: string | null;
          amount?: string;
          user_preferences?: Json;
          vince_recommendation?: Json;
          status?: AllocationStatus;
          created_at?: string;
        };
      };
      allocation_decisions: {
        Row: {
          id: string;
          request_id: string;
          decision: AllocationDecisionType;
          allocations: Json | null;
          kincho_analysis: Json;
          confidence: string;
          reasoning: string;
          human_override_required: boolean;
          decided_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          decision: AllocationDecisionType;
          allocations?: Json | null;
          kincho_analysis: Json;
          confidence: string;
          reasoning: string;
          human_override_required?: boolean;
          decided_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          decision?: AllocationDecisionType;
          allocations?: Json | null;
          kincho_analysis?: Json;
          confidence?: string;
          reasoning?: string;
          human_override_required?: boolean;
          decided_at?: string;
        };
      };
      agent_conversations: {
        Row: {
          id: string;
          allocation_request_id: string;
          started_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          allocation_request_id: string;
          started_at?: string;
          last_message_at?: string;
        };
        Update: {
          id?: string;
          allocation_request_id?: string;
          started_at?: string;
          last_message_at?: string;
        };
      };
      agent_messages: {
        Row: {
          id: string;
          agent_conversation_id: string;
          sender: Sender;
          content: string;
          metadata: Json | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          agent_conversation_id: string;
          sender: Sender;
          content: string;
          metadata?: Json | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          agent_conversation_id?: string;
          sender?: Sender;
          content?: string;
          metadata?: Json | null;
          sent_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      user_status: UserStatus;
      platform: Platform;
      sender: Sender;
      risk_tolerance: RiskTolerance;
      deposit_status: DepositStatus;
      chain: Chain;
      archetype: Archetype;
      conversation_state: ConversationState;
      allocation_status: AllocationStatus;
      allocation_decision: AllocationDecisionType;
    };
  };
}

// ============================================================================
// Helper Types for Query Results
// ============================================================================

/** User row type */
export type UserRow = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];

/** User profile row type */
export type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];

/** Questionnaire response row type */
export type QuestionnaireResponseRow = Database['public']['Tables']['questionnaire_responses']['Row'];
export type QuestionnaireResponseInsert = Database['public']['Tables']['questionnaire_responses']['Insert'];

/** Archetype score row type */
export type ArchetypeScoreRow = Database['public']['Tables']['archetype_scores']['Row'];
export type ArchetypeScoreInsert = Database['public']['Tables']['archetype_scores']['Insert'];

/** Cause affinity row type */
export type CauseAffinityRow = Database['public']['Tables']['cause_affinities']['Row'];
export type CauseAffinityInsert = Database['public']['Tables']['cause_affinities']['Insert'];

/** Wallet row type */
export type WalletRow = Database['public']['Tables']['wallets']['Row'];
export type WalletInsert = Database['public']['Tables']['wallets']['Insert'];

/** Deposit row type */
export type DepositRow = Database['public']['Tables']['deposits']['Row'];
export type DepositInsert = Database['public']['Tables']['deposits']['Insert'];

/** Conversation row type */
export type ConversationRow = Database['public']['Tables']['conversations']['Row'];
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];

/** Message row type */
export type MessageRow = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

/** Story row type */
export type StoryRow = Database['public']['Tables']['stories']['Row'];
export type StoryInsert = Database['public']['Tables']['stories']['Insert'];

/** Allocation request row type */
export type AllocationRequestRow = Database['public']['Tables']['allocation_requests']['Row'];
export type AllocationRequestInsert = Database['public']['Tables']['allocation_requests']['Insert'];

/** Allocation decision row type */
export type AllocationDecisionRow = Database['public']['Tables']['allocation_decisions']['Row'];
export type AllocationDecisionInsert = Database['public']['Tables']['allocation_decisions']['Insert'];

/** Agent conversation row type */
export type AgentConversationRow = Database['public']['Tables']['agent_conversations']['Row'];
export type AgentConversationInsert = Database['public']['Tables']['agent_conversations']['Insert'];

/** Agent message row type */
export type AgentMessageRow = Database['public']['Tables']['agent_messages']['Row'];
export type AgentMessageInsert = Database['public']['Tables']['agent_messages']['Insert'];

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginationParams {
  readonly limit: number;
  readonly offset: number;
}
