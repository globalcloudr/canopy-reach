"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AppSurface,
  BodyText,
  Button,
  CanopyHeader,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Eyebrow,
  PageTitle,
  cn,
} from "@canopy/ui";
import { supabase } from "@/lib/supabase-client";
import { readStoredWorkspaceId, writeStoredWorkspaceId } from "@/lib/workspace-client";
import { buildWorkspaceHref } from "@/lib/workspace-href";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgOption = { id: string; name: string; slug: string };
type LauncherProductKey = "photovault" | "stories_canopy" | "reach_canopy";
type AppSessionPayload = {
  user: { id: string; email: string; displayName: string };
  isPlatformOperator: boolean;
  workspaces: OrgOption[];
  activeWorkspace: OrgOption | null;
};

type NavKey = "home" | "calendar" | "compose" | "connect" | "guidelines" | "settings";

type ReachShellProps = {
  activeNav: NavKey;
  eyebrow: string;
  title: string;
  subtitle: string;
  headerMeta?: string;
  headerActions?: ReactNode;
  children: ReactNode;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://usecanopy.school";

async function waitForSessionTokens() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token && data.session.refresh_token) {
    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  return new Promise<{ accessToken: string; refreshToken: string } | null>((resolve) => {
    const timeout = window.setTimeout(() => {
      subscription.unsubscribe();
      resolve(null);
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && session.refresh_token) {
        window.clearTimeout(timeout);
        subscription.unsubscribe();
        resolve({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        });
      }
    });
  });
}

// ─── Nav icons ────────────────────────────────────────────────────────────────

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18" />
      <path d="M8 2v4M16 2v4" />
      <path d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2M15 17h2" strokeLinecap="round" />
    </svg>
  );
}

function ComposeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function ConnectIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" strokeLinecap="round" />
    </svg>
  );
}

function GuidelinesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8.5 7h7M8.5 11h7M8.5 15h4" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 3.5l2.1 1.2 2.4-.2 1.2 2.1 2 1.3-.2 2.4L20.5 12l-1.2 2.1.2 2.4-2.1 1.2-1.3 2-2.4-.2L12 20.5l-2.1 1.2-2.4-.2-1.2-2.1-2-1.3.2-2.4L3.5 12l1.2-2.1-.2-2.4 2.1-1.2 1.3-2 2.4.2Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const navItems: Array<{ key: NavKey; href: string; label: string; icon: (p: { className?: string }) => ReactNode }> = [
  { key: "home",       href: "/",           label: "Dashboard",  icon: DashboardIcon  },
  { key: "calendar",   href: "/calendar",   label: "Calendar",   icon: CalendarIcon   },
  { key: "compose",    href: "/posts/new",  label: "New Post",   icon: ComposeIcon    },
  { key: "connect",    href: "/connect",    label: "Accounts",   icon: ConnectIcon    },
  { key: "guidelines", href: "/guidelines", label: "Guidelines", icon: GuidelinesIcon },
  { key: "settings",   href: "/settings",   label: "Settings",   icon: SettingsIcon   },
];

function navClass(active: boolean) {
  return cn(
    "flex items-center gap-2.5 rounded-2xl px-3.5 py-3 font-medium text-[15px] tracking-[-0.01em] transition",
    active
      ? "bg-white/82 text-[#172033] shadow-[0_10px_24px_rgba(35,74,144,0.08)]"
      : "text-[#506176] hover:bg-white/48 hover:text-[#172033]"
  );
}

