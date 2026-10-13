// Shobot brain on Vercel: streams Claude's answer from the Vercel AI Gateway.
// Auth: AI_GATEWAY_API_KEY if set, otherwise the project's automatic Vercel OIDC token.
// The page sends Shobot's instructions (system) for each mode; this function picks the model and limits.

const GATEWAY = 'https://ai-gateway.vercel.sh/v1/messages';
const MODELS = {
  chat: ['anthropic/claude-haiku-5.5', 'anthropic/claude-haiku-4.5'],
  music: ['anthropic/claude-haiku-5.5', 'anthropic/claude-haiku-4.5'],
  code: ['anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5'],
  '3d': ['anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5'],
};
const MAX_TOKENS = { chat: 1500, music: 1500, code: 16000, '3d': 24000 };

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
  for (const m of messages.slice(-24)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const content = cleanContent(m.role === 'assistant' && typeof m.content !== 'string' ? '' : m.content, imgBudget);
    if (!content || (typeof content === 'string' && !content.trim())) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role && typeof prev.content === 'string' && typeof content === 'string') prev.content += '\n\n' + content;
    else if (prev && prev.role === m.role) {
      const asBlocks = x => (typeof x === 'string' ? [{ type: 'text', text: x }] : x);
      prev.content = [...asBlocks(prev.content), ...asBlocks(content)];
    } else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

function gateway(token, body) {
  return fetch(GATEWAY, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  const token = process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;

  if (req.method === 'GET') {
    if (req.query && req.query.ping) {
      const r = await gateway(token, { model: MODELS.chat[0], max_tokens: 20, messages: [{ role: 'user', content: 'Say hi' }] });
      const j = await r.json().catch(() => ({}));
      return res.status(200).json({ ai: r.ok, status: r.status, sample: j?.content?.[0]?.text, error: j?.error?.message });
    }
    return res.status(200).json({ ai: !!token });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!token) return res.status(500).json({ error: 'AI is not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const mode = MODELS[body.mode] ? body.mode : 'chat';
  const system = typeof body.system === 'string' ? body.system.slice(0, 20000) : 'You are Shobot, a friendly robot helper.';
  const messages = clean(body.messages);
  if (!messages.length) return res.status(400).json({ error: 'No message' });

  let lastErr = 'AI error';
  for (const model of MODELS[mode]) {
    const r = await gateway(token, { model, max_tokens: MAX_TOKENS[mode], system, messages, stream: true });
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({}));
      lastErr = j?.error?.message || `gateway ${r.status}`;
      if (r.status === 401 || r.status === 403 || r.status === 429) break;
      continue;
    }
    // Stream plain text deltas to the page.
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-model': model });
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') res.write(ev.delta.text);
          else if (ev.type === 'error') res.write(`\n[[error:${ev.error?.message || 'stream error'}]]`);
        }
      }
    } catch (e) { res.write('\n[[error:connection dropped]]'); }
    return res.end();
  }
  return res.status(502).json({ error: lastErr });
};
