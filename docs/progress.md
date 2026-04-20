# Canopy Reach — Progress and Current Work

Append new sessions at the top. Do not overwrite history.

---

## 2026-04-19 — Shared shell frame and app font ownership moved into @canopy/ui

- Updated Reach to `@canopy/ui` v0.1.10
- Replaced the repo-local outer shell frame with shared `@canopy/ui` primitives:
  - `AppShellFrame`
  - `AppShellSidebar`
  - `AppShellContent`
- Removed local Canopy app font loading from `app/layout.tsx`
- Reach now imports `canopyFontVariables` from `@canopy/ui`, so the core app font stack is owned by the shared package

### Verification

- `npm run build` passed
- `package-lock.json` now resolves `@canopy/ui` to `vendor/canopy-ui-0.1.10.tgz`

## 2026-04-08 — Media library, template management, UX simplification, per-platform preview, post duplication

### Media library and template management (Milestone 3)
- `/media` page — grid browse, filename search with offset pagination, image preview dialog, upload, delete with confirmation
- `searchMedia()` and `deleteMedia()` added to data layer; delete cleans up storage files
- `DELETE /api/media/[id]` with `upload_media` capability check and audit logging
- `/templates` page — create, edit, delete templates with `manage_templates` capability (owner/admin)
- `updateTemplate()` added to data layer; `POST /api/templates`, `PUT/DELETE /api/templates/[id]` with audit logging
- Media and Templates added to sidebar navigation

### UX simplification
- **Sidebar consolidated**: primary nav (Dashboard, Calendar, New Post, Review) always visible; Media, Templates, Accounts, Guidelines, Settings grouped in collapsible "Manage" section
- **Pending review badge**: amber count on Review nav item, fetched automatically on workspace load
- **Composer reworked**: templates promoted to visible card grid at top; media section collapsed by default; guidelines panel added to composer sidebar; static publishing guidance card removed
- **Calendar simplified**: 6 filter tabs → 3 (Upcoming, Published, Drafts) with inline count badges; client-side filtering from single fetch

### Per-platform preview
- Generic composer preview replaced with platform-specific mock-ups
- Facebook: text first, full-width image below
- Instagram: square-crop image first (placeholder if missing), caption below, missing-image warning
- LinkedIn: 140-char fold with "see more" truncation
- Tab switcher when multiple platforms selected; per-platform character-over warnings
- Preview card always visible in sidebar with prompt when no platform is selected

### Post duplication
- "Duplicate post" button on post detail page (any post status, requires `canCreatePosts`)
- Navigates to `/posts/new?body=...&platforms=...&mediaId=...`
- Composer reads query params on mount and pre-fills body, platform toggles, and media selection

### Verification
- `npx tsc --noEmit` passed

---

## 2026-04-07 — Approved post publish flow + real engagement analytics

### Approved post publish flow

Previously, posts that reached `approved` status had no UI path to actually publish them. Admins could approve but then nothing could push the post live.

- **New `POST /api/posts/[id]/publish`** (`app/api/posts/[id]/publish/route.ts`) — publishes an `approved` post immediately to all its platforms. Replicates the "post now" dispatch loop from the create route: Facebook via `publishToPage`, LinkedIn via `publishToOrganization`, Instagram via `publishToInstagram`. Updates the post to `published` with `publishResults`, `externalPostId`, and `publishedAt`. Requires `create_posts` capability. Instagram still requires an image (returns 400 if no media).
- **Post detail page** (`app/posts/[id]/page.tsx`) updated:
  - `approved` posts now show a **"Publish now"** primary button (calls the new endpoint with a confirm dialog, then reloads the post)
  - **"Edit / reschedule"** secondary button also shown — admin can open the editor and save as `scheduled` to put the post on the calendar instead of publishing immediately
  - Status description for `approved` updated to mention these two paths
- Status flow now fully connected: `pending_review → approved → published` (publish now) or `approved → scheduled → published` (via edit + cron)

### Real engagement analytics

