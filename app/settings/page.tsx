"use client";

import { useEffect, useState } from "react";
import { ReachShell } from "@/app/_components/reach-shell";
import { Card, BodyText } from "@canopy/ui";
import { supabase } from "@/lib/supabase-client";
import { useReachWorkspaceId } from "@/lib/workspace-client";

type OrgInfo = { id: string; name: string; slug: string };

export default function SettingsPage() {
  const workspaceId = useReachWorkspaceId();
  const [org, setOrg]       = useState<OrgInfo | null>(null);
  const [email, setEmail]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email ?? null);
    });

    if (!workspaceId) {
      setOrg(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const { data } = await supabase
          .from("organizations")
          .select("id,name,slug")
          .eq("id", workspaceId)
          .single();
        if (!cancelled && data) setOrg(data as OrgInfo);
      } catch { /* no-op */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <ReachShell
      activeNav="settings"
      eyebrow="Settings"
      title="Settings"
      subtitle="Workspace information for Canopy Reach."
    >
      {loading ? (
        <Card padding="md" className="border-0 bg-white/88 shadow-[0_18px_50px_rgba(26,54,93,0.08)]"><BodyText muted>Loading…</BodyText></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card padding="md" className="border-0 bg-white/88 shadow-[0_20px_52px_rgba(26,54,93,0.08)] sm:p-7">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Workspace identity</p>
            <p className="mt-3 text-[1.2rem] font-semibold tracking-[-0.03em] text-[#172033]">This is the school context Reach is using right now.</p>
            <dl className="space-y-3">
              <div className="mt-6 flex gap-4">
                <dt className="w-32 shrink-0 text-[14px] text-[#6b7280]">Name</dt>
                <dd className="text-[14px] text-[#202020]">{org?.name ?? "—"}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-32 shrink-0 text-[14px] text-[#6b7280]">Slug</dt>
                <dd className="font-mono text-[13px] text-[#202020]">{org?.slug ?? "—"}</dd>
              </div>
            </dl>
          </Card>

          <div className="flex flex-col gap-5">
          <Card padding="md" className="border-0 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] shadow-[0_18px_44px_rgba(25,51,92,0.08)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Account</p>
            <dl className="space-y-3">
              <div className="mt-4 flex gap-4">
                <dt className="w-32 shrink-0 text-[14px] text-[#6b7280]">Email</dt>
                <dd className="text-[14px] text-[#202020]">{email ?? "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card padding="md" className="border-0 bg-[linear-gradient(180deg,#fbfdff_0%,#f1f6ff_100%)] shadow-[0_18px_44px_rgba(25,51,92,0.08)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Workspace controls</p>
            <p className="mt-3 text-[14px] font-semibold text-[#172033]">Social account management</p>
            <p className="mt-2 text-[13px] leading-6 text-[#6b7280]">
              Manage connected social media accounts on the{" "}
              <a href="/connect" className="text-[#2f76dd] underline underline-offset-2">Accounts</a> page.
            </p>
          </Card>
          </div>
        </div>
      )}
    </ReachShell>
  );
}
