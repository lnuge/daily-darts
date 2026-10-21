-- Swear-word filter for usernames.
--
-- * The words live in public.username_blocklist, so new ones can be added from the
--   dashboard (Table Editor) without a migration. Players can't read or change it.
-- * Two kinds of entry:
--     anywhere = true   blocked inside any name ("xFUCKx"). Only for words that don't
--                       turn up inside ordinary words.
--     anywhere = false  blocked only as a whole word: the whole name, or a part of it
--                       between underscores, digits or a capital ("big_ass", "BigAss",
--                       "ass99"), so "class", "Bass_Player" and "Cockburn" are fine.
-- * Disguises it sees through: capitals, extra repeated letters ("fuuuck", "asss"),
--   underscores between letters (anywhere words: "f_u_c_k") and digits for letters
--   (0=o, 1=i or l, 3=e, 4=a, 5=s, 7=t, 8=b). Repeats only count extra: "boob" needs
--   two o's, so "bob" is fine.
-- * No filter is perfect: someone determined will find a spelling it misses, and the
--   odd innocent name gets caught. Rename offenders from the dashboard (see
--   docs/supabase-setup.md) and add the word here.
-- * set_username() refuses a blocked name with `username_reserved` ("That username
--   isn't allowed"), the same as names like "admin". Names set before this migration
--   aren't changed; docs/supabase-setup.md has a query to find any that are now blocked.

create table public.username_blocklist (
  word text primary key
    constraint username_blocklist_word_format check (word ~ '^[a-z]{2,}$'),
  anywhere boolean not null
);

comment on table public.username_blocklist is
  'Words not allowed in usernames. anywhere = true: blocked inside any name; false: only as a whole word.';

alter table public.username_blocklist enable row level security;
revoke all on public.username_blocklist from anon, authenticated;

insert into public.username_blocklist (word, anywhere) values
  -- Blocked anywhere in a name.
  ('fuck', true), ('fck', true), ('shit', true), ('cunt', true),
  ('bitch', true), ('bastard', true), ('asshole', true), ('arsehole', true),
  ('dickhead', true), ('cocksuck', true), ('motherfuck', true), ('wanker', true),
  ('twat', true), ('bollock', true), ('bellend', true), ('pussy', true), ('whore', true),
  ('slut', true), ('skank', true), ('penis', true), ('vagina', true), ('dildo', true),
  ('jizz', true), ('blowjob', true), ('handjob', true), ('cumshot', true), ('porn', true),
  ('boob', true), ('piss', true), ('jerkoff', true), ('molest', true),
  ('nigger', true), ('nigga', true), ('faggot', true), ('retard', true), ('tranny', true),
  ('wetback', true), ('hitler', true),
  -- Blocked only as a whole word (they turn up inside ordinary words).
  ('ass', false), ('arse', false), ('anal', false), ('anus', false), ('cum', false),
  ('tit', false), ('tits', false), ('sex', false), ('dick', false), ('cock', false),
  ('prick', false), ('knob', false), ('shag', false), ('crap', false), ('rape', false),
  ('hoe', false), ('thot', false), ('slag', false), ('fag', false), ('dyke', false),
  ('spic', false), ('chink', false), ('coon', false), ('gook', false), ('kike', false),
  ('negro', false), ('nazi', false), ('heil', false), ('pedo', false), ('paedo', false),
  ('nonce', false), ('milf', false), ('wank', false), ('rapist', false), ('kkk', false);

-- True if a name contains a blocked word. Internal: called by set_username, and by the
-- query in docs/supabase-setup.md.
create function public.username_is_blocked(p_name text)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  -- "BigAss99" -> "big_ass99": a capital after a lower-case letter or digit starts a word.
  v_split text := lower(regexp_replace(coalesce(p_name, ''), '([a-z0-9])([A-Z])', '\1_\2', 'g'));
  v_forms text[] := array[
    v_split,
    translate(v_split, '0134578', 'oieastb'),
    translate(v_split, '0134578', 'oleastb')
  ];
begin
  return exists (
    select 1
    from public.username_blocklist b
    -- "ass" -> 'a+s+s+': the word, with any letter repeated more times.
    cross join lateral (select regexp_replace(b.word, '(.)', '\1+', 'g') as pattern) w
    cross join unnest(v_forms) f
    where case
      when b.anywhere then replace(f, '_', '') ~ w.pattern
      else exists (
        select 1
        from unnest(regexp_split_to_array(f, '[_0-9]+')) part
        where part ~ ('^' || w.pattern || '$')
      )
    end
  );
end;
$$;

revoke execute on function public.username_is_blocked(text) from public, anon, authenticated;

-- Same as in 20261024090000_usernames.sql, plus the blocklist check.
create or replace function public.set_username(p_username text)
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

  -- Names that could pass for the game, its staff, or a generated name; and swear words.
  if v_lower in (
       'admin', 'administrator', 'anonymous', 'guest', 'help', 'mod', 'moderator',
       'null', 'official', 'player', 'root', 'staff', 'support', 'system', 'undefined', 'you'
     )
     or v_lower like '%dailydarts%'
     or v_lower like '%daily\_darts%'
     or v_lower ~ '^player_?[0-9a-f]{6}$'
     or public.username_is_blocked(v_name) then
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
