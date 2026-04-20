"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@globalcloudr/canopy-ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachIntegration, ReachPlatform } from "@/lib/reach-schema";
import { REACH_PLATFORMS, PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";

const PLATFORM_DESCRIPTIONS: Record<ReachPlatform, string> = {
  facebook:  "Post to your school's Facebook page.",
  instagram: "Post to your school's Instagram Business account.",
  linkedin:  "Post to your school's LinkedIn company page.",
  x:         "Coming soon.",
};

const SUPPORTED_PLATFORMS: ReachPlatform[] = ["facebook", "linkedin", "instagram"];

export default function ConnectPage() {
  const searchParams = useSearchParams();
  const workspaceId = useReachWorkspaceId();
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
      .then((data) => Array.isArray(data) ? data : [])
      .catch(() => []);
  }

  useEffect(() => {
    // Handle OAuth callback result in URL params
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");
    if (connected) setMessage(`${PLATFORM_LABELS[connected as ReachPlatform] ?? connected} connected successfully.`);
    if (err) setError(err);

    if (!workspaceId) {
      setIntegrations([]);
      setAccess(DEFAULT_REACH_CLIENT_ACCESS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      loadIntegrations(workspaceId),
      getClientWorkspaceAccess(workspaceId),
    ]).then(([nextIntegrations, nextAccess]) => {
      if (cancelled) return;
      setIntegrations(nextIntegrations);
      setAccess(nextAccess);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [searchParams, workspaceId]);

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
      setIntegrations(await loadIntegrations(workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setDisconnecting(null);
    }
  }

  const connectedMap = Object.fromEntries(
    integrations.map((i) => [i.platform, i])
  ) as Partial<Record<ReachPlatform, ReachIntegration>>;
  const hasAnyConnection = integrations.length > 0;

  return (
    <ReachShell
      activeNav="connect"
      eyebrow="Setup"
      title="Connected Accounts"
      subtitle="Connect your school's approved social accounts. These accounts are shared by everyone in this workspace."
    >
      {!loading && !access.canManageIntegrations && (
        <div className="rounded-xl border border-[#f2e4bc] bg-transparent px-4 py-3 text-[14px] text-amber-800">
          Connected social accounts are workspace-wide. Only owners and admins can connect or disconnect them.
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-[#d8eadf] bg-transparent px-4 py-3 text-[14px] text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[#f1d1d1] bg-transparent px-4 py-3 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none"><BodyText muted>Loading…</BodyText></Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <Card className="overflow-hidden border border-[#dfe7f4] bg-transparent shadow-none">
              <div className="px-6 py-6 sm:px-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2f76dd]">Account setup</p>
                <p className="mt-4 text-[1.4rem] font-semibold tracking-[-0.03em] text-[#172033]">
                  {hasAnyConnection ? "Your school accounts are approved for publishing." : "Connect the school accounts this workspace should publish to."}
                </p>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#617286]">
                  Reach is built around one approved account per platform for each workspace, so everyone on the school team publishes from the same social identity.
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  {SUPPORTED_PLATFORMS.map((platform) => {
                    const integration = connectedMap[platform];
                    return (
                      <div key={platform} className="rounded-[26px] border border-[#e3eaf6] bg-white/62 px-5 py-5">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[1rem] font-semibold text-[#172033]">{PLATFORM_LABELS[platform]}</p>
                              {integration ? (
                                <span className="rounded-full bg-[#eefbf3] px-2.5 py-0.5 text-[11px] font-semibold text-[#1f7a52]">
                                  Connected
                                </span>
                              ) : (
                                <span className="rounded-full bg-[#f3f6fa] px-2.5 py-0.5 text-[11px] font-semibold text-[#708194]">
                                  Not connected
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-[14px] text-[#617286]">
                              {integration
                                ? integration.displayName ?? `Approved ${PLATFORM_LABELS[platform]} account`
                                : PLATFORM_DESCRIPTIONS[platform]}
                            </p>
                          </div>
                          {integration ? (
                            <Button
                              variant="secondary"
                              onClick={() => void handleDisconnect(integration)}
                              disabled={disconnecting === integration.id || !access.canManageIntegrations}
                            >
                              {disconnecting === integration.id ? "Removing…" : "Disconnect"}
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              onClick={() => void handleConnect(platform)}
                              disabled={connecting === platform || !access.canManageIntegrations}
                            >
                              {connecting === platform ? "Connecting…" : `Connect ${PLATFORM_LABELS[platform]}`}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none sm:p-7">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">How this works</p>
              <ul className="mt-4 space-y-3 text-[14px] leading-6 text-[#5f6f82]">
                <li>Connect the approved school page once, then let staff schedule content against that shared account.</li>
                <li>Only owners and admins should swap or remove a connected school account.</li>
                <li>Business-managed pages may ask for both business and page access during setup.</li>
              </ul>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
          {REACH_PLATFORMS.map((platform) => {
            const integration = connectedMap[platform];
            const isConnected = !!integration;
            const isSupported = SUPPORTED_PLATFORMS.includes(platform);

            return (
              <Card key={platform} padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#172033]">{PLATFORM_LABELS[platform]}</p>
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
        </div>
      )}
    </ReachShell>
  );
}
