// Writes to the shared activity_events table in the Canopy platform Supabase
// project. That table powers the workspace nerve-center dashboard in the portal
// ("In progress", "Going out this week", "Recent").
//
// Failures are always swallowed — activity logging must never break the main
// Reach flow. Call with void: `void logPortalActivity({...})`.

type PortalActivityEvent = {
  workspace_id: string;
  product_key: string;
  event_type: string;
  title: string;
  description?: string | null;
  metric?: string | null;
  event_url?: string | null;
  scheduled_for?: string | null;
};

export async function logPortalActivity(event: PortalActivityEvent): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/activity_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Non-critical — swallow silently
  }
}
