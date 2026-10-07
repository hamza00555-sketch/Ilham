import type { NextConfig } from "next";

const firebaseProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const nextConfig: NextConfig = {
  // Serve Firebase's sign-in helper from our own domain, so NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN can be
  // the site itself: browsers that partition storage (Safari, in-app browsers, home-screen apps)
  // break signInWithRedirect when the helper lives on firebaseapp.com.
  async rewrites() {
    if (!firebaseProject || process.env.NEXT_PUBLIC_USE_EMULATORS === "true") return [];
    return [
      { source: "/__/auth/:path*", destination: `https://${firebaseProject}.firebaseapp.com/__/auth/:path*` },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Lets `next dev` serve HMR/chunks when opened via 127.0.0.1 (emulator setups, Playwright).
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
