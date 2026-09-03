import './globals.css';
import type {Metadata,Viewport} from 'next';
export const metadata:Metadata={title:'PRD Forge — Deterministic Product Specification Studio',description:'Offline-first deterministic PRD generator with a 20-step wizard, architecture builder, schema planner, estimation engine and local exports.',applicationName:'PRD Forge',keywords:['PRD','product requirements','product management','deterministic generator','architecture','estimation']};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#07090d'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body>{children}</body></html>}
