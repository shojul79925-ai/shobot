// Shobot brain on Vercel: streams an AI answer to the page as plain text.
// Providers (first one configured wins):
//   GEMINI_API_KEY      -> Google Gemini API (has a free tier; the key owner must be 18+)
//   AI_GATEWAY_API_KEY  -> Vercel AI Gateway (Claude)
//   automatic Vercel OIDC token -> Vercel AI Gateway (needs a card on the Vercel account)
// Optional: GEMINI_MODEL to pick a specific Gemini model.

const GATEWAY = 'https://ai-gateway.vercel.sh/v1/messages';
// Brain levels the user picks in Shobot's settings: fast / smart / genius.
const HAIKU = 'anthropic/claude-haiku-5.5', SONNET = 'anthropic/claude-sonnet-5.5', OPUS = 'anthropic/claude-opus-5.5';
// Team mode: plan (leader splits the job), agent (each helper), review (checker), final (leader's answer).
const GW_MODELS = {
  fast: { chat: [HAIKU], music: [HAIKU], code: [SONNET, HAIKU], '3d': [SONNET, HAIKU], plan: [HAIKU], agent: [HAIKU], review: [HAIKU], final: [SONNET, HAIKU] },
  smart: { chat: [SONNET, HAIKU], music: [HAIKU], code: [SONNET, HAIKU], '3d': [SONNET, HAIKU], plan: [SONNET, HAIKU], agent: [HAIKU], review: [SONNET, HAIKU], final: [SONNET, HAIKU] },
  genius: { chat: [OPUS, SONNET], music: [SONNET, HAIKU], code: [OPUS, SONNET], '3d': [OPUS, SONNET], plan: [OPUS, SONNET], agent: [SONNET, HAIKU], review: [OPUS, SONNET], final: [OPUS, SONNET] },
};
const GEMINI_MODELS = {
  fast: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'],
  smart: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'],
  genius: ['gemini-3.8-pro', 'gemini-3-pro', 'gemini-2.5-pro', 'gemini-3.8-flash'],
};
const MAX_TOKENS = { chat: 1500, music: 1500, code: 16000, '3d': 24000, plan: 2500, agent: 3500, review: 2000, final: 5000 };
let lastStatus = 0; // status of the last failed AI request (429 = too many requests)
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function cleanContent(c, imgBudget) {
  if (typeof c === 'string') return c.slice(0, 60000);
  if (!Array.isArray(c)) return '';
  const blocks = [];
  for (const b of c.slice(0, 8)) {
    if (b && b.type === 'text' && typeof b.text === 'string' && b.text.trim()) blocks.push({ type: 'text', text: b.text.slice(0, 60000) });
    else if (b && b.type === 'image' && b.source?.type === 'base64' && IMG_TYPES.includes(b.source.media_type)
      && typeof b.source.data === 'string' && b.source.data.length < 1_400_000 && imgBudget.n-- > 0) {
      blocks.push({ type: 'image', source: { type: 'base64', media_type: b.source.media_type, data: b.source.data } });
    }
  }
  return blocks.length ? blocks : '';
}
function clean(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [], imgBudget = { n: 4 };
  const asBlocks = x => (typeof x === 'string' ? [{ type: 'text', text: x }] : x);
  for (const m of messages.slice(-24)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const content = cleanContent(m.role === 'assistant' && typeof m.content !== 'string' ? '' : m.content, imgBudget);
    if (!content || (typeof content === 'string' && !content.trim())) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role && typeof prev.content === 'string' && typeof content === 'string') prev.content += '\n\n' + content;
    else if (prev && prev.role === m.role) prev.content = [...asBlocks(prev.content), ...asBlocks(content)];
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

// Read a server-sent-events body and call onEvent(json) for every "data:" line.
async function readSSE(body, onEvent) {
  const reader = body.getReader(), dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try { onEvent(JSON.parse(line.slice(5))); } catch {}
    }
  }
}

