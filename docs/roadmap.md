# Canopy Reach — Roadmap

This document is the current planning reference for future agents and contributors.

It captures the milestone order, the major issue buckets, and the intended architecture direction for Canopy Reach as a school-scoped social publishing product inside Canopy.

## Guiding Architecture

Canopy Reach should behave as a single-tenant product at the workspace level.

Each school workspace owns:
- its approved social accounts
- its posts
- its uploaded media
- its templates
- its guidelines
- its analytics and audit history

Core rules:
- one active social account per platform per workspace
- workspace-scoped storage paths for uploaded assets
- owner/admin-controlled account connections
- server-enforced workspace authorization on every API
- no cross-school mingling of posts, media, or integrations

## Milestone Board

### Completed

#### Milestone 1 — Tenant And Access Foundation

Status: complete on 2026-03-31

Completed outcomes:
- one active social account per platform per workspace is enforced through the workspace/platform uniqueness model
- Reach integration management is restricted to owner/admin-level users
- Reach uses server-enforced workspace capability checks for posts, uploads, and account management
- Canopy Portal now supports the `social_media` workspace role
- Canopy Portal now provides a workspace invitation flow for owner/admin users
- Reach and Portal now write foundation-level audit events for key governance actions
- PhotoVault super-admin UI now points school invitation management toward Canopy Portal

Implementation notes:
- Portal owns the workspace invitation and role-assignment workflow
- Reach consumes the resulting membership roles and applies them to publishing behavior
- `social_media` users can create/edit posts and upload media, but cannot manage connected school accounts

### Now

#### Milestone 2 — Reach Media Foundation

Goal:
Make media a first-class workspace-owned asset instead of relying on raw URLs stored on posts.

Includes:
- add `reach_media`
- store uploads as workspace-scoped media records
- move posts from `mediaUrl` to media references
- make uploaded assets reusable across composer flows

Issue buckets:
- Add `reach_media` Table For Workspace-Scoped Media
- Move Reach Posts From `mediaUrl` To `reach_media` References

Why this is next:
- it is the foundation for a media library
- it is required before a clean PhotoVault bridge
- it improves tenant separation by making assets explicit records

### Next

#### Milestone 3 — Composer And Media Library

Goal:
Turn uploads into a usable school media library and improve the day-to-day posting flow.

Includes:
- reusable media library UI
- select existing uploaded images in composer and edit flows
- better connected-account UX
- stronger page/account visibility for staff

Issue buckets:
- Build Reach Media Library UI
- Add Approved-Account Management UX In Reach
- Facebook Page Selection And Multi-Page Support

#### Milestone 4 — PhotoVault Bridge

Goal:
Allow Reach to use school-approved PhotoVault assets without breaking workspace boundaries.

Includes:
- PhotoVault asset picker inside Reach
- mapping PhotoVault assets into Reach media usage
- keeping direct upload and PhotoVault selection side by side

Issue buckets:
- Prepare PhotoVault Bridge For Reach Media Selection

### Later

#### Milestone 5 — Publishing Workflow Maturity

Goal:
Make Reach suitable for real multi-user school communication teams.

Includes:
- approval/review workflow
- stronger publish failure handling and recovery
- safer account replacement flows
- explicit page selection and replacement logic

Issue buckets:
- Post Approvals / Publishing Workflow
- Harden Publishing Reliability, Failure Handling, And Audit Trail
- Facebook Page Selection And Multi-Page Support

#### Milestone 6 — Analytics And Reporting

Goal:
Add performance visibility after the publishing foundation is stable.

Includes:
- Facebook insights ingestion
- reporting storage model
- dashboard and post-level analytics

Issue buckets:
- Analytics And Reporting Foundation

## Additional Suggested Issues

These were identified as worthwhile standalone tasks in addition to the original planning set:

- Facebook Page Selection And Multi-Page Support
- Post Approvals / Publishing Workflow
- Analytics And Reporting Foundation
- Activity Log / Audit Trail

## Current Implementation Notes

Already in place:
- direct Facebook OAuth and publishing
- business-managed Facebook Page support via `business_management`
- scheduled and draft post editing
- direct image upload to Supabase Storage
- workspace-scoped upload paths
- role-aware server capability checks for posts, uploads, and social account management
- Portal-owned workspace invitation flow for owner/admin users
- `social_media` role support in Canopy Portal
- audit-event logging foundation in Reach and Portal

Still architectural follow-up, not yet complete:
- `reach_media` as the canonical media source
- post-to-media record references
- PhotoVault-backed asset selection
