/** @type {import('next').NextConfig} */
const path = require("path");
const { loadEnvConfig } = require("@next/env");

// The app runs from apps/web while shared runtime settings live in the repo root.
// Only NEXT_PUBLIC_* values are consumed by the browser bundle.
loadEnvConfig(path.resolve(__dirname, "../.."), process.env.NODE_ENV === "development");

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@degenradar/types"],
};

module.exports = nextConfig;
