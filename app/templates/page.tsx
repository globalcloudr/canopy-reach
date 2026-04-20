"use client";

import { useEffect, useState } from "react";
import { ReachShell } from "@/app/_components/reach-shell";
import {
  Button,
  Card,
  BodyText,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Input,
  Textarea,
} from "@globalcloudr/canopy-ui";
import { apiFetch } from "@/lib/api-client";
import type { ReachTemplate } from "@/lib/reach-schema";
import { DEFAULT_REACH_CLIENT_ACCESS, getClientWorkspaceAccess } from "@/lib/reach-client-access";
import { useReachWorkspaceId } from "@/lib/workspace-client";

const TEMPLATE_TYPES = [
  { value: "general", label: "General" },
  { value: "announcement", label: "Announcement" },
  { value: "event", label: "Event" },
  { value: "spotlight", label: "Spotlight" },
  { value: "reminder", label: "Reminder" },
];

function typeLabel(value: string): string {
  return TEMPLATE_TYPES.find((t) => t.value === value)?.label ?? value;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type FormState = {
  name: string;
  templateType: string;
  bodyTemplate: string;
};

const EMPTY_FORM: FormState = { name: "", templateType: "general", bodyTemplate: "" };

export default function TemplatesPage() {
  const workspaceId = useReachWorkspaceId();
  const [access, setAccess] = useState(DEFAULT_REACH_CLIENT_ACCESS);
  const [templates, setTemplates] = useState<ReachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ReachTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const [tmplRes, clientAccess] = await Promise.all([
          apiFetch(`/api/templates?workspaceId=${workspaceId}`).then((r) => r.json()),
          getClientWorkspaceAccess(workspaceId!),
        ]);
        if (cancelled) return;
        setTemplates(Array.isArray(tmplRes) ? tmplRes : []);
        setAccess(clientAccess);
      } catch {
        if (!cancelled) setError("Failed to load templates.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [workspaceId]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(template: ReachTemplate) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      templateType: template.templateType,
      bodyTemplate: template.bodyTemplate,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    if (!form.bodyTemplate.trim()) { setFormError("Template body is required."); return; }

    setSaving(true);
    setFormError(null);

    try {
      if (editingId) {
        // Update
        const res = await apiFetch(`/api/templates/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            name: form.name.trim(),
            templateType: form.templateType,
            bodyTemplate: form.bodyTemplate.trim(),
          }),
        });
        const payload = (await res.json()) as ReachTemplate & { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Failed to update template.");
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? payload : t)));
      } else {
        // Create
        const res = await apiFetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            name: form.name.trim(),
            templateType: form.templateType,
            bodyTemplate: form.bodyTemplate.trim(),
          }),
        });
        const payload = (await res.json()) as ReachTemplate & { error?: string };
        if (!res.ok) throw new Error(payload.error ?? "Failed to create template.");
        setTemplates((prev) => [...prev, payload].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!workspaceId || !deleteTarget) return;

    setDeleting(true);
    try {
      const res = await apiFetch(`/api/templates/${deleteTarget.id}?workspaceId=${workspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Delete failed.");
      }
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ReachShell
      activeNav={"templates" as "home"}
      eyebrow="Canopy Reach"
      title="Post Templates"
      subtitle="Create and manage reusable templates for your team's posts."
      headerActions={
        access.canManageTemplates ? (
          <Button onClick={openCreate}>New template</Button>
        ) : null
      }
    >
      {/* Error */}
      {error && (
        <Card padding="md" className="border border-red-200 bg-red-50 shadow-none">
          <BodyText className="text-red-700">{error}</BodyText>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card padding="md" className="border border-[var(--app-surface-border)] bg-transparent shadow-none">
          <BodyText muted>Loading templates…</BodyText>
        </Card>
      )}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <Card padding="md" className="border border-[var(--app-surface-border)] bg-transparent shadow-none">
          <div className="py-8 text-center">
            <TemplateIcon className="mx-auto mb-3 h-12 w-12 text-[#c4cdd5]" />
            <BodyText className="font-medium text-[#506176]">No templates yet.</BodyText>
            {access.canManageTemplates && (
              <BodyText muted className="mt-1 text-sm">
                Create templates so your team can quickly draft on-brand posts.
              </BodyText>
            )}
          </div>
        </Card>
      )}

      {/* Template list */}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              padding="md"
              className="border border-[var(--app-surface-border)] bg-white/60 shadow-none"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="text-[15px] font-semibold text-[#172033]">
                      {template.name}
                    </p>
                    <span className="inline-flex rounded-full bg-[#f0f4f8] px-2.5 py-0.5 text-[11px] font-medium text-[#506176]">
                      {typeLabel(template.templateType)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[#617286]">
                    {template.bodyTemplate}
                  </p>
                  <p className="mt-2 text-[11px] text-[#8ea0b7]">
                    Created {formatDate(template.createdAt)}
                  </p>
                </div>

                {access.canManageTemplates && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-[#94a3b8] transition hover:bg-[#f0f4f8] hover:text-[#172033]"
                      onClick={() => openEdit(template)}
                      title="Edit template"
                    >
                      <EditIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-[#94a3b8] transition hover:bg-red-50 hover:text-red-500"
                      onClick={() => setDeleteTarget(template)}
                      title="Delete template"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !saving) setDialogOpen(false); }}>
        <DialogContent>
          <DialogTitle>{editingId ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            {editingId
              ? "Update the template details below."
              : "Templates let your team quickly apply consistent post content."}
          </DialogDescription>

          <form onSubmit={handleSave} className="mt-4 space-y-4">
            <div>
              <label htmlFor="tmpl-name" className="mb-1.5 block text-[13px] font-medium text-[#172033]">
                Name
              </label>
              <Input
                id="tmpl-name"
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Weekly newsletter intro"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="tmpl-type" className="mb-1.5 block text-[13px] font-medium text-[#172033]">
                Type
              </label>
              <select
                id="tmpl-type"
                value={form.templateType}
                onChange={(e) => setForm((f) => ({ ...f, templateType: e.target.value }))}
                className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-sm text-[#172033] focus:border-[#2f76dd] focus:outline-none focus:ring-2 focus:ring-[#2f76dd]/20"
              >
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tmpl-body" className="mb-1.5 block text-[13px] font-medium text-[#172033]">
                Template body
              </label>
              <Textarea
                id="tmpl-body"
                value={form.bodyTemplate}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
                placeholder="Write the template text that will be applied to new posts…"
                rows={6}
              />
              <p className="mt-1 text-[11px] text-[#8ea0b7]">
                {form.bodyTemplate.length} characters
              </p>
            </div>

            {formError && (
              <p className="text-[13px] text-red-600">{formError}</p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogTitle>Delete template</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            This will not affect any posts that have already used this template.
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ReachShell>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function TemplateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 7h10M7 11h6M7 15h8" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
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
