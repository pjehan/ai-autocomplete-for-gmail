(function () {
  'use strict';

  const GHOST_CLASS = 'eac-ghost';
  const INDICATOR_CLASS = 'eac-indicator';
  const DEFAULT_DELAY        = 600;
  const DEFAULT_LANGUAGE     = 'auto';
  const DEFAULT_TRIGGER_MODE = 'auto';

  let settings = { triggerDelay: DEFAULT_DELAY, language: DEFAULT_LANGUAGE, triggerMode: DEFAULT_TRIGGER_MODE };

  // ── Settings ────────────────────────────────────────────────────────────────

  async function loadSettings() {
    return new Promise(resolve =>
      chrome.storage.sync.get(
        { triggerDelay: DEFAULT_DELAY, language: DEFAULT_LANGUAGE, triggerMode: DEFAULT_TRIGGER_MODE },
        data => { settings = data; resolve(); }
      )
    );
  }

  chrome.storage.onChanged.addListener(changes => {
    if (changes.triggerDelay)  settings.triggerDelay  = changes.triggerDelay.newValue;
    if (changes.triggerMode)   settings.triggerMode   = changes.triggerMode.newValue;
    if (changes.language) {
      settings.language = changes.language.newValue;
      resetSession();
    }
  });

  // ── Model ────────────────────────────────────────────────────────────────────

  let modelCrashedUntil = 0;
  let sharedSession = null;
  let sharedSessionLanguage = null;
  let sessionCreatingPromise = null;

  async function getAvailability() {
    if (Date.now() < modelCrashedUntil) return 'unavailable';
    if (typeof LanguageModel === 'undefined') return 'unavailable';
    try { return await LanguageModel.availability(); }
    catch { return 'unavailable'; }
  }

  function resetSession() {
    sharedSession?.destroy();
    sharedSession = null;
    sharedSessionLanguage = null;
    sessionCreatingPromise = null;
  }

  async function getOrCreateSession(language) {
    if (sharedSession && sharedSessionLanguage === language) return sharedSession;
    if (sharedSession) resetSession();
    if (sessionCreatingPromise) return sessionCreatingPromise;
    sessionCreatingPromise = createSession(language)
      .then(s => {
        sharedSession = s;
        sharedSessionLanguage = language;
        sessionCreatingPromise = null;
        return s;
      })
      .catch(err => {
        sessionCreatingPromise = null;
        throw err;
      });
    return sessionCreatingPromise;
  }

  const SYSTEM_PROMPT = `You are an assistant that helps compose emails.
You receive the email subject, any quoted previous messages, and the current draft.
The draft contains a [CURSOR] marker indicating where text should be inserted.
Your task is to suggest text to insert at [CURSOR].
Write a substantial continuation of several sentences to meaningfully advance the email.
Do not include greetings, signatures, or any text already present in the draft.
Do not explain your suggestions, just provide the text to insert.`;

  const SUPPORTED_LANGUAGES = new Set(['en', 'es', 'ja']);

  function effectiveLanguage(language) {
    const code = (language && language !== 'auto')
      ? language
      : navigator.language?.split('-')[0] ?? 'en';
    return SUPPORTED_LANGUAGES.has(code) ? code : 'en';
  }

  function createSession(language) {
    return LanguageModel.create({
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
      expectedOutputs: [{ type: 'text', languages: [effectiveLanguage(language)] }],
    });
  }

  // ── Badge (extension icon) ───────────────────────────────────────────────────

  function setBadge(status) {
    chrome.runtime.sendMessage({ type: 'SET_BADGE', status });
  }

  // ── Context extraction ───────────────────────────────────────────────────────

  function getGmailUser() {
    const el = document.querySelector('a[aria-label^="Google Account:"]');
    if (!el) return null;
    const match = el.getAttribute('aria-label').match(/Google Account:\s*(.+?)\s*\(([^)]+)\)/);
    return match ? { name: match[1].trim(), email: match[2].trim() } : null;
  }

  function getTextAroundCursor(textboxEl) {
    const fullTextFallback = () => {
      const clone = textboxEl.cloneNode(true);
      clone.querySelectorAll(`.${GHOST_CLASS}`).forEach(n => n.remove());
      return { textBefore: clone.innerText.trimEnd(), textAfter: '' };
    };

    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.getRangeAt(0).collapsed) return fullTextFallback();

    const range = sel.getRangeAt(0);
    if (!textboxEl.contains(range.startContainer)) return fullTextFallback();

    try {
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(textboxEl);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      const beforeFrag = beforeRange.cloneContents();
      beforeFrag.querySelectorAll(`.${GHOST_CLASS}`).forEach(n => n.remove());

      const afterRange = document.createRange();
      afterRange.selectNodeContents(textboxEl);
      afterRange.setStart(range.endContainer, range.endOffset);
      const afterFrag = afterRange.cloneContents();
      afterFrag.querySelectorAll(`.${GHOST_CLASS}`).forEach(n => n.remove());

      return {
        textBefore: beforeFrag.textContent.trimEnd(),
        textAfter:  afterFrag.textContent.trimStart(),
      };
    } catch {
      return fullTextFallback();
    }
  }

  function extractContext(textboxEl) {
    const subject =
      document.querySelector('input[name="subjectbox"]')?.value?.trim() ?? '';

    const form = textboxEl.closest('form') ?? textboxEl.parentElement;
    const quoted = form?.querySelector('.gmail_quote')?.innerText?.trim() ?? '';

    const { textBefore, textAfter } = getTextAroundCursor(textboxEl);
    const user = getGmailUser();
    return { subject, quoted, textBefore, textAfter, user };
  }

  function buildPrompt({ subject, quoted, textBefore, textAfter, user }) {
    const parts = [];
    if (user) parts.push(`You are writing on behalf of: ${user.name} <${user.email}>`);
    if (subject) parts.push(`Subject: ${subject}`);
    if (quoted)  parts.push(`Previous messages:\n${quoted.slice(0, 1500)}`);
    const draft = textAfter ? `${textBefore}[CURSOR]${textAfter}` : `${textBefore}[CURSOR]`;
    parts.push(`Current draft:\n${draft}`);
    return parts.join('\n\n');
  }

  // ── Ghost text ───────────────────────────────────────────────────────────────

  function makeGhostHelpers() {
    let ghostSpan = null;

    function remove() {
      if (!ghostSpan?.isConnected) { ghostSpan = null; return; }

      const range = document.createRange();
      range.setStartBefore(ghostSpan);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      ghostSpan.remove();
      ghostSpan = null;
    }

    function upsert(text) {
      if (ghostSpan?.isConnected) {
        ghostSpan.dataset.ghostContent = text;
        return;
      }

      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);

      ghostSpan = document.createElement('span');
      ghostSpan.className = GHOST_CLASS;
      ghostSpan.setAttribute('contenteditable', 'false');
      ghostSpan.dataset.ghostContent = text;

      range.insertNode(ghostSpan);

      const newRange = document.createRange();
      newRange.setStartBefore(ghostSpan);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    function accept() {
      if (!ghostSpan?.isConnected) return;

      const text = ghostSpan.dataset.ghostContent ?? '';
      const textNode = document.createTextNode(text);
      ghostSpan.replaceWith(textNode);
      ghostSpan = null;

      const range = document.createRange();
      range.setStartAfter(textNode);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function hasGhost() { return ghostSpan?.isConnected ?? false; }

    return { remove, upsert, accept, hasGhost };
  }

  // ── Indicator (compose window) ───────────────────────────────────────────────

  function createIndicator(textboxEl) {
    const el = document.createElement('div');
    el.className = INDICATOR_CLASS;
    el.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;display:none;';
    document.body.appendChild(el);

    return {
      setStatus(status) {
        setBadge(status);
        if (status !== 'loading') {
          el.style.display = 'none';
          return;
        }
        // Positionne l'indicateur au niveau du curseur
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (textboxEl.contains(range.startContainer)) {
            const rect = range.getBoundingClientRect();
            if (rect.height > 0) {
              el.style.left = `${rect.left + 4}px`;
              el.style.top  = `${rect.top + (rect.height - 10) / 2}px`;
              el.style.display = '';
              return;
            }
          }
        }
        // Fallback : coin inférieur droit de la zone de saisie
        const rect = textboxEl.getBoundingClientRect();
        el.style.left = `${rect.right - 18}px`;
        el.style.top  = `${rect.bottom - 18}px`;
        el.style.display = '';
      },
      destroy() { el.remove(); },
    };
  }

  // ── Autocomplete ─────────────────────────────────────────────────────────────

  function attachAutocomplete(textboxEl) {
    const ghost = makeGhostHelpers();
    const indicator = createIndicator(textboxEl);
    let timer = null;
    let abortController = null;

    async function generate() {
      abortController?.abort();
      const ac = new AbortController();
      abortController = ac;
      const { signal } = ac;

      const availability = await getAvailability();
      if (signal.aborted) return;

      if (availability !== 'available') {
        indicator.setStatus(availability === 'unavailable' ? 'unavailable' : 'loading');
        return;
      }

      const context = extractContext(textboxEl);
      if (!context.textBefore) return;

      indicator.setStatus('loading');

      try {
        const session = await getOrCreateSession(settings.language);
        if (signal.aborted) return;

        const userPrompt = buildPrompt(context);
        console.log(
          '%c[EAC] System prompt\n%c' + SYSTEM_PROMPT +
          '\n\n%c[EAC] User prompt\n%c' + userPrompt,
          'color:#4285f4;font-weight:bold', 'color:inherit',
          'color:#4285f4;font-weight:bold', 'color:inherit'
        );
        const stream = session.promptStreaming(userPrompt, { signal });

        let accumulated = '';
        for await (const chunk of stream) {
          if (signal.aborted) break;
          accumulated += chunk;
          const text = accumulated.trim();
          if (text) {
            ghost.upsert(text);
            indicator.setStatus('available');
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        ghost.remove();
        if (err.message?.includes('crashed')) {
          modelCrashedUntil = Date.now() + 30_000;
          resetSession();
          indicator.setStatus('unavailable');
        } else if (!signal.aborted) {
          resetSession();
          indicator.setStatus('available');
        }
      }
    }

    function cancel() {
      abortController?.abort();
      abortController = null;
      clearTimeout(timer);
      ghost.remove();
    }

    function cancelAndSchedule() {
      cancel();
      timer = setTimeout(generate, settings.triggerDelay);
    }

    // Capture phase to intercept Tab before Gmail's own handlers
    textboxEl.addEventListener('keydown', e => {
      // Déclenchement manuel : Ctrl+Espace
      if (settings.triggerMode === 'manual' && e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        if (!ghost.hasGhost()) generate();
        return;
      }

      if (!ghost.hasGhost()) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        ghost.accept();
        indicator.setStatus('available');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        abortController?.abort();
        abortController = null;
        ghost.remove();
      }
    }, true);

    textboxEl.addEventListener('input', () => {
      if (settings.triggerMode === 'auto') cancelAndSchedule();
    });

    // Met à jour le badge initial sans afficher l'indicateur
    getAvailability().then(a => setBadge(
      a === 'available' ? 'available' : a === 'unavailable' ? 'unavailable' : 'loading'
    ));

    return function cleanup() {
      cancel();
      indicator.destroy();
    };
  }

  // ── Gmail observation ─────────────────────────────────────────────────────────

  function observeGmail() {
    const attached = new Map();

    function sync() {
      document
        .querySelectorAll('div[role="textbox"][contenteditable="true"]')
        .forEach(el => {
          if (!attached.has(el)) {
            attached.set(el, attachAutocomplete(el));
          }
        });

      for (const [el, cleanup] of attached) {
        if (!el.isConnected) {
          cleanup();
          attached.delete(el);
        }
      }
    }

    new MutationObserver(sync).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'contenteditable'],
    });

    sync();
  }

  // ── Message handler ───────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'GET_STATUS') {
      getAvailability().then(a => sendResponse({ availability: a }));
      return true;
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────────

  loadSettings().then(observeGmail);
})();
