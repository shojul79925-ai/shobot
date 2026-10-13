// Shobot brain on Vercel: streams an AI answer to the page as plain text.
// Providers (first one configured wins):
//   OPENROUTER_API_KEY  -> OpenRouter (pay-as-you-go credits; uses Claude models)
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
// Each model has its own free-tier limit, so when one is busy Shobot tries the next.
const GEMINI_MODELS = {
  fast: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'],
  smart: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  genius: ['gemini-3-pro', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
};
const retrySeconds = j => {
  const d = (j?.error?.details || []).find(x => x.retryDelay)?.retryDelay;
  return d ? Math.min(90, Math.ceil(parseFloat(d))) : 0;
};
const MAX_TOKENS = { chat: 1500, music: 1500, code: 16000, '3d': 24000, plan: 2500, agent: 3500, review: 2000, final: 5000 };
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
async function streamGateway(token, mode, system, messages, write, brain = 'smart', info = {}) {
  let lastErr = 'AI error';
  for (const model of (GW_MODELS[brain] || GW_MODELS.smart)[mode]) {
    const r = await gateway(token, { model, max_tokens: MAX_TOKENS[mode], system, messages, stream: true });
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({}));
      lastErr = j?.error?.message || `gateway ${r.status}`; info.status = r.status;
      if ([401, 403, 429].includes(r.status)) break;
      continue;
    }
    await readSSE(r.body, ev => {
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') write(ev.delta.text);
      else if (ev.type === 'message_start') info.usage = { in: ev.message?.usage?.input_tokens || 0, out: 0, cost: null };
      else if (ev.type === 'message_delta' && ev.usage) info.usage = { ...(info.usage || { in: 0 }), out: ev.usage.output_tokens || 0, cost: null };
      else if (ev.type === 'error') write(`\n[[error:${ev.error?.message || 'stream error'}]]`);
    });
    info.model = model;
    return null;
  }
  return lastErr;
}

