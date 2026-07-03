import * as Sentry from "@sentry/nextjs";

// Server + edge error monitoring. Inert unless SENTRY_DSN is set, so deploying
// this changes nothing until a DSN is configured in the environment.
export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }
}

// Captures errors thrown in server components, route handlers, etc.
export const onRequestError = Sentry.captureRequestError;
