"use client";

import { useEffect, useState } from "react";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@globalcloudr/canopy-ui";
import { apiFetch } from "@/lib/api-client";
import { supabase } from "@/lib/supabase-client";
import type { ReachGuidelines } from "@/lib/reach-schema";
import { useReachWorkspaceId } from "@/lib/workspace-client";

export default function GuidelinesPage() {
  const workspaceId = useReachWorkspaceId();
  const [guidelines, setGuidelines]   = useState<ReachGuidelines | null>(null);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(false);
  const [draft, setDraft]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [isOperator, setIsOperator]   = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setGuidelines(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Check if current user is an operator (can edit)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("is_super_admin,platform_role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle() as { data: { is_super_admin?: boolean; platform_role?: string } | null };
      const op =
        data?.is_super_admin === true ||
        data?.platform_role === "super_admin" ||
        data?.platform_role === "platform_staff";
      if (!cancelled) setIsOperator(op);
    }).catch(() => {});

    apiFetch(`/api/guidelines?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((data: ReachGuidelines | { error?: string }) => {
        if (!cancelled && "content" in data) setGuidelines(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function startEdit() {
    setDraft(guidelines?.content ?? "");
    setEditing(true);
    setError(null);
  }

  async function handleSave() {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/guidelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, content: draft }),
      });
      const data = (await res.json()) as ReachGuidelines & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      setGuidelines(data);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const isEmpty = !guidelines?.content?.trim();

  return (
    <ReachShell
      activeNav="guidelines"
      eyebrow="Brand"
      title="Social Media Guidelines"
      subtitle="Tone, topics, and posting standards for this workspace."
      headerActions={
        isOperator && !editing ? (
          <Button variant="secondary" onClick={startEdit}>Edit guidelines</Button>
        ) : undefined
      }
    >
      {loading ? (
        <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none"><BodyText muted>Loading…</BodyText></Card>
      ) : editing ? (
        <div className="flex flex-col gap-4">
          <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none sm:p-7">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Guidelines document</p>
            <p className="mt-3 text-[1.15rem] font-semibold tracking-[-0.03em] text-[var(--ink)]">Shape the tone and boundaries for this workspace.</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={18}
              placeholder="Write your school's social media guidelines here…&#10;&#10;Include: tone of voice, topics to cover, topics to avoid, posting frequency, image standards, and any brand rules."
              className="w-full resize-y rounded-lg border border-[var(--rule)] bg-white px-3 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:outline-none"
            />
          </Card>
          {error && (
            <div className="rounded-xl border border-[#f1d1d1] bg-transparent px-4 py-3 text-[14px] text-red-700">{error}</div>
          )}
          <div className="flex gap-3">
            <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save guidelines"}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      ) : isEmpty ? (
        <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none sm:p-8">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface-muted)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.6" className="h-7 w-7">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M8.5 7h7M8.5 11h7M8.5 15h4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--ink)]">No guidelines yet</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {isOperator
                  ? "Add social media guidelines for this workspace."
                  : "Your Canopy team will add social media guidelines for your workspace."}
              </p>
            </div>
            {isOperator && (
              <Button variant="primary" onClick={startEdit}>Add guidelines</Button>
            )}
          </div>
        </Card>
      ) : guidelines ? (
        <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none sm:p-8">
          <div className="mb-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7f8ea3]">Guidelines document</p>
            <p className="mt-3 text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--ink)]">The guardrails for your school's social voice.</p>
          </div>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap rounded-[28px] border border-[var(--rule)] bg-white/58 px-6 py-6 font-sans text-[15px] leading-relaxed text-[var(--ink-2)]">
              {guidelines.content}
            </pre>
          </div>
          {guidelines.updatedAt && (
            <p className="mt-6 text-[12px] text-[var(--faint)]">
              Last updated {new Date(guidelines.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </Card>
      ) : null}
    </ReachShell>
  );
}
