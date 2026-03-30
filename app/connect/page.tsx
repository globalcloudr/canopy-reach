"use client";

import { useEffect, useState } from "react";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@canopy/ui";
import type { ReachIntegration, ReachPlatform } from "@/lib/reach-schema";
import { REACH_PLATFORMS, PLATFORM_LABELS } from "@/lib/reach-schema";

function getStoredOrgId(): string | null {
  try { return window.localStorage.getItem("cr_active_org_id_v1"); } catch { return null; }
}

const PLATFORM_DESCRIPTIONS: Record<ReachPlatform, string> = {
  facebook:  "Post to your school's Facebook page.",
  instagram: "Share photos and updates on Instagram.",
  linkedin:  "Reach professional audiences and employers.",
  x:         "Short-form updates and announcements.",
};

export default function ConnectPage() {
  const [workspaceId, setWorkspaceId]   = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<ReachIntegration[]>([]);
  const [loading, setLoading]           = useState(true);
  const [syncing, setSyncing]           = useState(false);
  const [connecting, setConnecting]     = useState<ReachPlatform | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [message, setMessage]           = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  function loadIntegrations(id: string) {
    return fetch(`/api/integrations?workspaceId=${id}`)
      .then((r) => r.json())
      .then((data) => setIntegrations(Array.isArray(data) ? data : []))
      .catch(() => setIntegrations([]));
  }

  useEffect(() => {
    const id = getStoredOrgId();
    if (!id) { setLoading(false); return; }
    setWorkspaceId(id);
    loadIntegrations(id).finally(() => setLoading(false));
  }, []);

  async function handleConnect(platform: ReachPlatform) {
    setConnecting(platform);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/oauth-url?platform=${platform}`);
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not get connect URL.");
      // Open Postiz OAuth in new tab — user completes flow, then syncs
      window.open(data.url, "_blank");
      setMessage(`Complete the ${PLATFORM_LABELS[platform]} connection in the new tab, then click "Sync accounts".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get connect URL.");
    } finally {
      setConnecting(null);
    }
  }

  async function handleSync() {
    if (!workspaceId) return;
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = (await res.json()) as { synced?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      await loadIntegrations(workspaceId);
      setMessage(
        data.synced?.length
          ? `Synced: ${data.synced.map((p) => PLATFORM_LABELS[p as ReachPlatform]).join(", ")}.`
          : "No new accounts found. Make sure you completed the connection in Postiz."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect(integration: ReachIntegration) {
    if (!workspaceId) return;
    if (!confirm(`Disconnect ${PLATFORM_LABELS[integration.platform]}? You can reconnect at any time.`)) return;
    setDisconnecting(integration.id);
    try {
      const res = await fetch(`/api/integrations/${integration.id}?workspaceId=${workspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to disconnect.");
      }
      await loadIntegrations(workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setDisconnecting(null);
    }
  }

  const connectedMap = Object.fromEntries(
    integrations.map((i) => [i.platform, i])
  ) as Partial<Record<ReachPlatform, ReachIntegration>>;

  return (
    <ReachShell
      activeNav="connect"
      eyebrow="Setup"
      title="Connected Accounts"
      subtitle="Connect your school's social media accounts to start publishing posts."
      headerActions={
        <Button variant="secondary" onClick={() => void handleSync()} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync accounts"}
        </Button>
      }
    >
      {message && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[14px] text-blue-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <Card padding="md"><BodyText muted>Loading…</BodyText></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {REACH_PLATFORMS.map((platform) => {
            const integration = connectedMap[platform];
            const isConnected = !!integration;
            return (
              <Card key={platform} padding="md">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#202020]">{PLATFORM_LABELS[platform]}</p>
                      {isConnected && (
                        <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 text-[11px] font-medium text-[#059669]">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-[#6b7280]">
                      {isConnected
                        ? integration.displayName ?? `${PLATFORM_LABELS[platform]} account`
                        : PLATFORM_DESCRIPTIONS[platform]}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {isConnected ? (
                      <Button
                        variant="secondary"
                        onClick={() => void handleDisconnect(integration)}
                        disabled={disconnecting === integration.id}
                      >
                        {disconnecting === integration.id ? "Removing…" : "Disconnect"}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => void handleConnect(platform)}
                        disabled={connecting === platform}
                      >
                        {connecting === platform ? "Opening…" : "Connect"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card padding="md" className="bg-[#f9fafb]">
        <p className="text-[13px] font-semibold text-[#374151]">How to connect</p>
        <ol className="mt-2 space-y-1 text-[13px] text-[#6b7280] list-decimal list-inside">
          <li>Click Connect next to a platform.</li>
          <li>Complete the authorization in the new tab that opens.</li>
          <li>Return here and click <strong>Sync accounts</strong>.</li>
          <li>Your account will appear as Connected.</li>
        </ol>
      </Card>
    </ReachShell>
  );
}
