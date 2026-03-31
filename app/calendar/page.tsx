"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, Badge, BodyText } from "@canopy/ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachPost, ReachPlatform } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { useReachWorkspaceId } from "@/lib/workspace-client";

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
  scheduled: "bg-[#eff6ff] text-[#2563eb]",
  published: "bg-[#f0fdf4] text-[#059669]",
  draft:     "bg-[#f9fafb] text-[#6b7280]",
  failed:    "bg-[#fef2f2] text-[#dc2626]",
};

type FilterStatus = "all" | "scheduled" | "published" | "draft";

export default function CalendarPage() {
  const workspaceId = useReachWorkspaceId();
  const [posts, setPosts]           = useState<ReachPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterStatus>("all");

  useEffect(() => {
    if (!workspaceId) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ workspaceId });
    if (filter !== "all") params.set("status", filter);
    let cancelled = false;
    setLoading(true);

    apiFetch(`/api/posts?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setPosts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, workspaceId]);

  const groups = groupByDate(posts);
  const scheduledCount = posts.filter((post) => post.status === "scheduled").length;
  const publishedCount = posts.filter((post) => post.status === "published").length;
  const draftCount = posts.filter((post) => post.status === "draft").length;

  return (
    <ReachShell
      activeNav="calendar"
      eyebrow="Content"
      title="Calendar"
      subtitle="All scheduled, published, and draft posts for this workspace."
      headerActions={
        <Button asChild variant="primary">
          <Link href="/posts/new">New Post</Link>
        </Button>
      }
    >
      {loading ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none"><BodyText muted>Loading posts…</BodyText></Card>
      ) : posts.length === 0 ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none sm:p-8">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f1f5f9]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.6" className="h-7 w-7">
                <rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18" />
                <path d="M8 2v4M16 2v4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[#202020]">No posts yet</p>
              <p className="mt-1 text-sm text-[#6b7280]">Create your first post to start building your content calendar.</p>
            </div>
            <Button asChild variant="primary">
              <Link href="/posts/new">New Post</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_340px]">
            <Card className="overflow-hidden border border-[#dfe7f4] bg-transparent shadow-none">
              <div className="px-6 py-6 sm:px-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2f76dd]">Calendar flow</p>
                <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-[1.4rem] font-semibold tracking-[-0.03em] text-[#172033]">
                      See what is going out, what already landed, and what still needs shaping.
                    </p>
                    <p className="mt-2 text-[14px] leading-6 text-[#617286]">
                      Use the view below as your working agenda for the school account, then open any post to edit timing, wording, or media.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["all", "scheduled", "published", "draft"] as FilterStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => { setLoading(true); setFilter(s); }}
                        className={[
                          "rounded-full px-4 py-2 text-[14px] font-medium capitalize transition",
                          filter === s
                            ? "border border-[#2f76dd] bg-[#2f76dd] text-white"
                            : "border border-[#d7e3f3] bg-[#edf3fb] text-[#415163] hover:bg-[#e7eef9]",
                        ].join(" ")}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4">
              <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Scheduled</p>
                <p className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-[#172033]">{scheduledCount}</p>
              </Card>
              <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Published</p>
                <p className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-[#172033]">{publishedCount}</p>
              </Card>
              <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Drafts</p>
                <p className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-[#172033]">{draftCount}</p>
              </Card>
            </div>
          </div>

          {groups.map(({ date, posts: groupPosts }) => (
            <div key={date}>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">{date}</p>
              <div className="flex flex-col gap-2">
                {groupPosts.map((post) => (
                  <Link key={post.id} href={`/posts/${post.id}`}>
                    <Card padding="md" className="cursor-pointer border border-[#dfe7f4] bg-white/62 shadow-none transition hover:translate-y-[-1px] hover:bg-white/78">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[15px] leading-6 text-[#172033]">{post.body}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {post.platforms.map((p: ReachPlatform) => (
                              <span
                                key={p}
                                className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[12px] font-medium text-[#374151]"
                              >
                                {PLATFORM_LABELS[p]}
                              </span>
                            ))}
                            {post.scheduledAt && (
                              <span className="rounded-full bg-[#f5f8fd] px-3 py-1 text-[12px] font-medium text-[#607287]">{formatTime(post.scheduledAt)}</span>
                            )}
                          </div>
                        </div>
                        <span className={[
                          "shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium capitalize",
                          STATUS_BADGE[post.status] ?? "bg-[#f9fafb] text-[#6b7280]",
                        ].join(" ")}>
                          {post.status}
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </ReachShell>
  );
}
