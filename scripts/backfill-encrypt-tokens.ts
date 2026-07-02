/**
 * One-time backfill: encrypt existing plaintext reach_integrations.access_token
 * values at rest. Safe to re-run (already-encrypted rows are skipped).
 *
 * Usage (from the canopy-reach repo root):
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   SECRETS_ENCRYPTION_KEY=... \
 *   npx tsx scripts/backfill-encrypt-tokens.ts
 *
 * Run this AFTER deploying the code that reads/writes encrypted tokens and
 * setting SECRETS_ENCRYPTION_KEY on Vercel.
 */
import { createClient } from "@supabase/supabase-js";
import { encryptSecret, isEncrypted } from "../lib/secret-crypto";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase env vars are required.");
  if (!process.env.SECRETS_ENCRYPTION_KEY) throw new Error("SECRETS_ENCRYPTION_KEY is required.");

  const supabase = createClient(url, serviceRoleKey);
  const { data, error } = await supabase
    .from("reach_integrations")
    .select("id,access_token");
  if (error) throw new Error(error.message);

  let encrypted = 0;
  let skipped = 0;
  for (const row of data ?? []) {
    const token = (row as { id: string; access_token: string | null }).access_token;
    const id = (row as { id: string }).id;
    if (!token || isEncrypted(token)) {
      skipped += 1;
      continue;
    }
    const { error: updateError } = await supabase
      .from("reach_integrations")
      .update({ access_token: encryptSecret(token) })
      .eq("id", id);
    if (updateError) throw new Error(`Failed to update ${id}: ${updateError.message}`);
    encrypted += 1;
  }

  console.log(`Done. Encrypted ${encrypted} token(s), skipped ${skipped} (empty or already encrypted).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
