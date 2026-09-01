-- RLS policy and constraint tests for the AI/content tables.
--
-- See supabase/tests/rls/identity.test.sql for the conventions these follow
-- (silent filtering for SELECT/UPDATE/DELETE, 42501 for a refused INSERT).

begin;
select plan(30);

select tests.clear_authentication();

create temporary table actors (name text primary key, id uuid not null);
insert into actors (name, id) values
  ('alice', tests.create_user('alice@test.local')),
  ('bob', tests.create_user('bob@test.local'));

create temporary table fixtures (name text primary key, id uuid not null);


-- ── RLS is actually switched on ──────────────────────────────────────────────

select ok(tests.rls_enabled('public', 'chat_sessions'), 'chat_sessions has RLS enabled');
select ok(tests.rls_enabled('public', 'chat_messages'), 'chat_messages has RLS enabled');
select ok(tests.rls_enabled('public', 'bookmarks'), 'bookmarks has RLS enabled');
select ok(tests.rls_enabled('public', 'quiz_progress'), 'quiz_progress has RLS enabled');
select ok(tests.rls_enabled('public', 'generated_media'), 'generated_media has RLS enabled');
select ok(tests.rls_enabled('public', 'ai_usage'), 'ai_usage has RLS enabled');


-- ── Fixtures owned by bob, created outside RLS ───────────────────────────────

insert into public.chat_sessions (user_id, title, sect, madhab)
values ((select id from actors where name = 'bob'), 'Bob''s session', 'Sunni', 'Maliki');

-- Captured in a second statement because `returning ... into` is plpgsql syntax
-- and this file is plain SQL.
insert into fixtures (name, id)
select 'bob_session', cs.id
from public.chat_sessions cs
where cs.user_id = (select id from actors where name = 'bob');

insert into public.chat_messages (session_id, user_id, role, content)
values (
  (select id from fixtures where name = 'bob_session'),
  (select id from actors where name = 'bob'),
  'user',
  'bob asked something private'
);


-- ── chat_sessions ────────────────────────────────────────────────────────────

select tests.authenticate_as((select id from actors where name = 'alice'));

select lives_ok(
  $$ insert into public.chat_sessions (user_id, title, sect, madhab)
     values (auth.uid(), 'Alice''s session', 'Shia', 'Usuli') $$,
  'alice can create a chat session for herself'
);

select throws_ok(
  format(
    $$ insert into public.chat_sessions (user_id, title, sect, madhab)
       values (%L, 'Forged', 'Sunni', 'Hanafi') $$,
    (select id from actors where name = 'bob')
  ),
  '42501'::text,
  null,
  'alice cannot create a chat session owned by bob'
);

select is_empty(
  $$ select 1 from public.chat_sessions where title = 'Bob''s session' $$,
  'alice cannot read bob''s chat session'
);

select is(
  (select count(*)::int from public.chat_sessions),
  1,
  'alice sees exactly one chat session — her own'
);


-- ── chat_messages, and the denormalised owner column ─────────────────────────

select lives_ok(
  $$ insert into public.chat_messages (session_id, user_id, role, content)
     values (
       (select cs.id from public.chat_sessions cs where cs.user_id = auth.uid()),
       auth.uid(),
       'user',
       'hello'
     ) $$,
  'alice can add a message to her own session'
);

-- The attack the app.enforce_message_owner() trigger exists to stop: pass a
-- session you do not own together with your own user_id. The foreign key check
-- runs as the table owner and so does not block it, and the WITH CHECK clause on
-- its own would be satisfied by the supplied user_id. The trigger overwrites
-- user_id with the session's real owner first, which is what turns this into a
-- policy violation.
select throws_ok(
  format(
    $$ insert into public.chat_messages (session_id, user_id, role, content)
       values (%L, auth.uid(), 'user', 'injected into bob''s thread') $$,
    (select id from fixtures where name = 'bob_session')
  ),
  '42501'::text,
  null,
  'alice cannot attach a message to bob''s session by supplying her own user_id'
);

select is_empty(
  $$ select 1 from public.chat_messages where content = 'bob asked something private' $$,
  'alice cannot read messages in bob''s session'
);

-- Each of the six metadata columns must hold a JSON array; types.ts maps over all
-- of them, and an object here would reach the UI as an unhandled shape.
select throws_ok(
  $$ insert into public.chat_messages (session_id, user_id, role, content, sources)
     values (
       (select cs.id from public.chat_sessions cs where cs.user_id = auth.uid()),
       auth.uid(),
       'assistant',
       'bad metadata',
       '{"not": "an array"}'::jsonb
     ) $$,
  '23514'::text,
  null,
  'a message rejects metadata that is not a JSON array'
);


-- ── bookmarks ────────────────────────────────────────────────────────────────

select lives_ok(
  $$ insert into public.bookmarks (user_id, session_id)
     values (auth.uid(), (select cs.id from public.chat_sessions cs where cs.user_id = auth.uid())) $$,
  'alice can bookmark her own session'
);

