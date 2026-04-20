"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReachShell } from "@/app/_components/reach-shell";
import { AppPill, Button, Card, BodyText, DashboardHero } from "@globalcloudr/canopy-ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachPost, ReachIntegration, ReachPlatform } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";
import { buildWorkspaceHref } from "@/lib/workspace-href";

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
    <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">{label}</p>
      <p className="mt-3 text-[2.2rem] font-semibold tracking-[-0.04em] text-[#172033]">{value}</p>
      {sub && <p className="mt-1 text-[13px] text-[#68788d]">{sub}</p>}
    </Card>
  );
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const workspaceId = useReachWorkspaceId();
  const workspaceSlug = searchParams.get("workspace")?.trim() || null;
  const [loading, setLoading]               = useState(true);
  const [scheduled, setScheduled]           = useState<ReachPost[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [integrations, setIntegrations]     = useState<ReachIntegration[]>([]);
  const [access, setAccess]                 = useState(DEFAULT_REACH_CLIENT_ACCESS);

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
      apiFetch(`/api/posts?workspaceId=${workspaceId}&status=pending_review`).then((r) => r.json()),
      apiFetch(`/api/integrations?workspaceId=${workspaceId}`).then((r) => r.json()),
      getClientWorkspaceAccess(workspaceId),
    ]).then(([sched, pub, pending, ints, nextAccess]) => {
      if (cancelled) return;
      setScheduled(Array.isArray(sched) ? sched : []);
      setPublishedCount(Array.isArray(pub) ? pub.length : 0);
      setPendingReviewCount(Array.isArray(pending) ? pending.length : 0);
      setIntegrations(Array.isArray(ints) ? ints : []);
      setAccess(nextAccess as typeof access);
    }).catch(() => {
      if (cancelled) return;
      setScheduled([]);
      setPublishedCount(0);
      setPendingReviewCount(0);
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
    <ReachShell activeNav="home">
      <DashboardHero
        eyebrow="Canopy Reach"
        headline="Reach Your School Community"
        subheading="Schedule and publish social media posts for your school."
        ctaLabel="New Post"
        ctaHref={buildWorkspaceHref("/posts/new", workspaceSlug)}
        illustration={
          <svg width="140" height="120" viewBox="0 0 140 120" fill="none" aria-hidden="true">
            <circle cx="70" cy="60" r="36" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" opacity="0.5" />
            <circle cx="70" cy="60" r="20" stroke="currentColor" strokeWidth="2" />
            <circle cx="70" cy="60" r="5" fill="currentColor" />
            <line x1="70" y1="14" x2="70" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="70" y1="94" x2="70" y2="106" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="60" x2="26" y2="60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="114" y1="60" x2="126" y2="60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="70" cy="14" r="4" fill="currentColor" opacity="0.7" />
            <circle cx="116" cy="34" r="3" fill="currentColor" opacity="0.5" />
            <circle cx="24" cy="86" r="3" fill="currentColor" opacity="0.5" />
          </svg>
        }
      />
      {loading ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none"><BodyText muted>Loading…</BodyText></Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_360px]">
            <Card className="overflow-hidden border border-[#dfe7f4] bg-transparent shadow-none">
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
                    <AppPill>
                      {connectedPlatforms.length > 0 ? connectedPlatforms.map((platform) => PLATFORM_LABELS[platform]).join(", ") : "No accounts connected"}
                    </AppPill>
                    <AppPill>
                      {scheduled.length} scheduled
                    </AppPill>
                  </div>
                </div>

                {nextPost ? (
                  <Link href={buildWorkspaceHref(`/posts/${nextPost.id}`, workspaceSlug)} className="mt-6 block">
                    <div className="rounded-[26px] border border-white/75 bg-white/70 px-5 py-5 shadow-[0_12px_30px_rgba(25,51,92,0.05)] transition hover:translate-y-[-1px] hover:bg-white/78 hover:shadow-[0_16px_36px_rgba(25,51,92,0.07)]">
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
                        <div className="shrink-0 rounded-2xl border border-white/70 bg-white/58 px-4 py-3 text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8392a6]">Scheduled for</p>
                          <p className="mt-2 text-[13px] font-medium text-[#172033]">{formatDateTime(nextPost.scheduledAt ?? nextPost.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="mt-6 rounded-[26px] border border-white/75 bg-white/70 px-5 py-5 shadow-[0_12px_30px_rgba(25,51,92,0.05)]">
                    <p className="text-[15px] font-semibold text-[#172033]">Nothing is scheduled yet</p>
                    <p className="mt-2 text-[14px] leading-6 text-[#617286]">
                      Draft a few updates and line them up for the week so the school feed stays active without scrambling at the last minute.
                    </p>
                    <div className="mt-4">
                      <Button asChild variant="primary">
                        <Link href={buildWorkspaceHref("/posts/new", workspaceSlug)}>Create your first post</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex flex-col gap-4">
              <StatCard label="Scheduled posts" value={scheduled.length} sub="Upcoming in the queue" />
              <StatCard label="Published this month" value={publishedCount} sub="Live activity this month" />
              {access.canReviewPosts && (
                <Link href={buildWorkspaceHref("/review", workspaceSlug)}>
                  <Card padding="md" className={[
                    "border shadow-none transition hover:translate-y-[-1px]",
                    pendingReviewCount > 0
                      ? "border-[#f2e4bc] bg-[#fffbeb]"
                      : "border-[#dfe7f4] bg-transparent",
                  ].join(" ")}>
                    <p className={[
                      "text-[12px] font-semibold uppercase tracking-[0.08em]",
                      pendingReviewCount > 0 ? "text-[#b7791f]" : "text-[#7f8ea3]",
                    ].join(" ")}>Pending review</p>
                    <p className={[
                      "mt-3 text-[2.2rem] font-semibold tracking-[-0.04em]",
                      pendingReviewCount > 0 ? "text-[#92400e]" : "text-[#172033]",
                    ].join(" ")}>{pendingReviewCount}</p>
                    <p className="mt-1 text-[13px] text-[#68788d]">
                      {pendingReviewCount === 0 ? "All caught up" : `${pendingReviewCount} post${pendingReviewCount === 1 ? "" : "s"} awaiting your review`}
                    </p>
                  </Card>
                </Link>
              )}
              <StatCard
                label="Connected accounts"
                value={connectedPlatforms.length}
                sub={connectedPlatforms.length === 0 ? "Approve your school account" : connectedPlatforms.map((p) => PLATFORM_LABELS[p]).join(", ")}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Queue overview</p>
                  <p className="mt-2 text-[1.1rem] font-semibold tracking-[-0.03em] text-[#172033]">What needs attention next</p>
                </div>
                <Button asChild variant="secondary">
                  <Link href={buildWorkspaceHref("/calendar", workspaceSlug)}>Open calendar</Link>
                </Button>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-[22px] border border-white/70 bg-white/58 px-4 py-4">
                  <p className="text-[14px] font-semibold text-[#172033]">Upcoming scheduled posts</p>
                  <p className="mt-1 text-[13px] text-[#617286]">{scheduled.length === 0 ? "Nothing scheduled yet." : `${scheduled.length} post${scheduled.length === 1 ? "" : "s"} waiting to go out.`}</p>
                </div>
                <div className="rounded-[22px] border border-white/70 bg-white/56 px-4 py-4">
                  <p className="text-[14px] font-semibold text-[#172033]">Recent publishing pace</p>
                  <p className="mt-1 text-[13px] text-[#617286]">{publishedCount} post{publishedCount === 1 ? "" : "s"} published this month.</p>
                </div>
                <div className="rounded-[22px] border border-white/70 bg-white/54 px-4 py-4">
                  <p className="text-[14px] font-semibold text-[#172033]">Working set</p>
                  <p className="mt-1 text-[13px] text-[#617286]">{draftCount > 0 ? `${draftCount} additional scheduled item${draftCount === 1 ? "" : "s"} behind the next post.` : "Your queue is light right now, which is a good time to build next week’s content."}</p>
                </div>
              </div>
            </Card>

            {connectedPlatforms.length === 0 ? (
              <Card padding="md" className="border border-[#f2e4bc] bg-transparent shadow-none sm:p-7">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#b7791f]">Setup needed</p>
                <p className="mt-2 text-[1.1rem] font-semibold tracking-[-0.03em] text-[#7c4a14]">No school social account is approved yet</p>
                <p className="mt-3 text-[14px] leading-6 text-[#9b5d16]">
                  Reach can draft and schedule content, but it cannot publish until the workspace owner or admin connects the school account.
                </p>
                <div className="mt-5">
                  <Button asChild variant="primary">
                    <Link href={buildWorkspaceHref("/connect", workspaceSlug)}>Connect accounts</Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card padding="md" className="border border-[#d8eadf] bg-transparent shadow-none sm:p-7">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#2c8a61]">Connected</p>
                <p className="mt-2 text-[1.1rem] font-semibold tracking-[-0.03em] text-[#184c39]">Your publishing path is ready</p>
                <p className="mt-3 text-[14px] leading-6 text-[#3b6b58]">
                  Reach is connected to {connectedPlatforms.map((platform) => PLATFORM_LABELS[platform]).join(", ")} for this workspace, so new posts can go live immediately or on schedule.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {connectedPlatforms.map((platform) => (
                    <AppPill key={platform} tone="success">
                      {PLATFORM_LABELS[platform]}
                    </AppPill>
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
