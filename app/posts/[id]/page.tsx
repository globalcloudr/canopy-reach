"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@canopy/ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachPost } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";

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
  scheduled: "bg-[#eff6ff] text-[#2563eb]",
  published: "bg-[#f0fdf4] text-[#059669]",
  draft:     "bg-[#f9fafb] text-[#6b7280]",
  failed:    "bg-[#fef2f2] text-[#dc2626]",
};

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 text-center">
      <p className="text-2xl font-semibold tracking-tight text-[#202020]">{value}</p>
      <p className="mt-1 text-[13px] text-[#6b7280]">{label}</p>
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const workspaceId = useReachWorkspaceId();

  const [post, setPost]           = useState<ReachPost | null>(null);
  const [analytics, setAnalytics] = useState<PostAnalytics | null>(null);
  const [access, setAccess]       = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

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
      router.push("/calendar");
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
        <Card padding="md"><BodyText muted>Loading…</BodyText></Card>
      ) : error ? (
        <Card padding="md"><BodyText muted>{error}</BodyText></Card>
      ) : !post ? (
        <Card padding="md"><BodyText muted>Post not found.</BodyText></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Post content */}
          <Card padding="md" className="sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className={[
                    "rounded-full px-2.5 py-0.5 text-[12px] font-medium capitalize",
                    STATUS_BADGE[post.status] ?? "bg-[#f9fafb] text-[#6b7280]",
                  ].join(" ")}>
                    {post.status}
                  </span>
                  {post.platforms.map((p) => (
                    <span key={p} className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[12px] font-medium text-[#374151]">
                      {PLATFORM_LABELS[p]}
                    </span>
                  ))}
                </div>
                <p className="whitespace-pre-wrap text-[15px] text-[#202020] leading-relaxed">{post.body}</p>
                {post.mediaUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.mediaUrl} alt="" className="mt-4 max-h-64 rounded-lg object-cover" />
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-6 text-[13px] text-[#6b7280] border-t border-[#f1f5f9] pt-4">
              {post.scheduledAt && (
                <span>Scheduled: {formatDateTime(post.scheduledAt)}</span>
              )}
              {post.publishedAt && (
                <span>Published: {formatDateTime(post.publishedAt)}</span>
              )}
              <span>Created: {formatDateTime(post.createdAt)}</span>
            </div>
          </Card>

          {/* Engagement stats */}
          {post.status === "published" && (
            <Card padding="md">
              <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Engagement</p>
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
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button asChild variant="secondary">
              <Link href="/calendar">Back to calendar</Link>
            </Button>
            {post.status !== "published" && access.canEditPosts && (
              <Button asChild variant="primary">
                <Link href={`/posts/${post.id}/edit`}>Edit post</Link>
              </Button>
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
        </div>
      )}
    </ReachShell>
  );
}
