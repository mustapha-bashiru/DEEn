-- AI and content: the tables that hold what the assistant produced and what the
-- user kept.
--
-- These mirror the shapes already persisted in `localStorage` under `sebillink_*`
-- (see config/storage.ts and types.ts) because step 3 offers a one-time import of
-- that local data into the authenticated account. Where a client type and a column
-- disagree, the client type is noted so that import has an unambiguous target.
--
-- On jsonb: a message carries six arrays of model-produced metadata — sources,
-- attachments, suggestions, visuals, resources, article leads. They are written
-- once, never queried across, and always read with their message. Normalising
-- them would mean six tables and six joins to render one chat bubble, with no
-- query that benefits. They are jsonb.

create type app.message_role as enum ('user', 'assistant');
create type app.media_kind as enum ('image', 'video', 'live_session');
create type app.media_status as enum ('pending', 'ready', 'failed');

-- One value per billable call in services/geminiService.ts, plus the live voice
-- session. Step 4 enforces per-kind quotas, so the granularity here is what makes
-- "10 chats but only 2 videos" expressible.
create type app.ai_operation as enum (
  'chat',
  'briefing',
  'reverse_geocode',
  'quiz_generate',
  'quiz_grade',
  'quran_lookup',
  'daily_verse',
  'image',
  'video',
  'live_session'
);


-- ── chat_sessions ────────────────────────────────────────────────────────────

create table public.chat_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null default '',
  -- Captured per session rather than read from user_preferences at render time:
  -- the answers in an old session were shaped by the sect/madhab in force when it
  -- happened, and relabelling that history after a preference change would
  -- misrepresent what the assistant actually said.
  sect           app.sect not null,
  madhab         app.madhab not null,
  is_bookmarked  boolean not null default false,
  -- types.ts calls this `createdAt` and stores epoch millis; the API converts.
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint chat_sessions_title_length check (char_length(title) <= 200)
);

create index chat_sessions_user_created_idx
  on public.chat_sessions (user_id, created_at desc);

alter table public.chat_sessions enable row level security;

create policy chat_sessions_own_all
  on public.chat_sessions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function app.set_updated_at();


-- ── chat_messages ────────────────────────────────────────────────────────────

create table public.chat_messages (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.chat_sessions (id) on delete cascade,
  -- Denormalised from the parent session so that policies on this table do not
  -- need a subquery into chat_sessions to establish ownership. Kept honest by
  -- app.enforce_message_owner() below, not by trusting the client.
  user_id           uuid not null references auth.users (id) on delete cascade,
  role              app.message_role not null,
  content           text not null default '',
  is_bookmarked     boolean not null default false,
  is_news           boolean not null default false,
  is_legacy_lesson  boolean not null default false,

  -- Model-produced metadata. See the note at the top of this file.
  sources           jsonb not null default '[]'::jsonb,
  attachments       jsonb not null default '[]'::jsonb,
  suggestions       jsonb not null default '[]'::jsonb,
  visuals           jsonb not null default '[]'::jsonb,
  resources         jsonb not null default '[]'::jsonb,
  article_leads     jsonb not null default '[]'::jsonb,

  feedback_rating   text,
  feedback_comment  text,
  created_at        timestamptz not null default now(),

  constraint chat_messages_feedback_rating_valid check (
    feedback_rating is null or feedback_rating in ('up', 'down')
  ),
  -- Each of these is an array in types.ts. A bare object or string here would
  -- deserialise into something the UI cannot map over.
  constraint chat_messages_metadata_are_arrays check (
    jsonb_typeof(sources) = 'array'
    and jsonb_typeof(attachments) = 'array'
    and jsonb_typeof(suggestions) = 'array'
    and jsonb_typeof(visuals) = 'array'
    and jsonb_typeof(resources) = 'array'
    and jsonb_typeof(article_leads) = 'array'
  )
);

create index chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at);

-- Supports the bookmarks library, which lists saved messages across all sessions.
create index chat_messages_bookmarked_idx
  on public.chat_messages (user_id, created_at desc)
  where is_bookmarked;

alter table public.chat_messages enable row level security;

create policy chat_messages_own_all
  on public.chat_messages for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- `user_id` on this table is a performance denormalisation, and a denormalisation
-- the client supplies is a denormalisation the client can lie about: passing your
-- own user_id with someone else's session_id would satisfy the `with check` above
-- and attach a message to their conversation. This trigger derives the value from
-- the parent session instead of accepting it.
create or replace function app.enforce_message_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select cs.user_id into owner
  from public.chat_sessions cs
  where cs.id = new.session_id;

  if owner is null then
    raise exception 'chat session % does not exist', new.session_id
      using errcode = 'foreign_key_violation';
  end if;

  new.user_id := owner;
  return new;
end;
$$;

create trigger chat_messages_enforce_owner
  before insert or update on public.chat_messages
  for each row execute function app.enforce_message_owner();


-- ── bookmarks ────────────────────────────────────────────────────────────────

create table public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Exactly one target is set. Two nullable foreign keys with a check beats a
  -- (target_type, target_id) pair, which cannot be a foreign key at all and so
  -- leaves dangling rows behind every delete.
  session_id  uuid references public.chat_sessions (id) on delete cascade,
  message_id  uuid references public.chat_messages (id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now(),

  constraint bookmarks_exactly_one_target check (
    num_nonnulls(session_id, message_id) = 1
  )
);

comment on table public.bookmarks is
  'Unified bookmark index for the library view. The is_bookmarked flags on chat_sessions/chat_messages remain the fast per-row read; this table is what makes "everything I saved, newest first" one query.';

