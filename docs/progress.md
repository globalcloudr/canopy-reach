# Canopy Reach — Progress and Current Work

Append new sessions at the top. Do not overwrite history.

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
- Milestone 2 — Reach media foundation
- Add `reach_media`
- Move posts from raw `mediaUrl` values to media-record references

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
- `app/_components/reach-shell.tsx` — full app shell: token handoff from Canopy portal, workspace resolution (URL param → localStorage → first org), operator vs. member detection, CanopyHeader + sidebar nav
- Nav items: Dashboard, Calendar, New Post, Accounts, Guidelines, Settings
- localStorage key: `cr_active_org_id_v1`
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
- Milestone 2 — Add `reach_media` and move posts from raw `mediaUrl` values to media-record references
- Milestone 3 — Build the reusable Reach media library UI
- Milestone 4 — Add the PhotoVault bridge on top of the Reach media model

### Deployment
- App is deploying to Vercel at https://canopy-reach.vercel.app
- Environment variables are being added to Vercel — once set, update `REACH_APP_URL` in canopy-platform portal env (both `.env.local` and Vercel) to `https://canopy-reach.vercel.app`

### Known gaps
- Instagram, LinkedIn, and X direct integrations are still not implemented
- SQL migration must be run manually in Supabase dashboard (no automated migration runner yet)
