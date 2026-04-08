"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@canopy/ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachPost, ReachPlatform } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";
import { buildWorkspaceHref } from "@/lib/workspace-href";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReviewPage() {
  const searchParams = useSearchParams();
  const workspaceId = useReachWorkspaceId();
  const workspaceSlug = searchParams.get("workspace")?.trim() || null;

  const [posts, setPosts]           = useState<ReachPost[]>([]);
  const [access, setAccess]         = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [loading, setLoading]       = useState(true);
  const [actioning, setActioning]   = useState<string | null>(null);
  const [rejectPostId, setRejectPostId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError]           = useState<string | null>(null);

  const loadPosts = useCallback((id: string) => {
    return apiFetch(`/api/posts?workspaceId=${id}&status=pending_review`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? data : [])
      .catch(() => []);
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setPosts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      loadPosts(workspaceId),
      getClientWorkspaceAccess(workspaceId),
    ]).then(([nextPosts, nextAccess]) => {
      if (cancelled) return;
      setPosts(nextPosts as ReachPost[]);
      setAccess(nextAccess);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [workspaceId, loadPosts]);

  async function handleApprove(postId: string) {
    if (!workspaceId) return;
    setActioning(postId);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/posts/${postId}/approve?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to approve post.");
      }
      setPosts(await loadPosts(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve post.");
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(postId: string) {
    if (!workspaceId) return;
    setActioning(postId);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/posts/${postId}/reject?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewNote: rejectNote.trim() || null }),
        }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to reject post.");
      }
      setRejectPostId(null);
      setRejectNote("");
      setPosts(await loadPosts(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject post.");
    } finally {
      setActioning(null);
    }
  }

  return (
    <ReachShell
      activeNav="review"
      eyebrow="Workflow"
      title="Review Queue"
      subtitle="Posts submitted by staff waiting for approval before publishing."
    >
      {error && (
        <div className="rounded-xl border border-[#f1d1d1] bg-transparent px-4 py-3 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
          <BodyText muted>Loading…</BodyText>
        </Card>
      ) : !access.canReviewPosts ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none sm:p-8">
          <div className="py-6 text-center">
            <p className="font-semibold text-[#202020]">Access restricted</p>
            <p className="mt-1 text-sm text-[#6b7280]">Only workspace owners and admins can review posts.</p>
          </div>
        </Card>
      ) : posts.length === 0 ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none sm:p-8">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f0fdf4]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.6" className="h-7 w-7">
                <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[#202020]">All caught up</p>
              <p className="mt-1 text-sm text-[#6b7280]">No posts are waiting for review right now.</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <Card
              key={post.id}
              className="overflow-hidden border border-[#dfe7f4] bg-transparent shadow-none"
            >
              <div className="px-6 py-5 sm:px-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Post body preview */}
                    <p className="line-clamp-3 text-[15px] leading-6 text-[#172033]">{post.body}</p>

                    {/* Meta row */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {post.platforms.map((p: ReachPlatform) => (
                        <span
                          key={p}
                          className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[12px] font-medium text-[#374151]"
                        >
                          {PLATFORM_LABELS[p]}
                        </span>
                      ))}
                      {post.scheduledAt && (
                        <span className="rounded-full bg-[#eff6ff] px-3 py-0.5 text-[12px] font-medium text-[#2563eb]">
                          Scheduled for {formatDate(post.scheduledAt)}
                        </span>
                      )}
                      <span className="text-[12px] text-[#9ca3af]">
                        Submitted {formatDate(post.createdAt)}
                      </span>
                    </div>

                    {/* Image preview */}
                    {post.mediaUrl && (
                      <div className="mt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.mediaUrl}
                          alt="Post media"
                          className="h-24 w-24 rounded-lg object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* View link */}
                  <Link
                    href={buildWorkspaceHref(`/posts/${post.id}`, workspaceSlug)}
                    className="shrink-0 text-[13px] font-medium text-[#2f76dd] hover:underline"
                  >
                    View
                  </Link>
                </div>

                {/* Reject note input (shown only for this post) */}
                {rejectPostId === post.id && (
                  <div className="mt-4 rounded-xl border border-[#f1d1d1] bg-[#fef9f9] px-4 py-4">
                    <p className="mb-2 text-[13px] font-medium text-[#172033]">Rejection note (optional)</p>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="Let the author know why this post needs changes…"
                      rows={3}
                      className="w-full resize-none rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[14px] leading-6 text-[#172033] placeholder:text-[#9ca3af] focus:border-[#2f76dd] focus:outline-none"
                    />
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="primary"
                        onClick={() => void handleReject(post.id)}
                        disabled={actioning === post.id}
                      >
                        {actioning === post.id ? "Rejecting…" : "Confirm Reject"}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => { setRejectPostId(null); setRejectNote(""); }}
                        disabled={actioning === post.id}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {rejectPostId !== post.id && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="primary"
                      onClick={() => void handleApprove(post.id)}
                      disabled={!!actioning}
                    >
                      {actioning === post.id ? "Approving…" : "Approve"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => { setRejectPostId(post.id); setRejectNote(""); }}
                      disabled={!!actioning}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </ReachShell>
  );
}
