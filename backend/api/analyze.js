// Node 18+ environment on Vercel. Uses global fetch.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { imageBase64, mode } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'missing imageBase64' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'no GEMINI_API_KEY configured' });

    let promptText = 'In at most 20 words, concisely explain what is shown. No preface, no markdown.';
    let maxTokens = 64;
    if (mode === 'oneword') { promptText = 'Just answer of the question in the screenshot. GIVE A, B, C, D. No punctuation, no extra text.'; maxTokens = 5; }
    if (mode === 'brief') { promptText = 'In at most 20 words, concisely explain the answer to the question. No preface, no markdown.'; maxTokens = 64; }
    if (mode === 'detailed') { promptText = 'Provide an in-depth, well-structured explanation of the screenshot in plain text, up to ~180 words.'; maxTokens = 256; }

    const body = {
      contents: [
        { parts: [ { text: promptText }, { inline_data: { mime_type: 'image/png', data: imageBase64 } } ] }
      ],
      generationConfig: { maxOutputTokens: maxTokens }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 15000);

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!r.ok) {
      const txt = await r.text().catch(()=>"<no body>");
      return res.status(502).json({ error: `Gemini HTTP ${r.status}`, body: txt.slice(0,500) });
    }
    const json = await r.json();
    const text = (json.candidates && json.candidates[0] && json.candidates[0].content.parts[0].text)
      ? json.candidates[0].content.parts[0].text.trim()
      : '?';
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
