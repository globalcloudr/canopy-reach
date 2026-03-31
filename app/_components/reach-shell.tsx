"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Avatar,
  AvatarFallback,
  BodyText,
  Button,
  CanopyHeader,
  Card,
  Eyebrow,
  PageTitle,
  cn,
} from "@canopy/ui";
import { supabase } from "@/lib/supabase-client";
import { readStoredWorkspaceId, writeStoredWorkspaceId } from "@/lib/workspace-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgOption = { id: string; name: string; slug: string };

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
      ? "bg-white text-[#172033] shadow-[0_12px_28px_rgba(35,74,144,0.12)]"
      : "text-[#506176] hover:bg-white/70 hover:text-[#172033]"
  );
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
  const [loadingSession, setLoadingSession] = useState(true);

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

  function setActiveOrgId(id: string) {
    setActiveOrgIdState(id);
    writeStoredWorkspaceId(id);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingSession(true);
      try {
        // Handle token handoff from Canopy portal (tokens in URL hash)
        if (typeof window !== "undefined") {
          const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
          if (hash) {
            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
              window.history.replaceState({}, "", window.location.pathname + window.location.search);
            }
          }
        }

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          window.location.assign(PORTAL_URL);
          return;
        }
        if (cancelled) { setLoadingSession(false); return; }

        setUserEmail(user.email ?? "");
        const full =
          (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
          (typeof user.user_metadata?.name === "string" && user.user_metadata.name) || "";
        setUserName(full);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_super_admin,platform_role")
          .eq("user_id", user.id)
          .single() as { data: { is_super_admin?: boolean; platform_role?: string } | null };

        const isOperator =
          profileData?.is_super_admin === true ||
          profileData?.platform_role === "super_admin" ||
          profileData?.platform_role === "platform_staff";

        if (!cancelled) setIsPlatformOperator(isOperator);

        let loadedOrgs: OrgOption[] = [];
        if (isOperator) {
          const { data } = await supabase
            .from("organizations")
            .select("id,name,slug")
            .order("name", { ascending: true });
          loadedOrgs = (data ?? []) as OrgOption[];
        } else {
          const { data: memberships } = await supabase
            .from("memberships")
            .select("org_id")
            .eq("user_id", user.id) as { data: { org_id: string }[] | null };
          const ids = [...new Set((memberships ?? []).map((m) => m.org_id).filter(Boolean))] as string[];
          if (ids.length > 0) {
            const { data } = await supabase
              .from("organizations")
              .select("id,name,slug")
              .in("id", ids)
              .order("name", { ascending: true });
            loadedOrgs = (data ?? []) as OrgOption[];
          }
        }

        if (cancelled) return;
        setOrgs(loadedOrgs);

        // Resolve active org: URL param > localStorage > first org
        const slugParam = searchParams.get("workspace");
        const fromUrl = slugParam ? loadedOrgs.find((o) => o.slug === slugParam)?.id ?? null : null;
        const stored = readStoredWorkspaceId();
        const hasStored = stored && loadedOrgs.some((o) => o.id === stored);
        const resolved = fromUrl ?? (hasStored ? stored! : loadedOrgs[0]?.id ?? null);
        setActiveOrgIdState(resolved);
        writeStoredWorkspaceId(resolved);
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

  const workspaceLabel = activeOrg?.name ?? (loadingSession ? "Loading..." : "Select workspace");
  const workspaceLinks = isPlatformOperator
    ? orgs.map((org) => ({
        id: org.id,
        label: org.name,
        onSelect: () => setActiveOrgId(org.id),
        active: org.id === activeOrgId,
      }))
    : [];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f8ff_0%,#eef3ff_55%,#f8fbff_100%)] md:h-screen md:overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <CanopyHeader
        brandHref={PORTAL_URL}
        workspaceLabel={workspaceLabel}
        workspaceLinks={workspaceLinks}
        isPlatformOperator={isPlatformOperator}
        platformOverviewHref={PORTAL_URL}
        userInitials={loadingSession ? "…" : initials}
        displayName={displayName}
        email={userName ? userEmail : null}
        roleLabel={isPlatformOperator ? "operator" : null}
        accountMenuItems={[
          { label: "Portal overview", href: PORTAL_URL },
          { label: "Questions / feedback", href: "mailto:info@akkedisdigital.com?subject=Canopy%20Reach%20Feedback" },
        ]}
        onSignOut={() => void signOut()}
        signOutLabel={signingOut ? "Signing out…" : "Sign out"}
      />

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div className="md:grid md:h-[calc(100vh-3.5rem)] md:grid-cols-[280px_minmax(0,1fr)]">

        {/* Sidebar */}
        <aside className="hidden bg-transparent md:block">
          <div className="flex h-full flex-col">

            {/* Workspace lockup */}
            <section className="mx-4 mt-4 flex items-center gap-4 rounded-[28px] bg-[linear-gradient(180deg,#ffffff_0%,#f5f8ff_100%)] px-6 py-6 shadow-[0_18px_45px_rgba(27,58,109,0.08)]">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#2f76dd_0%,#5c96ea_100%)] text-[1.05rem] font-semibold tracking-[-0.02em] text-white shadow-[0_10px_24px_rgba(47,118,221,0.28)]">
                {loadingSession ? "…" : orgInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[#202020]">
                  {activeOrg?.name ?? (loadingSession ? "Loading…" : "No workspace")}
                </p>
                <p className="mt-0.5 text-[13px] text-[#6f7e90]">Canopy Reach</p>
              </div>
            </section>

            {/* Nav */}
            <nav className="px-4 py-6">
              <div className="rounded-[28px] bg-white/55 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea0b7]">Navigation</p>
                <div className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.key} href={item.href} className={navClass(activeNav === item.key)}>
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
        <div className="min-w-0 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[1340px] flex-col gap-6 px-4 py-6 sm:px-6">
            <section className="overflow-hidden rounded-[34px] bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#fbfdff_44%,#f2f6ff_100%)] px-6 py-7 shadow-[0_24px_60px_rgba(26,54,93,0.09)] sm:px-8 sm:py-8">
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
            </section>

            {loadingSession ? (
              <Card padding="md" className="border-0 bg-white/88 shadow-[0_18px_50px_rgba(26,54,93,0.08)]">
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
