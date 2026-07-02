import { createHmac, timingSafeEqual } from "node:crypto";
import { RouteAuthError } from "@/lib/server-auth";

type OAuthStatePayload = {
  workspaceId: string;
  userId: string;
  expiresAt: number;
};

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function getSigningSecret() {
  const secret =
    process.env.OAUTH_STATE_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!secret) {
    // Signing with an empty key makes the OAuth state forgeable (workspace/user
    // binding bypass on OAuth callbacks). Fail closed instead.
    throw new Error("OAUTH_STATE_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set to sign OAuth state.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

export function createSignedOAuthState(input: {
  workspaceId: string;
  userId: string;
}) {
  const payload: OAuthStatePayload = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function parseSignedOAuthState(state: string): OAuthStatePayload {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    throw new RouteAuthError(400, "Invalid OAuth state.");
  }

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new RouteAuthError(400, "Invalid OAuth state.");
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
  if (!payload.workspaceId || !payload.userId || !payload.expiresAt) {
    throw new RouteAuthError(400, "Invalid OAuth state.");
  }

  if (payload.expiresAt < Date.now()) {
    throw new RouteAuthError(400, "Connection expired. Please try again.");
  }

  return payload;
}
