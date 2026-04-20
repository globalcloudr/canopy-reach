"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@globalcloudr/canopy-ui";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import type { ReachIntegration, ReachMedia, ReachTemplate, ReachPlatform, ReachGuidelines } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";
import { buildWorkspaceHref } from "@/lib/workspace-href";

const CHAR_LIMITS: Record<ReachPlatform, number> = {
  facebook:  63206,
  instagram: 2200,
  linkedin:  3000,
  x:         280,
};

const PLATFORM_COLORS: Record<ReachPlatform, string> = {
  facebook:  "#1877F2",
  instagram: "#E4405F",
  linkedin:  "#0A66C2",
  x:         "#000000",
};

const PLATFORM_NOTES: Record<ReachPlatform, string> = {
  facebook:  "Image shows full-width below text. Links generate a preview card.",
  instagram: "Image is required. Caption appears below the square-cropped photo. No clickable links.",
  linkedin:  "Text post with optional image. First 140 characters are visible before \"see more\".",
  x:         "Short-form. Image shows as a card below the tweet.",
};

function getCharLimit(platforms: ReachPlatform[]): number | null {
  if (!platforms.length) return null;
  return Math.min(...platforms.map((p) => CHAR_LIMITS[p]));
}

function formatScheduledPreview(value: string) {
  if (!value) return "Choose a send time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Choose a send time";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type PostType = "now" | "schedule" | "draft";

export default function NewPostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = useReachWorkspaceId();
  const workspaceSlug = searchParams.get("workspace")?.trim() || null;

  const [integrations, setIntegrations]   = useState<ReachIntegration[]>([]);
  const [recentMedia, setRecentMedia]     = useState<ReachMedia[]>([]);
  const [templates, setTemplates]         = useState<ReachTemplate[]>([]);
  const [guidelines, setGuidelines]       = useState<ReachGuidelines | null>(null);
  const [access, setAccess]               = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [loading, setLoading]             = useState(true);

  // Pre-fill from duplicate query params
  const dupBody      = searchParams.get("body") ?? "";
  const dupPlatforms = searchParams.get("platforms")?.split(",").filter(Boolean) as ReachPlatform[] | undefined;
  const dupMediaId   = searchParams.get("mediaId") ?? null;

  const [body, setBody]                   = useState(dupBody);
  const [platforms, setPlatforms]         = useState<ReachPlatform[]>(dupPlatforms ?? []);
  const [postType, setPostType]           = useState<PostType>("now");
  const [scheduledAt, setScheduledAt]     = useState("");
  const [mediaId, setMediaId]             = useState<string | null>(dupMediaId);
  const [mediaUrl, setMediaUrl]           = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // Collapsible section states
  const [mediaOpen, setMediaOpen]           = useState(!!dupMediaId);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<ReachPlatform | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setIntegrations([]);
      setTemplates([]);
      setRecentMedia([]);
      setGuidelines(null);
      setAccess(DEFAULT_REACH_CLIENT_ACCESS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      apiFetch(`/api/integrations?workspaceId=${workspaceId}`).then((r) => r.json()),
      apiFetch(`/api/templates?workspaceId=${workspaceId}`).then((r) => r.json()),
      apiFetch(`/api/media?workspaceId=${workspaceId}&limit=9`).then((r) => r.json()),
      apiFetch(`/api/guidelines?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => null),
      getClientWorkspaceAccess(workspaceId),
    ]).then(([ints, tmpl, media, guide, nextAccess]) => {
      if (cancelled) return;
      setIntegrations(Array.isArray(ints) ? ints : []);
      setTemplates(Array.isArray(tmpl) ? tmpl : []);
      setRecentMedia(Array.isArray(media) ? media : []);
      setGuidelines(guide && typeof guide === "object" && "content" in guide ? guide as ReachGuidelines : null);
      setAccess(nextAccess);

      // Resolve media URL if pre-filled from duplicate
      if (dupMediaId) {
        const allMedia = Array.isArray(media) ? media as ReachMedia[] : [];
        const match = allMedia.find((m) => m.id === dupMediaId);
        if (match) {
          setMediaUrl(match.url);
        }
      }
    }).catch(() => {
      if (cancelled) return;
      setIntegrations([]);
      setTemplates([]);
      setRecentMedia([]);
      setGuidelines(null);
      setAccess(DEFAULT_REACH_CLIENT_ACCESS);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [workspaceId]);

  // Auto-select first platform for preview when selection changes
  useEffect(() => {
    if (platforms.length > 0 && (!previewPlatform || !platforms.includes(previewPlatform))) {
      setPreviewPlatform(platforms[0]);
    } else if (platforms.length === 0) {
      setPreviewPlatform(null);
    }
  }, [platforms, previewPlatform]);

  function togglePlatform(platform: ReachPlatform) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  function applyTemplate(template: ReachTemplate) {
    setBody(template.bodyTemplate);
  }

  function selectMedia(media: ReachMedia) {
    setMediaId(media.id);
    setMediaUrl(media.url);
    setMediaOpen(true);
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
      const payload = (await res.json()) as { error?: string; media?: ReachMedia; mediaUrl?: string; mediaId?: string };
      if (!res.ok || !payload.media || !payload.mediaUrl || !payload.mediaId) {
        throw new Error(payload.error ?? "Failed to upload image.");
      }
      setMediaId(payload.mediaId);
      setMediaUrl(payload.mediaUrl);
      setRecentMedia((current) => [payload.media!, ...current.filter((item) => item.id !== payload.media!.id)].slice(0, 9));
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
          mediaId: mediaId ?? undefined,
          mediaUrl: mediaId ? undefined : mediaUrl.trim() || undefined,
        }),
      });
      const payload = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to create post.");
      router.push(buildWorkspaceHref("/calendar", workspaceSlug));
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
  const requiresReview = access.role === "staff" || access.role === "social_media";
  const submitLabel = submitting
    ? (requiresReview && postType !== "draft" ? "Submitting…" : "Posting…")
    : postType === "now"
      ? (requiresReview ? "Submit for review" : "Publish now")
      : postType === "schedule"
        ? (requiresReview ? "Submit for review (scheduled)" : "Schedule post")
        : "Save draft";
  const selectedPlatformLabels = platforms.map((platform) => PLATFORM_LABELS[platform]);

  return (
    <ReachShell
      activeNav="compose"
      eyebrow="Compose"
      title="New Post"
      subtitle="Write your update, pick where it goes, and publish or schedule."
    >
      {loading ? (
        <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none"><BodyText muted>Loading…</BodyText></Card>
      ) : !workspaceId ? (
        <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none"><BodyText muted>No workspace selected.</BodyText></Card>
      ) : !access.canCreatePosts ? (
        <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none sm:p-8">
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-[var(--ink)]">Post creation is limited in this workspace</p>
            <BodyText muted>
              Owners, admins, staff, and social media users can create posts. Uploaders can add photos, but cannot publish or schedule posts on behalf of the school.
            </BodyText>
          </div>
        </Card>
      ) : connectedPlatforms.length === 0 ? (
        <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none sm:p-8">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface-muted)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.6" className="h-7 w-7">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-[var(--ink)]">No accounts connected</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Connect your school's social accounts before composing a post.</p>
            </div>
            <Button asChild variant="accent">
              <Link href={buildWorkspaceHref("/connect", workspaceSlug)}>Connect accounts</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-transparent px-4 py-3 text-[14px] text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_340px]">
            {/* ── Main column ── */}
            <div className="flex min-w-0 flex-col gap-5">

              {/* Templates — promoted to first step */}
              {templates.length > 0 && (
                <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none">
                  <p className="text-[13px] font-semibold text-[#506176]">Start from a template</p>
                  <p className="mt-1 text-[12px] text-[#8ea0b7]">Choose one to pre-fill the post, or skip and write from scratch.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="group rounded-xl border border-[var(--rule)] bg-white/70 px-4 py-3 text-left transition hover:border-[#93c5fd] hover:bg-white hover:shadow-sm"
                      >
                        <p className="text-[14px] font-medium text-[var(--ink)]">{template.name}</p>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#8ea0b7] group-hover:text-[#617286]">
                          {template.bodyTemplate}
                        </p>
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Post content — the main writing area */}
              <Card className="overflow-hidden border border-[var(--rule)] bg-transparent shadow-none">
                <div className="px-6 py-5 sm:px-8">
                  {/* Platform toggles — inline, compact */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[13px] font-medium text-[#506176]">Post to</span>
                    {connectedPlatforms.map((platform) => {
                      const active = platforms.includes(platform);
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => togglePlatform(platform)}
                          className={[
                            "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                            active
                              ? "border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--accent)]"
                              : "border-[var(--rule)] bg-[var(--surface-muted)] text-[#506176] hover:border-[#93c5fd]",
                          ].join(" ")}
                        >
                          <span className={active ? "h-2 w-2 rounded-full bg-[var(--accent)]" : "h-2 w-2 rounded-full bg-[#c6d0db]"} />
                          {PLATFORM_LABELS[platform]}
                        </button>
                      );
                    })}
                    {charLimit !== null && (
                      <span className={[
                        "ml-auto rounded-full px-2.5 py-1 text-[12px] tabular-nums",
                        charOver ? "bg-red-50 text-red-600"
                          : charWarning ? "bg-amber-50 text-amber-600"
                          : "bg-[#f5f7fa] text-[#7a8798]",
                      ].join(" ")}>
                        {charCount} / {charLimit}
                      </span>
                    )}
                  </div>

                  {/* Textarea */}
                  <div className="mt-4 overflow-hidden rounded-[18px] border border-[var(--rule)] bg-white">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      placeholder="What do you want to share with your community?"
                      className="min-h-[200px] w-full resize-y border-0 bg-transparent px-5 py-4 text-[15px] leading-7 text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none"
                    />
                  </div>

                  {/* Delivery — compact row */}
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <span className="text-[13px] font-medium text-[#506176]">When</span>
                    {(["now", "schedule", "draft"] as PostType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPostType(type)}
                        className={[
                          "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                          postType === type
                            ? "border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--accent)]"
                            : "border-[var(--rule)] bg-white/60 text-[#506176] hover:border-[#93c5fd]",
                        ].join(" ")}
                      >
                        {type === "now"
                          ? (requiresReview ? "Submit for review" : "Publish now")
                          : type === "schedule"
                            ? "Schedule"
                            : "Save as draft"}
                      </button>
                    ))}
                    {postType === "schedule" && (
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="rounded-xl border border-[var(--rule)] bg-white px-3 py-1.5 text-[13px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              </Card>

              {/* Media — collapsible */}
              <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none">
                <button
                  type="button"
                  onClick={() => setMediaOpen((o) => !o)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <MediaSectionIcon className="h-5 w-5 text-[#8ea0b7]" />
                    <span className="text-[14px] font-medium text-[var(--ink)]">
                      {mediaUrl ? "Image attached" : "Add an image"}
                    </span>
                    {mediaUrl && <span className="text-[12px] text-[#059669]">Attached</span>}
                  </div>
                  <ChevronIcon className={`h-4 w-4 text-[var(--faint)] transition-transform ${mediaOpen ? "rotate-180" : ""}`} />
                </button>

                {mediaOpen && (
                  <div className="mt-4 space-y-4">
                    {/* Upload + URL side by side */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="cursor-pointer rounded-xl border border-dashed border-[#c6d3e2] bg-white/40 p-4 transition hover:border-[#93c5fd] hover:bg-white/60">
                        <p className="text-[13px] font-medium text-[var(--ink)]">Upload an image</p>
                        <p className="mt-1 text-[12px] text-[#8ea0b7]">PNG, JPG, WebP, or GIF up to 10MB</p>
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
                        <span className="mt-2 inline-flex rounded-full border border-[var(--rule)] bg-[var(--surface-muted)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-2)]">
                          {uploadingMedia ? "Uploading…" : "Choose file"}
                        </span>
                      </label>

                      <div className="rounded-xl border border-[var(--rule)] bg-transparent p-4">
                        <p className="text-[13px] font-medium text-[var(--ink)]">Paste an image URL</p>
                        <input
                          type="url"
                          value={mediaUrl}
                          onChange={(e) => { setMediaId(null); setMediaUrl(e.target.value); }}
                          placeholder="https://…"
                          className="mt-2 w-full rounded-lg border border-[var(--rule)] bg-white px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Media preview */}
                    {mediaUrl && (
                      <div className="flex items-center gap-3 rounded-xl border border-[var(--rule)] bg-white/60 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaUrl} alt="Selected" className="h-16 w-20 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[var(--ink)]">Image selected</p>
                          <button
                            type="button"
                            onClick={() => { setMediaId(null); setMediaUrl(""); }}
                            className="mt-0.5 text-[12px] text-red-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Recent media */}
                    {recentMedia.length > 0 && (
                      <div>
                        <p className="mb-2 text-[12px] font-medium text-[#8ea0b7]">Recent workspace images</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {recentMedia.map((media) => {
                            const selected = mediaId === media.id;
                            return (
                              <button
                                key={media.id}
                                type="button"
                                onClick={() => selectMedia(media)}
                                className={[
                                  "relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border transition",
                                  selected ? "border-[var(--accent)] ring-2 ring-[#bfdbfe]" : "border-[var(--rule)] hover:border-[#93c5fd]",
                                ].join(" ")}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={media.url} alt={media.originalFilename ?? "Media"} className="h-full w-full object-cover" />
                                {selected && (
                                  <span className="absolute inset-0 grid place-items-center bg-[var(--accent)]/20">
                                    <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white">Selected</span>
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Sidebar column ── */}
            <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
              <div className="flex flex-col gap-4">
                {/* Publishing summary + actions */}
                <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7a8798]">Summary</p>
                  <div className="mt-3 space-y-3 text-[13px]">
                    <div className="flex justify-between">
                      <span className="text-[#7a8798]">Destination</span>
                      <span className="font-medium text-[var(--ink)]">
                        {selectedPlatformLabels.length > 0 ? selectedPlatformLabels.join(", ") : "None selected"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7a8798]">Delivery</span>
                      <span className="font-medium text-[var(--ink)]">
                        {postType === "now" ? "Immediately" : postType === "schedule" ? "Scheduled" : "Draft"}
                      </span>
                    </div>
                    {postType === "schedule" && scheduledAt && (
                      <div className="flex justify-between">
                        <span className="text-[#7a8798]">Send time</span>
                        <span className="font-medium text-[var(--ink)]">{formatScheduledPreview(scheduledAt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#7a8798]">Length</span>
                      <span className="font-medium text-[var(--ink)]">{charCount} chars</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7a8798]">Image</span>
                      <span className="font-medium text-[var(--ink)]">{mediaUrl ? "Yes" : "None"}</span>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-2.5">
                    <Button type="submit" variant="accent" disabled={submitting}>
                      {submitLabel}
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href={buildWorkspaceHref("/calendar", workspaceSlug)}>Cancel</Link>
                    </Button>
                  </div>
                </Card>

                {/* Per-platform preview */}
                <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7a8798]">Preview</p>
                    {platforms.length > 1 && (
                      <div className="flex gap-1">
                        {platforms.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPreviewPlatform(p)}
                            className={[
                              "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                              previewPlatform === p
                                ? "bg-[var(--ink)] text-white"
                                : "bg-[#f0f4f8] text-[#506176] hover:bg-[var(--rule)]",
                            ].join(" ")}
                          >
                            {PLATFORM_LABELS[p]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {previewPlatform ? (
                    <div className="mt-3">
                      <PlatformPreview
                        platform={previewPlatform}
                        body={body}
                        mediaUrl={mediaUrl}
                        postType={postType}
                        scheduledAt={scheduledAt}
                      />
                    </div>
                  ) : (
                    <p className="mt-3 text-[12px] text-[var(--faint)]">
                      Select a platform above to see how your post will look.
                    </p>
                  )}
                </Card>

                {/* Guidelines — collapsible reference */}
                {guidelines?.content && (
                  <Card padding="md" className="border border-[var(--rule)] bg-transparent shadow-none">
                    <button
                      type="button"
                      onClick={() => setGuidelinesOpen((o) => !o)}
                      className="flex w-full items-center justify-between"
                    >
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7a8798]">Guidelines</p>
                      <ChevronIcon className={`h-3.5 w-3.5 text-[var(--faint)] transition-transform ${guidelinesOpen ? "rotate-180" : ""}`} />
                    </button>
                    {guidelinesOpen && (
                      <div className="mt-3 max-h-64 overflow-y-auto rounded-lg bg-[var(--surface-muted)] p-3">
                        <p className="whitespace-pre-wrap text-[12px] leading-5 text-[#506176]">
                          {guidelines.content}
                        </p>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </div>
        </form>
      )}
    </ReachShell>
  );
}

// ─── Platform preview ────────────────────────────────────────────────────────

function PlatformPreview({
  platform,
  body,
  mediaUrl,
  postType,
  scheduledAt,
}: {
  platform: ReachPlatform;
  body: string;
  mediaUrl: string;
  postType: PostType;
  scheduledAt: string;
}) {
  const limit = CHAR_LIMITS[platform];
  const text = body.trim();
  const isOver = text.length > limit;
  const brandColor = PLATFORM_COLORS[platform];
  const note = PLATFORM_NOTES[platform];
  const truncatedBody = platform === "linkedin" && text.length > 140
    ? text.slice(0, 140) + "… see more"
    : text;
  const noImageWarning = platform === "instagram" && !mediaUrl;

  return (
    <div>
      {/* Mock post card */}
      <div className="overflow-hidden rounded-xl border border-[var(--rule)] bg-white">
        {/* Header bar */}
        <div className="flex items-center gap-2.5 border-b border-[#f0f0f0] px-3 py-2.5">
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: brandColor }}
          >
            {PLATFORM_LABELS[platform][0]}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[var(--ink)]">Your school page</p>
            <p className="text-[10px] text-[var(--faint)]">
              {postType === "schedule" ? formatScheduledPreview(scheduledAt) : postType === "draft" ? "Draft" : "Just now"}
            </p>
          </div>
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: brandColor }}
          >
            {PLATFORM_LABELS[platform]}
          </span>
        </div>

        {/* Instagram: image first, caption below */}
        {platform === "instagram" ? (
          <>
            {mediaUrl ? (
              <div className="aspect-square w-full bg-[#f0f0f0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="Preview" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="grid aspect-square w-full place-items-center bg-[#f8f8f8]">
                <div className="text-center">
                  <ImagePlaceholderIcon className="mx-auto h-8 w-8 text-[#d0d0d0]" />
                  <p className="mt-1 text-[11px] text-[var(--faint)]">Image required</p>
                </div>
              </div>
            )}
            <div className="px-3 py-2.5">
              <p className="whitespace-pre-wrap text-[12px] leading-5 text-[var(--ink)]">
                {text || "Your caption will appear here…"}
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Facebook / LinkedIn / X: text first, image below */}
            <div className="px-3 py-2.5">
              <p className="whitespace-pre-wrap text-[12px] leading-5 text-[var(--ink)]">
                {(platform === "linkedin" ? truncatedBody : text) || "Your post will appear here…"}
              </p>
            </div>
            {mediaUrl && (
              <div className="border-t border-[#f0f0f0]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="Preview" className="max-h-44 w-full object-cover" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Platform-specific notes */}
      <div className="mt-2.5 space-y-1.5">
        <p className="text-[11px] leading-4 text-[#8ea0b7]">{note}</p>
        {isOver && (
          <p className="text-[11px] font-medium text-red-500">
            {text.length - limit} characters over the {limit.toLocaleString()} limit for {PLATFORM_LABELS[platform]}.
          </p>
        )}
        {noImageWarning && (
          <p className="text-[11px] font-medium text-amber-600">
            Instagram requires an image. Add one before publishing.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function MediaSectionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImagePlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
