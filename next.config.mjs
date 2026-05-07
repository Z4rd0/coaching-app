/** @type {import('next').NextConfig} */
const nextConfig = {
  // Register service worker for PWA
  async headers() {
    return [
      // Service worker must never be cached
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      // HTML pages must not be cached so browsers always get the latest JS bundle
      {
        source: "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
