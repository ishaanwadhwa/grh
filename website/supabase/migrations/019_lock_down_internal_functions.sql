-- Supabase's default privileges grant EXECUTE on every new public function to
-- anon and authenticated, so `REVOKE ... FROM PUBLIC` alone does not protect
-- internal helpers. upsert_guest (016) was callable via PostgREST by anyone
-- with the anon key, letting them overwrite any guest's name/email and set
-- whatsapp_opt_in = TRUE. Lock it and the trigger-only functions down.

REVOKE EXECUTE ON FUNCTION public.upsert_guest(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_default_booking_policy() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_guest_visit_counters() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_reservation_created_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_reservation_update_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_reservation_tables_assigned_event() FROM PUBLIC, anon, authenticated;

-- Secure by default from here on: functions created by later migrations are
-- NOT executable by anon/authenticated unless explicitly GRANTed. Every
-- public or staff RPC must carry its own GRANT EXECUTE (existing ones already do).
-- Per-schema defaults can only ADD to the global defaults, and the global
-- default grants EXECUTE to PUBLIC, so the PUBLIC revoke must be global.
-- Scoped to role postgres, which is the role migrations and the SQL editor run as.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
