import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'PRD Forge — AI Product OS',
  description: 'A production-grade, GitHub Pages-first workspace for turning product ideas into decision-ready PRDs.',
  applicationName: 'PRD Forge',
  keywords: ['PRD', 'product requirements', 'product management', 'Gemini', 'AI', 'product spec'],
  manifest: './manifest.webmanifest',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#08090d',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
