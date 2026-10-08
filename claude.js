/**
 * Fournisseur Claude (API Anthropic) — chargé avant content.js.
 * Expose `EAC.claude` dans le monde isolé partagé par les content scripts.
 */
(function () {
  'use strict';

  const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
  const API_URL = 'https://api.anthropic.com/v1/messages';

  // Les modèles 5.5 réfléchissent par défaut : pour une autocomplétion, on minimise
  // la latence (effort bas ; Sonnet 5.5 accepte en plus de couper la réflexion,
  // Opus 5.5 ne le permet pas). Haiku 4.5 ne supporte pas `effort`.
  function modelParams(model) {
    if (model === 'claude-sonnet-5-5') {
      return { thinking: { type: 'between_tools' }, output_config: { effort: 'low' } };
    }
    if (model === 'claude-opus-5-5') {
      return { output_config: { effort: 'low' } };
    }
    return {};
  }

  /**
   * Génère la suggestion en streaming ; chaque itération renvoie le texte cumulé.
   * @param {string} prompt
   * @param {{ apiKey: string, model: string, systemPrompt: string, signal: AbortSignal }} options
   */
  async function* stream(prompt, { apiKey, model, systemPrompt, signal }) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        ...modelParams(model),
      }),
      signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error?.message ?? `Claude API ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || signal.aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              accumulated += event.delta.text;
              const text = accumulated.trim();
              if (text) yield text;
            }
          } catch { /* ligne SSE non-JSON, ignorée */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  globalThis.EAC = globalThis.EAC || {};
  globalThis.EAC.claude = { DEFAULT_MODEL, stream };
})();
