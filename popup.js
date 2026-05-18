document.addEventListener('DOMContentLoaded', async () => {
  const statusEl    = document.getElementById('status');
  const delayInput  = document.getElementById('triggerDelay');
  const languageSel = document.getElementById('language');

  // ── Statut du modèle ────────────────────────────────────────────────────────

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isGmail = tab?.url && (
    tab.url.includes('mail.google.com') ||
    tab.url.includes('gmail.google.com')
  );

  if (!isGmail) {
    statusEl.textContent = "Ouvrir Gmail pour activer l'extension";
    statusEl.className = 'status inactive';
  } else {
    try {
      const { availability } = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
      if (availability === 'available') {
        statusEl.textContent = 'Modèle prêt';
        statusEl.className = 'status active';
      } else if (availability === 'unavailable') {
        statusEl.textContent = 'Modèle indisponible — redémarrer Chrome';
        statusEl.className = 'status inactive';
      } else {
        statusEl.textContent = 'Modèle en cours de téléchargement…';
        statusEl.className = 'status loading';
      }
    } catch {
      statusEl.textContent = 'Non actif sur cette page';
      statusEl.className = 'status inactive';
    }
  }

  // ── Paramètres ──────────────────────────────────────────────────────────────

  const defaults = { triggerMode: 'auto', triggerDelay: 600, language: 'auto' };
  const settings = await chrome.storage.sync.get(defaults);

  document.querySelector(`[name="triggerMode"][value="${settings.triggerMode}"]`).checked = true;
  delayInput.value   = settings.triggerDelay;
  languageSel.value  = settings.language;
  updateDelayState(settings.triggerMode);

  function updateDelayState(mode) {
    delayInput.disabled = mode === 'manual';
  }

  document.querySelectorAll('[name="triggerMode"]').forEach(radio => {
    radio.addEventListener('change', e => {
      chrome.storage.sync.set({ triggerMode: e.target.value });
      updateDelayState(e.target.value);
    });
  });

  delayInput.addEventListener('change', () => {
    chrome.storage.sync.set({ triggerDelay: parseInt(delayInput.value) || 600 });
  });

  languageSel.addEventListener('change', () => {
    chrome.storage.sync.set({ language: languageSel.value });
  });

  // ── Modèle actif ────────────────────────────────────────────────────────────

  const { provider, claudeModel } = await chrome.storage.sync.get({
    provider: 'browser',
    claudeModel: 'claude-haiku-4-5-20251001',
  });

  const modelLabels = {
    'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
    'claude-sonnet-4-6':         'Claude Sonnet 4.6',
    'claude-opus-4-7':           'Claude Opus 4.7',
  };

  const providerEl = document.createElement('div');
  providerEl.style.cssText = 'font-size:12px;color:#9aa0a6;margin:-6px 0 10px;';
  providerEl.textContent = provider === 'claude'
    ? `Modèle : ${modelLabels[claudeModel] ?? claudeModel}`
    : 'Modèle : Gemini Nano (navigateur)';
  document.getElementById('status').insertAdjacentElement('afterend', providerEl);

  // ── Boutons ──────────────────────────────────────────────────────────────────

  if (isGmail) {
    document.getElementById('reload').addEventListener('click', () => chrome.tabs.reload(tab.id));
  }
  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
