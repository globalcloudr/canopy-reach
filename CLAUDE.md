# Canopy Reach — Agent Guide

Canopy Reach is the social media scheduling and publishing product in the Canopy platform. It is a **standalone Next.js app** — not embedded in the portal. Users launch it from the Canopy portal and it receives workspace context via the Canopy handoff protocol.

## Repos

| Repo | Purpose |
|---|---|
| `canopy-reach` | This repo — Canopy Reach product |
| `canopy-platform` | Portal, identity, entitlements, provisioning, launch |
| `photovault` | PhotoVault by Canopy — asset foundation |
| `canopy-stories` | Canopy Stories product |

All repos share one Supabase project.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript, Node 20 (pinned via `.nvmrc`)
- **Styling**: Tailwind CSS v4
- **UI components**: `@canopy/ui` — vendored from `vendor/canopy-ui-0.1.2.tgz`
- **Auth/DB**: Supabase (shared project with canopy-platform, photovault, canopy-stories)
- **Social publishing**: Facebook Graph API (direct integration)
- **Deployment**: Vercel

## App Structure

```
canopy-reach/
  app/
    _components/      — reach-shell.tsx (main app shell)
    page.tsx          — Dashboard
    calendar/         — Content calendar
    posts/new/        — Post composer
    posts/[id]/       — Post detail + engagement stats
    connect/          — Social account OAuth connections
    guidelines/       — Social media guidelines (read + operator edit)
    settings/         — Workspace settings
    api/              — API routes
  lib/
    supabase-client.ts  — Supabase singleton
    facebook-client.ts  — Facebook Graph API wrapper (server-side only)
    reach-data.ts       — All Supabase read/write operations
  vendor/
    canopy-ui-0.1.2.tgz
```

## Routes

### Workspace (authenticated)
| Route | Description |
|---|---|
| `/` | Dashboard — calendar snapshot, recent posts, quick stats |
| `/calendar` | Full content calendar — scheduled, published, drafts |
| `/posts/new` | Post composer — write, attach media, select platforms, schedule |
| `/posts/[id]` | Post detail — status, per-platform engagement stats |
| `/connect` | Social account connections — OAuth per platform |
| `/guidelines` | Social media guidelines — read for staff, edit for operators |
| `/settings` | Workspace settings |
| `/posts/[id]/edit` | Edit scheduled or draft post |

### API Routes
| Route | Description |
|---|---|
| `GET/POST /api/posts` | List (with status/date filters) / create (draft, schedule, or post now) |
| `GET/PATCH/DELETE /api/posts/[id]` | Post detail, edit scheduled/draft posts, delete |
| `GET /api/integrations` | List connected social accounts for workspace |
| `DELETE /api/integrations/[id]` | Disconnect account |
| `GET /api/integrations/oauth-url` | Get Facebook OAuth URL |
| `GET /api/integrations/connect/facebook` | Facebook OAuth callback — exchanges code, stores page connection |
| `POST /api/integrations/sync` | Deprecated no-op kept for backwards compatibility |
| `GET/POST /api/guidelines` | Read and save workspace guidelines |
| `GET /api/templates` | List post templates |
| `GET /api/media` | List recent workspace media records |
| `POST /api/media/upload` | Upload image assets, create media records, return signed URLs |
| `GET /api/launcher-products` | Products the current workspace is entitled to (used by in-app switcher) |
| `GET /api/app-session` | Server-backed workspace session — user identity, active workspace, accessible workspaces |
| `POST /api/auth/exchange-handoff` | Exchange Portal launch code for Supabase session tokens |
| `GET /api/cron/publish-scheduled` | Publish due scheduled posts via Facebook Graph API (secured by CRON_SECRET) |

## Data Model (Supabase — Shared Project)

| Table | Purpose |
|---|---|
| `reach_integrations` | Per-workspace social account connections — stores platform-native account IDs and tokens |
| `reach_posts` | Post records — status, schedule, platforms, body, media, and publish metadata |
| `reach_guidelines` | Per-workspace social media guidelines text |
| `reach_templates` | Per-workspace post templates (type, body_template) |
| `reach_media` | Per-workspace uploaded and external media references |

