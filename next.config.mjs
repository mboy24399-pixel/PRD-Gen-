/** @type {import('next').NextConfig} */
const isPages = process.env.GITHUB_ACTIONS === 'true';
const repoName = (process.env.GITHUB_REPOSITORY || 'mboy24399-pixel/PRD-Gen-').split('/')[1] || 'PRD-Gen-';
const basePath = isPages ? `/${repoName}` : '';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: isPages ? 'export' : undefined,
  trailingSlash: true,
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
