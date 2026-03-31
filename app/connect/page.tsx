"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@canopy/ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachIntegration, ReachPlatform } from "@/lib/reach-schema";
import { REACH_PLATFORMS, PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";

const PLATFORM_DESCRIPTIONS: Record<ReachPlatform, string> = {
  facebook:  "Post to your school's Facebook page.",
  instagram: "Coming soon.",
  linkedin:  "Coming soon.",
  x:         "Coming soon.",
};

const SUPPORTED_PLATFORMS: ReachPlatform[] = ["facebook"];

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
  const facebookIntegration = connectedMap.facebook ?? null;

  return (
    <ReachShell
      activeNav="connect"
      eyebrow="Setup"
      title="Connected Accounts"
      subtitle="Connect your school's approved social accounts. These accounts are shared by everyone in this workspace."
    >
      {!loading && !access.canManageIntegrations && (
        <div className="rounded-xl bg-[linear-gradient(180deg,#fff8ec_0%,#fff1d1_100%)] px-4 py-3 text-[14px] text-amber-800 shadow-[0_16px_38px_rgba(195,141,39,0.10)]">
          Connected social accounts are workspace-wide. Only owners and admins can connect or disconnect them.
        </div>
      )}
      {message && (
        <div className="rounded-xl bg-[linear-gradient(180deg,#eefbf3_0%,#e5f8ee_100%)] px-4 py-3 text-[14px] text-green-700 shadow-[0_16px_38px_rgba(30,111,74,0.10)]">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-[linear-gradient(180deg,#fff2f2_0%,#ffe6e6_100%)] px-4 py-3 text-[14px] text-red-700 shadow-[0_16px_38px_rgba(190,24,24,0.10)]">
          {error}
        </div>
      )}

      {loading ? (
        <Card padding="md" className="border-0 bg-white/88 shadow-[0_18px_50px_rgba(26,54,93,0.08)]"><BodyText muted>Loading…</BodyText></Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <Card className="overflow-hidden border-0 bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f8fbff_42%,#eef4ff_100%)] shadow-[0_24px_60px_rgba(26,54,93,0.10)]">
              <div className="px-6 py-6 sm:px-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2f76dd]">Account setup</p>
                <p className="mt-4 text-[1.4rem] font-semibold tracking-[-0.03em] text-[#172033]">
                  {facebookIntegration ? "Your school account is approved for publishing." : "Connect the one school account this workspace should publish to."}
                </p>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#617286]">
                  Reach is built around one approved account per platform for each workspace, so everyone on the school team publishes from the same social identity.
                </p>

                <div className="mt-6 rounded-[26px] bg-white/88 px-5 py-5 shadow-[0_18px_42px_rgba(25,51,92,0.08)]">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[1rem] font-semibold text-[#172033]">Facebook</p>
                        {facebookIntegration ? (
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
                        {facebookIntegration
                          ? facebookIntegration.displayName ?? "Approved Facebook page"
                          : "This is the live school page Reach will publish to once connected."}
                      </p>
                    </div>
                    {facebookIntegration ? (
                      <Button
                        variant="secondary"
                        onClick={() => void handleDisconnect(facebookIntegration)}
                        disabled={disconnecting === facebookIntegration.id || !access.canManageIntegrations}
                      >
                        {disconnecting === facebookIntegration.id ? "Removing…" : "Disconnect"}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => void handleConnect("facebook")}
                        disabled={connecting === "facebook" || !access.canManageIntegrations}
                      >
                        {connecting === "facebook" ? "Connecting…" : "Connect Facebook"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="md" className="border-0 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] shadow-[0_18px_44px_rgba(25,51,92,0.08)] sm:p-7">
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
              <Card key={platform} padding="md" className="border-0 bg-white/82 shadow-[0_16px_38px_rgba(26,54,93,0.08)]">
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
