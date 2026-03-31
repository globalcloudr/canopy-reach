"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText, Eyebrow } from "@canopy/ui";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import type { ReachIntegration, ReachTemplate, ReachPlatform } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";

// Character limits per platform (most restrictive shown when multiple selected)
const CHAR_LIMITS: Record<ReachPlatform, number> = {
  facebook:  63206,
  instagram: 2200,
  linkedin:  3000,
  x:         280,
};

function getCharLimit(platforms: ReachPlatform[]): number | null {
  if (!platforms.length) return null;
  return Math.min(...platforms.map((p) => CHAR_LIMITS[p]));
}

function getStoredOrgId(): string | null {
  try { return window.localStorage.getItem("cr_active_org_id_v1"); } catch { return null; }
}

type PostType = "now" | "schedule" | "draft";

export default function NewPostPage() {
  const router = useRouter();

  const [workspaceId, setWorkspaceId]     = useState<string | null>(null);
  const [integrations, setIntegrations]   = useState<ReachIntegration[]>([]);
  const [templates, setTemplates]         = useState<ReachTemplate[]>([]);
  const [access, setAccess]               = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [loading, setLoading]             = useState(true);

  const [body, setBody]                   = useState("");
  const [platforms, setPlatforms]         = useState<ReachPlatform[]>([]);
  const [postType, setPostType]           = useState<PostType>("now");
  const [scheduledAt, setScheduledAt]     = useState("");
  const [mediaUrl, setMediaUrl]           = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    const id = getStoredOrgId();
    if (!id) { setLoading(false); return; }
    setWorkspaceId(id);

    Promise.all([
      apiFetch(`/api/integrations?workspaceId=${id}`).then((r) => r.json()),
      apiFetch(`/api/templates?workspaceId=${id}`).then((r) => r.json()),
      getClientWorkspaceAccess(id),
    ]).then(([ints, tmpl, nextAccess]) => {
      setIntegrations(Array.isArray(ints) ? ints : []);
      setTemplates(Array.isArray(tmpl) ? tmpl : []);
      setAccess(nextAccess);
    }).catch(() => {
      // Load with empty lists
      setAccess(DEFAULT_REACH_CLIENT_ACCESS);
    }).finally(() => setLoading(false));
  }, []);

  function togglePlatform(platform: ReachPlatform) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  function applyTemplate(template: ReachTemplate) {
    setBody(template.bodyTemplate);
  }

  async function handleMediaUpload(file: File) {
    if (!workspaceId) return;
    if (!access.canUploadMedia) {
      setError("Your role does not allow uploading media in this workspace.");
      return;
    }

    setUploadingMedia(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("workspaceId", workspaceId);
      formData.set("file", file);

      const res = await apiFetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await res.json()) as { error?: string; mediaUrl?: string };
      if (!res.ok || !payload.mediaUrl) throw new Error(payload.error ?? "Failed to upload image.");
      setMediaUrl(payload.mediaUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    if (!body.trim()) { setError("Post body is required."); return; }
    if (!platforms.length) { setError("Select at least one platform."); return; }
    if (postType === "schedule" && !scheduledAt) { setError("Select a date and time to schedule."); return; }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          postBody: body,
          platforms,
          postType,
          scheduledAt: postType === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
          mediaUrl: mediaUrl.trim() || undefined,
        }),
      });
      const payload = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to create post.");
      router.push("/calendar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post.");
    } finally {
      setSubmitting(false);
    }
  }

  const charLimit   = getCharLimit(platforms);
  const charCount   = body.length;
  const charWarning = charLimit !== null && charCount > charLimit * 0.8;
  const charOver    = charLimit !== null && charCount > charLimit;

  const connectedPlatforms = integrations.map((i) => i.platform);

  return (
    <ReachShell
      activeNav="compose"
      eyebrow="Compose"
      title="New Post"
      subtitle="Write, attach media, and schedule or publish to your connected accounts."
    >
      {loading ? (
        <Card padding="md"><BodyText muted>Loading…</BodyText></Card>
      ) : !workspaceId ? (
        <Card padding="md"><BodyText muted>No workspace selected.</BodyText></Card>
      ) : !access.canCreatePosts ? (
        <Card padding="md" className="sm:p-8">
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-[#202020]">Post creation is limited in this workspace</p>
            <BodyText muted>
              Owners, admins, staff, and social media users can create posts. Uploaders can add photos, but cannot publish or schedule posts on behalf of the school.
            </BodyText>
          </div>
        </Card>
      ) : connectedPlatforms.length === 0 ? (
        <Card padding="md" className="sm:p-8">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f1f5f9]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.6" className="h-7 w-7">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[#202020]">No accounts connected</p>
              <p className="mt-1 text-sm text-[#6b7280]">Connect your school's social accounts before composing a post.</p>
            </div>
            <Button asChild variant="primary">
              <Link href="/connect">Connect accounts</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">

          {/* Platform selector */}
          <Card padding="md">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Publish to</p>
            <div className="flex flex-wrap gap-3">
              {connectedPlatforms.map((platform) => {
                const active = platforms.includes(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    className={[
                      "flex items-center gap-2 rounded-lg border px-4 py-2 text-[14px] font-medium transition",
                      active
                        ? "border-[#2f76dd] bg-[#eff6ff] text-[#2f76dd]"
                        : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#93c5fd]",
                    ].join(" ")}
                  >
                    {PLATFORM_LABELS[platform]}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Body */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Post content</p>
              {charLimit !== null && (
                <span className={[
                  "text-[13px] tabular-nums",
                  charOver ? "text-red-500 font-semibold" : charWarning ? "text-amber-500" : "text-[#9ca3af]",
                ].join(" ")}>
                  {charCount} / {charLimit}
                </span>
              )}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Write your post…"
              className="w-full resize-y rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-[15px] text-[#202020] placeholder:text-[#9ca3af] focus:border-[#2f76dd] focus:outline-none"
            />
            {templates.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-[12px] text-[#6b7280]">Templates</p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1 text-[13px] text-[#374151] hover:border-[#93c5fd] transition"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Media */}
          <Card padding="md">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Media (optional)</p>
            <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-4">
              <label className="flex cursor-pointer flex-col items-start gap-2 text-[14px] text-[#374151]">
                <span className="font-medium text-[#202020]">Upload an image</span>
                <span className="text-[13px] text-[#6b7280]">PNG, JPG, WebP, or GIF up to 10MB.</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleMediaUpload(file);
                    e.currentTarget.value = "";
                  }}
                />
                <span className="rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-[13px] font-medium text-[#374151]">
                  {uploadingMedia ? "Uploading…" : "Choose image"}
                </span>
              </label>
            </div>
            <p className="mb-3 mt-4 text-[12px] text-[#6b7280]">Or paste an image URL</p>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Paste an image URL…"
              className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-[15px] text-[#202020] placeholder:text-[#9ca3af] focus:border-[#2f76dd] focus:outline-none"
            />
            {mediaUrl && (
              <div className="mt-3 flex flex-col gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="Preview" className="max-h-48 rounded-lg object-cover" />
                <div>
                  <button
                    type="button"
                    onClick={() => setMediaUrl("")}
                    className="text-[13px] font-medium text-[#2f76dd] underline underline-offset-2"
                  >
                    Remove image
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Schedule */}
          <Card padding="md">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">When</p>
            <div className="flex flex-wrap gap-3">
              {(["now", "schedule", "draft"] as PostType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPostType(t)}
                  className={[
                    "rounded-lg border px-4 py-2 text-[14px] font-medium transition",
                    postType === t
                      ? "border-[#2f76dd] bg-[#eff6ff] text-[#2f76dd]"
                      : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#93c5fd]",
                  ].join(" ")}
                >
                  {t === "now" ? "Post now" : t === "schedule" ? "Schedule" : "Save as draft"}
                </button>
              ))}
            </div>
            {postType === "schedule" && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-[15px] text-[#202020] focus:border-[#2f76dd] focus:outline-none"
              />
            )}
          </Card>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Posting…" : postType === "now" ? "Publish now" : postType === "schedule" ? "Schedule post" : "Save draft"}
            </Button>
            <Button asChild variant="secondary">
              <Link href="/calendar">Cancel</Link>
            </Button>
          </div>
        </form>
      )}
    </ReachShell>
  );
}