- **`lib/facebook-client.ts`** — added `getPostInsights(postId, accessToken)`: calls `GET /{postId}/insights?metric=post_impressions,post_reactions_by_type_total,post_comments,post_shares`. Sums all reaction types for the likes figure. Returns `PostInsights | null` (null if metrics not yet available).
- **`lib/instagram-client.ts`** — added `getMediaInsights(mediaId, accessToken)`: fetches `impressions` from the Insights API (`period=lifetime`) and `like_count`/`comments_count` from the media object fields (more reliable than insight metrics for engagement). Shares always 0 — Instagram does not expose organic share counts via API. Returns `MediaInsights | null`.
- **`GET /api/posts/[id]`** updated: for published posts with `publishResults`, fetches real analytics from each platform using stored `postId` and the workspace's integration access tokens. Sums across platforms so multi-platform posts show combined totals. Returns `analytics: null` if no data is available yet (fresh post, platform hasn't processed metrics, or no `publishResults` on the record).

### Verification
- `npx tsc --noEmit` passed

---

## 2026-04-07 — Approval workflow + LinkedIn/Instagram integrations

### LinkedIn and Instagram
- Added `lib/linkedin-client.ts` — OAuth, organization lookup, Posts API publishing with image upload
- Added `lib/instagram-client.ts` — Facebook-linked OAuth, IG business account discovery, two-step container publishing
- Added `/api/integrations/connect/linkedin` and `/api/integrations/connect/instagram` OAuth callbacks
- Updated `/api/integrations/oauth-url` to generate OAuth URLs for LinkedIn and Instagram
- Updated `/api/posts` and `/api/cron/publish-scheduled` to publish to LinkedIn and Instagram
- Updated connect page — LinkedIn and Instagram now show "Connect" buttons (not "Coming soon")
- Instagram uses Facebook OAuth with Instagram scopes; falls back to Facebook app credentials if no dedicated IG credentials set
- LinkedIn Community Management API review is pending; connection flow is wired and ready

### Approval workflow
- New post statuses: `pending_review`, `approved`
- `staff` and `social_media` roles now route "post now" and "schedule" actions to `pending_review` instead of publishing directly
- Owners and admins bypass review and publish directly as before
- New `review_posts` capability added to permissions model (owner/admin only)
- New `canReviewPosts` flag added to client access model
- New API routes: `POST /api/posts/[id]/approve` and `POST /api/posts/[id]/reject`
- On approve: post moves to `approved` (no scheduledAt) or `scheduled` (scheduledAt preserved)
- On reject: post returns to `draft` with optional reviewer note shown to author
- New `/review` page — review queue for admins with approve/reject inline actions
- Review nav item added to sidebar
- Dashboard shows pending review count card for admins (amber highlight when posts are waiting)
- Calendar updated with `pending_review` and `approved` filter tabs and status badges
- Composer relabels "Publish now" → "Submit for review" and "Schedule" → "Submit for review (scheduled)" for staff roles
- Post detail shows approve/reject buttons for admins, reviewer note for rejected drafts, editing locked during review
- Edit page blocks editing when post is in `pending_review`
- SQL migration: `docs/sql/2026-04-07-cr-005-approval-workflow.sql`

### Verification
- `npx tsc --noEmit` passed

---

## 2026-04-06 — Bumped to @canopy/ui v0.1.4

- Updated `@canopy/ui` from v0.1.3 → v0.1.4
- Copied `canopy-ui-0.1.4.tgz` to `vendor/` and ran `npm install`
- New in v0.1.4: `Alert` component with `info`, `success`, `error`, `warning` variants
- `npx tsc --noEmit` passes clean

---

## 2026-04-03 — Super admin workspace redirect

- `ReachShell` now detects when a platform operator loads any page without `?workspace=` in the URL and immediately redirects to add it
- Ensures server-side data queries are always scoped to the correct workspace from first render
- School users are excluded — they only have one workspace and are protected by RLS
- Mirrors the same fix applied to Canopy Stories on the same date
- Reach's data layer was already safe (all queries require an explicit `workspaceId` parameter), so this is a UX consistency fix rather than a data leak patch

### Verification
- `npx tsc --noEmit` passed

---

## 2026-04-02 — Beta security hardening

