'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function looksLikeChunkFailure(error: Error) {
  const message = `${error.name} ${error.message}`.toLowerCase();
  return /chunk|loading css|failed to fetch dynamically imported module|importing a module script failed|module script/i.test(message);
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const attemptedRecovery = useRef(false);

  useEffect(() => {
    console.error('PRD Forge client runtime error', error);

    // Deployments can briefly leave an old HTML document pointing at a new
    // immutable Next.js chunk. One hard reload fixes that stale-client state.
    if (looksLikeChunkFailure(error) && !sessionStorage.getItem('prd-forge-reloaded')) {
      sessionStorage.setItem('prd-forge-reloaded', '1');
      window.location.reload();
      return;
    }

    sessionStorage.removeItem('prd-forge-reloaded');
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#08090d] px-5 text-zinc-100">
      <section className="glass w-full max-w-lg p-7 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-300/20">
          <AlertTriangle size={25} />
        </div>
        <p className="eyebrow mt-5">Recovery mode</p>
        <h1 className="mt-2 text-2xl font-semibold">PRD Forge hit a recoverable error.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">Your local workspace is kept in the browser. Try again; the last saved draft remains available.</p>
        <button className="btn btn-primary mt-6" onClick={() => { attemptedRecovery.current = true; reset(); }}><RefreshCw size={15} /> Try again</button>
      </section>
    </main>
  );
}
