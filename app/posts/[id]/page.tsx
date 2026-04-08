"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@canopy/ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachPost } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";
import { buildWorkspaceHref } from "@/lib/workspace-href";

type PostAnalytics = {
  impressions: number;
  likes:       number;
  comments:    number;
  shares:      number;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const STATUS_BADGE: Record<string, string> = {
  scheduled:      "bg-[#eff6ff] text-[#2563eb]",
  published:      "bg-[#f0fdf4] text-[#059669]",
  draft:          "bg-[#f9fafb] text-[#6b7280]",
  failed:         "bg-[#fef2f2] text-[#dc2626]",
  pending_review: "bg-[#fef3c7] text-[#d97706]",
  approved:       "bg-[#ecfdf5] text-[#059669]",
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "In review",
  approved:       "Approved",
};

function buildDuplicateHref(post: ReachPost, workspaceSlug: string | null): string {
  const params = new URLSearchParams();
  if (workspaceSlug) params.set("workspace", workspaceSlug);
  params.set("body", post.body);
  if (post.platforms.length > 0) params.set("platforms", post.platforms.join(","));
  if (post.mediaId) params.set("mediaId", post.mediaId);
  return `/posts/new?${params.toString()}`;
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[22px] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-4 text-center shadow-[0_16px_36px_rgba(26,54,93,0.08)]">
      <p className="text-2xl font-semibold tracking-tight text-[#202020]">{value}</p>
      <p className="mt-1 text-[13px] text-[#6b7280]">{label}</p>
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = useReachWorkspaceId();
  const workspaceSlug = searchParams.get("workspace")?.trim() || null;

  const [post, setPost]               = useState<ReachPost | null>(null);
  const [analytics, setAnalytics]     = useState<PostAnalytics | null>(null);
  const [access, setAccess]           = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [loading, setLoading]         = useState(true);
  const [deleting, setDeleting]       = useState(false);
  const [publishing, setPublishing]   = useState(false);
  const [approving, setApproving]     = useState(false);
  const [rejecting, setRejecting]     = useState(false);
  const [showRejectNote, setShowRejectNote] = useState(false);
  const [rejectNote, setRejectNote]   = useState("");
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !id) {
      setPost(null);
      setAnalytics(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      apiFetch(`/api/posts/${id}?workspaceId=${workspaceId}`).then((r) => r.json()),
      getClientWorkspaceAccess(workspaceId),
    ])
      .then(([data, nextAccess]: [{ post?: ReachPost; analytics?: PostAnalytics; error?: string }, typeof access]) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setPost(data.post ?? null);
        setAnalytics(data.analytics ?? null);
        setAccess(nextAccess);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load post.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, workspaceId]);

  async function handleApprove() {
    if (!workspaceId || !post) return;
    setApproving(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/posts/${post.id}/approve?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to approve.");
      }
      // Reload post to reflect new status
      const updated = await apiFetch(`/api/posts/${post.id}?workspaceId=${workspaceId}`).then((r) => r.json()) as { post?: ReachPost };
      setPost(updated.post ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve post.");
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!workspaceId || !post) return;
    setRejecting(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/posts/${post.id}/reject?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewNote: rejectNote.trim() || null }),
        }
      );
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to reject.");
      }
      setShowRejectNote(false);
      setRejectNote("");
      const updated = await apiFetch(`/api/posts/${post.id}?workspaceId=${workspaceId}`).then((r) => r.json()) as { post?: ReachPost };
      setPost(updated.post ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject post.");
    } finally {
      setRejecting(false);
    }
  }

  async function handlePublish() {
    if (!workspaceId || !post) return;
    if (!confirm("Publish this post now to all selected platforms?")) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/posts/${post.id}/publish?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to publish.");
      }
      const updated = await apiFetch(`/api/posts/${post.id}?workspaceId=${workspaceId}`).then((r) => r.json()) as { post?: ReachPost };
      setPost(updated.post ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish post.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!workspaceId || !post) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/posts/${post.id}?workspaceId=${workspaceId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete.");
      }
      router.push(buildWorkspaceHref("/calendar", workspaceSlug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
      setDeleting(false);
    }
  }

  return (
    <ReachShell
      activeNav="calendar"
      eyebrow="Post"
      title="Post Detail"
      subtitle="Status and engagement for this post."
    >
      {loading ? (
        <Card padding="md" className="border-0 bg-white/88 shadow-[0_18px_50px_rgba(26,54,93,0.08)]"><BodyText muted>Loading…</BodyText></Card>
      ) : error ? (
        <Card padding="md" className="border-0 bg-[linear-gradient(180deg,#fff2f2_0%,#ffe6e6_100%)] shadow-[0_16px_38px_rgba(190,24,24,0.10)]"><BodyText muted>{error}</BodyText></Card>
      ) : !post ? (
        <Card padding="md" className="border-0 bg-white/88 shadow-[0_18px_50px_rgba(26,54,93,0.08)]"><BodyText muted>Post not found.</BodyText></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_340px]">
          <Card padding="md" className="border-0 bg-white/88 shadow-[0_22px_55px_rgba(26,54,93,0.08)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={[
                    "rounded-full px-2.5 py-0.5 text-[12px] font-medium",
                    STATUS_BADGE[post.status] ?? "bg-[#f9fafb] text-[#6b7280]",
                  ].join(" ")}>
                    {STATUS_LABELS[post.status] ?? post.status}
                  </span>
                  {post.platforms.map((platform) => (
                    <span key={platform} className="rounded-full bg-[#eff4ff] px-3 py-1 text-[12px] font-medium text-[#355b9b]">
                      {PLATFORM_LABELS[platform]}
                    </span>
                  ))}
                </div>
                <p className="whitespace-pre-wrap text-[16px] leading-7 text-[#172033]">{post.body}</p>
                {post.mediaUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.mediaUrl} alt="" className="mt-5 max-h-[420px] w-full rounded-[28px] object-cover shadow-[0_16px_38px_rgba(26,54,93,0.10)]" />
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-6 text-[13px] text-[#6b7280] pt-2">
              {post.scheduledAt && (
                <span>Scheduled: {formatDateTime(post.scheduledAt)}</span>
              )}
              {post.publishedAt && (
                <span>Published: {formatDateTime(post.publishedAt)}</span>
              )}
              <span>Created: {formatDateTime(post.createdAt)}</span>
            </div>

            {post.status === "published" && (
              <div className="mt-8">
                <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Engagement</p>
                {!analytics ? (
                  <BodyText muted>Analytics not yet available for this post.</BodyText>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Impressions", key: "impressions" as const },
                      { label: "Likes",       key: "likes"       as const },
                      { label: "Comments",    key: "comments"    as const },
                      { label: "Shares",      key: "shares"      as const },
                    ].map(({ label, key }) => (
                      <StatBox key={key} label={label} value={analytics[key] ?? 0} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
            <Card padding="md" className="border-0 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] shadow-[0_18px_44px_rgba(25,51,92,0.08)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Post status</p>
              <p className="mt-3 text-[1.1rem] font-semibold tracking-[-0.03em] text-[#172033]">{STATUS_LABELS[post.status] ?? post.status}</p>
              <p className="mt-2 text-[14px] leading-6 text-[#617286]">
                {post.status === "published"
                  ? "This post is live."
                  : post.status === "scheduled"
                    ? "This post is queued and can still be edited before it publishes."
                    : post.status === "pending_review"
                      ? "This post is waiting for admin review before it can be scheduled or published."
                      : post.status === "approved"
                        ? "This post has been approved. Use the actions below to publish it now, or edit it to set a schedule."
                        : "This post is still in progress and has not been scheduled for publishing yet."}
              </p>
            </Card>

            {/* Rejection note — shown on drafts that were previously rejected */}
            {post.status === "draft" && post.reviewNote && (
              <Card padding="md" className="border border-[#f2e4bc] bg-[#fffbeb] shadow-none">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#b7791f]">Reviewer note</p>
                <p className="mt-2 text-[14px] leading-6 text-[#92400e]">{post.reviewNote}</p>
              </Card>
            )}

            {/* Review actions — shown to admins when post is pending review */}
            {post.status === "pending_review" && access.canReviewPosts && (
              <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Review</p>
                {showRejectNote ? (
                  <div className="mt-3">
                    <p className="mb-2 text-[13px] font-medium text-[#172033]">Rejection note (optional)</p>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Let the author know why this post needs changes…"
                      rows={3}
                      className="w-full resize-none rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[14px] leading-6 text-[#172033] placeholder:text-[#9ca3af] focus:border-[#2f76dd] focus:outline-none"
                    />
                    <div className="mt-3 flex gap-2">
                      <Button variant="primary" onClick={() => void handleReject()} disabled={rejecting}>
                        {rejecting ? "Rejecting…" : "Confirm Reject"}
                      </Button>
                      <Button variant="secondary" onClick={() => { setShowRejectNote(false); setRejectNote(""); }} disabled={rejecting}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button variant="primary" onClick={() => void handleApprove()} disabled={approving}>
                      {approving ? "Approving…" : "Approve"}
                    </Button>
                    <Button variant="secondary" onClick={() => setShowRejectNote(true)} disabled={approving}>
                      Reject
                    </Button>
                  </div>
                )}
              </Card>
            )}

            <Card padding="md" className="border-0 bg-white/88 shadow-[0_18px_44px_rgba(25,51,92,0.08)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Actions</p>
              <div className="mt-4 flex flex-col gap-3">
                <Button asChild variant="secondary">
                  <Link href={buildWorkspaceHref("/calendar", workspaceSlug)}>Back to calendar</Link>
                </Button>
                {access.canCreatePosts && (
                  <Button asChild variant="secondary">
                    <Link href={buildDuplicateHref(post, workspaceSlug)}>Duplicate post</Link>
                  </Button>
                )}
                {post.status === "approved" && access.canEditPosts && (
                  <Button
                    variant="primary"
                    onClick={() => void handlePublish()}
                    disabled={publishing}
                  >
                    {publishing ? "Publishing…" : "Publish now"}
                  </Button>
                )}
                {post.status !== "published" && post.status !== "pending_review" && access.canEditPosts && (
                  <Button asChild variant="secondary">
                    <Link href={buildWorkspaceHref(`/posts/${post.id}/edit`, workspaceSlug)}>
                      {post.status === "approved" ? "Edit / reschedule" : "Edit post"}
                    </Link>
                  </Button>
                )}
                {post.status === "pending_review" && access.canEditPosts && (
                  <p className="text-[13px] text-[#7a8798]">Editing is locked while this post is under review.</p>
                )}
                {post.status !== "published" && access.canDeletePosts && (
                  <Button
                    variant="destructive"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete post"}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </ReachShell>
  );
}
