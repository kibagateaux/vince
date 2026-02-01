-- Add vault_address column to allocation_requests table
-- This stores the ERC4626 vault address that Kincho will use for the allocate() function
ALTER TABLE "public"."allocation_requests" ADD COLUMN "vault_address" varchar(42);
