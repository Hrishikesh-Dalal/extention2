// contentScript.js
// contentScript.js - Text copy & screenshot download
// contentScript.js - Ctrl+[ captures screenshot, sends to Gemini, shows floating response
(() => {
  // Debug: confirm script loaded and frame context
  try { console.debug('[GeminiOverlay] content script loaded on', location.href); } catch {}
  let overlay;
  let hideTimer;
  function ensureOverlay() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'gemini-response-overlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        right: '8px',
        bottom: '8px',
        maxWidth: '320px',
        background: 'rgba(255, 255, 255, 0.85)',
        color: '#7e7e7eff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        padding: '8px 10px',
        borderRadius: '6px',
        lineHeight: '1.3',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        zIndex: '2147483647',
        backdropFilter: 'blur(2px)',
        cursor: 'move'
      });
      overlay.textContent = '…';
      document.documentElement.appendChild(overlay);
      // Simple drag
      let dragging = false; let sx=0; let sy=0; let ox=0; let oy=0;
      overlay.addEventListener('mousedown', e => { dragging = true; sx = e.clientX; sy = e.clientY; const rect = overlay.getBoundingClientRect(); ox = rect.left; oy = rect.top; overlay.style.right = 'auto'; e.preventDefault(); });
      window.addEventListener('mousemove', e => { if(!dragging) return; const dx = e.clientX - sx; const dy = e.clientY - sy; overlay.style.left = (ox + dx) + 'px'; overlay.style.top = (oy + dy) + 'px'; overlay.style.bottom='auto'; });
      window.addEventListener('mouseup', () => dragging = false);
    }
    return overlay;
  }

  function setStyleMinimalWord(word) {
    const el = ensureOverlay();
    el.textContent = word;
    el.style.background = 'transparent';
    el.style.color = 'rgba(126, 126, 126, 0.95)';
    el.style.fontSize = '18px';
    el.style.padding = '0';
    el.style.borderRadius = '0';
    el.style.boxShadow = 'none';
    el.style.maxWidth = 'none';
    el.style.backdropFilter = '';
  }

  function setStyleBrief(text) {
    const el = ensureOverlay();
    el.textContent = text;
    el.style.background = 'rgba(30,30,30,0.85)';
    el.style.color = '#fff';
    el.style.fontSize = '14px';
    el.style.padding = '8px 10px';
    el.style.borderRadius = '6px';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    el.style.maxWidth = '360px';
    el.style.backdropFilter = 'blur(2px)';
    el.style.whiteSpace = 'normal';
  }

  function setStyleDetailed(text) {
    const el = ensureOverlay();
    el.textContent = text; // keep safe (no HTML injection)
    el.style.background = 'rgba(18,18,18,0.92)';
    el.style.color = '#fff';
    el.style.fontSize = '15px';
    el.style.padding = '12px 14px';
    el.style.borderRadius = '10px';
    el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
    el.style.maxWidth = '520px';
    el.style.maxHeight = '50vh';
    el.style.overflow = 'auto';
    el.style.backdropFilter = 'blur(3px)';
    el.style.whiteSpace = 'pre-wrap';
    el.style.lineHeight = '1.4';
    // Add a close button in the corner
    let closeBtn = el.querySelector('.gemini-overlay-close');
    if (closeBtn) closeBtn.remove();
    closeBtn = document.createElement('button');
    closeBtn.className = 'gemini-overlay-close';
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '4px',
      right: '6px',
      border: 'none',
      background: 'transparent',
      color: '#fff',
      fontSize: '18px',
      lineHeight: '1',
      cursor: 'pointer',
      padding: '0 4px'
    });
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); if (hideTimer) { clearTimeout(hideTimer); hideTimer=null; } try { el.remove(); } catch{} overlay = null; });
    el.appendChild(closeBtn);
  }

  function analyzeScreenshot(mode) {
    const box = ensureOverlay();
    if (mode === 'brief') setStyleBrief('…');
    else if (mode === 'detailed') setStyleDetailed('…');
    else setStyleBrief('…');
    try {
      chrome.runtime.sendMessage({ type: 'GEMINI_SCREENSHOT_ANALYZE', mode }, (resp) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          const msg = 'Error: ' + chrome.runtime.lastError.message;
          if (mode === 'detailed') setStyleDetailed(msg); else { setStyleBrief(msg); if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { box.remove(); } catch{} overlay=null; }, 3500); }
          return;
        }
        if (!resp) { if (mode==='detailed') setStyleDetailed('No response'); else { setStyleBrief('No response'); if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { box.remove(); } catch{} overlay=null; }, 3500); } return; }
        if (resp.error) { if (mode==='detailed') setStyleDetailed('Fail: ' + resp.error); else { setStyleBrief('Fail'); if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { box.remove(); } catch{} overlay=null; }, 3500); } return; }
        const text = resp.text || '?';
        if (mode === 'detailed') { setStyleDetailed(text); }
        else { setStyleBrief(text); if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { box.remove(); } catch{} overlay=null; }, 3500); }
      });
    } catch (e) {
      const msg = 'Exception: ' + e.message;
      if (mode === 'detailed') setStyleDetailed(msg); else { setStyleBrief(msg); if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { box.remove(); } catch{} overlay=null; }, 3500); }
    }
  }

  window.addEventListener('keydown', (e) => {
    // Debug trace for troubleshooting
    if (e.ctrlKey) {
      try { console.debug('[GeminiOverlay] keydown ctrl combo', { key: e.key, code: e.code, target: e.target && e.target.tagName }); } catch {}
    }
    // Ctrl + [ => one-word result (no interim text)
    if (e.ctrlKey && !e.shiftKey && (e.key === '[' || e.code === 'BracketLeft')) {
      // Minimal overlay with no interim text
      setStyleMinimalWord('');
      try {
        chrome.runtime.sendMessage({ type: 'GEMINI_SCREENSHOT_ANALYZE', mode: 'oneword' }, (resp) => {
          if (chrome.runtime && chrome.runtime.lastError) { setStyleMinimalWord('?'); if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { overlay.remove(); } catch{} overlay=null; }, 3500); return; }
          if (!resp || resp.error) { setStyleMinimalWord('?'); if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { overlay.remove(); } catch{} overlay=null; }, 3500); return; }
          const raw = String(resp.text || '').trim().toLowerCase();
          const m = raw.match(/[a-z0-9_-]+/);
          const word = m ? m[0] : '?';
          setStyleMinimalWord(word);
          if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { overlay.remove(); } catch{} overlay=null; }, 3500);
        });
      } catch { setStyleMinimalWord('?'); if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { try { overlay.remove(); } catch{} overlay=null; }, 3500); }
      return;
    }
    // Ctrl + ] => brief explanation (~20 words)
    if (e.ctrlKey && !e.shiftKey && (e.key === ']' || e.code === 'BracketRight')) {
      analyzeScreenshot('brief');
      return;
    }
    // Ctrl + ; => detailed explanation
    if (e.ctrlKey && !e.shiftKey && (e.key === ';' || e.code === 'Semicolon')) {
      analyzeScreenshot('detailed');
      return;
    }
  }, true);
})();
