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
- **UI components**: `@canopy/ui` — vendored from `vendor/canopy-ui-0.1.0.tgz`
- **Auth/DB**: Supabase (shared project with canopy-platform, photovault, canopy-stories)
- **Social scheduling**: Postiz API (`POSTIZ_API_URL` / `POSTIZ_API_KEY`)
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
    postiz-client.ts    — Postiz API wrapper (server-side only)
    reach-data.ts       — All Supabase read/write operations
  vendor/
    canopy-ui-0.1.0.tgz
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

## Data Model (Supabase — Shared Project)

| Table | Purpose |
|---|---|
| `reach_integrations` | Per-workspace social account connections — maps to Postiz integration IDs |
| `reach_posts` | Post records — status, schedule, platforms, body, media, Postiz IDs |
| `reach_guidelines` | Per-workspace social media guidelines text |
| `reach_templates` | Per-workspace post templates (type, body_template) |

**Shared tables** (read-only from this repo):
- `organizations` — workspace bridge
- `memberships` — user ↔ org relationships
- `profiles` — platform_role, is_super_admin

## Postiz Integration

**One Postiz workspace** — Canopy-owned. All school social accounts are connected as integrations within that single workspace.

- `POSTIZ_API_KEY` — stored server-side only, never sent to browser
- `POSTIZ_API_URL` — defaults to `https://api.postiz.com/public/v1`
- Each school's connected social account gets a `postiz_integration_id` stored in `reach_integrations`
- When posting, Canopy targets the school's specific integration IDs
- School users never see or interact with Postiz directly

**Key endpoints used**:
- `GET /integrations` — list connected channels
- `GET /social/{integration}` — OAuth connect URL for a platform
- `POST /posts` — create/schedule posts
- `GET /posts` — fetch posts by date range (calendar)
- `DELETE /posts/{id}` — delete a post
- `GET /analytics/post/{postId}` — per-post engagement stats
- `POST /upload-from-url` — attach media from PhotoVault signed URLs

## Canopy Platform Integration

**Product key**: `reach_canopy`

**Launch flow**:
1. User signs in through Canopy portal
2. Portal checks `reach_canopy` entitlement
3. Portal sends user to `/auth/launch/reach` which passes tokens in URL hash
4. Canopy Reach receives `access_token` + `refresh_token` with `type=canopy_handoff`
5. Canopy Reach resolves workspace from `?workspace=<slug>`
6. User lands in the correct org context

## Workspace Context

- Active org stored in `localStorage` under key `cr_active_org_id_v1`
- Resolution order: `?workspace=<slug>` URL param → localStorage → first org
- API routes expect `workspaceId` sent by client in request body
- All data queries must filter by `workspace_id`

## PhotoVault Integration

When `photovault` entitlement is active for the workspace, the post composer shows a "Browse PhotoVault" option. Selected images are attached via Postiz `POST /upload-from-url` using the PhotoVault Supabase Storage signed URL.

## UI Conventions

- Shell: `ReachShell` wraps all workspace pages
- @canopy/ui vendored — use `Button`, `Card`, `Badge`, `Input`, `Textarea`, `Select`, `Dialog`, `CanopyHeader`, etc.
- Eyebrow accent color: `#2f76dd`

## Architecture Rules

**This repo owns:**
- Social post composition, scheduling, publishing
- Social account OAuth connections (via Postiz)
- Content calendar
- Social media guidelines and post templates
- Per-post engagement stats

**This repo does NOT own:**
- User invitations or workspace membership (canopy-platform)
- Product entitlements (canopy-platform)
- Photo assets and albums (photovault)
- Stories content (canopy-stories)

**Rules:**
- `POSTIZ_API_KEY` is server-side only — never expose to browser
- All data operations scoped to active `workspace_id`
- Use `lib/postiz-client.ts` for all Postiz calls — do not call Postiz directly from routes
- Use `lib/reach-data.ts` for all Supabase calls
- Run `npx eslint` and `npx tsc --noEmit` before considering any change done

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
POSTIZ_API_KEY=
POSTIZ_API_URL=https://api.postiz.com/public/v1
NEXT_PUBLIC_PORTAL_URL=https://usecanopy.school
```

## Local Dev

- Node 20 (pinned in `.nvmrc`)
- Copy `.env.local.example` to `.env.local` and fill in values
- `npm install && npm run dev` — runs at localhost:3000
