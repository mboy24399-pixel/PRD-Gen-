/** @type {import('next').NextConfig} */
const isPages = process.env.GITHUB_ACTIONS === 'true';
const repoName = (process.env.GITHUB_REPOSITORY || '').split('/')[1] || 'PRD-Gen-';
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  trailingSlash: true,
  basePath: isPages ? `/${repoName}` : '',
  images: { unoptimized: true },
};
export default nextConfig;
