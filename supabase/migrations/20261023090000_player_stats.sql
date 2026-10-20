-- Player stats, computed on the server from verified rounds only.
--
-- Verified rounds are written only by the submit-round edge function after it replays
-- the throws, and only for dates that were "today" somewhere on Earth at the time. So
-- streaks and stats built from them can't be faked by the client.

-- ------------------------------------------------------------------------------------------
-- The fewest darts that can finish each score (a double-out in at most three darts).
-- Used to count perfect checkouts. Built here from the board itself; a test checks it
-- against the game's checkout solver (src/game/checkout.ts) for every score.
-- ------------------------------------------------------------------------------------------

create table public.checkout_min_darts (
  score integer primary key,
  darts integer not null check (darts between 1 and 3)
);

comment on table public.checkout_min_darts is
  'Reference data: fewest darts to check out each finishable score (2-170, bogey numbers absent).';

insert into public.checkout_min_darts (score, darts)
with
  -- Every scoring dart: singles, doubles and trebles 1-20, outer bull 25, bullseye 50.
  board(points) as (
    select n * m from generate_series(1, 20) n, generate_series(1, 3) m
    union all select 25
    union all select 50
  ),
  -- Finishing darts: doubles 1-20 and the bullseye.
  doubles(points) as (
    select 2 * n from generate_series(1, 20) n
    union all select 50
  ),
  finishes(score, darts) as (
    select d.points, 1 from doubles d
    union all
    select a.points + d.points, 2 from board a, doubles d
    union all
    select a.points + b.points + d.points, 3 from board a, board b, doubles d
  )
select score, min(darts) from finishes where score <= 170 group by score;

alter table public.checkout_min_darts enable row level security;
create policy "Checkout reference data is readable by everyone"
  on public.checkout_min_darts for select
  to anon, authenticated
  using (true);
revoke all on public.checkout_min_darts from anon, authenticated;
grant select on public.checkout_min_darts to anon, authenticated;

-- ------------------------------------------------------------------------------------------
-- get_player_stats: the caller's own stats.
--
-- p_today: the player's local date, used only to decide whether their latest streak is
-- still alive (they played today or yesterday). It's clamped to the dates that are
-- "today" somewhere on Earth right now (UTC-12 to UTC+14), so passing an old date can't
-- revive a broken streak. Without it, the earliest such date is used (the lenient end).
--
-- Returns:
--   {
--     "rounds_played": 42,
--     "current_streak": 5,            -- consecutive days up to today or yesterday
--     "best_streak": 12,
--     "average_darts": 15.3,          -- null before the first round
--     "best_round": { "total_darts": 8, "puzzle_date": "2026-11-04" } | null,
--     "perfect_checkouts": 17,        -- targets finished in the fewest possible darts
--     "last_played": "2026-11-20" | null
--   }
--
-- SECURITY INVOKER: RLS applies; it reads only the caller's verified rounds (via the
-- unique (user_id, puzzle_date) index), never `inputs`.
-- ------------------------------------------------------------------------------------------

create function public.get_player_stats(p_today date default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
    mine as (
      select r.puzzle_date, r.total_darts, r.per_target
      from public.rounds r
      where r.verified and r.user_id = (select auth.uid())
    ),
    -- Consecutive dates share a group: date minus its position is constant along a run.
    runs as (
      select min(g.puzzle_date) as first_day, max(g.puzzle_date) as last_day, count(*)::int as days
      from (
        select m.puzzle_date,
               m.puzzle_date - (row_number() over (order by m.puzzle_date))::int as run
        from mine m
      ) g
      group by g.run
    ),
    today as (
      select least(
        greatest(coalesce(p_today, w.earliest), w.earliest),
        w.latest
      ) as day
      from (
        select (now() at time zone 'utc' - interval '12 hours')::date as earliest,
               (now() at time zone 'utc' + interval '14 hours')::date as latest
      ) w
    )
  select jsonb_build_object(
    'rounds_played', (select count(*) from mine),
    'current_streak', coalesce(
      (
        select r.days
        from runs r, today t
        where r.last_day >= t.day - 1
        order by r.last_day desc
        limit 1
      ),
      0
    ),
    'best_streak', coalesce((select max(r.days) from runs r), 0),
    'average_darts', (select round(avg(m.total_darts), 1) from mine m),
    'best_round', (
      select jsonb_build_object('total_darts', m.total_darts, 'puzzle_date', m.puzzle_date)
      from mine m
      order by m.total_darts, m.puzzle_date
      limit 1
    ),
    'perfect_checkouts', (
      select count(*)
      from mine m
      cross join lateral jsonb_array_elements(m.per_target) t(target)
      join public.checkout_min_darts c on c.score = (t.target ->> 'target')::int
      where t.target ->> 'outcome' = 'checkout'
        and (t.target ->> 'darts')::int = c.darts
    ),
    'last_played', (select max(m.puzzle_date) from mine m)
  )
$$;

comment on function public.get_player_stats(date) is
  'The caller''s streaks, average darts, best round and perfect checkouts, from verified rounds.';

revoke all on function public.get_player_stats(date) from public;
grant execute on function public.get_player_stats(date) to anon, authenticated;
