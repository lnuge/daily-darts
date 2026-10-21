-- Usernames: players choose the name shown on the leaderboard.
--
-- * A username is 3-20 letters (A-Z), numbers or underscores. ASCII only, so nobody can
--   copy someone's name with look-alike letters.
-- * Unique ignoring case: "Bob" and "BOB" can't both exist.
-- * Generated names ("Player 3F9A1C") contain a space, which a username can't, so a
--   username never looks like one. Generated names aren't unique (6 hex digits repeat
--   once there are thousands of players) and don't need to be.
-- * Players change their name only through set_username(), which checks it and returns
--   a clear error. The direct column update from the first migration is revoked, so the
--   rules can't be skipped. The server (service role) can still rename anyone, e.g. to
--   remove an offensive name.

revoke update (display_name) on public.profiles from authenticated;
drop policy "Players can update their own profile" on public.profiles;

-- Every name is either generated or a valid username. `not valid` skips checking rows
-- that already exist, so this can't fail on a name set before usernames existed; every
-- new or changed name is checked.
alter table public.profiles
  add constraint profiles_display_name_format check (
    display_name ~ '^Player [0-9A-F]{6}$' or display_name ~ '^[A-Za-z0-9_]{3,20}$'
  ) not valid;

create unique index profiles_username_key
  on public.profiles (lower(display_name))
  where display_name !~ ' ';

-- Sets the caller's username and returns it. Errors (the message is the code):
--   not_signed_in, username_invalid, username_reserved, username_taken.
create function public.set_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_username, ''));
  v_lower text := lower(btrim(coalesce(p_username, '')));
  v_rows integer;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  if v_name !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'username_invalid' using errcode = '22023';
  end if;

  -- Names that could pass for the game, its staff, or a generated name.
  if v_lower in (
       'admin', 'administrator', 'anonymous', 'guest', 'help', 'mod', 'moderator',
       'null', 'official', 'player', 'root', 'staff', 'support', 'system', 'undefined', 'you'
     )
     or v_lower like '%dailydarts%'
     or v_lower like '%daily\_darts%'
     or v_lower ~ '^player_?[0-9a-f]{6}$' then
    raise exception 'username_reserved' using errcode = '22023';
  end if;

  begin
    update public.profiles set display_name = v_name where id = v_uid;
    get diagnostics v_rows = row_count;
  exception when unique_violation then
    raise exception 'username_taken' using errcode = '23505';
  end;

  if v_rows = 0 then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return v_name;
end;
$$;

revoke execute on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;