Pre-beta security review and hardening pass. Reach changes:

### Cron secret enforcement
- Fixed bypass where `CRON_SECRET` env var being unset caused the auth check to be skipped entirely
- Endpoint now returns `500` if `CRON_SECRET` is not configured, and `401` if the header doesn't match
- File: `app/api/cron/publish-scheduled/route.ts`

### Facebook OAuth callback workspace authorization
- Added `requireWorkspaceCapability(request, workspaceId, "manage_integrations")` check after parsing the signed OAuth state
- Previously the callback trusted the workspace ID in the state without verifying the user had access to it
- File: `app/api/integrations/connect/facebook/route.ts`

### Facebook OAuth callback error hardening
- Error message in redirect URL now only uses `err.message` for `RouteAuthError` (intentional user-facing messages); all other errors redirect with a generic "Connection failed." message
- Removed `console.log` calls that logged Facebook API responses (pages, permissions) in production

### Error message sanitization
- Fixed `toErrorResponse` in `lib/server-auth.ts` — non-auth errors now return the fallback message instead of `err.message`, and log the full error server-side
- This covers all routes that use `toErrorResponse`

### Verification
- `npx tsc --noEmit` passed

---

## 2026-04-02 — Reach workspace-context and entitlement gating stabilization

- Fixed Reach's app session so platform operators only see workspaces where `reach_canopy` is actually enabled
- Tightened the in-app workspace gate so a Super Admin cannot quietly keep using Reach inside a school that lacks Reach entitlement
- Updated launcher-product resolution to merge entitlement rows across `organization_id`, `org_id`, and `workspace_id` instead of stopping on the first legacy column that returned data
- Added a shared workspace-href helper and applied it to dashboard, calendar, composer, post detail, edit, and settings links so internal navigation preserves `?workspace=<slug>`
- This specifically fixes Super Admin flows like `New Post`, `Open`, `Edit`, `Cancel`, and `Back to calendar` jumping back to the first workspace

### Verification
- `npm run build` passed in `canopy-reach`
- `git diff --check` passed in `canopy-reach`

---

## 2026-04-02 — Private media bucket and signed URL hardening

- Replaced Reach's public media URL model with signed URLs generated from stored bucket/path metadata
- `lib/reach-data.ts` now signs uploaded media on read instead of using `getPublicUrl()`
- `/api/media/upload` now ensures the `reach-media` bucket is private and updates older public bucket config on first upload after deploy
- Composer, edit, recent-media, and post-detail flows continue to use the same API shape while receiving signed URLs under the hood

### Verification
- `npm run build` passed in `canopy-reach`

---

## 2026-04-01 — Switcher stabilization and shared UI bundle refresh

- Replaced the brittle cross-site fetch-based switcher flow with Portal-managed form POST handoffs
- Reach now switches products through Portal `POST /auth/product-launch`
- Reach now returns to Portal through `POST /auth/portal-return`
- Refreshed Reach's vendored `@canopy/ui` bundle to `0.1.1` so `CanopyHeader` supports callback-driven Portal actions
- Verified Reach builds cleanly against the refreshed bundle after the switcher changes

### Verification
- `npm run build` passed in `canopy-reach`

---

## 2026-03-31 — Launch/session hardening and docs refresh

- Replaced the old raw token-hash launch pattern with a one-time handoff exchange from Portal
- Added `/api/auth/exchange-handoff` so Reach can exchange a short-lived launch code server-side before setting the Supabase session
- Added `/api/app-session` as the server-backed source of truth for:
  - current user identity
  - active workspace
  - accessible workspaces
  - platform-operator detection
- Updated `ReachShell` to load app context from the server session endpoint instead of rediscovering workspace from mixed client-side fallbacks
- Hardened scheduled publishing so posts are not marked `published` when no integration actually sends them
- Updated docs to remove stale token-handoff and localStorage-first workspace language

### Verification
- `npm run build` passed in:
  - `canopy-reach`
  - `canopy-platform/apps/portal`

### Next active milestone
- Milestone 3 — Composer and media library
- Milestone 4 — PhotoVault bridge

---

