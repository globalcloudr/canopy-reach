"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@canopy/ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachIntegration, ReachPlatform } from "@/lib/reach-schema";
import { REACH_PLATFORMS, PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";

function getStoredOrgId(): string | null {
  try { return window.localStorage.getItem("cr_active_org_id_v1"); } catch { return null; }
}

const PLATFORM_DESCRIPTIONS: Record<ReachPlatform, string> = {
  facebook:  "Post to your school's Facebook page.",
  instagram: "Coming soon.",
  linkedin:  "Coming soon.",
  x:         "Coming soon.",
};

const SUPPORTED_PLATFORMS: ReachPlatform[] = ["facebook"];

export default function ConnectPage() {
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId]     = useState<string | null>(null);
  const [integrations, setIntegrations]   = useState<ReachIntegration[]>([]);
  const [access, setAccess]               = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [loading, setLoading]             = useState(true);
  const [connecting, setConnecting]       = useState<ReachPlatform | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [message, setMessage]             = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  function loadIntegrations(id: string) {
    return apiFetch(`/api/integrations?workspaceId=${id}`)
      .then((r) => r.json())
      .then((data) => setIntegrations(Array.isArray(data) ? data : []))
      .catch(() => setIntegrations([]));
  }

  useEffect(() => {
    const id = getStoredOrgId();
    if (!id) { setLoading(false); return; }
    setWorkspaceId(id);

    // Handle OAuth callback result in URL params
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");
    if (connected) setMessage(`${PLATFORM_LABELS[connected as ReachPlatform] ?? connected} connected successfully.`);
    if (err) setError(err);

    Promise.all([
      loadIntegrations(id),
      getClientWorkspaceAccess(id).then((nextAccess) => setAccess(nextAccess)),
    ]).finally(() => setLoading(false));
  }, [searchParams]);

  async function handleConnect(platform: ReachPlatform) {
    if (!workspaceId) return;
    if (!access.canManageIntegrations) {
      setError("Only workspace owners or admins can change connected school accounts.");
      return;
    }
    setConnecting(platform);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch(
        `/api/integrations/oauth-url?platform=${platform}&workspaceId=${encodeURIComponent(workspaceId)}`
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not get connect URL.");
      // Redirect in the same window — callback will redirect back to /connect
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start connection.");
      setConnecting(null);
    }
  }

  async function handleDisconnect(integration: ReachIntegration) {
    if (!workspaceId) return;
    if (!access.canManageIntegrations) {
      setError("Only workspace owners or admins can change connected school accounts.");
      return;
    }
    if (!confirm(`Disconnect ${PLATFORM_LABELS[integration.platform]}? You can reconnect at any time.`)) return;
    setDisconnecting(integration.id);
    try {
      const res = await apiFetch(`/api/integrations/${integration.id}?workspaceId=${workspaceId}`, {
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
      subtitle="Connect your school's approved social accounts. These accounts are shared by everyone in this workspace."
    >
      {!loading && !access.canManageIntegrations && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-800">
          Connected social accounts are workspace-wide. Only owners and admins can connect or disconnect them.
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[14px] text-green-700">
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
            const isSupported = SUPPORTED_PLATFORMS.includes(platform);

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
                      {!isSupported && !isConnected && (
                        <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-medium text-[#9ca3af]">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[13px] text-[#6b7280]">
                      {isConnected
                        ? integration.displayName ?? `${PLATFORM_LABELS[platform]} page`
                        : PLATFORM_DESCRIPTIONS[platform]}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {isConnected ? (
                      <Button
                        variant="secondary"
                        onClick={() => void handleDisconnect(integration)}
                        disabled={disconnecting === integration.id || !access.canManageIntegrations}
                      >
                        {disconnecting === integration.id ? "Removing…" : "Disconnect"}
                      </Button>
                    ) : isSupported ? (
                      <Button
                        variant="primary"
                        onClick={() => void handleConnect(platform)}
                        disabled={connecting === platform || !access.canManageIntegrations}
                      >
                        {connecting === platform ? "Connecting…" : "Connect"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </ReachShell>
  );
}
