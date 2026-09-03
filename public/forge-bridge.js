(() => {
  const isPages = location.hostname.endsWith('github.io');
  const originalFetch = window.fetch.bind(window);
  const gateway = 'https://prd-gen-livid.vercel.app/api/generate';

  if (isPages) {
    window.fetch = (input, init) => {
      try {
        const url = typeof input === 'string' ? input : input.url;
        if (url === '/api/generate' || url.endsWith('/api/generate')) {
          if (typeof input === 'string') return originalFetch(gateway, init);
          return originalFetch(gateway, { ...(init || {}), headers: new Headers(input.headers) });
        }
      } catch {}
      return originalFetch(input, init);
    };
  }

  // The app's current React handler historically combined verification + save.
  // This guard makes the UX explicitly two-step without storing the secret here:
  // click 1 = verify, click 2 = allow the app's normal save handler to run.
  let verifiedFingerprint = '';
  let verificationBusy = false;

  const clean = (value) => String(value || '').trim();
  const findKeyInput = () => document.querySelector('input[type="password"]');
  const findModelInput = () => [...document.querySelectorAll('input')].find((el) => {
    const value = clean(el.value).toLowerCase();
    return value.startsWith('gemini-') || value.startsWith('gpt-') || value.startsWith('claude-') || value.startsWith('llama-') || value.startsWith('mistral-') || value.startsWith('openrouter/') || value === 'your-model';
  });
  const findBaseInput = () => [...document.querySelectorAll('input')].find((el) => clean(el.value).startsWith('https://'));
  const findProvider = () => {
    const select = document.querySelector('select');
    return clean(select?.value) || 'gemini';
  };
  const findActionButton = () => [...document.querySelectorAll('button')].find((button) => {
    const text = clean(button.textContent);
    return text === 'Check key & add' || text === 'Check API key' || text === 'Save verified key';
  });

  const fingerprint = (provider, model, baseUrl, key) => `${provider}|${model}|${baseUrl}|${key}`;

  function renderVerification(button, ok, message) {
    let panel = document.getElementById('prd-forge-verification-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'prd-forge-verification-panel';
      panel.style.cssText = 'margin:12px 0;padding:12px 14px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.035);font:500 13px/1.45 system-ui,sans-serif;';
      button.parentElement?.insertBefore(panel, button);
    }
    panel.style.borderColor = ok ? 'rgba(52,211,153,.35)' : 'rgba(248,113,113,.35)';
    panel.innerHTML = `<div style="font-weight:700;margin-bottom:6px">${ok ? '✓ Verification passed' : '✕ Verification blocked'}</div><div>${message}</div>`;
  }

  function clearVerification() {
    verifiedFingerprint = '';
    const button = findActionButton();
    if (button && button.dataset.prdVerified === '1') {
      button.dataset.prdVerified = '';
      button.textContent = 'Check key & add';
    }
    document.getElementById('prd-forge-verification-panel')?.remove();
  }

  async function verifyFirstClick(event, button) {
    if (verificationBusy) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (button.dataset.prdVerified === '1' && verifiedFingerprint) return;

    const key = findKeyInput();
    const model = findModelInput();
    const base = findBaseInput();
    const provider = findProvider();
    const secret = clean(key?.value);
    const modelId = clean(model?.value);
    const baseUrl = clean(base?.value);

    if (!secret || !modelId || !baseUrl) {
      event.preventDefault();
      event.stopPropagation();
      renderVerification(button, false, 'Provider, API key, model and Base URL are all required before saving.');
      return;
    }
    if (!baseUrl.toLowerCase().startsWith('https://')) {
      event.preventDefault();
      event.stopPropagation();
      renderVerification(button, false, 'Endpoint rejected: HTTPS is required.');
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    verificationBusy = true;
    button.disabled = true;
    button.style.opacity = '.7';
    button.textContent = 'Checking provider • endpoint • key • model…';
    renderVerification(button, true, 'Running live authentication and exact-model availability check…');

    try {
      const response = await window.fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: secret, model: modelId, baseUrl, test: true, prompt: '' }),
      });
      const raw = await response.text();
      let data = {};
      try { data = JSON.parse(raw); } catch {}
      const ok = response.ok && data.ok === true && data.modelAvailable !== false;
      if (!ok) {
        verifiedFingerprint = '';
        button.dataset.prdVerified = '';
        button.textContent = 'Check key & add';
        renderVerification(button, false, data.message || data.detail || `Verification failed (HTTP ${response.status}). Nothing was saved.`);
        return;
      }
      verifiedFingerprint = fingerprint(provider, modelId, baseUrl, secret);
      button.dataset.prdVerified = '1';
      button.disabled = false;
      button.style.opacity = '1';
      button.textContent = 'Save verified key';
      renderVerification(button, true, `Authentication ✓ • Endpoint ✓ • Model ${modelId} ✓ — ready to save. Click “Save verified key” to commit it to this session.`);
    } catch (error) {
      verifiedFingerprint = '';
      button.dataset.prdVerified = '';
      button.textContent = 'Check key & add';
      renderVerification(button, false, error instanceof Error ? error.message : 'Verification request failed. Nothing was saved.');
    } finally {
      verificationBusy = false;
      button.disabled = false;
      button.style.opacity = '1';
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target) return;
    const text = clean(target.textContent);
    if (text !== 'Check key & add' && text !== 'Check API key' && text !== 'Save verified key') return;
    if (target.dataset.prdVerified === '1' && verifiedFingerprint) return;
    void verifyFirstClick(event, target);
  }, true);

  document.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement && (event.target.type === 'password' || event.target.type === 'text')) {
      clearVerification();
    }
  }, true);
})();
