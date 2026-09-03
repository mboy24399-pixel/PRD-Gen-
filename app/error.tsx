'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the recovery UI deliberately quiet; detailed client errors should not leak secrets.
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#08090d] px-5 text-zinc-100">
      <section className="glass w-full max-w-lg p-7 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-300/20">
          <AlertTriangle size={25} />
        </div>
        <p className="eyebrow mt-5">Recovery mode</p>
        <h1 className="mt-2 text-2xl font-semibold">PRD Forge hit a recoverable error.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">Your local workspace is kept in the browser. Reload the app and continue from the last saved draft.</p>
        <button className="btn btn-primary mt-6" onClick={() => reset()}><RefreshCw size={15} /> Try again</button>
      </section>
    </main>
  );
}
