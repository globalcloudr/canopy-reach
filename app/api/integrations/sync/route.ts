import { NextResponse } from "next/server";
import { requireAuthenticatedUser, toErrorResponse } from "@/lib/server-auth";

// POST /api/integrations/sync
// No longer used — social accounts are connected directly via OAuth callbacks.
// Kept for backwards compatibility; returns an empty result.
export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    return NextResponse.json({ synced: [] });
  } catch (err) {
    return toErrorResponse(err, "Failed to sync integrations.");
  }
}