select throws_ok(
  $$ insert into public.bookmarks (user_id) values (auth.uid()) $$,
  '23514'::text,
  null,
  'a bookmark with no target is rejected'
);

select throws_ok(
  $$ insert into public.bookmarks (user_id, session_id, message_id)
     values (
       auth.uid(),
       (select cs.id from public.chat_sessions cs where cs.user_id = auth.uid()),
       (select cm.id from public.chat_messages cm where cm.user_id = auth.uid() limit 1)
     ) $$,
  '23514'::text,
  null,
  'a bookmark pointing at both a session and a message is rejected'
);

select tests.clear_authentication();
insert into public.bookmarks (user_id, session_id)
values (
  (select id from actors where name = 'bob'),
  (select id from fixtures where name = 'bob_session')
);

select tests.authenticate_as((select id from actors where name = 'alice'));

select is(
  (select count(*)::int from public.bookmarks),
  1,
  'alice sees only her own bookmark'
);


-- ── quiz_progress ────────────────────────────────────────────────────────────

select lives_ok(
  $$ insert into public.quiz_progress (user_id, xp, level, streak)
     values (auth.uid(), 120, 2, 3) $$,
  'alice can write her own progress'
);

select throws_ok(
  $$ update public.quiz_progress set xp = -1 where user_id = auth.uid() $$,
  '23514'::text,
  null,
  'negative XP is rejected'
);

select tests.clear_authentication();
insert into public.quiz_progress (user_id, xp) values ((select id from actors where name = 'bob'), 999);

select tests.authenticate_as((select id from actors where name = 'alice'));

select is_empty(
  $$ select 1 from public.quiz_progress where xp = 999 $$,
  'alice cannot read bob''s progress'
);


-- ── generated_media ──────────────────────────────────────────────────────────
--
-- Read and delete only for the owner. A row here records a billed provider call,
-- so a client that could insert one could claim media it never paid for.

select throws_ok(
  $$ insert into public.generated_media (user_id, kind) values (auth.uid(), 'image') $$,
  '42501'::text,
  null,
  'alice cannot insert a generated_media row — only the server may'
);

select tests.clear_authentication();

insert into public.generated_media (user_id, kind, status, storage_path)
values
  ((select id from actors where name = 'alice'), 'image', 'ready', 'alice/art.png'),
  ((select id from actors where name = 'bob'), 'video', 'ready', 'bob/clip.mp4');

select throws_ok(
  $$ insert into public.generated_media (user_id, kind, status)
     values ('00000000-0000-0000-0000-000000000000', 'image', 'ready') $$,
  '23514'::text,
  null,
  'a media row cannot be ready without a storage path'
);

select tests.authenticate_as((select id from actors where name = 'alice'));

select isnt_empty(
  $$ select 1 from public.generated_media where storage_path = 'alice/art.png' $$,
  'alice can read her own generated media'
);

select is_empty(
  $$ select 1 from public.generated_media where storage_path = 'bob/clip.mp4' $$,
  'alice cannot read bob''s generated media'
);

delete from public.generated_media where storage_path = 'bob/clip.mp4';

select tests.clear_authentication();
select is(
  (select count(*)::int from public.generated_media where storage_path = 'bob/clip.mp4'),
  1,
  'alice''s attempt to delete bob''s media removed nothing'
);

select tests.authenticate_as((select id from actors where name = 'alice'));
delete from public.generated_media where storage_path = 'alice/art.png';

select is(
  (select count(*)::int from public.generated_media),
  0,
  'alice can delete her own generated media'
);


-- ── ai_usage ─────────────────────────────────────────────────────────────────
--
-- Readable so the UI can show a quota, never writable: a client that could write
-- its own meter rows could also decline to, making every quota advisory.

select throws_ok(
  $$ insert into public.ai_usage (user_id, operation) values (auth.uid(), 'chat') $$,
  '42501'::text,
  null,
  'alice cannot write her own usage meter'
);

select tests.clear_authentication();
insert into public.ai_usage (user_id, operation, model) values
  ((select id from actors where name = 'alice'), 'chat', 'test-model'),
  ((select id from actors where name = 'bob'), 'video', 'test-model');

-- A guest row: metered by opaque session key, with no user at all.
insert into public.ai_usage (session_key, operation) values ('guest-hash', 'chat');

select tests.authenticate_as((select id from actors where name = 'alice'));

select is(
  (select count(*)::int from public.ai_usage),
  1,
  'alice sees only her own usage rows — not bob''s, and not guest rows'
);


-- ── Cascades ─────────────────────────────────────────────────────────────────

select tests.clear_authentication();
delete from public.chat_sessions where id = (select id from fixtures where name = 'bob_session');

select is(
  (select count(*)::int from public.chat_messages where content = 'bob asked something private'),
  0,
  'deleting a session removes its messages'
);

select is(
  (select count(*)::int
   from public.bookmarks b
   where b.session_id = (select id from fixtures where name = 'bob_session')),
  0,
  'deleting a session removes bookmarks pointing at it'
);


select * from finish();
rollback;
