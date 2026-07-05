"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReachPost } from "@/lib/reach-schema";
import { buildWorkspaceHref } from "@/lib/workspace-href";

/**
 * Status chip classes shared between the Calendar list and month grid.
 * Background/text pairs only — no new colors beyond these.
 */
export const STATUS_BADGE: Record<string, string> = {
  scheduled:      "bg-[var(--surface-muted)] text-[var(--accent)]",
  published:      "bg-[#f0fdf4] text-[#059669]",
  draft:          "bg-[#f9fafb] text-[var(--text-muted)]",
  failed:         "bg-[#fef2f2] text-[#dc2626]",
  pending_review: "bg-[#fef3c7] text-[#d97706]",
  approved:       "bg-[#ecfdf5] text-[#059669]",
};

/** Solid dot color per status for the compressed mobile cells (text hexes from STATUS_BADGE). */
const STATUS_DOT: Record<string, string> = {
  scheduled:      "bg-[var(--accent)]",
  published:      "bg-[#059669]",
  draft:          "bg-[var(--text-muted)]",
  failed:         "bg-[#dc2626]",
  pending_review: "bg-[#d97706]",
  approved:       "bg-[#059669]",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How many chips a day cell shows before collapsing behind "+N more". */
const MAX_VISIBLE_CHIPS = 3;

/** Same date-bucketing rule as the list view's groupByDate. */
function postDateKey(post: ReachPost): string {
  const iso = post.scheduledAt ?? post.publishedAt ?? post.createdAt;
  return new Date(iso).toDateString();
}

function postTimestamp(post: ReachPost): number {
  const iso = post.scheduledAt ?? post.publishedAt ?? post.createdAt;
  return new Date(iso).getTime();
}

function formatChipTime(post: ReachPost): string | null {
  const iso = post.scheduledAt ?? post.publishedAt;
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function truncateBody(body: string, max = 20): string {
  const trimmed = body.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

type CalendarMonthGridProps = {
  /** Already status-filtered posts — the grid does no filtering of its own. */
  posts: ReachPost[];
  workspaceSlug: string | null;
};

export function CalendarMonthGrid({ posts, workspaceSlug }: CalendarMonthGridProps) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  // Day keys (toDateString) whose cells are expanded to show every chip.
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const postsByDay = useMemo(() => {
    const map = new Map<string, ReachPost[]>();
    for (const post of posts) {
      const key = postDateKey(post);
      const group = map.get(key) ?? [];
      group.push(post);
      map.set(key, group);
    }
    for (const group of map.values()) {
      group.sort((a, b) => postTimestamp(a) - postTimestamp(b));
    }
    return map;
  }, [posts]);

  // Build the visible cells: full weeks covering the displayed month.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const gridStart = new Date(viewYear, viewMonth, 1 - firstOfMonth.getDay());
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalCells = Math.ceil((firstOfMonth.getDay() + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      return { date, key: date.toDateString(), inMonth: date.getMonth() === viewMonth };
    });
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayKey = today.toDateString();
  const isViewingCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    setExpandedDays(new Set());
  }

  function toggleExpanded(key: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const navButtonClass =
    "grid h-8 w-8 place-items-center rounded-full border border-[var(--rule)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition hover:bg-[#e7eef9] hover:text-[var(--ink)]";

  return (
    <div className="flex flex-col gap-3">
      {/* Month navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className={navButtonClass}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <p className="min-w-[10rem] text-center text-[15px] font-semibold text-[var(--ink)]" aria-live="polite">
            {monthLabel}
          </p>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" className={navButtonClass}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setViewYear(today.getFullYear());
            setViewMonth(today.getMonth());
            setExpandedDays(new Set());
          }}
          disabled={isViewingCurrentMonth}
          className="rounded-full border border-[var(--rule)] bg-[var(--surface-muted)] px-4 py-1.5 text-[13px] font-medium text-[var(--text-muted)] transition enabled:hover:bg-[#e7eef9] enabled:hover:text-[var(--ink)] disabled:opacity-50"
        >
          Today
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-xl border border-[var(--rule)]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-px border-b border-[var(--rule)] bg-[var(--rule)]">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="bg-[var(--surface-muted)] px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label[0]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-[var(--rule)]">
          {cells.map(({ date, key, inMonth }) => {
            const dayPosts = postsByDay.get(key) ?? [];
            const isToday = key === todayKey;
            const expanded = expandedDays.has(key);
            const visiblePosts = expanded ? dayPosts : dayPosts.slice(0, MAX_VISIBLE_CHIPS);
            const hiddenCount = dayPosts.length - visiblePosts.length;

            return (
              <div
                key={key}
                className={[
                  "flex min-h-[56px] flex-col gap-1 p-1 md:min-h-[96px] md:p-1.5",
                  inMonth ? "bg-white/62" : "bg-[var(--surface-muted)]/60",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-medium",
                    isToday
                      ? "bg-[var(--accent)] font-semibold text-white"
                      : inMonth
                        ? "text-[var(--ink)]"
                        : "text-[var(--text-muted)] opacity-60",
                  ].join(" ")}
                >
                  {date.getDate()}
                </span>

                {dayPosts.length > 0 && (
                  <>
                    {/* Desktop / tablet: status chips */}
                    <div className="hidden flex-col gap-1 md:flex">
                      {visiblePosts.map((post) => {
                        const time = formatChipTime(post);
                        return (
                          <Link
                            key={post.id}
                            href={buildWorkspaceHref(`/posts/${post.id}`, workspaceSlug)}
                            title={post.body}
                            className={[
                              "block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 transition hover:opacity-80",
                              STATUS_BADGE[post.status] ?? "bg-[#f9fafb] text-[var(--text-muted)]",
                            ].join(" ")}
                          >
                            {time && <span className="font-semibold">{time}</span>}
                            {time && " "}
                            {truncateBody(post.body)}
                          </Link>
                        );
                      })}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(key)}
                          className="self-start rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                        >
                          +{hiddenCount} more
                        </button>
                      )}
                      {expanded && dayPosts.length > MAX_VISIBLE_CHIPS && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(key)}
                          className="self-start rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                        >
                          Show less
                        </button>
                      )}
                    </div>

                    {/* Mobile: colored dots + count */}
                    <div className="flex flex-wrap items-center gap-0.5 md:hidden">
                      {dayPosts.slice(0, 3).map((post) => (
                        <span
                          key={post.id}
                          className={[
                            "h-1.5 w-1.5 rounded-full",
                            STATUS_DOT[post.status] ?? "bg-[var(--text-muted)]",
                          ].join(" ")}
                        />
                      ))}
                      {dayPosts.length > 1 && (
                        <span className="text-[10px] font-medium text-[var(--text-muted)]">{dayPosts.length}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
