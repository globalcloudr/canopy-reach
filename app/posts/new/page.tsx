"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText, Eyebrow } from "@canopy/ui";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import type { ReachIntegration, ReachMedia, ReachTemplate, ReachPlatform } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";

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

function formatScheduledPreview(value: string) {
  if (!value) {
    return "Choose a send time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Choose a send time";
  }

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
  const workspaceId = useReachWorkspaceId();

  const [integrations, setIntegrations]   = useState<ReachIntegration[]>([]);
  const [recentMedia, setRecentMedia]     = useState<ReachMedia[]>([]);
  const [templates, setTemplates]         = useState<ReachTemplate[]>([]);
  const [access, setAccess]               = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [loading, setLoading]             = useState(true);

  const [body, setBody]                   = useState("");
  const [platforms, setPlatforms]         = useState<ReachPlatform[]>([]);
  const [postType, setPostType]           = useState<PostType>("now");
  const [scheduledAt, setScheduledAt]     = useState("");
  const [mediaId, setMediaId]             = useState<string | null>(null);
  const [mediaUrl, setMediaUrl]           = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setIntegrations([]);
      setTemplates([]);
      setRecentMedia([]);
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
      getClientWorkspaceAccess(workspaceId),
    ]).then(([ints, tmpl, media, nextAccess]) => {
      if (cancelled) return;
      setIntegrations(Array.isArray(ints) ? ints : []);
      setTemplates(Array.isArray(tmpl) ? tmpl : []);
      setRecentMedia(Array.isArray(media) ? media : []);
      setAccess(nextAccess);
    }).catch(() => {
      if (cancelled) return;
      // Load with empty lists
      setIntegrations([]);
      setTemplates([]);
      setRecentMedia([]);
      setAccess(DEFAULT_REACH_CLIENT_ACCESS);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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
  const submitLabel = submitting
    ? "Posting…"
    : postType === "now"
      ? "Publish now"
      : postType === "schedule"
        ? "Schedule post"
        : "Save draft";
  const selectedPlatformLabels = platforms.map((platform) => PLATFORM_LABELS[platform]);

  return (
    <ReachShell
      activeNav="compose"
      eyebrow="Compose"
      title="New Post"
      subtitle="Write, attach media, and schedule or publish to your connected accounts."
    >
      {loading ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none"><BodyText muted>Loading…</BodyText></Card>
      ) : !workspaceId ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none"><BodyText muted>No workspace selected.</BodyText></Card>
      ) : !access.canCreatePosts ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none sm:p-8">
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-[#202020]">Post creation is limited in this workspace</p>
            <BodyText muted>
              Owners, admins, staff, and social media users can create posts. Uploaders can add photos, but cannot publish or schedule posts on behalf of the school.
            </BodyText>
          </div>
        </Card>
      ) : connectedPlatforms.length === 0 ? (
        <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none sm:p-8">
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
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-transparent px-4 py-3 text-[14px] text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_340px]">
            <div className="min-w-0">
              <Card className="overflow-hidden border border-[#dfe7f4] bg-transparent shadow-none">
                <div className="border-b border-[#edf1f5] px-6 py-5 sm:px-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-2xl">
                      <Eyebrow className="text-[#2f76dd]">Composer</Eyebrow>
                      <p className="mt-3 text-[1.35rem] font-semibold tracking-[-0.03em] text-[#202020]">
                        Build one school update, then choose how it goes out.
                      </p>
                      <p className="mt-2 text-[14px] leading-6 text-[#6b7280]">
                        Keep the writing flow in one place. Audience, timing, and media live alongside the post instead of breaking it into disconnected steps.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-[#d7e3f3] bg-[#edf3fb] px-3 py-1 text-[12px] font-medium text-[#516074]">
                        {connectedPlatforms.length} connected account{connectedPlatforms.length === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full border border-[#d7e3f3] bg-[#edf3fb] px-3 py-1 text-[12px] font-medium text-[#516074]">
                        {mediaUrl ? "Media attached" : "No media yet"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6 sm:px-8">
                  <section>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-semibold text-[#202020]">Audience and delivery</p>
                        <p className="mt-1 text-[13px] text-[#6b7280]">Choose where this post publishes and whether it goes out now, later, or stays as a draft.</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {connectedPlatforms.map((platform) => {
                        const active = platforms.includes(platform);
                        return (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => togglePlatform(platform)}
                            className={[
                              "flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition",
                              active
                                ? "border-[#2f76dd] bg-[#eff6ff] text-[#2f76dd] shadow-[0_0_0_1px_rgba(47,118,221,0.08)]"
                                : "border-[#d7e3f3] bg-[#edf3fb] text-[#415163] hover:border-[#93c5fd] hover:bg-[#e7eef9]",
                            ].join(" ")}
                          >
                            <span className={active ? "h-2.5 w-2.5 rounded-full bg-[#2f76dd]" : "h-2.5 w-2.5 rounded-full bg-[#c6d0db]"} />
                            {PLATFORM_LABELS[platform]}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {(["now", "schedule", "draft"] as PostType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setPostType(type)}
                          className={[
                            "rounded-xl border px-4 py-3 text-left transition",
                            postType === type
                              ? "border-[#2f76dd] bg-[#eff6ff] text-[#163d78]"
                              : "border-[#e5e7eb] bg-white/62 text-[#374151] hover:border-[#93c5fd] hover:bg-white/80",
                          ].join(" ")}
                        >
                          <p className="text-[14px] font-semibold">
                            {type === "now" ? "Publish now" : type === "schedule" ? "Schedule" : "Save as draft"}
                          </p>
                          <p className="mt-1 text-[12px] text-[#6b7280]">
                            {type === "now"
                              ? "Send this update as soon as you submit."
                              : type === "schedule"
                                ? "Choose a future date and time."
                                : "Keep working on it before publishing."}
                          </p>
                        </button>
                      ))}
                    </div>

                    {postType === "schedule" && (
                      <div className="mt-4 max-w-sm">
                        <label className="mb-2 block text-[12px] font-medium uppercase tracking-[0.06em] text-[#7a8798]">
                          Scheduled send time
                        </label>
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="w-full rounded-xl border border-[#d7dee8] bg-white px-3 py-2.5 text-[15px] text-[#202020] focus:border-[#2f76dd] focus:outline-none"
                        />
                      </div>
                    )}
                  </section>

                  <section className="mt-8 border-t border-[#edf1f5] pt-8">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[15px] font-semibold text-[#202020]">Post content</p>
                        <p className="mt-1 text-[13px] text-[#6b7280]">Write the message once, then refine tone and length for the selected platforms.</p>
                      </div>
                      {charLimit !== null && (
                        <span className={[
                          "rounded-full px-3 py-1 text-[13px] tabular-nums",
                          charOver
                            ? "bg-red-50 text-red-600"
                            : charWarning
                              ? "bg-amber-50 text-amber-600"
                              : "bg-[#f5f7fa] text-[#7a8798]",
                        ].join(" ")}>
                          {charCount} / {charLimit}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 overflow-hidden rounded-[22px] border border-[#d7dee8] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={10}
                        placeholder="Share the update you want families, students, or your community to see..."
                        className="min-h-[260px] w-full resize-y border-0 bg-transparent px-5 py-5 text-[16px] leading-7 text-[#202020] placeholder:text-[#9ca3af] focus:outline-none"
                      />
                    </div>

                    {templates.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-[#7a8798]">Start from a template</p>
                        <div className="flex flex-wrap gap-2">
                          {templates.map((template) => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => applyTemplate(template)}
                              className="rounded-full border border-[#d7e3f3] bg-[#edf3fb] px-3 py-1.5 text-[13px] text-[#374151] transition hover:border-[#93c5fd] hover:bg-[#e7eef9]"
                            >
                              {template.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="mt-8 border-t border-[#edf1f5] pt-8">
                    <div>
                      <p className="text-[15px] font-semibold text-[#202020]">Media</p>
                      <p className="mt-1 text-[13px] text-[#6b7280]">Add one strong visual, either by uploading it, pasting a URL, or reusing recent workspace media.</p>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <label className="rounded-2xl border border-dashed border-[#c6d3e2] bg-white/42 p-5 transition hover:border-[#93c5fd] hover:bg-white/60">
                        <div className="flex h-full cursor-pointer flex-col gap-2">
                          <p className="text-[14px] font-semibold text-[#202020]">Upload an image</p>
                          <p className="text-[13px] text-[#6b7280]">PNG, JPG, WebP, or GIF up to 10MB.</p>
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
                          <span className="mt-3 inline-flex w-fit rounded-full border border-[#d7e3f3] bg-[#edf3fb] px-3 py-2 text-[13px] font-medium text-[#374151]">
                            {uploadingMedia ? "Uploading…" : "Choose image"}
                          </span>
                        </div>
                      </label>

                      <div className="rounded-2xl border border-[#e5e7eb] bg-transparent p-5">
                        <p className="text-[14px] font-semibold text-[#202020]">Use an image URL</p>
                        <p className="mt-1 text-[13px] text-[#6b7280]">Paste a direct image link if the asset already lives online.</p>
                        <input
                          type="url"
                          value={mediaUrl}
                          onChange={(e) => {
                            setMediaId(null);
                            setMediaUrl(e.target.value);
                          }}
                          placeholder="Paste an image URL…"
                          className="mt-4 w-full rounded-xl border border-[#d7dee8] bg-white px-3 py-2.5 text-[15px] text-[#202020] placeholder:text-[#9ca3af] focus:border-[#2f76dd] focus:outline-none"
                        />
                      </div>
                    </div>

                    {recentMedia.length > 0 && (
                      <div className="mt-6">
                        <div className="mb-3">
                          <p className="text-[13px] font-medium text-[#374151]">Recent workspace media</p>
                          <p className="mt-1 text-[12px] text-[#6b7280]">Choose one of these images to attach it to this post.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {recentMedia.map((media) => {
                            const selected = mediaId === media.id;
                            return (
                              <button
                                key={media.id}
                                type="button"
                                onClick={() => selectMedia(media)}
                                className={[
                                  "flex items-center gap-4 overflow-hidden rounded-2xl border bg-white p-3 text-left transition",
                                  selected ? "border-[#2f76dd] ring-2 ring-[#bfdbfe]" : "border-[#e5e7eb] hover:border-[#93c5fd] hover:bg-[#f8fbff]",
                                ].join(" ")}
                                aria-pressed={selected}
                              >
                                <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#f3f4f6]">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={media.url} alt={media.originalFilename ?? "Workspace media"} className="h-full w-full object-cover" />
                                  {selected && (
                                    <span className="absolute inset-x-2 top-2 rounded-full bg-[#2f76dd] px-2 py-1 text-center text-[10px] font-semibold text-white">
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[14px] font-medium text-[#202020]">
                                    {media.originalFilename ?? "Workspace image"}
                                  </p>
                                  <p className="mt-1 text-[12px] text-[#6b7280]">
                                    {selected ? "Attached to this post" : "Use this image for the post"}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </Card>
            </div>

            <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
              <div className="flex flex-col gap-4">
                <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7a8798]">Publishing summary</p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-[12px] text-[#7a8798]">Destination</p>
                      <p className="mt-1 text-[15px] font-semibold text-[#202020]">
                        {selectedPlatformLabels.length > 0 ? selectedPlatformLabels.join(", ") : "Choose at least one platform"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#7a8798]">Delivery</p>
                      <p className="mt-1 text-[15px] font-semibold text-[#202020]">
                        {postType === "now" ? "Publish immediately" : postType === "schedule" ? "Scheduled send" : "Draft only"}
                      </p>
                      {postType === "schedule" && (
                        <p className="mt-1 text-[12px] text-[#6b7280]">{formatScheduledPreview(scheduledAt)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[12px] text-[#7a8798]">Content length</p>
                      <p className="mt-1 text-[15px] font-semibold text-[#202020]">{charCount} characters</p>
                    </div>
                    <div>
                      <p className="text-[12px] text-[#7a8798]">Media</p>
                      <p className="mt-1 text-[15px] font-semibold text-[#202020]">
                        {mediaUrl ? (mediaId ? "Workspace image attached" : "Image URL attached") : "No image attached"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-3">
                    <Button type="submit" variant="primary" disabled={submitting}>
                      {submitLabel}
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/calendar">Cancel</Link>
                    </Button>
                  </div>
                </Card>

                <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7a8798]">Live preview</p>
                  <div className="mt-4 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#2f76dd] text-sm font-semibold text-white">
                        C
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[#202020]">Your school page</p>
                        <p className="text-[12px] text-[#7a8798]">
                          {postType === "schedule" ? formatScheduledPreview(scheduledAt) : postType === "draft" ? "Draft preview" : "Ready to publish"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#202020]">
                      {body.trim() || "Your post preview will appear here as you write."}
                    </p>
                    {mediaUrl && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#f8fafc]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaUrl} alt="Selected post media" className="max-h-72 w-full object-contain bg-[#f8fafc]" />
                      </div>
                    )}
                  </div>
                </Card>

                <Card padding="md" className="border border-[#dfe7f4] bg-transparent shadow-none">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#7a8798]">Publishing guidance</p>
                  <ul className="mt-3 space-y-2 text-[13px] leading-6 text-[#5d6a79]">
                    <li>Choose the destination first so the character guidance reflects where this update will go.</li>
                    <li>Use one image that supports the message instead of treating media as a separate task.</li>
                    <li>Drafts are useful when the school account owner wants to review wording before it goes live.</li>
                  </ul>
                </Card>
              </div>
            </div>
          </div>
        </form>
      )}
    </ReachShell>
  );
}