**Shared tables** (read-only from this repo):
- `organizations` — workspace bridge
- `memberships` — user ↔ org relationships
- `profiles` — platform_role, is_super_admin

## Facebook Integration

Facebook is the only live publishing integration today.

- `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are server-side env vars used for OAuth and page access
- Each workspace stores a Facebook Page ID in `reach_integrations.external_account_id`
- Page access tokens are stored in `reach_integrations.access_token`
- Immediate posts publish from `/api/posts`; scheduled posts publish from `/api/cron/publish-scheduled`
- LinkedIn, Instagram, and X are planned but not yet implemented

**Key endpoints used**:
- Facebook OAuth dialog + callback exchange
- Graph API page lookup for connected workspaces
- Graph API feed publishing for immediate and scheduled posts

## Canopy Platform Integration

**Product key**: `reach_canopy`

**Launch flow**:
1. User signs in through Canopy portal
2. Portal checks `reach_canopy` entitlement
3. Portal creates a short-lived single-use launch handoff and redirects to `/auth/launch/reach`
4. Canopy Reach exchanges the handoff code through `/api/auth/exchange-handoff` before setting the Supabase session
5. Canopy Reach loads workspace context from `/api/app-session`, using `?workspace=<slug>` to resolve the active workspace when present
6. User lands in the correct org context

**Switcher flow**:
- in-app product switching submits back to Portal through `POST /auth/product-launch`
- returning to Portal submits through `POST /auth/portal-return`
- Portal restores its own cookies and issues the next redirect using `303` semantics so the destination app receives a normal `GET`

## Workspace Context

- Active workspace is resolved from `/api/app-session`
- `/api/app-session` should only return workspaces where Reach itself is enabled
- Initial workspace resolution uses `?workspace=<slug>` when present, then falls back to the server-backed active workspace
- Internal Reach navigation should preserve `?workspace=<slug>` for platform operators so dashboard, calendar, composer, post detail, edit, and settings stay in the selected school
- API routes validate workspace access server-side; client requests still send `workspaceId` where required
- All data queries must filter by `workspace_id`
- Uploaded Reach media should be stored in a private bucket and exposed through signed URLs, not `getPublicUrl()`

## PhotoVault Integration

When `photovault` entitlement is active for the workspace, the post composer should show a "Browse PhotoVault" option. Selected images should flow into publishing through a PhotoVault signed URL.

## UI Conventions

- Shell: `ReachShell` wraps all workspace pages
- @canopy/ui vendored — use `Button`, `Card`, `Badge`, `Input`, `Textarea`, `Select`, `Dialog`, `CanopyHeader`, etc.
- Eyebrow accent color: `#2f76dd`

## Architecture Rules

**This repo owns:**
- Social post composition, scheduling, publishing
- Social account OAuth connections
- Content calendar
- Social media guidelines and post templates
- Per-post engagement stats

**This repo does NOT own:**
- User invitations or workspace membership (canopy-platform)
- Product entitlements (canopy-platform)
- Photo assets and albums (photovault)
- Stories content (canopy-stories)

**Rules:**
- Facebook secrets and access tokens are server-side only — never expose them to the browser
- All data operations scoped to active `workspace_id`
- Use `lib/facebook-client.ts` for Facebook API calls — do not hand-roll Graph API requests in routes
- Use `lib/reach-data.ts` for all Supabase calls
- Run `npx eslint` and `npx tsc --noEmit` before considering any change done
- Keep `reach-media` private; sign URLs on read so draft assets are not world-readable by bucket URL

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_PORTAL_URL=https://usecanopy.school
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
CRON_SECRET=
```

## Local Dev

- Node 20 (pinned in `.nvmrc`)
- Copy `.env.local.example` to `.env.local` and fill in values
- `npm install && npm run dev` — runs at localhost:3000
