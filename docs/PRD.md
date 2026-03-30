# Canopy Reach — Product Requirements

## What Canopy Reach Is

Canopy Reach is the social media scheduling and publishing product inside Canopy.

It lets school staff write, schedule, and publish social media posts to their school's accounts — either themselves through the Canopy portal, or through Canopy as a managed service.

This product replaces Hootsuite as the scheduling tool and gives schools a Canopy-native interface to participate in — or hand off — their social media program.

## Social Platforms in Scope

MVP targets the platforms adult education schools actively use:

- **Facebook** — primary platform; highest engagement with adult learners
- **Instagram** — growing platform for visual storytelling and student highlights
- **LinkedIn** — relevant for workforce development and continuing education
- **X (Twitter)** — lower priority but commonly present

Platform connections are managed per workspace. Each school connects their own social accounts through OAuth.

## Delivery Modes

### Self-Serve
School staff log in, write posts, attach media, select platforms, schedule or publish immediately, and view engagement stats.

### Managed Service
Canopy staff handle monthly content planning, post drafting, scheduling, and publishing on the school's behalf. The managed service includes social media guidelines and branded post templates created at onboarding.

The managed service is a paid add-on visible in the portal — not a self-serve button. Canopy staff access any workspace via platform operator permissions.

## Social Media Guidelines and Templates

Per-workspace, Canopy creates:
- **Social media guidelines** — tone, topics, posting frequency, what to post vs. what not to post
- **Post templates** — structured content patterns for recurring post types (enrollment open, class spotlight, student story, event, holiday)

These are stored in the workspace and visible inside Canopy Reach. Self-serve template editing is out of scope for MVP.

## PhotoVault Integration

Staff composing a post can open a media browser and select an approved photo directly from their PhotoVault library. The image attaches via Postiz `POST /upload-from-url` using the PhotoVault Supabase Storage signed URL.

Requires `reach_canopy` and `photovault` entitlements both active. If PhotoVault is not enabled, direct upload is the only option.

## Content Calendar

Canopy Reach shows a content calendar for the workspace:
- Scheduled posts by date
- Published posts by date
- Drafts
- Platform filter

## Posting Engine: Postiz

Canopy Reach uses Postiz as its underlying social scheduling engine.

**Architecture**: One Postiz workspace (Canopy-owned). All school social accounts are connected as integrations within that workspace. Canopy stores Postiz integration IDs in `reach_integrations` mapped to each workspace. Posts are sent via the Postiz API using Canopy's single API key, targeting the school's integration IDs.

School users never see or interact with Postiz. The Canopy Reach interface is the only product surface.

## Analytics

Basic per-post engagement stats pulled from social platform APIs via Postiz:
- Impressions
- Likes / reactions
- Comments
- Shares / reposts

Per-platform breakdowns shown when a post was published to more than one platform.

## Portal Dashboard Card

The Canopy Reach dashboard card on the portal home shows:
- Next scheduled post date and platform
- Total posts published this month
- Quick action: "New Post"

## MVP Scope

### In Scope
- Post composition with image attachment (direct upload or PhotoVault browser)
- Multi-platform publishing: Facebook, Instagram, LinkedIn, X
- Scheduled and immediate publishing
- Draft posts
- Content calendar view
- Basic per-post engagement stats
- OAuth-based social account connections per workspace (via Postiz)
- Social media guidelines stored per workspace (Canopy-managed)
- Post templates stored per workspace (Canopy-managed)
- Postiz as the backend scheduling engine
- Managed service pathway (operators manage posts on behalf of any school)
- Portal dashboard card with activity summary and quick action

### Out of Scope for MVP
- Self-serve social media guidelines or template editing
- AI-assisted post writing or caption generation
- Instagram Stories or Reels (feed posts only)
- TikTok or YouTube
- Advanced analytics (that is Canopy Insights)
- Multi-post campaign sequences
- Team approval workflows before publishing
- Hashtag research or recommendations
- Billing or plan enforcement logic

## MVP Success Criteria

1. A school staff member can log in and see their content calendar
2. They can write a post, attach an image (including from PhotoVault if enabled), and schedule or publish it to at least one platform
3. They can view engagement stats on a published post
4. Canopy staff can do all of the above on behalf of any school
5. The portal dashboard card shows the next scheduled post and a "New Post" action
6. Social account connections survive session resets

## Connection to the Platform

- **Product key**: `reach_canopy`
- User authenticates through Canopy portal; active workspace determines social accounts, calendar, and posts shown
- `reach_canopy` entitlement must be `active` or `pilot` to launch
- PhotoVault media browser available if `photovault` entitlement is also active
