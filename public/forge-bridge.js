(() => {
  // GitHub Pages is a static export, so its browser requests need a server-side
  // gateway hosted on Vercel. Vercel itself uses the native same-origin route.
  if (!location.hostname.endsWith('github.io')) return;

  const originalFetch = window.fetch.bind(window);
  const gateway = 'https://prd-gen-livid.vercel.app/api/generate';

  window.fetch = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : input.url;
      if (url === '/api/generate' || url.endsWith('/api/generate')) {
        if (typeof input === 'string') return originalFetch(gateway, init);
        return originalFetch(gateway, {
          ...(init || {}),
          headers: new Headers(input.headers),
        });
      }
    } catch {
      // Fall through to the browser's native fetch if interception fails.
    }
    return originalFetch(input, init);
  };
})();
