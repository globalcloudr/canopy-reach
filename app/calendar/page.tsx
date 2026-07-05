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
import { CalendarMonthGrid, STATUS_BADGE } from "@/app/_components/calendar-month-grid";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Turn a `toDateString()` group key into a friendly heading: "Today", "Tomorrow", or "Friday, July 4". */
function formatGroupHeading(dateKey: string): string {
  const date = new Date(dateKey);
  if (Number.isNaN(date.getTime())) return dateKey;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
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

const STATUS_LABELS: Record<string, string> = {
  pending_review: "In review",
  approved:       "Approved",
  failed:         "Failed",
};

type FilterView = "upcoming" | "published" | "drafts" | "failed";
type CalendarViewMode = "list" | "month";

const VIEW_MODE_STORAGE_KEY = "reach.calendar.viewMode";

const UPCOMING_STATUSES = new Set(["scheduled", "approved", "pending_review"]);

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const workspaceId = useReachWorkspaceId();
  const workspaceSlug = searchParams.get("workspace")?.trim() || null;
  const [allPosts, setAllPosts]    = useState<ReachPost[]>([]);
  const [loading, setLoading]      = useState(true);
  const [filter, setFilter]        = useState<FilterView>("upcoming");
  const [viewMode, setViewMode]    = useState<CalendarViewMode>("month");

  // Restore the persisted view choice after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === "list" || stored === "month") setViewMode(stored);
  }, []);

  function changeViewMode(mode: CalendarViewMode) {
    setViewMode(mode);
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Persistence is best-effort; ignore storage failures (private mode, quota).
    }
  }

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
    if (filter === "failed") return post.status === "failed";
    return post.status === "draft";
  });

  const groups = groupByDate(filteredPosts);
  const upcomingCount  = allPosts.filter((p) => UPCOMING_STATUSES.has(p.status)).length;
  const publishedCount = allPosts.filter((p) => p.status === "published").length;
  const draftCount     = allPosts.filter((p) => p.status === "draft").length;
  const failedCount    = allPosts.filter((p) => p.status === "failed").length;

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
              // Failed posts need attention — only surface the tab when they exist.
              ...(failedCount > 0 || filter === "failed"
                ? [{ key: "failed" as const, label: "Needs attention", count: failedCount }]
                : []),
            ]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={[
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition",
                  filter === key
                    ? key === "failed"
                      ? "border-[#dc2626] bg-[#dc2626] text-white"
                      : "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : key === "failed"
                      ? "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] hover:bg-[#fee2e2]"
                      : "border-[var(--rule)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[#e7eef9]",
                ].join(" ")}
              >
                {label}
                <span className={[
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold",
                  filter === key
                    ? "bg-white/20 text-white"
                    : key === "failed"
                      ? "bg-[#fecaca] text-[#b91c1c]"
                      : "bg-[var(--rule)] text-[var(--text-muted)]",
                ].join(" ")}>
                  {count}
                </span>
              </button>
            ))}

            {/* View toggle */}
            <div className="ml-auto flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--surface-muted)] p-1">
              {([
                { key: "list" as const,  label: "List"  },
                { key: "month" as const, label: "Month" },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => changeViewMode(key)}
                  aria-pressed={viewMode === key}
                  className={[
                    "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
                    viewMode === key
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text-muted)] hover:bg-[#e7eef9] hover:text-[var(--ink)]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {viewMode === "month" ? (
            <CalendarMonthGrid posts={filteredPosts} workspaceSlug={workspaceSlug} />
          ) : filteredPosts.length === 0 ? (
            <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none">
              <BodyText muted className="py-4 text-center">
                {filter === "upcoming"
                  ? "Nothing scheduled yet."
                  : filter === "published"
                    ? "No published posts."
                    : filter === "failed"
                      ? "No failed posts — everything published cleanly."
                      : "No drafts."}
              </BodyText>
            </Card>
          ) : (
            groups.map(({ date, posts: groupPosts }) => (
              <div key={date}>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{formatGroupHeading(date)}</p>
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
