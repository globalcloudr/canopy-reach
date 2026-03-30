import { NextResponse } from "next/server";
import { getGuidelines, upsertGuidelines } from "@/lib/reach-data";

// GET /api/guidelines?workspaceId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  try {
    const guidelines = await getGuidelines(workspaceId);
    return NextResponse.json(guidelines);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load guidelines." },
      { status: 500 }
    );
  }
}

// POST /api/guidelines
export async function POST(request: Request) {
  const body = (await request.json()) as {
    workspaceId?: string;
    content?:     string;
    updatedBy?:   string;
  };

  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }

  try {
    const guidelines = await upsertGuidelines({
      workspaceId,
      content:   body.content ?? "",
      updatedBy: body.updatedBy,
    });
    return NextResponse.json(guidelines);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save guidelines." },
      { status: 500 }
    );
  }
}