## 2026-03-31 — Shared UI primitives and doc cleanup

- Added shared Reach-compatible shell primitives to `@canopy/ui`:
  - `AppSurface`
  - `AppPill`
- Moved the new lighter shell/surface/pill styling direction into the shared UI package so Reach and Stories can inherit the same visual language
- Refreshed Reach's vendored `@canopy/ui` bundle and reinstalled it so the new shared exports are available in-app
- Updated `README.md` to reflect:
  - Milestones 1 and 2 complete
  - the current Facebook-first product surface
  - the current lighter UI direction
  - the vendored shared UI refresh workflow
- Cleaned `docs/progress.md` so open items focus only on still-active work

### Verification
- `npm run build` passed in:
  - `canopy-reach`
  - `canopy-stories`
  - `canopy-platform/apps/portal`

### Next active milestone
- Milestone 3 — Composer and media library
- Milestone 4 — PhotoVault bridge

---

## 2026-03-31 — Milestone 2 complete: media foundation

- Completed Milestone 2 from `docs/roadmap.md`
- Added `reach_media` as the first-class workspace media model
- Added SQL migration `cr-004` to create `reach_media`, add `reach_posts.media_id`, and backfill legacy `media_url` records
- Updated uploads so `/api/media/upload` creates media records instead of only returning a URL
- Added `GET /api/media` to return recent workspace media
- Refactored posts so `media_id` is now the canonical media reference in application code
- Normalized pasted image URLs into media records for consistency with uploaded assets
- Updated compose and edit flows to show recent workspace media for reuse

### Verification
- `npm run build` passed in `canopy-reach`

### Next active milestone
- Milestone 3 — Composer and media library
- Milestone 4 — PhotoVault bridge

---

## 2026-03-31 — Milestone 1 complete: tenant, roles, invites, and audit foundation

- Completed Milestone 1 from `docs/roadmap.md`
- Kept Reach at a strict workspace boundary for connected accounts and publishing permissions
- Simplified Reach role handling around the actual Portal-supported `social_media` role
- Added Canopy Portal support for `social_media` in workspace role assignment
- Added a Portal workspace invitation flow for owner/admin users on the account page
- Updated Portal invitation APIs so workspace owners/admins can create and resend invitations without platform-operator-only access
- Added audit logging foundation in both Reach and Portal for:
  - workspace invitations
  - Reach social account connection/disconnection
  - Reach post creation, edits, deletes, and publish actions
  - Reach media uploads
- Updated the legacy PhotoVault super-admin UI to direct school invitation management toward Canopy Portal

### Verification
- `npm run build` passed in:
  - `canopy-reach`
  - `canopy-platform/apps/portal`
  - `photovault`

### Next active milestone
- Milestone 3 — Composer and media library
- Milestone 4 — PhotoVault bridge

---

## 2026-03-31 — Roadmap and milestone planning documented

- Added `docs/roadmap.md` as the planning reference for future agents and contributors
- Documented the milestone board:
  - Tenant and access foundation
  - Reach media foundation
  - Composer and media library
  - PhotoVault bridge
  - Publishing workflow maturity
  - Analytics and reporting
- Captured the current architectural direction:
  - workspace as tenant boundary
  - one active social account per platform per workspace
  - workspace-scoped media and storage
  - Portal-owned role and invitation management over time
- Added issue-bucket mapping and implementation notes for future work

---

## 2026-03-31 — Workspace permissions, editing, and direct upload

- Added server-enforced workspace capability checks for post creation, editing, deletion, media upload, and integration management
- Added shared Reach permission model with support for future roles such as `social_media`
- Restricted connected social account management to higher-trust workspace users
- Added scheduled/draft post editing via `/posts/[id]/edit` and `PATCH /api/posts/[id]`
- Added direct image upload via `/api/media/upload` with workspace-scoped storage paths
- Updated Facebook publishing so posts with images publish as photo posts rather than text-only posts
- Confirmed business-managed Facebook Page connection works when `business_management` is requested

