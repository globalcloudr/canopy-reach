"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, Badge, BodyText } from "@globalcloudr/canopy-ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachPost, ReachPlatform } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { useReachWorkspaceId } from "@/lib/workspace-client";
import { buildWorkspaceHref } from "@/lib/workspace-href";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function groupByDate(posts: ReachPost[]): Array<{ date: string; posts: ReachPost[] }> {
  const map = new Map<string, ReachPost[]>();
  for (const post of posts) {
    const key = post.scheduledAt
      ? new Date(post.scheduledAt).toDateString()
      : new Date(post.createdAt).toDateString();
    const group = map.get(key) ?? [];
    group.push(post);
    map.set(key, group);
  }
  return Array.from(map.entries()).map(([date, posts]) => ({ date, posts }));
}

const STATUS_BADGE: Record<string, string> = {
  scheduled:      "bg-[var(--surface-muted)] text-[var(--accent)]",
  published:      "bg-[#f0fdf4] text-[#059669]",
  draft:          "bg-[#f9fafb] text-[var(--text-muted)]",
  failed:         "bg-[#fef2f2] text-[#dc2626]",
  pending_review: "bg-[#fef3c7] text-[#d97706]",
  approved:       "bg-[#ecfdf5] text-[#059669]",
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "In review",
  approved:       "Approved",
};

type FilterView = "upcoming" | "published" | "drafts";

const UPCOMING_STATUSES = new Set(["scheduled", "approved", "pending_review"]);

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const workspaceId = useReachWorkspaceId();
  const workspaceSlug = searchParams.get("workspace")?.trim() || null;
  const [allPosts, setAllPosts]    = useState<ReachPost[]>([]);
  const [loading, setLoading]      = useState(true);
  const [filter, setFilter]        = useState<FilterView>("upcoming");

  useEffect(() => {
    if (!workspaceId) {
      setAllPosts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiFetch(`/api/posts?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAllPosts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setAllPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [workspaceId]);

  // Client-side filter
  const filteredPosts = allPosts.filter((post) => {
    if (filter === "upcoming") return UPCOMING_STATUSES.has(post.status);
    if (filter === "published") return post.status === "published";
    return post.status === "draft";
  });

  const groups = groupByDate(filteredPosts);
  const upcomingCount  = allPosts.filter((p) => UPCOMING_STATUSES.has(p.status)).length;
  const publishedCount = allPosts.filter((p) => p.status === "published").length;
  const draftCount     = allPosts.filter((p) => p.status === "draft").length;

  return (
    <ReachShell
      activeNav="calendar"
      eyebrow="Content"
      title="Calendar"
      subtitle="Your publishing pipeline at a glance."
      headerActions={
        <Button asChild variant="accent">
          <Link href={buildWorkspaceHref("/posts/new", workspaceSlug)}>New Post</Link>
        </Button>
      }
    >
      {loading ? (
        <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none"><BodyText muted>Loading posts…</BodyText></Card>
      ) : allPosts.length === 0 ? (
        <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none sm:p-8">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface-muted)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.6" className="h-7 w-7">
                <rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18" />
                <path d="M8 2v4M16 2v4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--ink)]">No posts yet</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Create your first post to start building your content calendar.</p>
            </div>
            <Button asChild variant="accent">
              <Link href={buildWorkspaceHref("/posts/new", workspaceSlug)}>New Post</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Filter tabs + counts */}
          <div className="flex flex-wrap items-center gap-3">
            {([
              { key: "upcoming" as const,  label: "Upcoming",  count: upcomingCount  },
              { key: "published" as const, label: "Published", count: publishedCount },
              { key: "drafts" as const,    label: "Drafts",    count: draftCount     },
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={[
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition",
                  filter === key
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--rule)] bg-[var(--surface-muted)] text-[#506176] hover:bg-[#e7eef9]",
                ].join(" ")}
              >
                {label}
                <span className={[
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold",
                  filter === key ? "bg-white/20 text-white" : "bg-[var(--rule)] text-[#506176]",
                ].join(" ")}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Post list */}
          {filteredPosts.length === 0 ? (
            <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none">
              <BodyText muted className="py-4 text-center">
                {filter === "upcoming" ? "Nothing scheduled yet." : filter === "published" ? "No published posts." : "No drafts."}
              </BodyText>
            </Card>
          ) : (
            groups.map(({ date, posts: groupPosts }) => (
              <div key={date}>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">{date}</p>
                <div className="flex flex-col gap-2">
                  {groupPosts.map((post) => (
                    <Link key={post.id} href={buildWorkspaceHref(`/posts/${post.id}`, workspaceSlug)}>
                      <Card padding="md" className="cursor-pointer border border-[var(--rule)] bg-white/62 shadow-none transition hover:translate-y-[-1px] hover:bg-white/78">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[15px] leading-6 text-[var(--ink)]">{post.body}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {post.platforms.map((p: ReachPlatform) => (
                                <span
                                  key={p}
                                  className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[12px] font-medium text-[var(--ink-2)]"
                                >
                                  {PLATFORM_LABELS[p]}
                                </span>
                              ))}
                              {post.scheduledAt && (
                                <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[12px] font-medium text-[#607287]">{formatTime(post.scheduledAt)}</span>
                              )}
                            </div>
                          </div>
                          <span className={[
                            "shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium capitalize",
                            STATUS_BADGE[post.status] ?? "bg-[#f9fafb] text-[var(--text-muted)]",
                          ].join(" ")}>
                            {STATUS_LABELS[post.status] ?? post.status}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </ReachShell>
  );
}
