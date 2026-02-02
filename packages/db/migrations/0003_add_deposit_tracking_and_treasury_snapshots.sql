-- Add additional tracking columns to deposits table
-- This stores complete transaction data for governance dashboard

-- Add vault_address to deposits (the ERC4626 vault that received the deposit)
ALTER TABLE "public"."deposits" ADD COLUMN IF NOT EXISTS "vault_address" varchar(42);

-- Add token_address to deposits (the ERC20 token contract address)
ALTER TABLE "public"."deposits" ADD COLUMN IF NOT EXISTS "token_address" varchar(42);

-- Add chain to deposits (denormalized from wallet for easier queries)
ALTER TABLE "public"."deposits" ADD COLUMN IF NOT EXISTS "chain" varchar(20);

-- Create treasury_snapshots table for historical tracking
CREATE TABLE IF NOT EXISTS "public"."treasury_snapshots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "vault_address" varchar(42) NOT NULL,
    "chain" varchar(20) NOT NULL,
    "total_assets" numeric NOT NULL,
    "total_shares" numeric NOT NULL,
    "asset_price_usd" numeric,
    "total_value_usd" numeric,
    "yield_earned" numeric DEFAULT 0,
    "apy_estimate" numeric,
    "depositor_count" integer DEFAULT 0,
    "snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
    "metadata" jsonb
);

-- Create index for efficient time-series queries
CREATE INDEX IF NOT EXISTS "treasury_snapshots_vault_time_idx"
ON "public"."treasury_snapshots" ("vault_address", "snapshot_at" DESC);

-- Create index for chain-based queries
CREATE INDEX IF NOT EXISTS "treasury_snapshots_chain_time_idx"
ON "public"."treasury_snapshots" ("chain", "snapshot_at" DESC);

-- Add index on deposits for governance queries
CREATE INDEX IF NOT EXISTS "deposits_status_time_idx"
ON "public"."deposits" ("status", "deposited_at" DESC);

CREATE INDEX IF NOT EXISTS "deposits_vault_idx"
ON "public"."deposits" ("vault_address");
