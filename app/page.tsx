"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@canopy/ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachPost, ReachIntegration, ReachPlatform } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";

function getStoredOrgId(): string | null {
  try { return window.localStorage.getItem("cr_active_org_id_v1"); } catch { return null; }
}

function thisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { from, to };
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card padding="md" className="flex flex-col gap-1">
      <p className="text-[13px] text-[#6b7280]">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-[#202020]">{value}</p>
      {sub && <p className="text-[12px] text-[#9ca3af]">{sub}</p>}
    </Card>
  );
}

export default function DashboardPage() {
  const [loading, setLoading]             = useState(true);
  const [scheduled, setScheduled]         = useState<ReachPost[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [integrations, setIntegrations]   = useState<ReachIntegration[]>([]);

  useEffect(() => {
    const id = getStoredOrgId();
    if (!id) { setLoading(false); return; }
    const { from, to } = thisMonthRange();

    Promise.all([
      apiFetch(`/api/posts?workspaceId=${id}&status=scheduled`).then((r) => r.json()),
      apiFetch(`/api/posts?workspaceId=${id}&status=published&from=${from}&to=${to}`).then((r) => r.json()),
      apiFetch(`/api/integrations?workspaceId=${id}`).then((r) => r.json()),
    ]).then(([sched, pub, ints]) => {
      setScheduled(Array.isArray(sched) ? sched : []);
      setPublishedCount(Array.isArray(pub) ? pub.length : 0);
      setIntegrations(Array.isArray(ints) ? ints : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const nextPost = scheduled[0] ?? null;
  const connectedPlatforms = integrations.map((i) => i.platform);

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
        <Card padding="md"><BodyText muted>Loading…</BodyText></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Scheduled posts"
              value={scheduled.length}
              sub="upcoming"
            />
            <StatCard
              label="Published this month"
              value={publishedCount}
            />
            <StatCard
              label="Connected accounts"
              value={connectedPlatforms.length}
              sub={connectedPlatforms.length === 0 ? "none connected" : connectedPlatforms.map((p) => PLATFORM_LABELS[p]).join(", ")}
            />
          </div>

          {/* Next scheduled post */}
          {nextPost ? (
            <Card padding="md">
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Next scheduled post</p>
              <Link href={`/posts/${nextPost.id}`} className="block">
                <div className="flex items-start justify-between gap-4 rounded-lg p-3 hover:bg-[#f9fafb] transition">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] text-[#202020]">{nextPost.body}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {nextPost.platforms.map((p: ReachPlatform) => (
                        <span key={p} className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-[12px] font-medium text-[#374151]">
                          {PLATFORM_LABELS[p]}
                        </span>
                      ))}
                      {nextPost.scheduledAt && (
                        <span className="text-[12px] text-[#9ca3af]">
                          {new Date(nextPost.scheduledAt).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </Card>
          ) : (
            <Card padding="md">
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Next scheduled post</p>
              <BodyText muted>Nothing scheduled. Create your first post to get started.</BodyText>
            </Card>
          )}

          {/* No accounts warning */}
          {connectedPlatforms.length === 0 && (
            <Card padding="md" className="border-amber-200 bg-amber-50">
              <p className="text-[14px] font-medium text-amber-800">No social accounts connected</p>
              <p className="mt-1 text-[13px] text-amber-700">Connect your school's accounts before publishing posts.</p>
              <div className="mt-3">
                <Button asChild variant="secondary">
                  <Link href="/connect">Connect accounts</Link>
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </ReachShell>
  );
}
