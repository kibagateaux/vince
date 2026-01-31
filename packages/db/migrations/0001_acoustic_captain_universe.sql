CREATE TYPE "public"."allocation_decision" AS ENUM('approved', 'modified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."allocation_status" AS ENUM('pending', 'processing', 'approved', 'modified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."memory_type" AS ENUM('allocation_decision', 'user_preference', 'risk_assessment', 'negotiation_history', 'clarification', 'escalation');--> statement-breakpoint
ALTER TYPE "public"."chain" ADD VALUE 'base';--> statement-breakpoint
ALTER TYPE "public"."sender" ADD VALUE 'kincho' BEFORE 'system';--> statement-breakpoint
CREATE TABLE "agent_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allocation_request_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar(50) NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"allocation_request_id" uuid,
	"content" text NOT NULL,
	"memory_type" "memory_type" NOT NULL,
	"importance" numeric DEFAULT '0.5',
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_conversation_id" uuid NOT NULL,
	"sender" "sender" NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"decision" "allocation_decision" NOT NULL,
	"allocations" jsonb,
	"kincho_analysis" jsonb NOT NULL,
	"confidence" numeric NOT NULL,
	"reasoning" text NOT NULL,
	"human_override_required" boolean DEFAULT false NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_decisions_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "allocation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deposit_id" uuid,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"amount" numeric NOT NULL,
	"user_preferences" jsonb NOT NULL,
	"vince_recommendation" jsonb NOT NULL,
	"status" "allocation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_allocation_request_id_allocation_requests_id_fk" FOREIGN KEY ("allocation_request_id") REFERENCES "public"."allocation_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_allocation_request_id_allocation_requests_id_fk" FOREIGN KEY ("allocation_request_id") REFERENCES "public"."allocation_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_agent_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("agent_conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_decisions" ADD CONSTRAINT "allocation_decisions_request_id_allocation_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."allocation_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_requests" ADD CONSTRAINT "allocation_requests_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_requests" ADD CONSTRAINT "allocation_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_requests" ADD CONSTRAINT "allocation_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;