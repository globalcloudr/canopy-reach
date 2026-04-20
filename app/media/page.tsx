"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReachShell } from "@/app/_components/reach-shell";
import { Button, Card, BodyText, Dialog, DialogContent, DialogTitle, DialogDescription } from "@globalcloudr/canopy-ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachMedia } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";

const PAGE_SIZE = 24;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MediaLibraryPage() {
  const workspaceId = useReachWorkspaceId();
  const [access, setAccess] = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [media, setMedia] = useState<ReachMedia[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<ReachMedia | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview state
  const [previewMedia, setPreviewMedia] = useState<ReachMedia | null>(null);

  const loadMedia = useCallback(
    async (wsId: string, searchTerm: string, offset: number) => {
      const params = new URLSearchParams({
        workspaceId: wsId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (searchTerm) params.set("search", searchTerm);

      const res = await apiFetch(`/api/media?${params}`);
      const data = await res.json();

      // Handle both flat array (backwards compat) and { items, total } shapes
      if (Array.isArray(data)) {
        return { items: data as ReachMedia[], total: data.length };
      }
      return data as { items: ReachMedia[]; total: number };
    },
    []
  );

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [result, clientAccess] = await Promise.all([
          loadMedia(workspaceId!, "", 0),
          getClientWorkspaceAccess(workspaceId!),
        ]);
        if (cancelled) return;
        setMedia(result.items);
        setTotal(result.total);
        setAccess(clientAccess);
        setSearch("");
        setAppliedSearch("");
      } catch {
        if (!cancelled) setError("Failed to load media.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [workspaceId, loadMedia]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await loadMedia(workspaceId, search, 0);
      setMedia(result.items);
      setTotal(result.total);
      setAppliedSearch(search);
    } catch {
      setError("Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    if (!workspaceId || loadingMore) return;

    setLoadingMore(true);
    try {
      const result = await loadMedia(workspaceId, appliedSearch, media.length);
      setMedia((prev) => [...prev, ...result.items]);
      setTotal(result.total);
    } catch {
      setError("Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleUpload(file: File) {
    if (!workspaceId) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("workspaceId", workspaceId);
      formData.set("file", file);

      const res = await apiFetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await res.json()) as { error?: string; media?: ReachMedia };
      if (!res.ok || !payload.media) {
        throw new Error(payload.error ?? "Upload failed.");
      }

      // Insert at top of list
      setMedia((prev) => [payload.media!, ...prev]);
      setTotal((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!workspaceId || !deleteTarget) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/media/${deleteTarget.id}?workspaceId=${workspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Delete failed.");
      }
      setMedia((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setTotal((prev) => Math.max(prev - 1, 0));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  const hasMore = media.length < total;

  return (
    <ReachShell
      activeNav={"media" as "home"}
      eyebrow="Canopy Reach"
      title="Media Library"
      subtitle="Browse, search, and manage workspace images."
      headerActions={
        access.canUploadMedia ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload image"}
            </Button>
          </>
        ) : null
      }
    >
      {/* Search bar */}
      <Card padding="md" className="border border-[var(--app-surface-border)] bg-white/60 shadow-none">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by filename…"
              className="w-full rounded-xl border border-[#e2e8f0] bg-white py-2.5 pl-10 pr-4 text-sm text-[#172033] placeholder:text-[#94a3b8] focus:border-[#2f76dd] focus:outline-none focus:ring-2 focus:ring-[#2f76dd]/20"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={loading}>
            Search
          </Button>
          {appliedSearch && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                if (workspaceId) {
                  setLoading(true);
                  loadMedia(workspaceId, "", 0)
                    .then((result) => {
                      setMedia(result.items);
                      setTotal(result.total);
                      setAppliedSearch("");
                    })
                    .catch(() => setError("Failed to clear search."))
                    .finally(() => setLoading(false));
                }
              }}
            >
              Clear
            </Button>
          )}
        </form>
        {appliedSearch && !loading && (
          <BodyText muted className="mt-2 text-sm">
            {total} {total === 1 ? "result" : "results"} for &ldquo;{appliedSearch}&rdquo;
          </BodyText>
        )}
      </Card>

      {/* Error */}
      {error && (
        <Card padding="md" className="border border-red-200 bg-red-50 shadow-none">
          <BodyText className="text-red-700">{error}</BodyText>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card padding="md" className="border border-[var(--app-surface-border)] bg-transparent shadow-none">
          <BodyText muted>Loading media…</BodyText>
        </Card>
      )}

      {/* Empty state */}
      {!loading && media.length === 0 && (
        <Card padding="md" className="border border-[var(--app-surface-border)] bg-transparent shadow-none">
          <div className="py-8 text-center">
            <ImagePlaceholderIcon className="mx-auto mb-3 h-12 w-12 text-[#c4cdd5]" />
            <BodyText className="font-medium text-[#506176]">
              {appliedSearch ? "No media matched your search." : "No media uploaded yet."}
            </BodyText>
            {!appliedSearch && access.canUploadMedia && (
              <BodyText muted className="mt-1 text-sm">
                Upload images to use them across your posts.
              </BodyText>
            )}
          </div>
        </Card>
      )}

      {/* Media grid */}
      {!loading && media.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {media.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-[#e8ecf1] bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Thumbnail */}
                <button
                  type="button"
                  className="block w-full cursor-pointer"
                  onClick={() => setPreviewMedia(item)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.originalFilename ?? "Workspace image"}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </button>

                {/* Info overlay */}
                <div className="px-3 py-2.5">
                  <p className="truncate text-[13px] font-medium text-[#172033]">
                    {item.originalFilename ?? "Workspace image"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#8ea0b7]">
                    {formatDate(item.createdAt)}
                    {item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ""}
                  </p>
                </div>

                {/* Delete button */}
                {access.canUploadMedia && (
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-[#94a3b8] opacity-0 shadow-sm transition hover:text-red-500 group-hover:opacity-100"
                    onClick={() => setDeleteTarget(item)}
                    title="Delete"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2 pb-4">
              <Button variant="secondary" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : `Load more (${media.length} of ${total})`}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogTitle>Delete image</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.originalFilename ?? "this image"}</strong>?
            This will remove the file permanently. Posts already published with this image will not be affected.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview dialog */}
      <Dialog open={!!previewMedia} onOpenChange={(open) => { if (!open) setPreviewMedia(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{previewMedia?.originalFilename ?? "Image preview"}</DialogTitle>
          <DialogDescription>
            {previewMedia?.sourceType === "upload" ? "Uploaded" : "External"} image
            {previewMedia?.sizeBytes ? ` · ${formatBytes(previewMedia.sizeBytes)}` : ""}
            {previewMedia?.createdAt ? ` · ${formatDate(previewMedia.createdAt)}` : ""}
          </DialogDescription>
          {previewMedia && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewMedia.url}
              alt={previewMedia.originalFilename ?? "Workspace image"}
              className="mt-3 w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </ReachShell>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6" />
      <path d="M10 11v5M14 11v5" strokeLinecap="round" />
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
