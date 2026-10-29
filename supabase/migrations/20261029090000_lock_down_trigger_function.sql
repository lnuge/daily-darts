-- handle_new_user() runs as a trigger when Supabase Auth creates a user, with the
-- function owner's rights (security definer) so it can write the profile. Nobody needs
-- to call it directly, but new functions get EXECUTE for everyone by default, which
-- Supabase's security advisor flags. Calling it outside a trigger only errors, so this is
-- tidying rather than closing a hole: the trigger keeps working, because Postgres checks
-- EXECUTE when a trigger is created, not each time it fires.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
