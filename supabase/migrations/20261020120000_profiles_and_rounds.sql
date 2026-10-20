-- Daily Darts: player profiles and rounds, with Row Level Security.
--
-- Security model
-- * Anyone, signed in or not, can read profiles and verified rounds (the leaderboard).
-- * Signed-in players, including anonymous guests, can insert rounds for themselves only.
--   Column privileges let them write the round's data but never `verified`, `id` or
--   `created_at`, so a client can't mark its own round verified or backdate it to win a
--   tie-break. Only the server (service role), after replaying the inputs, verifies rounds.
-- * Players can read their own rounds, verified or not.
-- * Nobody but the server can update or delete rounds.
-- * Players can change their display name and nothing else about their profile.

-- ------------------------------------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    constraint profiles_display_name_length check (char_length(display_name) between 1 and 24)
    constraint profiles_display_name_trimmed check (display_name = btrim(display_name)),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per player (guest or signed in). Created automatically on sign-up.';

alter table public.profiles enable row level security;

create policy "Profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Players can create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Players can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Table privileges (RLS decides which rows; these decide which columns).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Every new user, guest or Google, gets a profile with a neutral name. Names from Google
-- are deliberately not used, so nobody's real name lands on a public leaderboard unasked.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Player ' || upper(left(replace(new.id::text, '-', ''), 6)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------------------------------
-- rounds
-- ------------------------------------------------------------------------------------------

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  puzzle_date date not null,
  -- The round's throw inputs: [{ "lockX": 812, "lockY": 1460 }, ...], one per dart.
  inputs jsonb not null
    constraint rounds_inputs_is_array check (jsonb_typeof(inputs) = 'array'),
  -- 3 targets, each 1 to 30 darts.
  total_darts integer not null
    constraint rounds_total_darts_range check (total_darts between 3 and 90),
  -- Per target: [{ "target": 55, "darts": 2, "outcome": "checkout" }, ...]
  per_target jsonb not null
    constraint rounds_per_target_shape check (
      jsonb_typeof(per_target) = 'array' and jsonb_array_length(per_target) = 3
    ),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint rounds_one_per_player_per_day unique (user_id, puzzle_date),
  constraint rounds_inputs_match_darts check (jsonb_array_length(inputs) = total_darts)
);

comment on table public.rounds is
  'One ranked round per player per day. Only rounds verified by server-side replay are public.';
comment on column public.rounds.verified is
  'Set only by the server after replaying inputs. Clients cannot write this column.';

-- Today's leaderboard: fewest darts, then earliest finish.
create index rounds_leaderboard_idx
  on public.rounds (puzzle_date, total_darts, created_at)
  where verified;

alter table public.rounds enable row level security;

create policy "Verified rounds are readable by everyone"
  on public.rounds for select
  to anon, authenticated
  using (verified);

create policy "Players can read their own rounds"
  on public.rounds for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players can insert their own unverified rounds"
  on public.rounds for insert
  to authenticated
  with check ((select auth.uid()) = user_id and verified = false);

-- No update or delete policies: only the service role (which bypasses RLS) can change rows.
revoke all on public.rounds from anon, authenticated;
grant select on public.rounds to anon, authenticated;
grant insert (user_id, puzzle_date, inputs, total_darts, per_target)
  on public.rounds to authenticated;
