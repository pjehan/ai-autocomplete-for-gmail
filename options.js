document.addEventListener('DOMContentLoaded', async () => {
  const claudeSettings = document.getElementById('claude-settings');
  const apiKeyInput    = document.getElementById('claudeApiKey');
  const modelSelect    = document.getElementById('claudeModel');
  const feedback       = document.getElementById('feedback');

  const defaults = {
    provider:     'browser',
    claudeApiKey: '',
    claudeModel:  'claude-haiku-4-5-20251001',
  };

  const settings = await chrome.storage.sync.get(defaults);

  // Migre les anciens identifiants de modèle enregistrés vers les modèles actuels
  const legacyModels = {
    'claude-sonnet-4-6': 'claude-sonnet-5-5',
    'claude-opus-4-7':   'claude-opus-5-5',
  };
  if (legacyModels[settings.claudeModel]) {
    settings.claudeModel = legacyModels[settings.claudeModel];
    await chrome.storage.sync.set({ claudeModel: settings.claudeModel });
  }

  // Initialise l'UI
  document.querySelector(`[name="provider"][value="${settings.provider}"]`).checked = true;
  apiKeyInput.value  = settings.claudeApiKey;
  modelSelect.value  = settings.claudeModel;
  toggleClaudeSettings(settings.provider);

  function toggleClaudeSettings(provider) {
    claudeSettings.classList.toggle('visible', provider === 'claude');
  }

  function showFeedback(msg, isError = false) {
    feedback.textContent = msg;
    feedback.className = 'feedback' + (isError ? ' error' : '');
    setTimeout(() => { feedback.textContent = ''; }, 2500);
  }

  // Provider
  document.querySelectorAll('[name="provider"]').forEach(radio => {
    radio.addEventListener('change', async e => {
      const provider = e.target.value;
      await chrome.storage.sync.set({ provider });
      toggleClaudeSettings(provider);
      showFeedback('Enregistré');
    });
  });

  // Clé API (sauvegarde à la perte du focus)
  apiKeyInput.addEventListener('blur', async () => {
    await chrome.storage.sync.set({ claudeApiKey: apiKeyInput.value.trim() });
    showFeedback('Clé API enregistrée');
  });

  // Modèle Claude
  modelSelect.addEventListener('change', async () => {
    await chrome.storage.sync.set({ claudeModel: modelSelect.value });
    showFeedback('Enregistré');
  });
});
