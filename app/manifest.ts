import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PRD Forge — AI Product OS',
    short_name: 'PRD Forge',
    description: 'Turn product ideas into decision-ready PRDs.',
    start_url: './',
    display: 'standalone',
    background_color: '#08090d',
    theme_color: '#08090d',
    orientation: 'portrait-primary',
    icons: [],
  };
}
