import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@globalcloudr/canopy-ui"],
  experimental: {
    externalDir: true,
  },
};

// Sentry wrapper. Error monitoring is gated by SENTRY_DSN in the instrumentation
// files; source-map upload only runs when SENTRY_AUTH_TOKEN is set.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
