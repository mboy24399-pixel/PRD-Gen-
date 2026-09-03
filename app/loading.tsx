import { Sparkles } from 'lucide-react';

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#08090d] text-zinc-100">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/20">
          <Sparkles size={24} />
        </div>
        <p className="mt-4 text-sm font-medium">Loading PRD Forge…</p>
        <p className="mt-1 text-xs text-zinc-600">Preparing your local workspace</p>
      </div>
    </main>
  );
}