function withWorkspaceContext(path: string, workspaceSlug?: string | null, isPlatformOperator = false) {
  return isPlatformOperator ? buildWorkspaceHref(path, workspaceSlug) : path;
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export function ReachShell({
  activeNav,
  eyebrow,
  title,
  subtitle,
  headerMeta,
  headerActions,
  children,
}: ReachShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [isPlatformOperator, setIsPlatformOperator] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [launcherProductKeys, setLauncherProductKeys] = useState<LauncherProductKey[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [launchingProductKey, setLaunchingProductKey] = useState<LauncherProductKey | null>(null);
  const [returningToPortal, setReturningToPortal] = useState(false);

  const activeOrg = useMemo(() => orgs.find((o) => o.id === activeOrgId) ?? null, [orgs, activeOrgId]);

  const initials = useMemo(() => {
    if (userName.trim()) {
      return userName.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();
    }
    return (userEmail[0] ?? "U").toUpperCase();
  }, [userName, userEmail]);

  const displayName = userName.trim() || userEmail || "Canopy User";

  const orgInitials = activeOrg
    ? activeOrg.name.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase()
    : "W";

  useEffect(() => {
    if (!activeOrgId) {
      setLauncherProductKeys([]);
      return;
    }
    const workspaceId = activeOrgId;

    const controller = new AbortController();

    async function loadLauncherProducts() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setLauncherProductKeys([]);
          return;
        }

        const response = await fetch(`/api/launcher-products?workspaceId=${encodeURIComponent(workspaceId)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setLauncherProductKeys([]);
          return;
        }

        const payload = (await response.json()) as { products?: LauncherProductKey[] };
        setLauncherProductKeys(
          (payload.products ?? []).filter((value): value is LauncherProductKey =>
            value === "photovault" || value === "stories_canopy" || value === "reach_canopy"
          )
        );
      } catch {
        if (!controller.signal.aborted) {
          setLauncherProductKeys([]);
        }
      }
    }

    void loadLauncherProducts();
    return () => controller.abort();
  }, [activeOrgId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingSession(true);
      try {
        const launchCode = searchParams.get("launch")?.trim();
        if (launchCode) {
          const exchangeResponse = await fetch("/api/auth/exchange-handoff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: launchCode }),
          });

          if (!exchangeResponse.ok) {
            window.location.assign(PORTAL_URL);
            return;
          }

          const exchangePayload = (await exchangeResponse.json()) as {
            accessToken?: string;
            refreshToken?: string;
            workspaceSlug?: string | null;
          };

          if (!exchangePayload.accessToken || !exchangePayload.refreshToken) {
            window.location.assign(PORTAL_URL);
            return;
          }

          await supabase.auth.setSession({
            access_token: exchangePayload.accessToken,
            refresh_token: exchangePayload.refreshToken,
          });

          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("launch");
            if (exchangePayload.workspaceSlug) {
              url.searchParams.set("workspace", exchangePayload.workspaceSlug);
            }
            window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
          }
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          window.location.assign(PORTAL_URL);
          return;
        }

        const requestedWorkspaceSlug = searchParams.get("workspace")?.trim() || "";
        const sessionResponse = await fetch(
          `/api/app-session${requestedWorkspaceSlug ? `?workspace=${encodeURIComponent(requestedWorkspaceSlug)}` : ""}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );

        if (!sessionResponse.ok) {
          window.location.assign(PORTAL_URL);
          return;
        }

        const appSession = (await sessionResponse.json()) as AppSessionPayload;
        if (cancelled) { setLoadingSession(false); return; }

        setUserEmail(appSession.user.email);
        setUserName(appSession.user.displayName);
        setIsPlatformOperator(appSession.isPlatformOperator);
        setOrgs(appSession.workspaces);
        setActiveOrgIdState(appSession.activeWorkspace?.id ?? null);
        writeStoredWorkspaceId(appSession.activeWorkspace?.id ?? null);
      } catch {
        // session not available
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [searchParams]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign(PORTAL_URL);
    } finally {
      setSigningOut(false);
    }
  }

  async function launchProduct(productKey: Exclude<LauncherProductKey, "reach_canopy">) {
    if (launchingProductKey) {
      return;
    }

    setLaunchingProductKey(productKey);
    try {
      const tokens = await waitForSessionTokens();

      if (!tokens) {
        window.location.assign(PORTAL_URL);
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = `${portalBase}/auth/product-launch`;
      form.style.display = "none";

      const fields = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        productKey,
        workspaceSlug: activeOrg?.slug ?? "",
      };

      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } finally {
      setLaunchingProductKey(null);
    }
  }

  async function returnToPortal() {
    if (returningToPortal) {
      return;
    }

    setReturningToPortal(true);
    try {
      const tokens = await waitForSessionTokens();

      if (!tokens) {
        window.location.assign(PORTAL_URL);
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = `${portalBase}/auth/portal-return`;
      form.style.display = "none";

      const fields = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        workspaceSlug: activeOrg?.slug ?? "",
      };

      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } finally {
      setReturningToPortal(false);
    }
  }

  const workspaceLabel = activeOrg?.name ?? (loadingSession ? "Loading..." : "Select workspace");
  const workspaceLinks = isPlatformOperator
    ? orgs.map((org) => ({
        id: org.id,
        label: org.name,
        href: `${pathname}?workspace=${encodeURIComponent(org.slug)}`,
        active: org.id === activeOrgId,
      }))
    : [];
  const portalBase = PORTAL_URL.replace(/\/$/, "");
  const portalHomeHref = activeOrg?.slug
    ? `${portalBase}/app?workspace=${encodeURIComponent(activeOrg.slug)}`
    : `${portalBase}/app`;
  const launcherItems: Array<{ key: string; label: string; href?: string; current?: boolean; productKey?: Exclude<LauncherProductKey, "reach_canopy">; portal?: boolean }> = [
    { key: "portal", label: "Canopy Portal", portal: true },
    ...(launcherProductKeys.includes("photovault")
      ? [{ key: "photovault", label: "PhotoVault", productKey: "photovault" as const }]
      : []),
    ...(launcherProductKeys.includes("stories_canopy")
      ? [{ key: "stories_canopy", label: "Canopy Stories", productKey: "stories_canopy" as const }]
      : []),
    ...(launcherProductKeys.includes("reach_canopy")
      ? [{ key: "reach_canopy", label: "Canopy Reach", href: withWorkspaceContext("/", activeOrg?.slug, isPlatformOperator), current: true }]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[var(--app-shell-bg)] md:h-screen md:overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <CanopyHeader
        brandHref={portalHomeHref}
        onBrandSelect={() => void returnToPortal()}
        workspaceLabel={workspaceLabel}
        workspaceContextLabel="School"
        workspaceLinks={workspaceLinks}
        isPlatformOperator={isPlatformOperator}
        platformOverviewHref={PORTAL_URL}
        onPlatformOverviewSelect={() => void returnToPortal()}
        userInitials={loadingSession ? "…" : initials}
        displayName={displayName}
        email={userName ? userEmail : null}
        roleLabel={isPlatformOperator ? "operator" : null}
        accountMenuItems={[
          { label: "Portal overview", onSelect: () => void returnToPortal() },
          { label: "Questions / feedback", href: "mailto:info@akkedisdigital.com?subject=Canopy%20Reach%20Feedback" },
        ]}
        onSignOut={() => void signOut()}
        signOutLabel={signingOut ? "Signing out…" : "Sign out"}
      />

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div className="md:grid md:h-[calc(100vh-3.5rem)] md:grid-cols-[280px_minmax(0,1fr)]">

        {/* Sidebar */}
        <aside className="hidden border-r border-[var(--app-divider)] bg-transparent md:block">
          <div className="flex h-full flex-col">

            {/* Workspace lockup */}
            <div className="mx-4 mt-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-4 rounded-[28px] bg-transparent px-6 py-6 text-left transition hover:bg-white/28"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#2f76dd_0%,#5c96ea_100%)] text-[1.05rem] font-semibold tracking-[-0.02em] text-white shadow-[0_10px_24px_rgba(47,118,221,0.28)]">
                      {loadingSession ? "…" : orgInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#0f172a]">
                        {activeOrg?.name ?? (loadingSession ? "Loading…" : "No workspace")}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#6f7e90]">Canopy Reach</p>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 bg-white">
                  <DropdownMenuLabel className="text-[#94a3b8]">{activeOrg?.name ?? "Workspace"}</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {launcherItems.map((item) =>
                      item.current ? (
                        <DropdownMenuItem key={item.key} className="font-medium">
                          {item.label}
                          <span className="ml-auto text-[11px] text-[var(--text-muted)]">current</span>
                        </DropdownMenuItem>
                      ) : item.productKey ? (
                        <DropdownMenuItem
                          key={item.key}
                          onSelect={(event) => {
                            event.preventDefault();
                            void launchProduct(item.productKey!);
                          }}
                        >
                          {item.label}
                          {launchingProductKey === item.productKey ? (
                            <span className="ml-auto text-[11px] text-[var(--text-muted)]">opening…</span>
                          ) : null}
                        </DropdownMenuItem>
                      ) : item.portal ? (
                        <DropdownMenuItem
                          key={item.key}
                          onSelect={(event) => {
                            event.preventDefault();
                            void returnToPortal();
                          }}
                        >
                          {item.label}
                          {returningToPortal ? (
                            <span className="ml-auto text-[11px] text-[var(--text-muted)]">opening…</span>
                          ) : null}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem key={item.key} asChild>
                          <a href={item.href}>{item.label}</a>
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      void returnToPortal();
                    }}
                  >
                    Back to portal home
                    {returningToPortal ? (
                      <span className="ml-auto text-[11px] text-[var(--text-muted)]">opening…</span>
                    ) : null}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Nav */}
            <nav className="px-4 py-6">
              <div className="rounded-[28px] bg-transparent px-4 py-4 shadow-none">
                <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea0b7]">Navigation</p>
                <div className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={withWorkspaceContext(item.href, activeOrg?.slug, isPlatformOperator)}
                      className={navClass(activeNav === item.key)}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                </div>
              </div>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 overflow-y-auto bg-[var(--app-content-bg)]">
          <div className="mx-auto flex min-h-full w-full max-w-[1340px] flex-col gap-6 px-4 py-6 sm:px-6">
            <AppSurface variant="clear" className="overflow-hidden rounded-[34px] px-6 py-7 sm:px-8 sm:py-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                  <Eyebrow className="text-[#2f76dd]">{eyebrow}</Eyebrow>
                  <PageTitle className="mt-3 text-[#172033]">{title}</PageTitle>
                  <BodyText muted className="mt-3 max-w-3xl text-[#617286] sm:text-[15px]">{subtitle}</BodyText>
                </div>
                {headerActions ? <div className="flex flex-wrap gap-3">{headerActions}</div> : null}
              </div>
              {headerMeta ? (
                <div className="mt-5 text-sm text-[#7a8798]">{headerMeta}</div>
              ) : null}
            </AppSurface>

            {loadingSession ? (
              <Card padding="md" className="border border-[var(--app-surface-border)] bg-transparent shadow-none">
                <BodyText muted>Loading workspace…</BodyText>
              </Card>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
