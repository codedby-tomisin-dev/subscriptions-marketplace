import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  // A second dev server (e.g. one pointed at other emulator ports) needs its own
  // build folder, or the two share compiled code, env values included.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Box photos uploaded to the Storage emulator in local development.
      { protocol: "http", hostname: "127.0.0.1", port: process.env.NEXT_PUBLIC_STORAGE_EMULATOR_PORT ?? "9199" },
    ],
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
})(nextConfig);
