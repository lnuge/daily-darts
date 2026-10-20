-- Leaderboard for one puzzle date, as a single RPC call.
--
-- Returns:
--   {
--     "date": "2026-11-01",
--     "players": 1234,              -- verified rounds that day
--     "average_darts": 14.3,        -- null when nobody has played
--     "top": [ { "rank": 1, "display_name": "...", "total_darts": 7,
--                "finished_at": "...", "is_me": false }, ... ],   -- up to 100
--     "me": { "rank": 412, "display_name": "...", "total_darts": 15,
--             "finished_at": "..." } | null   -- the caller's own round, wherever it ranks
--   }
--
-- Ranking: fewest total darts, then earliest finish (when the server verified the
-- round), then id, so every rank is unique. Only verified rounds count.
--
-- SECURITY INVOKER: runs with the caller's own permissions, so RLS and the column
-- privileges still apply (verified rounds only; `inputs` is never read).
--
-- Speed: every part is served by rounds_leaderboard_idx (puzzle_date, total_darts,
-- created_at) where verified. The top list reads at most 100 index entries in order,
-- the caller's rank counts the entries ahead of them, and the stats read the day's
-- entries once. Nothing sorts the whole day.

create function public.get_leaderboard(p_date date, p_limit integer default 100)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
    -- Not materialized: each use below reads the index directly (the top list stops
    -- after 100 entries) instead of copying and sorting the whole day first.
    day as not materialized (
      select r.id, r.user_id, r.total_darts, r.created_at
      from public.rounds r
      where r.verified and r.puzzle_date = p_date
    ),
    top as (
      select d.id, d.user_id, d.total_darts, d.created_at
      from day d
      order by d.total_darts, d.created_at, d.id
      limit least(greatest(coalesce(p_limit, 100), 1), 100)
    ),
    mine as (
      select d.id, d.user_id, d.total_darts, d.created_at
      from day d
      where d.user_id = (select auth.uid())
    )
  select jsonb_build_object(
    'date', p_date,
    'players', (select count(*) from day),
    'average_darts', (select round(avg(d.total_darts), 1) from day d),
    'top', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'rank', t.rank,
            'display_name', p.display_name,
            'total_darts', t.total_darts,
            'finished_at', t.created_at,
            'is_me', t.user_id is not distinct from (select auth.uid())
          )
          order by t.rank
        )
        from (
          select top.*, row_number() over (order by top.total_darts, top.created_at, top.id) as rank
          from top
        ) t
        join public.profiles p on p.id = t.user_id
      ),
      '[]'::jsonb
    ),
    'me', (
      select jsonb_build_object(
        'rank', 1 + (
          select count(*)
          from day ahead
          where (ahead.total_darts, ahead.created_at, ahead.id)
              < (m.total_darts, m.created_at, m.id)
        ),
        'display_name', p.display_name,
        'total_darts', m.total_darts,
        'finished_at', m.created_at
      )
      from mine m
      join public.profiles p on p.id = m.user_id
    )
  )
$$;

comment on function public.get_leaderboard(date, integer) is
  'Top players (max 100), the caller''s own rank, and stats for one puzzle date.';

revoke all on function public.get_leaderboard(date, integer) from public;
grant execute on function public.get_leaderboard(date, integer) to anon, authenticated;