### Architectural follow-up now planned
- Add `reach_media` as the canonical workspace media model
- Move posts from raw `mediaUrl` values to media-record references
- Add `social_media` role assignment in Canopy Portal
- Move school invitation ownership to Canopy Portal
- Prepare the PhotoVault bridge on top of the media model

---

## 2026-03-31 — Naming cleanup for direct Facebook architecture

- Removed stale third-party scheduling references from docs and setup files
- Renamed publish metadata in code and schema docs from legacy vendor-specific names to generic names:
  `external_account_id`, `external_post_id`, and `publish_results`
- Added follow-up SQL migration `cr-003` to rename publish columns on existing databases
- `.env.local.example`, `README.md`, `CLAUDE.md`, and `docs/PRD.md` now reflect the Facebook-first implementation

---

## 2026-03-30 — Deployment fix and Facebook connection confirmed working

- Vercel GitHub webhook was broken from initial setup (SSH→HTTPS remote switch)
- Pushes were silently ignored; redeployments kept packaging old code
- Fixed by: reconnecting repo in Vercel Settings → Git, then deploying via Vercel CLI (`npx vercel --prod`)
- Cron schedule changed from hourly (`0 * * * *`) to daily at 9am (`0 9 * * *`) — Vercel Hobby plan only allows daily crons
- Facebook connection flow confirmed working end-to-end
- **Deployment note**: use `npx vercel --prod` from the repo if the GitHub webhook ever breaks again

---

## 2026-03-30 — Phase 4: Direct Facebook integration

### What changed
- Removed the legacy scheduling dependency — replaced with direct Meta Graph API
- New `lib/facebook-client.ts` — OAuth token exchange, page listing, publishing via Graph API
- New `/api/integrations/connect/facebook` — OAuth callback: exchanges code, gets long-lived token, fetches pages, stores page ID + page access token in DB
- Updated `/api/integrations/oauth-url` — returns Facebook OAuth URL directly
- Updated `/api/posts` — "post now" calls Facebook Graph API directly; "schedule" saves to DB for cron
- New `/api/cron/publish-scheduled` — publishes due scheduled posts, secured by CRON_SECRET
- New `vercel.json` — hourly cron schedule (`0 * * * *`)
- New SQL migration `cr-002` — aligns `reach_integrations` naming and adds `access_token`
- Updated connect page — direct redirect OAuth flow, "Coming soon" badges for LinkedIn/X, success/error param handling
- Deleted the old social backend wrapper

### New env vars
- `FACEBOOK_APP_ID` — from Meta Developer Portal
- `FACEBOOK_APP_SECRET` — from Meta Developer Portal
- `NEXT_PUBLIC_APP_URL` — app base URL for OAuth redirect URI
- `CRON_SECRET` — optional secret to secure the cron endpoint

### Architecture decisions
- One Facebook Page per workspace (MVP — page selection UI is a future phase)
- Page access tokens are non-expiring; stored in `reach_integrations.access_token`
- Scheduled post publishing runs hourly via Vercel cron (upgrade to pro for sub-hourly)
- LinkedIn and X marked "Coming soon" in the connect UI — direct API integration to follow

---

## 2026-03-30 — Phase 3 complete

### Pages and API routes built

**API routes:**
- `GET/POST /api/posts` — list posts with status/date filters; create handles draft, schedule, and post now
- `GET/DELETE /api/posts/[id]` — detail fetches post data for published posts; delete removes the DB record
- `GET /api/integrations` — list workspace's connected social accounts
- `DELETE /api/integrations/[id]` — remove integration from DB
- `GET /api/integrations/oauth-url?platform=...` — returns the platform OAuth URL
- `POST /api/integrations/sync` — compatibility endpoint retained as a no-op
- `GET/POST /api/guidelines` — read and upsert guidelines for workspace
- `GET /api/templates` — list templates for workspace

