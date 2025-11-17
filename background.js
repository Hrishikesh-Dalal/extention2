const PROXY_URL = "https://your-deployment.vercel.app/api/analyze"; // set to your server endpoint
const GEMINI_TIMEOUT_MS = 15000;

async function captureVisiblePng(windowId) {
  return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
}

async function postToProxy(base64, mode) {
  const controller = new AbortController();
  const timeoutId = setTimeout(()=>controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mode }),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(()=>"<no body>");
      throw new Error(`Proxy HTTP ${res.status} ${text.slice(0,200)}`);
    }
    return await res.json(); // expect { text: "..." }
  } finally {
    clearTimeout(timeoutId);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'GEMINI_SCREENSHOT_ANALYZE') return;
  let responded = false;
  const respond = (p)=>{ if(!responded){ responded=true; try{ sendResponse(p);}catch{} } };
  (async ()=>{
    try {
      let tab = sender.tab;
      if (!tab) {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = active;
      }
      if (!tab) throw new Error('No active tab to capture');
      const dataUrl = await captureVisiblePng(tab.windowId);
      const base64 = dataUrl.split(',')[1];
      const mode = msg.mode || 'brief';
      const json = await postToProxy(base64, mode);
      respond({ text: (json && json.text) ? json.text : '?', dataUrl, size: base64.length, mode });
    } catch (e) {
      respond({ text: '?', error: String(e) });
    }
  })();
  return true;
});