/* ---------- OpenRouter (same Claude models, OpenAI-style API) ---------- */
function toOpenAI(system, messages) {
  return [{ role: 'system', content: system }, ...messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : m.content.map(b => b.type === 'image'
      ? { type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } }
      : { type: 'text', text: b.text }),
  }))];
}
async function streamOpenRouter(key, mode, system, messages, write, brain = 'smart', info = {}) {
  let lastErr = 'AI error';
  const models = [process.env.OPENROUTER_MODEL, ...(GW_MODELS[brain] || GW_MODELS.smart)[mode]].filter(Boolean);
  for (const model of models) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-title': 'Shobot', 'http-referer': 'https://shobot.vercel.app' },
      body: JSON.stringify({ model, max_tokens: MAX_TOKENS[mode], stream: true, usage: { include: true }, messages: toOpenAI(system, messages) }),
    });
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({}));
      lastErr = j?.error?.message || `openrouter ${r.status}`; info.status = r.status; info.model = model;
      (info.tries ||= []).push(`${model}: ${r.status} ${lastErr.slice(0, 120)}`);
      if (r.status === 429) info.busy = true;
      if ([401, 402, 403].includes(r.status)) break; // bad key or no credits left
      continue;
    }
    let wrote = 0;
    await readSSE(r.body, ev => {
      const t = ev?.choices?.[0]?.delta?.content;
      if (t) { wrote += t.length; write(t); }
      if (ev?.usage) info.usage = { in: ev.usage.prompt_tokens || 0, out: ev.usage.completion_tokens || 0, cost: typeof ev.usage.cost === 'number' ? ev.usage.cost : null };
      if (ev?.error) write(`\n[[error:${ev.error.message || 'stream error'}]]`);
    });
    info.model = model; info.chars = wrote;
    if (!wrote) { lastErr = `empty answer from ${model}`; (info.tries ||= []).push(lastErr); continue; }
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
      generationConfig: { maxOutputTokens: MAX_TOKENS[mode] + 8000 },
      ...(search ? { tools: [{ google_search: {} }] } : {}),
    }),
  });
}
async function streamGemini(key, mode, system, messages, write, brain = 'smart', info = {}) {
  const models = [process.env.GEMINI_MODEL, ...(GEMINI_MODELS[brain] || GEMINI_MODELS.smart)].filter(Boolean);
  let lastErr = 'AI error';
  for (const model of models) {
    // In chat, let Gemini look things up on Google so answers about today's world are right.
    const canSearch = mode === 'chat' || mode === 'agent';
    let r = await geminiRequest(key, model, mode, system, messages, true, canSearch);
    if (!r.ok && canSearch && r.status === 400) r = await geminiRequest(key, model, mode, system, messages, true, false);
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({}));
      lastErr = j?.error?.message || `gemini ${r.status}`; info.model = model; (info.tries ||= []).push(`${model}: ${r.status} ${lastErr.slice(0, 120)}`);
      if (r.status === 429) { info.busy = true; info.retryAfter = Math.max(info.retryAfter || 0, retrySeconds(j)); }
      if (r.status !== 404) info.status = r.status;
      if ([400, 401, 403].includes(r.status) && !/model/i.test(lastErr)) break; // bad key: stop
      continue; // model missing or busy: try the next one
    }
    let wrote = 0;
    await readSSE(r.body, ev => {
      const c = ev?.candidates?.[0];
      for (const p of c?.content?.parts || []) if (p.text && !p.thought) { wrote += p.text.length; write(p.text); }
      if (c?.finishReason) info.finish = c.finishReason;
      if (ev?.usageMetadata) info.usage = { in: ev.usageMetadata.promptTokenCount || 0, out: (ev.usageMetadata.candidatesTokenCount || 0) + (ev.usageMetadata.thoughtsTokenCount || 0), cost: null };
      if (ev?.error) write(`\n[[error:${ev.error.message || 'stream error'}]]`);
    });
    info.model = model; info.chars = wrote;
    if (!wrote) { lastErr = `empty answer from ${model} (${info.finish || 'no reason'})`; (info.tries ||= []).push(lastErr); continue; } // e.g. thinking used up the budget: try next model
    return null;
  }
  return lastErr;
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  const orKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const gwToken = process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  const provider = orKey ? 'openrouter' : geminiKey ? 'gemini' : gwToken ? 'gateway' : null;
  const run = (mode, system, messages, write, brain, info) =>
    provider === 'openrouter' ? streamOpenRouter(orKey, mode, system, messages, write, brain, info)
      : provider === 'gemini' ? streamGemini(geminiKey, mode, system, messages, write, brain, info)
        : streamGateway(gwToken, mode, system, messages, write, brain, info);

  if (req.method === 'GET') {
    if (req.query && req.query.usage) {
      // How much of the OpenRouter key's limit is used (only OpenRouter can tell us this).
      if (provider !== 'openrouter') return res.status(200).json({ provider, key: null });
      const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { authorization: `Bearer ${orKey}` } }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      const d = j?.data || null;
      return res.status(200).json({ provider, key: d && {
        label: /^sk-/i.test(d.label || '') ? 'shobot' : d.label, limit: d.limit, limit_remaining: d.limit_remaining, limit_reset: d.limit_reset,
        usage: d.usage, usage_daily: d.usage_daily, usage_weekly: d.usage_weekly, usage_monthly: d.usage_monthly,
      }, error: d ? undefined : (j?.error?.message || 'Could not read usage') });
    }
    if (req.query && req.query.ping) {
      // ?ping=1 checks the brain; &mode=plan|agent|... tests that mode; &brain=fast|smart|genius
      const pm = MAX_TOKENS[req.query.mode] ? req.query.mode : 'chat';
      const pb = ['fast', 'smart', 'genius'].includes(req.query.brain) ? req.query.brain : 'smart';
      const q = pm === 'plan' ? 'Split this task into exactly 3 jobs. Reply ONLY JSON {"goal":"...","agents":[{"name":"...","role":"...","task":"..."}]}. TASK: plan a fun robot game'
        : pm === 'chat' ? 'Say hi' : 'In two sentences, give one idea for a fun robot game.';
      let text = ''; const info = {};
      const err = provider
        ? await run(pm, 'You are a helpful assistant. Be brief.', [{ role: 'user', content: q }], t => (text += t), pb, info)
        : 'No AI key configured';
      return res.status(200).json({ ai: !err && !!text, provider, mode: pm, brain: pb, sample: text.slice(0, 80), error: err || undefined, ...info });
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
  let err; const info = {};
  try {
    err = await run(mode, system, messages, write, brain, info);
  } catch (e) {
    if (started) { res.write('\n[[error:connection dropped]]'); return res.end(); }
    err = e.message || 'AI error';
  }
  if (err && !started) {
    console.error('AI error', mode, brain, info, err);
    if (info.busy || info.status === 429) return res.status(429).json({ error: 'Shobot\'s brain is busy. Try again soon.', retryAfter: info.retryAfter || 20 });
    return res.status(502).json({ error: err });
  }
  if (!started) write('');
  if (!err) res.write(`\n[[usage:${JSON.stringify({ provider, model: info.model || null, ...(info.usage || {}) })}]]`);
  return res.end();
};