**Pages:**
- `/` — Dashboard: scheduled count, published-this-month count, connected accounts, next scheduled post preview, no-accounts warning card
- `/calendar` — Post list with all/scheduled/published/draft filter tabs, grouped by date, click through to detail
- `/posts/new` — Composer: platform checkboxes (only connected platforms shown), body textarea with per-platform character limit counter, template quick-apply, media URL input with preview, post now/schedule/draft toggle, datetime picker for schedule
- `/posts/[id]` — Post detail: content, platforms, status, timestamps, engagement stats (impressions/likes/comments/shares) for published posts
- `/connect` — Platform cards with connected status; Connect button starts direct OAuth; Disconnect removes from DB
- `/guidelines` — Staff sees read-only view; operators see edit button with textarea
- `/settings` — Workspace name, slug, current user email

**Key decisions:**
- Post composer shows empty state with link to `/connect` if no accounts are connected
- Guidelines edit is gated to operators (super_admin or platform_staff) only
- Media at MVP is URL-based
- Analytics are currently a placeholder for future direct platform support

---

## 2026-03-30 — Phase 1 + Phase 2 complete

### Phase 1 — App scaffold

- Created `canopy-reach` repo structure following the canopy-stories pattern
- `package.json` — Next.js 16, React 19, TypeScript, Tailwind v4, @canopy/ui vendored
- `app/layout.tsx` — root layout with Suspense
- `app/globals.css` — Tailwind v4 + @canopy/ui styles
- `next.config.ts` — transpilePackages for @canopy/ui
- `tsconfig.json` — same compiler options as canopy-stories
- `.nvmrc` — Node 20
- `.env.local.example`
- `vendor/canopy-ui-0.1.0.tgz` — copied from canopy-stories
- `lib/supabase-client.ts` — lazy singleton Supabase client
- `app/_components/reach-shell.tsx` — full app shell: later hardened to use Portal launch exchange plus a server-backed app session endpoint for workspace context
- Nav items: Dashboard, Calendar, New Post, Accounts, Guidelines, Settings
- `app/page.tsx` — dashboard placeholder
- `CLAUDE.md`, `README.md`, `docs/PRD.md`, `docs/progress.md`

### Phase 2 — Data layer

- `docs/sql/2026-03-30-cr-001-core-schema.sql` — four tables: `reach_integrations`, `reach_posts`, `reach_guidelines`, `reach_templates`; RLS enabled on all
- `lib/reach-schema.ts` — TypeScript types for all domain records and supported platform constants
- `lib/reach-data.ts` — Supabase service-role data layer: full CRUD for all four tables, all queries workspace-scoped

### Architecture decisions made
- One social account connection per workspace/platform for MVP
- `workspaceId` sent by client in request body (same pattern as canopy-stories)

---

## Open Items

### Next
- Milestone 4 — Add the PhotoVault bridge on top of the Reach media model

### Known gaps
- **LinkedIn** — Community Management API review still pending with LinkedIn; OAuth flow is fully wired and ready to go live once scopes are approved. No code changes needed.
- **X (Twitter)** — direct integration not yet implemented; still "Coming soon" in the connect UI
- **Multi-page Facebook selection** — currently auto-selects the first connected page; no UI to choose or swap pages per workspace
- **Approval workflow SQL migration** — `docs/sql/2026-04-07-cr-005-approval-workflow.sql` must be run manually in the Supabase dashboard (adds `review_note`, `reviewed_by`, `reviewed_at` to `reach_posts`)
- **Instagram analytics shares** — Instagram Graph API does not expose organic share counts; always returns 0 in post detail
- **LinkedIn analytics** — no LinkedIn insights integration yet; LinkedIn posts show no analytics in post detail
- **shared `@canopy/ui` changes** still require rebuilding and refreshing Reach's vendored tarball manually
- **SQL migrations** must still be run manually in the Supabase dashboard (no automated migration runner)

### Completed (no longer open)
- ~~Media library UI~~ — done (2026-04-08); browse, search, upload, delete, preview
- ~~Template management UI~~ — done (2026-04-08); create, edit, delete with manage_templates capability
- ~~Instagram and LinkedIn integrations~~ — done (2026-04-07); LinkedIn pending API review
- ~~Approval workflow / review states~~ — done (2026-04-07)
- ~~Approved post publish flow~~ — done (2026-04-07)
- ~~Facebook Insights analytics~~ — done (2026-04-07); Instagram impressions/likes/comments also live
