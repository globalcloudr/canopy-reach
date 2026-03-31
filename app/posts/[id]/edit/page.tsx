"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText } from "@canopy/ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachIntegration, ReachMedia, ReachPlatform, ReachPost, ReachTemplate } from "@/lib/reach-schema";
import { PLATFORM_LABELS } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";

const CHAR_LIMITS: Record<ReachPlatform, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  x: 280,
};

type PostType = "schedule" | "draft";

function getCharLimit(platforms: ReachPlatform[]): number | null {
  if (!platforms.length) return null;
  return Math.min(...platforms.map((platform) => CHAR_LIMITS[platform]));
}

function toDateTimeLocal(iso: string | null) {
  if (!iso) return "";

  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const workspaceId = useReachWorkspaceId();

  const [integrations, setIntegrations] = useState<ReachIntegration[]>([]);
  const [recentMedia, setRecentMedia] = useState<ReachMedia[]>([]);
  const [templates, setTemplates] = useState<ReachTemplate[]>([]);
  const [access, setAccess] = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [loading, setLoading] = useState(true);

  const [body, setBody] = useState("");
  const [platforms, setPlatforms] = useState<ReachPlatform[]>([]);
  const [postType, setPostType] = useState<PostType>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notEditable, setNotEditable] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !id) {
      setIntegrations([]);
      setTemplates([]);
      setRecentMedia([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotEditable(null);

    Promise.all([
      apiFetch(`/api/integrations?workspaceId=${workspaceId}`).then((response) => response.json()),
      apiFetch(`/api/templates?workspaceId=${workspaceId}`).then((response) => response.json()),
      apiFetch(`/api/media?workspaceId=${workspaceId}&limit=9`).then((response) => response.json()),
      apiFetch(`/api/posts/${id}?workspaceId=${workspaceId}`).then((response) => response.json()),
      getClientWorkspaceAccess(workspaceId),
    ])
      .then(([integrationData, templateData, mediaData, postData, nextAccess]) => {
        if (cancelled) return;
        setIntegrations(Array.isArray(integrationData) ? integrationData : []);
        setTemplates(Array.isArray(templateData) ? templateData : []);
        setRecentMedia(Array.isArray(mediaData) ? mediaData : []);
        setAccess(nextAccess);

        const post = (postData as { post?: ReachPost; error?: string }).post;
        if (!post) {
          throw new Error((postData as { error?: string }).error ?? "Post not found.");
        }

        if (!nextAccess.canEditPosts) {
          setNotEditable("Your role does not allow editing scheduled or draft posts.");
          return;
        }

        if (post.status === "published") {
          setNotEditable("Published posts cannot be edited.");
          return;
        }

        setBody(post.body);
        setPlatforms(post.platforms);
        setMediaId(post.mediaId);
        setMediaUrl(post.mediaUrl ?? "");
        setPostType(post.status === "scheduled" ? "schedule" : "draft");
        setScheduledAt(toDateTimeLocal(post.scheduledAt));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load post.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, workspaceId]);

  function togglePlatform(platform: ReachPlatform) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((current) => current !== platform) : [...prev, platform]
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

      const response = await apiFetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string; media?: ReachMedia; mediaUrl?: string; mediaId?: string };
      if (!response.ok || !payload.media || !payload.mediaUrl || !payload.mediaId) {
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
      const response = await apiFetch(`/api/posts/${id}?workspaceId=${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postBody: body,
          platforms,
          postType,
          scheduledAt: postType === "schedule" ? new Date(scheduledAt).toISOString() : undefined,
          mediaId: mediaId ?? undefined,
          mediaUrl: mediaId ? undefined : mediaUrl.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update post.");
      }

      router.push(`/posts/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update post.");
    } finally {
      setSubmitting(false);
    }
  }

  const charLimit = getCharLimit(platforms);
  const charCount = body.length;
  const charWarning = charLimit !== null && charCount > charLimit * 0.8;
  const charOver = charLimit !== null && charCount > charLimit;
  const connectedPlatforms = integrations.map((integration) => integration.platform);

  return (
    <ReachShell
      activeNav="calendar"
      eyebrow="Post"
      title="Edit Post"
      subtitle="Update content, platforms, media, or schedule before the post is published."
    >
      {loading ? (
        <Card padding="md"><BodyText muted>Loading…</BodyText></Card>
      ) : error ? (
        <Card padding="md"><BodyText muted>{error}</BodyText></Card>
      ) : notEditable ? (
        <Card padding="md" className="sm:p-8">
          <div className="flex flex-col gap-4">
            <BodyText muted>{notEditable}</BodyText>
            <div className="flex gap-3">
              <Button asChild variant="secondary">
                <Link href={`/posts/${id}`}>Back to post</Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : connectedPlatforms.length === 0 ? (
        <Card padding="md"><BodyText muted>No connected accounts available.</BodyText></Card>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
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

          <Card padding="md">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">Post content</p>
              {charLimit !== null && (
                <span
                  className={[
                    "text-[13px] tabular-nums",
                    charOver ? "text-red-500 font-semibold" : charWarning ? "text-amber-500" : "text-[#9ca3af]",
                  ].join(" ")}
                >
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
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="rounded-md border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1 text-[13px] text-[#374151] transition hover:border-[#93c5fd]"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

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
              onChange={(e) => {
                setMediaId(null);
                setMediaUrl(e.target.value);
              }}
              placeholder="Paste an image URL…"
              className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-[15px] text-[#202020] placeholder:text-[#9ca3af] focus:border-[#2f76dd] focus:outline-none"
            />
            {mediaUrl && (
              <div className="mt-4 rounded-xl border border-[#dbe4f0] bg-[#f8fbff] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#202020]">Selected image</p>
                    <p className="mt-1 text-[13px] text-[#6b7280]">
                      {mediaId ? "This workspace image will be attached to the post." : "This pasted image URL will be attached to the post."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaId(null);
                      setMediaUrl("");
                    }}
                    className="text-[13px] font-medium text-[#2f76dd] underline underline-offset-2"
                  >
                    Remove image
                  </button>
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl} alt="Selected post media" className="max-h-72 w-full object-contain bg-[#f8fafc]" />
                </div>
              </div>
            )}
            {recentMedia.length > 0 && (
              <div className="mt-4">
                <div className="mb-3">
                  <p className="text-[13px] font-medium text-[#374151]">Recent workspace media</p>
                  <p className="mt-1 text-[12px] text-[#6b7280]">Choose one of these images to attach it to this post.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recentMedia.map((media) => {
                    const selected = mediaId === media.id;
                    return (
                      <button
                        key={media.id}
                        type="button"
                        onClick={() => selectMedia(media)}
                        className={[
                          "overflow-hidden rounded-xl border bg-white text-left transition",
                          selected ? "border-[#2f76dd] ring-2 ring-[#bfdbfe]" : "border-[#e5e7eb] hover:border-[#93c5fd] hover:bg-[#f8fbff]",
                        ].join(" ")}
                        aria-pressed={selected}
                      >
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={media.url} alt={media.originalFilename ?? "Workspace media"} className="h-36 w-full object-cover" />
                          {selected && (
                            <span className="absolute left-2 top-2 rounded-full bg-[#2f76dd] px-2 py-1 text-[11px] font-semibold text-white">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-[#202020]">
                              {media.originalFilename ?? "Workspace image"}
                            </p>
                            <p className="mt-0.5 text-[12px] text-[#6b7280]">
                              {selected ? "Attached to this post" : "Use this image"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card padding="md">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">When</p>
            <div className="flex flex-wrap gap-3">
              {(["schedule", "draft"] as PostType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPostType(type)}
                  className={[
                    "rounded-lg border px-4 py-2 text-[14px] font-medium transition",
                    postType === type
                      ? "border-[#2f76dd] bg-[#eff6ff] text-[#2f76dd]"
                      : "border-[#e5e7eb] bg-white text-[#374151] hover:border-[#93c5fd]",
                  ].join(" ")}
                >
                  {type === "schedule" ? "Schedule" : "Save as draft"}
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
              {submitting ? "Saving…" : postType === "schedule" ? "Save changes" : "Save draft"}
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/posts/${id}`}>Cancel</Link>
            </Button>
          </div>
        </form>
      )}
    </ReachShell>
  );
}
