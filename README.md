# Canopy Reach

Social media scheduling and publishing product for the Canopy platform.

**GitHub**: https://github.com/globalcloudr/canopy-reach
**Live URL**: https://canopy-reach.vercel.app
**Status**: Active development

## What Is Built

### Phase 1 — App scaffold
- Next.js 16 app with App Router, TypeScript, Tailwind v4, @canopy/ui vendored
- `ReachShell` — full app shell with Portal launch exchange, server-backed app session, sidebar nav
- Supabase lazy singleton client
- CLAUDE.md, env example

### Phase 2 — Data layer
- DB schema: `reach_integrations`, `reach_posts`, `reach_guidelines`, `reach_templates`
- `lib/reach-schema.ts` — all TypeScript types and platform constants
- `lib/facebook-client.ts` — server-side Facebook Graph API wrapper
- `lib/reach-data.ts` — Supabase CRUD for all four tables

### Phase 3 — Pages and API routes

**Pages:**
- `/` — Dashboard: publishing queue overview, connected account visibility, setup guidance, operational summary
- `/calendar` — Post list with Upcoming/Published/Drafts filter tabs, grouped by date
- `/posts/new` — Post composer: template-first start, collapsible media, per-platform preview, guidelines reference, duplicate pre-fill
- `/posts/[id]` — Post detail with per-post engagement stats, edit/delete/duplicate actions
- `/posts/[id]/edit` — Edit scheduled and draft posts
- `/media` — Media library: grid browse, filename search, pagination, upload, delete, image preview
- `/templates` — Template management: create, edit, delete (owner/admin), read-only list for other roles
- `/connect` — Account connection flow: direct Facebook OAuth, disconnect, LinkedIn/X marked "Coming soon"
- `/guidelines` — Read view for staff, edit view for operators
- `/settings` — Workspace info

**API routes:**
- `GET/POST /api/posts` — list with status/date filters, create (draft/schedule/now)
- `GET/PATCH/DELETE /api/posts/[id]` — detail with real engagement analytics, edit scheduled/draft posts, delete from DB
- `GET /api/integrations` — list connected accounts for workspace
- `DELETE /api/integrations/[id]` — disconnect account
- `GET /api/integrations/oauth-url` — get direct Facebook OAuth URL
- `POST /api/integrations/sync` — deprecated no-op kept for backwards compatibility
- `GET/POST /api/guidelines` — read and save guidelines
- `GET/POST /api/templates` — list / create post templates
- `PUT/DELETE /api/templates/[id]` — update / delete a template
- `GET /api/media` — list workspace media (search, pagination)
- `POST /api/media/upload` — upload image assets for a workspace, create media records, and return signed media URLs
- `DELETE /api/media/[id]` — delete a media record and its storage file

### Phase 4 — Direct Facebook integration
- `lib/facebook-client.ts` — OAuth token exchange, page lookup, publishing via Graph API
- `/api/integrations/connect/facebook` — OAuth callback: exchanges code, gets page token, stores page connection
- `/api/cron/publish-scheduled` — publishes due scheduled posts through Facebook, secured by `CRON_SECRET`
- `docs/sql/` migrations updated for direct platform naming (`external_account_id`, `external_post_id`, `publish_results`)
- supports business-managed Facebook Pages via `business_management`

### Phase 4b — LinkedIn and Instagram integrations
- `lib/linkedin-client.ts` — LinkedIn OAuth, organization lookup, Posts API publishing with image upload
- `lib/instagram-client.ts` — Instagram Graph API via Facebook OAuth, business account discovery, two-step container publishing
- `/api/integrations/connect/linkedin` — LinkedIn OAuth callback: exchanges code, finds admin orgs, stores org connection
- `/api/integrations/connect/instagram` — Instagram OAuth callback: exchanges code, finds linked IG business account, stores connection
- `/api/integrations/oauth-url` updated to generate OAuth URLs for all three platforms
- `/api/posts` and `/api/cron/publish-scheduled` updated to publish to LinkedIn and Instagram
- Connect page updated to support connecting LinkedIn and Instagram accounts
- Instagram requires an image for every post (no text-only posts)

### Phase 5 — Workspace auth, editing, and direct upload
- server-enforced workspace authorization on the main Reach APIs
- capability-based permission model for posts, uploads, and integration management
- connected social accounts treated as workspace-level assets
- scheduled/draft post editing flow
- direct image upload to Supabase Storage with workspace-scoped paths
- uploaded workspace media now resolves through signed URLs instead of public bucket URLs

### Phase 6 — Milestone 1 tenant and access foundation
- Canopy Portal now supports the `social_media` workspace role
- workspace owners/admins can invite staff from Canopy Portal and assign roles there
- Reach consumes Portal membership roles for post creation, media upload, and social account management
- audit-event foundation added for invitations, post actions, uploads, and social account changes

### Phase 7 — Milestone 2 media foundation
- added `reach_media` as the workspace-scoped media model
- uploads now create media records instead of only returning raw URLs
- posts now use `media_id` as the canonical media reference
- pasted image URLs are normalized into media records for consistency
- composer and edit flows now surface recent workspace media for reuse
- Reach media bucket is now treated as private; uploaded assets are signed on read

