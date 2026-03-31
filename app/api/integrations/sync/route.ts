import { NextResponse } from "next/server";

// POST /api/integrations/sync
// No longer used — social accounts are connected directly via OAuth callbacks.
// Kept for backwards compatibility; returns an empty result.
export async function POST() {
  return NextResponse.json({ synced: [] });
}