-- Partial unique indexes rather than a single unique constraint: a constraint over
-- (user_id, session_id, message_id) treats NULLs as distinct, so it would permit
-- the same message to be bookmarked repeatedly.
create unique index bookmarks_unique_session
  on public.bookmarks (user_id, session_id)
  where session_id is not null;

create unique index bookmarks_unique_message
  on public.bookmarks (user_id, message_id)
  where message_id is not null;

create index bookmarks_user_created_idx
  on public.bookmarks (user_id, created_at desc);

alter table public.bookmarks enable row level security;

create policy bookmarks_own_all
  on public.bookmarks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── quiz_progress ────────────────────────────────────────────────────────────

create table public.quiz_progress (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  xp                 integer not null default 0,
  level              integer not null default 1,
  streak             integer not null default 0,
  -- `date`, not `timestamptz`: types.ts holds these as strings compared with
  -- toDateString(), i.e. calendar days. Storing an instant would make "did they
  -- already do today's lesson?" depend on the reader's timezone.
  last_lesson_date   date,
  last_quiz_date     date,
  completed_quizzes  text[] not null default '{}',
  badges             text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint quiz_progress_xp_non_negative check (xp >= 0),
  constraint quiz_progress_level_positive check (level >= 1),
  constraint quiz_progress_streak_non_negative check (streak >= 0)
);

alter table public.quiz_progress enable row level security;

-- Writable by the owner for now, because XP is awarded client-side today. Step 4
-- moves grading behind /api, at which point the update policy should narrow to
-- the service role — otherwise a user can POST themselves any XP total. Tracked
-- as a known limitation rather than a silent one.
create policy quiz_progress_own_all
  on public.quiz_progress for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger quiz_progress_set_updated_at
  before update on public.quiz_progress
  for each row execute function app.set_updated_at();


-- ── generated_media ──────────────────────────────────────────────────────────

create table public.generated_media (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  kind             app.media_kind not null,
  status           app.media_status not null default 'pending',
  -- Path inside the private `generated-media` bucket. Null while a video job is
  -- still running: Veo returns an operation to poll, not bytes, so the row exists
  -- before the object does.
  storage_path     text,
  prompt           text,
  mime_type        text,
  byte_size        bigint,
  -- The provider operation name for async video jobs, so a poll after a page
  -- reload can find the work again instead of starting a second billable job.
  provider_job_id  text,
  -- Live-session transcripts (types.ts LiveTranscriptItem[]) live here.
  metadata         jsonb not null default '{}'::jsonb,
  error_message    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint generated_media_ready_has_object check (
    status <> 'ready' or storage_path is not null
  ),
  constraint generated_media_byte_size_positive check (
    byte_size is null or byte_size > 0
  )
);

create index generated_media_user_created_idx
  on public.generated_media (user_id, created_at desc);

create unique index generated_media_provider_job_id_key
  on public.generated_media (provider_job_id)
  where provider_job_id is not null;

alter table public.generated_media enable row level security;

-- Read and delete by the owner. Insert and update are absent on purpose: a row
-- here is the record of a billed provider call, so only the server function that
-- made the call may create one or move it to `ready`. A client that could insert
-- could fabricate media it never paid for.
create policy generated_media_own_read
  on public.generated_media for select to authenticated
  using (user_id = auth.uid());

create policy generated_media_own_delete
  on public.generated_media for delete to authenticated
  using (user_id = auth.uid());

create trigger generated_media_set_updated_at
  before update on public.generated_media
  for each row execute function app.set_updated_at();


-- ── ai_usage ─────────────────────────────────────────────────────────────────

create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  -- Null for guests, who are metered by session_key instead. The plan allows a
  -- small unauthenticated text allowance, so usage cannot require a user.
  user_id       uuid references auth.users (id) on delete cascade,
  -- An opaque per-guest identifier (hashed IP plus session token). Never a raw IP.
  session_key   text,
  operation     app.ai_operation not null,
  -- Config-driven and recorded per call, so a model change is visible in usage
  -- history rather than retroactively rewriting it.
  model         text,
  -- Nullable because not every Gemini response reports token counts, and a zero
  -- would be indistinguishable from "genuinely free".
  input_tokens  integer,
  output_tokens integer,
  succeeded     boolean not null default true,
  created_at    timestamptz not null default now(),

  -- No prompt, response, or attachment content column exists here, deliberately:
  -- the plan requires usage accounting without retaining prompt text in
  -- operational records.
  constraint ai_usage_has_a_subject check (
    user_id is not null or session_key is not null
  ),
  constraint ai_usage_tokens_non_negative check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
  )
);

comment on table public.ai_usage is
  'Append-only meter, one row per billable AI call. Contains no prompt or response content. Step 4 counts rows over a time window to enforce quotas.';

-- Both indexes are shaped for the same question asked two ways: "how many calls
-- of this kind has this subject made since <timestamp>?"
create index ai_usage_user_operation_created_idx
  on public.ai_usage (user_id, operation, created_at desc)
  where user_id is not null;

create index ai_usage_session_operation_created_idx
  on public.ai_usage (session_key, operation, created_at desc)
  where session_key is not null;

alter table public.ai_usage enable row level security;

-- Users may read their own meter, so the UI can show "3 of 5 videos used today".
-- There is no insert, update, or delete policy: a client that could write its own
-- usage rows could also decline to, which would make every quota advisory.
create policy ai_usage_own_read
  on public.ai_usage for select to authenticated
  using (user_id is not null and user_id = auth.uid());

create policy ai_usage_admin_read
  on public.ai_usage for select to authenticated
  using (app.is_admin());
