-- Schema for the guest self-service manage link and the EazyDiner conflict
-- flag (docs/RESERVATIONS-PLAN.md P0 task 5). Only a sha256 hex digest of the
-- manage token is ever stored; the raw token is generated and sent to the
-- guest in P1 and is never persisted here.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS manage_token_hash TEXT UNIQUE NULL,
  ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attention_reason TEXT NULL;
