import { NextResponse } from "next/server";
import { createUploadedMedia, getServiceClient } from "@/lib/reach-data";
import { requireWorkspaceCapability, toErrorResponse } from "@/lib/server-auth";
import { logAuditEvent } from "@/lib/audit-server";

const MEDIA_BUCKET = "reach-media";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function ensureBucket() {
  const supabase = getServiceClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(listError.message);

  const exists = (buckets ?? []).some((bucket) => bucket.name === MEDIA_BUCKET);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(MEDIA_BUCKET, {
    public: true,
    fileSizeLimit: `${MAX_FILE_BYTES}`,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(createError.message);
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const file = formData.get("file");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Image must be 10MB or smaller." }, { status: 400 });
  }

  try {
    const { user } = await requireWorkspaceCapability(request, workspaceId, "upload_media");
    await ensureBucket();

    const supabase = getServiceClient();
    const sanitizedName = sanitizeFilename(file.name || "upload");
    const path = `${workspaceId}/posts/${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (uploadError) throw new Error(uploadError.message);

    const media = await createUploadedMedia({
      workspaceId,
      bucket: MEDIA_BUCKET,
      path,
      originalFilename: file.name || null,
      mimeType: file.type || null,
      sizeBytes: file.size,
      createdBy: user.id,
    });
    await logAuditEvent({
      orgId: workspaceId,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      eventType: "reach_media_uploaded",
      entityType: "reach_media_asset",
      entityId: media.id,
      metadata: {
        bucket: MEDIA_BUCKET,
        path,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    });
    return NextResponse.json({
      ok: true,
      media,
      mediaId: media.id,
      mediaUrl: media.url,
      path,
      bucket: MEDIA_BUCKET,
    });
  } catch (err) {
    return toErrorResponse(err, "Failed to upload image.");
  }
}
