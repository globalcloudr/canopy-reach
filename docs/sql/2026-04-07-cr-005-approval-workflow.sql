-- cr-005: Approval workflow for reach_posts
-- Adds review state fields to reach_posts.
-- Run in Supabase SQL editor.

alter table reach_posts
  add column if not exists review_note   text,
  add column if not exists reviewed_by   uuid references auth.users(id),
  add column if not exists reviewed_at   timestamptz;

-- New valid status values: 'pending_review', 'approved'
-- The status column is text, so no enum migration is needed.
-- Existing check constraint (if any) should be updated to include the new values.

comment on column reach_posts.review_note  is 'Optional rejection reason shown to the post author.';
comment on column reach_posts.reviewed_by  is 'User ID of the admin who approved or rejected the post.';
comment on column reach_posts.reviewed_at  is 'Timestamp of the approve/reject action.';