/* ---------- Vercel AI Gateway (Claude) ---------- */
function gateway(token, body) {
  return fetch(GATEWAY, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
}
async function streamGateway(token, mode, system, messages, write, brain = 'smart') {
  let lastErr = 'AI error';
  for (const model of (GW_MODELS[brain] || GW_MODELS.smart)[mode]) {
    const r = await gateway(token, { model, max_tokens: MAX_TOKENS[mode], system, messages, stream: true });
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({}));
      lastErr = j?.error?.message || `gateway ${r.status}`; lastStatus = r.status;
      if ([401, 403, 429].includes(r.status)) break;
      continue;
    }
    await readSSE(r.body, ev => {
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') write(ev.delta.text);
      else if (ev.type === 'error') write(`\n[[error:${ev.error?.message || 'stream error'}]]`);
    });
    return null;
  }
  return lastErr;
}

/* ---------- Google Gemini ---------- */
function toGemini(messages) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: (typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content).map(b =>
      b.type === 'image' ? { inline_data: { mime_type: b.source.media_type, data: b.source.data } } : { text: b.text }),
  }));
}
function geminiRequest(key, model, mode, system, messages, stream, search) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: toGemini(messages),
      generationConfig: { maxOutputTokens: MAX_TOKENS[mode] },
      ...(search ? { tools: [{ google_search: {} }] } : {}),
    }),
  });
}
async function streamGemini(key, mode, system, messages, write, brain = 'smart') {
  const models = [process.env.GEMINI_MODEL, ...(GEMINI_MODELS[brain] || GEMINI_MODELS.smart)].filter(Boolean);
  let lastErr = 'AI error';
  for (const model of models) {
    // In chat, let Gemini look things up on Google so answers about today's world are right.
    const canSearch = mode === 'chat' || mode === 'agent';
    let r = await geminiRequest(key, model, mode, system, messages, true, canSearch);
    if (!r.ok && canSearch && (r.status === 400 || r.status === 429)) r = await geminiRequest(key, model, mode, system, messages, true, false);
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({}));
      lastErr = j?.error?.message || `gemini ${r.status}`; lastStatus = r.status;
      if ([400, 401, 403].includes(r.status) && !/model/i.test(lastErr)) break; // bad key: stop
      continue; // model missing or busy: try the next one
    }
    await readSSE(r.body, ev => {
      const parts = ev?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) if (p.text && !p.thought) write(p.text);
      if (ev?.error) write(`\n[[error:${ev.error.message || 'stream error'}]]`);
    });
    return null;
  }
  return lastErr;
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  const geminiKey = process.env.GEMINI_API_KEY;
  const gwToken = process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  const provider = geminiKey ? 'gemini' : gwToken ? 'gateway' : null;

  if (req.method === 'GET') {
    if (req.query && req.query.ping) {
      let text = '';
      const err = provider === 'gemini'
        ? await streamGemini(geminiKey, 'chat', 'Reply with one word.', [{ role: 'user', content: 'Say hi' }], t => (text += t))
        : provider === 'gateway'
          ? await streamGateway(gwToken, 'chat', 'Reply with one word.', [{ role: 'user', content: 'Say hi' }], t => (text += t))
          : 'No AI key configured';
      return res.status(200).json({ ai: !err && !!text, provider, sample: text.slice(0, 40), error: err || undefined });
    }
    return res.status(200).json({ ai: !!provider, provider });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!provider) return res.status(500).json({ error: 'AI is not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const mode = MAX_TOKENS[body.mode] ? body.mode : 'chat';
  const brain = ['fast', 'smart', 'genius'].includes(body.brain) ? body.brain : 'smart';
  const system = typeof body.system === 'string' ? body.system.slice(0, 20000) : 'You are Shobot, a friendly robot helper.';
  const messages = clean(body.messages);
  if (!messages.length) return res.status(400).json({ error: 'No message' });

  let started = false;
  const write = t => {
    if (!started) { started = true; res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-provider': provider }); }
    res.write(t);
  };
  let err; lastStatus = 0;
  try {
    err = provider === 'gemini'
      ? await streamGemini(geminiKey, mode, system, messages, write, brain)
      : await streamGateway(gwToken, mode, system, messages, write, brain);
  } catch (e) {
    if (started) { res.write('\n[[error:connection dropped]]'); return res.end(); }
    err = e.message || 'AI error';
  }
  if (err && !started) return res.status(lastStatus === 429 ? 429 : 502).json({ error: err });
  if (!started) write('');
  return res.end();
};
