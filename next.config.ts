import type { NextConfig } from "next";

// Static security headers — applied to all routes via next.config headers().
// NOTE: Content-Security-Policy is set dynamically in middleware.ts
// (per-request nonce) — do NOT add a static CSP here to avoid duplication.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compiler: {
    // In production, strip console.log/warn/info/debug to avoid PII leakage,
    // but keep console.error so incident logs from lib/errorReporting survive.
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error"] }
        : false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
    // User-controlled images come from Supabase; disallow SVG in the optimizer pipeline.
    dangerouslyAllowSVG: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    middlewareClientMaxBodySize: "100mb",
  },
  serverExternalPackages: ['pdfjs-dist', 'canvas'],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'pdfjs-dist': 'pdfjs-dist',
        canvas: 'canvas',
      });
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    return config;
  },
};

export default nextConfig;
