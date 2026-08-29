import type { NextConfig } from "next";

/**
 * Response headers.
 *
 * No Content-Security-Policy here, deliberately. Next injects inline
 * bootstrap scripts, so a useful CSP needs per-request nonces threaded
 * through the document — worth doing, but it is a change to the rendering
 * path and not something to bolt on untested. The four below are the ones
 * that are correct unconditionally and cost nothing.
 */
const securityHeaders = [
  // This app is never legitimately framed, and a booking confirmation is
  // exactly the kind of one-click action clickjacking targets.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