### Phase 8 — UI refresh and shared design primitives
- Reach visual system refreshed toward lighter shells, transparent outer surfaces, softer content canvas, and clearer composition flows
- dashboard, accounts, calendar, composer, edit, settings, and guidelines pages were updated to the newer visual language
- shared `AppSurface` and `AppPill` primitives added to `@canopy/ui`
- Reach now consumes those shared primitives so future shell/surface/pill style changes can be made centrally
- sidebar/content divider restored while removing unnecessary boxed chrome around the sidebar itself

### Phase 9 — Launch/session hardening
- Portal-to-Reach launch now uses a one-time handoff exchange instead of raw URL-hash tokens
- Reach resolves its active workspace from `/api/app-session` on first load instead of mixed client-side fallbacks
- scheduled publish now fails safely when no connected integration can actually send the post
- Reach API auth now relies on server-validated workspace access for protected routes

### Phase 10 — Switcher and shared-header stabilization
- in-app product switching now posts back through Portal so Portal can mint fresh handoffs before redirecting to Reach, Stories, or PhotoVault
- Portal return actions now post back through Portal so Portal can restore its own cookies before redirecting to `/app`
- Reach's shared `@canopy/ui` bundle refreshed to `0.1.1` so `CanopyHeader` supports callback-based Portal actions
- product switch redirects now rely on `303` semantics from Portal to avoid browser `POST` follow-ups to app pages

### Phase 11 — Workspace-context stabilization
- Reach now filters `/api/app-session` to workspaces that actually have active `reach_canopy` entitlement instead of showing every accessible school to platform operators
- launcher products now merge entitlement rows across `organization_id`, `org_id`, and `workspace_id` so mixed legacy data does not hide apps in the switcher
- internal Reach navigation now preserves `?workspace=<slug>` across dashboard, calendar, composer, post detail, edit, and settings flows
- Super Admins should stay in the selected school while moving around Reach instead of snapping back to the first workspace

### Phase 12 — Milestone 3: media library, templates, and UX simplification
- full media library page at `/media` — grid view, filename search, offset pagination, image preview, upload, delete
- `searchMedia()` and `deleteMedia()` in data layer; media delete cleans up storage files
- `DELETE /api/media/[id]` with `upload_media` capability check and audit logging
- template management page at `/templates` — create, edit, delete with `manage_templates` capability (owner/admin only)
- `updateTemplate()` in data layer; `POST /api/templates`, `PUT/DELETE /api/templates/[id]` with audit logging
- sidebar navigation consolidated: primary nav (Dashboard, Calendar, New Post, Review) plus collapsible Manage section (Media, Templates, Accounts, Guidelines, Settings)
- pending review badge on Review nav item — amber count fetched on workspace load
- composer reworked: templates promoted to visible card grid, media section collapsible, guidelines panel in sidebar, publishing guidance card removed
- calendar simplified from 6 filters to 3: Upcoming (scheduled + approved + in review), Published, Drafts — with inline count badges

### Phase 13 — Per-platform preview and post duplication
- composer preview replaced with platform-specific mock-ups: Facebook (text + full-width image), Instagram (square-crop image + caption), LinkedIn (140-char fold + see more)
- preview tabs switch between selected platforms; character-over warnings per platform; Instagram missing-image warning
- preview card always visible in sidebar with prompt when no platform is selected
- duplicate post: "Duplicate post" button on post detail page for any post status
- duplicate navigates to `/posts/new?body=...&platforms=...&mediaId=...`; composer reads query params and pre-fills body, platform toggles, and media selection

## What Is Not Done Yet

- PhotoVault media browser integration
- X direct API integration (marked "Coming soon" in connect UI)
- explicit multi-page Facebook selection / page replacement flow

## Roadmap

Implementation planning now lives in [docs/roadmap.md](./docs/roadmap.md).

## How to Run

```bash
npm install
npm run dev     # runs at localhost:3000
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://canopy-reach.vercel.app
NEXT_PUBLIC_PORTAL_URL=https://usecanopy.school
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
CRON_SECRET=
```

## Database

Shared Supabase project with canopy-platform, photovault, and canopy-stories.

Product-owned tables today: `reach_integrations`, `reach_posts`, `reach_guidelines`, `reach_templates`, `reach_media`

Migration SQL files are in `docs/sql/`.

## Storage Notes

- Workspace uploads use the `reach-media` bucket with paths like `{workspaceId}/posts/...`
- Reach now expects `reach-media` to be private and signs URLs when media is loaded into the composer, editor, or post detail
- Existing uploaded assets continue to work after deploy because URLs are signed at read time from stored bucket/path metadata

## Shared UI Package

Reach consumes a vendored copy of `@canopy/ui`:

- `vendor/canopy-ui-0.1.10.tgz`

Reach now relies on `@canopy/ui` for:

- the shared shell frame (`AppShellFrame`, `AppShellSidebar`, `AppShellContent`)
- shared shell pieces like page headers, workspace switcher, sidebar sections, and nav states
- shared Canopy app font ownership through `canopyFontVariables`

The design source of truth lives in:

- `canopy-platform/packages/ui`

If shared UI components or tokens change, refresh Reach's vendored package before building or deploying:

```bash
cd /Users/zylstra/Code/canopy-platform/packages/ui
npm run build
npm pack

cd /Users/zylstra/Code/canopy-reach
cp /Users/zylstra/Code/canopy-platform/packages/ui/canopy-ui-0.1.10.tgz ./vendor/canopy-ui-0.1.10.tgz
npm install file:./vendor/canopy-ui-0.1.10.tgz --save-exact
```
