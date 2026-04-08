/**
 * Email notifications via Resend — server-side only.
 * All sends are fire-and-forget from the caller's perspective.
 * Never import this from client components.
 *
 * Required env vars:
 *   RESEND_API_KEY        — your Resend API key
 *   RESEND_FROM_EMAIL     — verified sender address, e.g. "Canopy Reach <notifications@yourdomain.com>"
 */

import { Resend } from "resend";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import type { ReachPlatform } from "@/lib/reach-schema";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL ?? "Canopy Reach <notifications@canopy.school>";
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr><td style="padding-bottom:24px;">
          <span style="font-size:15px;font-weight:700;color:#2f76dd;letter-spacing:-0.01em;">Canopy Reach</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(26,54,93,0.08);">
          ${bodyContent}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:20px;text-align:center;font-size:12px;color:#9ca3af;">
          Canopy Reach &middot; You are receiving this because you are a member of this workspace.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function postPreview(body: string, platforms: ReachPlatform[]): string {
  const platformList = platforms.map((p) => PLATFORM_LABELS[p]).join(", ");
  const preview = body.length > 280 ? body.slice(0, 277) + "…" : body;
  return `
    <div style="background:#f8fafc;border-radius:10px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#7f8ea3;text-transform:uppercase;letter-spacing:0.06em;">Post preview</p>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#172033;white-space:pre-wrap;">${escHtml(preview)}</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">${escHtml(platformList)}</p>
    </div>`;
}

function ctaButton(href: string, label: string): string {
  return `
    <p style="margin:24px 0 0;">
      <a href="${href}" style="display:inline-block;background:#2f76dd;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:8px;">${label}</a>
    </p>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Email senders ────────────────────────────────────────────────────────────

/**
 * Notify the post author that their post has been submitted for review.
 * Sent immediately when a staff/social_media member submits a post.
 */
export async function sendPostSubmittedEmail(params: {
  authorEmail: string;
  postBody:    string;
  platforms:   ReachPlatform[];
}): Promise<void> {
  const resend = getResend();
  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#172033;letter-spacing:-0.02em;">Post submitted for review</h1>
    <p style="margin:0;font-size:15px;color:#617286;line-height:1.6;">Your post has been sent to your workspace admins for review. You will receive another email once it has been approved or if changes are needed.</p>
    ${postPreview(params.postBody, params.platforms)}
  `);
  await resend.emails.send({
    from:    fromAddress(),
    to:      params.authorEmail,
    subject: "Your post has been submitted for review",
    html,
  });
}

/**
 * Notify workspace admins that a new post is waiting for their review.
 */
export async function sendNewPendingReviewEmail(params: {
  adminEmails: string[];
  authorEmail: string | null;
  postBody:    string;
  platforms:   ReachPlatform[];
  postId:      string;
}): Promise<void> {
  if (!params.adminEmails.length) return;
  const resend = getResend();
  const reviewUrl = `${appUrl()}/review`;
  const byLine = params.authorEmail
    ? `<p style="margin:0 0 16px;font-size:15px;color:#617286;">Submitted by <strong>${escHtml(params.authorEmail)}</strong> and waiting for your approval.</p>`
    : `<p style="margin:0 0 16px;font-size:15px;color:#617286;">A new post is waiting for your approval.</p>`;

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#172033;letter-spacing:-0.02em;">New post pending review</h1>
    ${byLine}
    ${postPreview(params.postBody, params.platforms)}
    ${ctaButton(reviewUrl, "Open review queue")}
  `);

  await resend.emails.send({
    from:    fromAddress(),
    to:      params.adminEmails,
    subject: "A post is waiting for your review",
    html,
  });
}

/**
 * Notify the post author that their post has been approved.
 */
export async function sendPostApprovedEmail(params: {
  authorEmail: string;
  postBody:    string;
  platforms:   ReachPlatform[];
  postId:      string;
  scheduledAt: string | null;
}): Promise<void> {
  const resend = getResend();
  const postUrl = `${appUrl()}/posts/${params.postId}`;

  const nextStep = params.scheduledAt
    ? `This post is scheduled to publish on <strong>${new Date(params.scheduledAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong>.`
    : "An admin will publish or schedule it shortly.";

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#172033;letter-spacing:-0.02em;">Your post has been approved ✓</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#617286;line-height:1.6;">${nextStep}</p>
    ${postPreview(params.postBody, params.platforms)}
    ${ctaButton(postUrl, "View post")}
  `);

  await resend.emails.send({
    from:    fromAddress(),
    to:      params.authorEmail,
    subject: "Your post has been approved",
    html,
  });
}

/**
 * Notify the post author that their post has been rejected and returned to draft.
 */
export async function sendPostRejectedEmail(params: {
  authorEmail: string;
  postBody:    string;
  platforms:   ReachPlatform[];
  postId:      string;
  reviewNote:  string | null;
}): Promise<void> {
  const resend = getResend();
  const editUrl = `${appUrl()}/posts/${params.postId}/edit`;

  const noteBlock = params.reviewNote
    ? `<div style="background:#fffbeb;border:1px solid #f2e4bc;border-radius:10px;padding:16px;margin:20px 0;">
         <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#b7791f;text-transform:uppercase;letter-spacing:0.06em;">Reviewer note</p>
         <p style="margin:0;font-size:14px;line-height:1.6;color:#92400e;">${escHtml(params.reviewNote)}</p>
       </div>`
    : `<p style="margin:20px 0 0;font-size:14px;color:#617286;">No specific note was left. Please review your post and resubmit when ready.</p>`;

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#172033;letter-spacing:-0.02em;">Your post needs changes</h1>
    <p style="margin:0;font-size:15px;color:#617286;line-height:1.6;">Your post has been returned to draft. Make the requested changes and resubmit when it is ready.</p>
    ${postPreview(params.postBody, params.platforms)}
    ${noteBlock}
    ${ctaButton(editUrl, "Edit post")}
  `);

  await resend.emails.send({
    from:    fromAddress(),
    to:      params.authorEmail,
    subject: "Your post needs changes",
    html,
  });
}
