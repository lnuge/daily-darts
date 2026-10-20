-- Verified rounds are public, but their throw inputs must not be. Replay is deterministic,
-- so anyone who could read the best round's inputs could submit them as their own for the
-- same day and tie the top score.
--
-- Players and visitors can read every column except `inputs`. The server (service role)
-- still reads and writes it, to replay rounds. Queries from the client must name their
-- columns: `select('*')` on rounds is refused.

revoke select on public.rounds from anon, authenticated;
grant select (id, user_id, puzzle_date, total_darts, per_target, verified, created_at)
  on public.rounds to anon, authenticated;
