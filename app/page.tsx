"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@canopy/ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachPost, ReachIntegration, ReachPlatform } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { useReachWorkspaceId } from "@/lib/workspace-client";

function thisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { from, to };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card padding="md" className="border-0 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] shadow-[0_18px_44px_rgba(25,51,92,0.08)]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">{label}</p>
      <p className="mt-3 text-[2.2rem] font-semibold tracking-[-0.04em] text-[#172033]">{value}</p>
      {sub && <p className="mt-1 text-[13px] text-[#68788d]">{sub}</p>}
    </Card>
  );
}

export default function DashboardPage() {
  const workspaceId = useReachWorkspaceId();
  const [loading, setLoading]             = useState(true);
  const [scheduled, setScheduled]         = useState<ReachPost[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [integrations, setIntegrations]   = useState<ReachIntegration[]>([]);

  useEffect(() => {
    if (!workspaceId) {
      setScheduled([]);
      setPublishedCount(0);
      setIntegrations([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const { from, to } = thisMonthRange();
    setLoading(true);

    Promise.all([
      apiFetch(`/api/posts?workspaceId=${workspaceId}&status=scheduled`).then((r) => r.json()),
      apiFetch(`/api/posts?workspaceId=${workspaceId}&status=published&from=${from}&to=${to}`).then((r) => r.json()),
      apiFetch(`/api/integrations?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]).then(([sched, pub, ints]) => {
      if (cancelled) return;
      setScheduled(Array.isArray(sched) ? sched : []);
      setPublishedCount(Array.isArray(pub) ? pub.length : 0);
      setIntegrations(Array.isArray(ints) ? ints : []);
    }).catch(() => {
      if (cancelled) return;
      setScheduled([]);
      setPublishedCount(0);
      setIntegrations([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const nextPost = scheduled[0] ?? null;
  const connectedPlatforms = integrations.map((i) => i.platform);
  const draftCount = Math.max(0, scheduled.length - 1);

  return (
    <ReachShell
      activeNav="home"
      eyebrow="Dashboard"
      title="Canopy Reach"
      subtitle="Schedule and publish social media posts for your school."
      headerActions={
        <Button asChild variant="primary">
          <Link href="/posts/new">New Post</Link>
        </Button>
      }
    >
      {loading ? (
        <Card padding="md" className="border-0 bg-white/88 shadow-[0_18px_50px_rgba(26,54,93,0.08)]"><BodyText muted>Loading…</BodyText></Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_360px]">
            <Card className="overflow-hidden border-0 bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f8fbff_42%,#eef4ff_100%)] shadow-[0_28px_65px_rgba(25,51,92,0.10)]">
              <div className="px-6 py-6 sm:px-8 sm:py-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2f76dd]">Workspace pulse</p>
                <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
                  <div className="max-w-2xl">
                    <p className="text-[1.55rem] font-semibold tracking-[-0.04em] text-[#172033]">
                      {nextPost ? "Your next post is lined up." : "Your publishing queue is open."}
                    </p>
                    <p className="mt-2 text-[14px] leading-6 text-[#617286]">
                      {nextPost
                        ? `The next scheduled post goes out ${formatDateTime(nextPost.scheduledAt ?? nextPost.createdAt)}.`
                        : "Use Reach to draft, schedule, and keep one approved school social account active for your workspace."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-[#536274] shadow-[0_10px_22px_rgba(25,51,92,0.08)]">
                      {connectedPlatforms.length > 0 ? connectedPlatforms.map((platform) => PLATFORM_LABELS[platform]).join(", ") : "No accounts connected"}
                    </span>
                    <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-[#536274] shadow-[0_10px_22px_rgba(25,51,92,0.08)]">
                      {scheduled.length} scheduled
                    </span>
                  </div>
                </div>

                {nextPost ? (
                  <Link href={`/posts/${nextPost.id}`} className="mt-6 block">
                    <div className="rounded-[26px] bg-white/88 px-5 py-5 shadow-[0_18px_42px_rgba(25,51,92,0.08)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_52px_rgba(25,51,92,0.11)]">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Next scheduled post</p>
                          <p className="mt-3 line-clamp-2 text-[16px] leading-7 text-[#172033]">{nextPost.body}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {nextPost.platforms.map((platform: ReachPlatform) => (
                              <span key={platform} className="rounded-full bg-[#eff4ff] px-3 py-1 text-[12px] font-medium text-[#355b9b]">
                                {PLATFORM_LABELS[platform]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-2xl bg-[#f5f8fd] px-4 py-3 text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8392a6]">Scheduled for</p>
                          <p className="mt-2 text-[13px] font-medium text-[#172033]">{formatDateTime(nextPost.scheduledAt ?? nextPost.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="mt-6 rounded-[26px] bg-white/88 px-5 py-5 shadow-[0_18px_42px_rgba(25,51,92,0.08)]">
                    <p className="text-[15px] font-semibold text-[#172033]">Nothing is scheduled yet</p>
                    <p className="mt-2 text-[14px] leading-6 text-[#617286]">
                      Draft a few updates and line them up for the week so the school feed stays active without scrambling at the last minute.
                    </p>
                    <div className="mt-4">
                      <Button asChild variant="primary">
                        <Link href="/posts/new">Create your first post</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex flex-col gap-4">
              <StatCard label="Scheduled posts" value={scheduled.length} sub="Upcoming in the queue" />
              <StatCard label="Published this month" value={publishedCount} sub="Live activity this month" />
              <StatCard
                label="Connected accounts"
                value={connectedPlatforms.length}
                sub={connectedPlatforms.length === 0 ? "Approve your school account" : connectedPlatforms.map((p) => PLATFORM_LABELS[p]).join(", ")}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Card padding="md" className="border-0 bg-white/88 shadow-[0_18px_50px_rgba(26,54,93,0.08)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Queue overview</p>
                  <p className="mt-2 text-[1.1rem] font-semibold tracking-[-0.03em] text-[#172033]">What needs attention next</p>
                </div>
                <Button asChild variant="secondary">
                  <Link href="/calendar">Open calendar</Link>
                </Button>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-[22px] bg-[#f5f8fd] px-4 py-4">
                  <p className="text-[14px] font-semibold text-[#172033]">Upcoming scheduled posts</p>
                  <p className="mt-1 text-[13px] text-[#617286]">{scheduled.length === 0 ? "Nothing scheduled yet." : `${scheduled.length} post${scheduled.length === 1 ? "" : "s"} waiting to go out.`}</p>
                </div>
                <div className="rounded-[22px] bg-[#f7fbff] px-4 py-4">
                  <p className="text-[14px] font-semibold text-[#172033]">Recent publishing pace</p>
                  <p className="mt-1 text-[13px] text-[#617286]">{publishedCount} post{publishedCount === 1 ? "" : "s"} published this month.</p>
                </div>
                <div className="rounded-[22px] bg-[#f8fafc] px-4 py-4">
                  <p className="text-[14px] font-semibold text-[#172033]">Working set</p>
                  <p className="mt-1 text-[13px] text-[#617286]">{draftCount > 0 ? `${draftCount} additional scheduled item${draftCount === 1 ? "" : "s"} behind the next post.` : "Your queue is light right now, which is a good time to build next week’s content."}</p>
                </div>
              </div>
            </Card>

            {connectedPlatforms.length === 0 ? (
              <Card padding="md" className="border-0 bg-[linear-gradient(180deg,#fff8ec_0%,#fff3d9_100%)] shadow-[0_18px_50px_rgba(195,141,39,0.12)] sm:p-7">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#b7791f]">Setup needed</p>
                <p className="mt-2 text-[1.1rem] font-semibold tracking-[-0.03em] text-[#7c4a14]">No school social account is approved yet</p>
                <p className="mt-3 text-[14px] leading-6 text-[#9b5d16]">
                  Reach can draft and schedule content, but it cannot publish until the workspace owner or admin connects the school account.
                </p>
                <div className="mt-5">
                  <Button asChild variant="primary">
                    <Link href="/connect">Connect accounts</Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card padding="md" className="border-0 bg-[linear-gradient(180deg,#f4fbf7_0%,#eef9f3_100%)] shadow-[0_18px_50px_rgba(30,111,74,0.10)] sm:p-7">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#2c8a61]">Connected</p>
                <p className="mt-2 text-[1.1rem] font-semibold tracking-[-0.03em] text-[#184c39]">Your publishing path is ready</p>
                <p className="mt-3 text-[14px] leading-6 text-[#3b6b58]">
                  Reach is connected to {connectedPlatforms.map((platform) => PLATFORM_LABELS[platform]).join(", ")} for this workspace, so new posts can go live immediately or on schedule.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {connectedPlatforms.map((platform) => (
                    <span key={platform} className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-medium text-[#21533f] shadow-[0_10px_24px_rgba(30,111,74,0.08)]">
                      {PLATFORM_LABELS[platform]}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </ReachShell>
  );
}
