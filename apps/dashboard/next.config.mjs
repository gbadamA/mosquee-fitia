/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les packages du monorepo sont en TS brut : Next les transpile.
  transpilePackages: ["@fitia/design-tokens", "@fitia/shared", "@fitia/supabase"],
};

export default nextConfig;
