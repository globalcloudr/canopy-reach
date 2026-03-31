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
- `/calendar` — Filterable post list (all/scheduled/published/draft), grouped by date
- `/posts/new` — Post composer: publishing workspace with content, media selection, timing, preview, and recent media reuse
- `/posts/[id]` — Post detail with per-post engagement stats and edit/delete actions when permitted
- `/posts/[id]/edit` — Edit scheduled and draft posts
- `/connect` — Account connection flow: direct Facebook OAuth, disconnect, LinkedIn/X marked "Coming soon"
- `/guidelines` — Read view for staff, edit view for operators
- `/settings` — Workspace info

**API routes:**
- `GET/POST /api/posts` — list with status/date filters, create (draft/schedule/now)
- `GET/PATCH/DELETE /api/posts/[id]` — detail + placeholder analytics, edit scheduled/draft posts, delete from DB
- `GET /api/integrations` — list connected accounts for workspace
- `DELETE /api/integrations/[id]` — disconnect account
- `GET /api/integrations/oauth-url` — get direct Facebook OAuth URL
- `POST /api/integrations/sync` — deprecated no-op kept for backwards compatibility
- `GET/POST /api/guidelines` — read and save guidelines
- `GET /api/templates` — list post templates
- `GET /api/media` — list recent workspace media records
- `POST /api/media/upload` — upload image assets for a workspace and create media records

### Phase 4 — Direct Facebook integration
- `lib/facebook-client.ts` — OAuth token exchange, page lookup, publishing via Graph API
- `/api/integrations/connect/facebook` — OAuth callback: exchanges code, gets page token, stores page connection
- `/api/cron/publish-scheduled` — publishes due scheduled posts through Facebook, secured by `CRON_SECRET`
- `docs/sql/` migrations updated for direct platform naming (`external_account_id`, `external_post_id`, `publish_results`)
- supports business-managed Facebook Pages via `business_management`

### Phase 5 — Workspace auth, editing, and direct upload
- server-enforced workspace authorization on the main Reach APIs
- capability-based permission model for posts, uploads, and integration management
- connected social accounts treated as workspace-level assets
- scheduled/draft post editing flow
- direct image upload to Supabase Storage with workspace-scoped paths

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

## What Is Not Done Yet

- full media library browsing and management UI
- PhotoVault media browser integration
- Facebook Insights analytics (post detail page shows placeholder)
- LinkedIn and X direct API integrations (marked "Coming soon" in connect UI)
- explicit multi-page Facebook selection / page replacement flow
- approval workflow / review states for school teams

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
CRON_SECRET=
```

## Database

Shared Supabase project with canopy-platform, photovault, and canopy-stories.

Product-owned tables today: `reach_integrations`, `reach_posts`, `reach_guidelines`, `reach_templates`, `reach_media`

Migration SQL files are in `docs/sql/`.

## Shared UI Package

Reach consumes a vendored copy of `@canopy/ui`:

- `vendor/canopy-ui-0.1.0.tgz`

The design source of truth lives in:

- `canopy-platform/packages/ui`

If shared UI components or tokens change, refresh Reach's vendored package before building or deploying:

```bash
cd /Users/zylstra/Code/canopy-platform/packages/ui
npm run build
npm pack

cd /Users/zylstra/Code/canopy-reach
cp /Users/zylstra/Code/canopy-platform/packages/ui/canopy-ui-0.1.0.tgz ./vendor/canopy-ui-0.1.0.tgz
npm install file:./vendor/canopy-ui-0.1.0.tgz --save-exact
```
