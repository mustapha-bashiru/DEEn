-- Storage buckets for user-supplied and AI-generated binaries.
--
-- Both are private. Nothing here is served from a public URL: delivery is by
-- short-lived signed URL issued by /api after it has checked ownership. A public
-- bucket would make every object world-readable to anyone who learns or guesses
-- its path, and these hold user chat attachments.
--
-- Path convention, relied on by every policy below: `<user_id>/<filename>`. The
-- first path segment is the owner, so `storage.foldername(name))[1]` is the
-- authorisation key. Objects that do not follow it are unreachable by design.
--
-- Deferred: the `verification-documents` bucket (organization ownership evidence)
-- and public `organization-media`. Both belong to step 5, which introduces the
-- organizations they hang off. The policy shape below is what they will copy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'ai-attachments',
    'ai-attachments',
    false,
    -- 10 MB. Gemini's inline attachment ceiling is well below this, and the
    -- browser has to base64 the file first, so a larger allowance would only let
    -- a request fail later and more expensively.
    10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf']
  ),
  (
    'generated-media',
    'generated-media',
    false,
    -- 100 MB, sized for Veo video output rather than images.
    104857600,
    array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'audio/mpeg', 'audio/webm']
  )
on conflict (id) do nothing;


-- ── ai-attachments ───────────────────────────────────────────────────────────
--
-- The user uploads these, so full own-prefix CRUD is correct. `bucket_id` is
-- checked in every clause: without it a policy written for one bucket authorises
-- the same path in every other bucket, because storage.objects is one table.

create policy ai_attachments_own_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ai-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy ai_attachments_own_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ai-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy ai_attachments_own_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'ai-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'ai-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy ai_attachments_own_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ai-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── generated-media ──────────────────────────────────────────────────────────
--
-- Read and delete only. There is deliberately no insert or update policy for
-- `authenticated`: an object here is the output of a billed provider call, so the
-- server function that made the call is the only thing that may write one. This
-- mirrors the policy set on public.generated_media, and the two need to stay in
-- agreement — a row without an object, or an object without a row, is orphaned.

create policy generated_media_own_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'generated-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy generated_media_own_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'generated-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
