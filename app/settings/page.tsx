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
        <Card padding="md"><BodyText muted>Loading…</BodyText></Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card padding="md">
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Workspace</p>
            <dl className="space-y-3">
              <div className="flex gap-4">
                <dt className="w-32 shrink-0 text-[14px] text-[#6b7280]">Name</dt>
                <dd className="text-[14px] text-[#202020]">{org?.name ?? "—"}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-32 shrink-0 text-[14px] text-[#6b7280]">Slug</dt>
                <dd className="font-mono text-[13px] text-[#202020]">{org?.slug ?? "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card padding="md">
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Account</p>
            <dl className="space-y-3">
              <div className="flex gap-4">
                <dt className="w-32 shrink-0 text-[14px] text-[#6b7280]">Email</dt>
                <dd className="text-[14px] text-[#202020]">{email ?? "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card padding="md" className="bg-[#f9fafb]">
            <p className="text-[13px] font-semibold text-[#374151]">Social accounts</p>
            <p className="mt-1 text-[13px] text-[#6b7280]">
              Manage connected social media accounts on the{" "}
              <a href="/connect" className="text-[#2f76dd] underline underline-offset-2">Accounts</a> page.
            </p>
          </Card>
        </div>
      )}
    </ReachShell>
  );
}
