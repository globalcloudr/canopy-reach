import { NextResponse } from "next/server";
import { deleteIntegration } from "@/lib/reach-data";

// DELETE /api/integrations/[id]?workspaceId=...
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  try {
    await deleteIntegration(id, workspaceId);
    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove integration." },
      { status: 500 }
    );
  }
}
