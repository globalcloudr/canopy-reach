"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, Badge, BodyText } from "@canopy/ui";
import type { ReachPost, ReachPlatform } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";

function getStoredOrgId(): string | null {
  try { return window.localStorage.getItem("cr_active_org_id_v1"); } catch { return null; }
}

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
  const [posts, setPosts]           = useState<ReachPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterStatus>("all");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const id = getStoredOrgId();
    if (!id) { setLoading(false); return; }
    setWorkspaceId(id);

    const params = new URLSearchParams({ workspaceId: id });
    if (filter !== "all") params.set("status", filter);

    fetch(`/api/posts?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [filter]);

  const groups = groupByDate(posts);

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
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "scheduled", "published", "draft"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => { setLoading(true); setFilter(s); }}
            className={[
              "rounded-lg border px-4 py-2 text-[14px] font-medium capitalize transition",
              filter === s
                ? "border-[#2f76dd] bg-[#eff6ff] text-[#2f76dd]"
                : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#93c5fd]",
            ].join(" ")}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <Card padding="md"><BodyText muted>Loading posts…</BodyText></Card>
      ) : posts.length === 0 ? (
        <Card padding="md" className="sm:p-8">
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
        <div className="flex flex-col gap-6">
          {groups.map(({ date, posts: groupPosts }) => (
            <div key={date}>
              <p className="mb-2 text-[13px] font-semibold text-[#6b7280]">{date}</p>
              <div className="flex flex-col gap-2">
                {groupPosts.map((post) => (
                  <Link key={post.id} href={`/posts/${post.id}`}>
                    <Card padding="md" className="cursor-pointer hover:border-[#93c5fd] transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] text-[#202020]">{post.body}</p>
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
                              <span className="text-[12px] text-[#9ca3af]">{formatTime(post.scheduledAt)}</span>
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
