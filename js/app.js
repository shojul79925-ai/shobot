// Shobot — main app
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// Running inside a Claude-hosted page (artifact) or on its own website (Vercel)?
const IN_CLAUDE = !!(window.claude && typeof window.claude.use === 'function');
const use = name => (IN_CLAUDE ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
const samplePromise = use('sample');
const downloadsPromise = use('downloads');
if (IN_CLAUDE) document.body.classList.add('in-claude');

/* ---------------- storage (safe) ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('shobot.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('shobot.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('shobot.' + k); } catch {} },
};
const settings = Object.assign({ name: '', voice: false, sound: true, brain: 'smart' }, store.get('settings', {}));
let memories = store.get('memories', []);
const saveMemories = () => store.set('memories', memories.slice(-30));
const saveSettings = () => store.set('settings', settings);
const userName = () => settings.name || 'Shokul';

/* ---------------- toast + sounds ---------------- */
let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms);
}
let actx;
function audioCtx() {
  if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function beep(kind = 'send') {
  if (!settings.sound) return;
  const ac = audioCtx(); if (!ac) return;
  const notes = { send: [660, 880], recv: [880, 1320], ok: [523, 659, 784], no: [400, 300] }[kind] || [700];
  notes.forEach((f, i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    const t = ac.currentTime + i * 0.07;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.13);
  });
}

/* ---------------- avatar ---------------- */
const Avatar = {
  svgs: [], base: 'teleport', temp: null, tempT: null, sleepT: null, jobs: 0,
  init() {
    $$('[data-shobot]').forEach(m => this.mount(m));
    setTimeout(() => { if (this.base === 'teleport') this.set('idle'); }, 1500);
    const look = e => {
      const p = e.touches ? e.touches[0] : e; if (!p) return;
      this.svgs.forEach(svg => {
        if (!svg.isConnected) return;
        const r = svg.getBoundingClientRect(); if (!r.width) return;
        const dx = p.clientX - (r.left + r.width / 2), dy = p.clientY - (r.top + r.height * 0.35);
        const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300);
        svg.querySelector('.av-eyes').style.transform = `translate(${(dx / d) * 5 * k}px, ${(dy / d) * 4 * k}px)`;
      });
      this.poke();
    };
    addEventListener('pointermove', look, { passive: true });
    addEventListener('touchstart', look, { passive: true });
    addEventListener('keydown', () => this.poke());
    this.poke();
  },
  mount(el) {
    el.appendChild($('#shobot-tpl').content.cloneNode(true));
    const svg = el.querySelector('svg'); this.svgs.push(svg);
    svg.setAttribute('class', 'av ' + this.state());
    return svg;
  },
  state() { return this.temp || this.base; },
  apply() {
    this.svgs = this.svgs.filter(s => s.isConnected);
    const s = this.state(); this.svgs.forEach(svg => svg.setAttribute('class', 'av ' + s));
  },
  set(s) { this.base = s; this.apply(); },
  play(s, ms = 2400) {
    clearTimeout(this.tempT); this.temp = s; this.apply();
    this.tempT = setTimeout(() => { this.temp = null; this.apply(); }, ms);
  },
  // Long jobs: Shobot shows the job's animation until the last job finishes.
  startJob(s) { this.jobs++; this.temp = null; this.set(s); },
  endJob(celebrate = true) {
    this.jobs = Math.max(0, this.jobs - 1);
    if (!this.jobs) { this.set('idle'); if (celebrate) this.play('happy', 1800); }
  },
  poke() {
    if (this.base === 'sleep') { this.set('idle'); this.play('surprised', 900); }
    clearTimeout(this.sleepT);
    this.sleepT = setTimeout(() => { if (this.base === 'idle' && !this.temp && !this.jobs) this.set('sleep'); }, 60000);
  },
};

/* ---------------- Shobot's instructions ---------------- */
const BASE = () => `You are Shobot, a friendly, upbeat robot AI helper made for ${userName()}, a young builder in Thailand who makes apps and games.
Personality: cheerful, curious, encouraging, a few emojis, explains things simply and clearly like a great teacher. Keep it kid-friendly and safe.
Always reply in the same language the user writes in (for example Thai or English).
Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
Be genuinely smart: think carefully before answering, get facts right, show the steps for maths and homework, and check your answer. If you are not sure, say so honestly instead of guessing.${memories.length ? `
Things you remember about ${userName()} from earlier chats:
${memories.map(m => '- ' + m).join('\n')}` : ''}`;

const PROMPTS = {
  chat: () => `${BASE()}
Answer questions directly and helpfully. Keep answers short (usually under 120 words) unless asked for detail. Use **bold** and \`code\` sparingly.
You live inside the Shobot app. You can DO things by putting a tag at the very END of your reply (tags are hidden from the user):
- Build a 3D model live: [[action:build3d|what to build]]
- Make a music beat: [[action:beat|the mood or style]]
- Write a website, game or app: [[action:code|what to make]]
- Avatar moves: [[action:dance]] [[action:wave]] [[action:happy]] [[action:spin]] [[action:sleep]] [[action:surprised]]
- Phone things (the app ALWAYS asks the user's permission first): [[action:vibrate]] [[action:camera]] [[action:mic]] [[action:location]] [[action:notify]] [[action:flashlight]] [[action:speaker]] [[action:clipboard]] [[action:wakelock]]
- Open a tool, only if the user asks to open it: [[action:open|code|studio3d|music|test|phone|me]]
- Ask your team of helper robots (3 to 10 agents working at the same time) to do a big job together: [[action:team|the job]], or choose the size: [[action:team|7|the job]]. Use it when the user asks for your agents or team, or for big jobs such as planning a whole game, a research project, a long story or a big school project.
- Remember something useful for future chats (their favourite things, projects, goals, how they like answers): [[action:remember|short fact]]. Never remember private details such as home address, phone number, passwords, school name or full name.
Use an action only when the user clearly asks you to make or do that thing; for normal questions just answer. When you use build3d, beat or code, say one short excited sentence first (the user will watch you work live). Never claim you used the phone without the permission step.`,

  code: () => `${BASE()}
You are in CODE MODE. Reply with:
1) One or two short friendly sentences about what you made.
2) ONE complete, self-contained HTML file in a single \`\`\`html code block (inline <style> and <script>; no external files except well-known CDNs if truly needed).
It must work on phones, iPads and computers (responsive; touch, mouse and keyboard), look colorful and polished, and run without errors. Do not use alert(), confirm() or prompt(). If a current project is provided and the user asks for a change, edit that project instead of starting over. Exactly one code block.`,

  '3d': () => `You are a master 3D model builder. You build models out of many primitive parts, streamed ONE JSON object PER LINE so the user can watch the model being built in real time. Output only JSON lines: no prose, no code fences, no blank commentary.
Line 1: {"title":"short name","parts":<how many parts you plan>}
Every other line is one part:
{"n":"part name","s":"<shape>","c":"#rrggbb","p":[x,y,z],"r":[rx,ry,rz],"k":[sx,sy,sz],"m":"<finish>"}
Shapes (base size about 1 unit, centered on p): box, roundbox (soft edges), sphere (diameter 1), hemisphere (dome, flat side down at p), cylinder (height 1, diameter 1, along Y), cone (along Y, tip up), pyramid (4 sides), torus (donut, outer diameter ~1.1, lies in XY plane), ring (thin hoop, diameter ~1, XY plane), capsule (height ~1.2), wedge (ramp: right triangle in XY, extruded along Z), gem (octahedron), rock (dodecahedron), plane (thin floor tile 1x1).
Advanced shapes for real detail (their sizes are in world units; usually leave k as [1,1,1]):
- lathe: a turned/spun shape around Y (vases, bottles, wheels, cups, bodies, noses). Add "pts":[[radius,y],...] from bottom to top, 4–24 points.
- extrude: a flat outline pushed out along Z (wings, fins, leaves, letters, logos, ears). Add "pts":[[x,y],...] outline (3–40 points) and "d":thickness.
- tube: a smooth pipe along a path (cables, tails, handles, horns, railings, legs). Add "path":[[x,y,z],...] (2–20 points) and "rad":radius.
Finishes "m": plastic (default), matte, rubber (tires), metal (shiny chrome/steel/gold), glass (see-through windows, water), glow (lights, eyes, screens, lava, neon).
Rules: Y is up and the ground is y=0, so the model rests on the ground. Center it near x=0, z=0, about 2–6 units tall or long. Rotations are in degrees. Use recognizable real-world proportions and many small details (panels, bolts, windows, lights, eyes, stripes, handles, trim) placed precisely and touching the parts they attach to. Mirror left/right parts exactly. Build in a natural order: base/body first, then big parts, then small details. Use bright, appealing colors.`,

  music: () => `You turn a description into a 16-step music loop. Reply with ONLY JSON:
{"title":"short name","bpm":60-180,"instrument":"synth|piano|pluck|bass|bell","drums":{"kick":[16 x 0/1],"snare":[16],"hat":[16],"clap":[16]},"melody":[16 entries, each one of "C4","D4","E4","F4","G4","A4","B4","C5" or null for a rest]}
Make it musical and match the mood (chill = slower and sparse; dance = 120–130 bpm with a kick on every beat).`,
};
const DETAIL = {
  simple: 'Detail level: SIMPLE. Use 15–35 parts.',
  detailed: 'Detail level: DETAILED. Use 60–140 parts with lots of small details.',
  super: 'Detail level: SUPER DETAILED. Use 150–300 parts: every panel, bolt, window frame, light, seam and trim piece. Prefer lathe, extrude and tube parts for smooth curved forms.',
};

const TEAM_PROMPTS = {
  plan: n => `You are Shobot, the leader of a team of helper robots, working for ${userName()}, a young builder. Keep everything kid-friendly and safe.
Split the user's task into exactly ${n} jobs for ${n} agents. The agents work AT THE SAME TIME and cannot see each other's work, so every job must make sense on its own and together they must cover the whole task with no overlap.
Choose the most useful mix of roles for THIS task, for example: researcher, writer, coder, designer, builder3d, musician, teacher, mathematician, storyteller, gamer, scientist, critic. Give each agent a fun short robot name.
Reply with ONLY JSON, no other text:
{"goal":"one short sentence","agents":[{"name":"...","role":"...","task":"1-3 clear, specific sentences"}]}
Write the goal and the tasks in the same language as the user.`,
  agent: (a, n) => `${BASE()}
You are ${a.name}, the ${a.role} on Shobot's team of ${n} helper robots. The team leader gave you ONE job. The other agents are doing the other parts at the same time, so do ONLY your job, and do it really well: concrete, correct, useful details, checked carefully.
Keep it under 250 words unless your job truly needs more (code, a story chapter or a detailed plan may be longer). Use simple language and markdown. Do not add action tags.`,
  review: () => `${BASE()}
You are Checker, the quality-control robot on Shobot's team. Read the team's work and point out the most important mistakes, wrong facts, missing pieces and parts that don't fit together, as 3 to 6 short, specific bullet points. If everything is good, say so in one line.`,
  final: () => `${BASE()}
You are Shobot, the leader of your helper-robot team. The team has finished. Combine their work into ONE excellent, well-organized answer for ${userName()}: keep the best parts, fix every problem the Checker found, remove repetition, and make it easy to read (short headings or lists when helpful). Do not list every agent; you may thank the team in one short line.
If the user asked you to MAKE something (a game, app or website; a 3D model; a music beat), end your answer with exactly one action tag that carries a DETAILED description built from the team's plan: [[action:code|...]] or [[action:build3d|...]] or [[action:beat|...]]. Never use the ] character inside the tag. Otherwise use no tags.`,
};

/* ---------------- AI ---------------- */
const BRAINS = {
  fast: { label: 'Fast ⚡', tier: { chat: 'quick', music: 'quick', code: 'default', '3d': 'default', plan: 'quick', agent: 'quick', review: 'quick', final: 'default' } },
  smart: { label: 'Smart 🧠', tier: { chat: 'default', music: 'quick', code: 'default', '3d': 'default', plan: 'default', agent: 'quick', review: 'default', final: 'default' } },
  genius: { label: 'Genius 🌟', tier: { chat: 'complex', music: 'default', code: 'complex', '3d': 'complex', plan: 'complex', agent: 'default', review: 'complex', final: 'complex' } },
};
const brain = () => BRAINS[settings.brain] || BRAINS.smart;
function setAiStatus(on, label) {
  const dot = $('#aiDot'), busy = dot.classList.contains('busy');
  dot.className = 'dot ' + (on ? 'on' : 'off') + (busy ? ' busy' : '');
  $('#aiStatus').textContent = label || (on ? `online · ${brain().label} brain` : 'brain offline · basic mode');
}
async function blobToBase64(b) {
  const buf = new Uint8Array(await b.arrayBuffer()); let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function callAI(mode, messages, { onText, signal, images, system: customSystem } = {}) {
  const system = customSystem || PROMPTS[mode]();
  const sample = await samplePromise;
  const pics = images && images.length ? images : null;
  if (sample) {
    if (pics) {
      const lim = await sample.limits().catch(() => null);
      if (!lim?.images) { const err = new Error('no images'); err.code = 'images_unavailable'; throw err; }
    }
    const input = [{ role: 'user', content: system + '\n\n---\nThat was your standing job description. The conversation starts below; reply to the latest message as Shobot.' }, ...messages];
    try {
      const r = await sample(input, { modelTier: brain().tier[mode], cache: false, signal, onText, ...(pics ? { images: pics.slice(0, 4) } : {}) });
      setAiStatus(true);
      return r.text;
    } catch (e) {
      const err = new Error(e.message || e.code); err.code = e.code; err.text = e.text;
      if (['not_granted', 'sampling_disabled'].includes(e.code)) setAiStatus(false, 'brain switched off · allow Claude to use Shobot');
      if (e.code === 'rate_limited') setAiStatus(false, 'resting a moment · try again soon');
      throw err;
    }
  }
  // Own website (Vercel): stream from /api/chat
  const r = await fetch('api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal,
    body: JSON.stringify({ mode, system, brain: settings.brain, messages: pics ? await withImages(messages, pics) : messages }),
  }).catch(e => { const err = new Error('offline'); err.code = e.name === 'AbortError' ? 'cancelled' : 'offline'; throw err; });
  if (!r.ok || !r.body) {
    const j = await r.json().catch(() => ({})); const err = new Error(j.error || 'HTTP ' + r.status);
    err.code = r.status === 429 ? 'rate_limited' : 'upstream_error'; err.retryAfter = +j.retryAfter || 0;
    setAiStatus(false, r.status === 429 ? 'resting a moment · busy brain' : undefined); throw err;
  }
  setAiStatus(true);
  const reader = r.body.getReader(), dec = new TextDecoder(); let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      const delta = dec.decode(value, { stream: true }); if (!delta) continue;
      text += delta; onText?.({ text, delta });
    }
  } catch (e) { const err = new Error('stopped'); err.code = signal?.aborted ? 'cancelled' : 'upstream_error'; err.text = text; throw err; }
  const m = text.match(/\n?\[\[error:([^\]]*)\]\]\s*$/);
  if (m) { const err = new Error(m[1]); err.code = 'upstream_error'; err.text = text.slice(0, m.index); throw err; }
  if (!text.trim()) { const err = new Error('empty'); err.code = 'empty_completion'; throw err; }
  return text;
}
async function withImages(messages, pics) {
  const out = messages.slice(), last = out[out.length - 1];
  const blocks = [];
  for (const b of pics.slice(0, 4)) blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobToBase64(b) } });
  blocks.push({ type: 'text', text: last.content });
  out[out.length - 1] = { role: 'user', content: blocks };
  return out;
}
async function checkAI() {
  if (IN_CLAUDE) { const s = await samplePromise; setAiStatus(!!s); return; }
  try { const r = await fetch('api/chat'); const j = await r.json(); setAiStatus(!!j.ai); } catch { setAiStatus(false); }
}
function aiErrorText(e) {
  return ({
    not_granted: 'I need permission to think! Allow Claude for Shobot, then ask again. 🔌',
    sampling_disabled: "My brain isn't available on this account right now.",
    rate_limited: "I'm thinking too fast! Let's rest a minute, then try again. 😅",
    offline: "I can't reach my brain. Check the internet and try again.",
    cancelled: 'Stopped.',
    images_unavailable: "I can't look at pictures here yet. Try describing it to me in words!",
    image_rejected: "That picture didn't work. Try a different one.",
  })[e.code] || "Oops, my brain glitched. Try again! 🔧";
}

/* ---------------- generators ---------------- */
import('./model3d.js').catch(() => {}); // warm up the 3D kit
async function gen3d(desc, detail = 'detailed', { onTitle, onPart, signal } = {}) {
  const { lineReader, normalize } = await import('./model3d.js');
  let title = null, count = 0;
  const rd = lineReader(o => {
    if (!title && o.title && !(o.s || o.shape)) { title = String(o.title).slice(0, 60); onTitle?.({ title, parts: Math.min(400, +o.parts || 0) || '?' }); return; }
    if ((o.s || o.shape) && count < 400) { count++; onPart?.(normalize(o)); }
  });
  await callAI('3d', [{ role: 'user', content: `Build: ${desc}\n${DETAIL[detail] || DETAIL.detailed}` }], { signal, onText: ({ delta }) => rd.push(delta) });
  rd.end();
  if (!count) { const e = new Error('no parts'); e.code = 'empty_completion'; throw e; }
  return { title: title || desc, count };
}
function partialCode(text) {
  const i = text.search(/```(?:html)?\s*\n/i); if (i < 0) return '';
  const start = text.indexOf('\n', i) + 1, end = text.indexOf('```', start);
  return text.slice(start, end < 0 ? undefined : end);
}
/** Run the code in a hidden sandbox for a moment and report any JavaScript errors. */
function testCode(html, ms = 2200) {
  return new Promise(res => {
    const errs = [];
    const catcher = `<script>(function(){var s=function(m){try{parent.postMessage({shobotErr:String(m).slice(0,300)},'*')}catch(e){}};window.onerror=function(m,u,l){s(m+(l?' (line '+l+')':''))};window.addEventListener('unhandledrejection',function(e){s('Promise error: '+((e.reason&&e.reason.message)||e.reason))});})();<\/script>`;
    const doc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + catcher) : catcher + html;
    const fr = document.createElement('iframe');
    fr.setAttribute('sandbox', 'allow-scripts'); fr.style.cssText = 'position:fixed;width:390px;height:700px;left:-9999px;top:0;opacity:0;pointer-events:none';
    const onMsg = e => { if (e.source === fr.contentWindow && e.data && e.data.shobotErr && errs.length < 5 && !errs.includes(e.data.shobotErr)) errs.push(e.data.shobotErr); };
    addEventListener('message', onMsg);
    fr.srcdoc = doc; document.body.appendChild(fr);
    setTimeout(() => { removeEventListener('message', onMsg); fr.remove(); res(errs); }, ms);
  });
}
/** Write code, test it, and if it crashes, fix it once by itself. */
async function genTestedCode(request, { onCode, onStatus, signal } = {}) {
  let out = await genCode(request, { onCode, signal });
  onStatus?.('Testing my code… 🧪');
  let errs = await testCode(out.html);
  if (errs.length && !signal?.aborted) {
    onStatus?.('Found a bug! Fixing it… 🔧');
    files = { html: out.html, css: '', js: '' };
    const fixed = await genCode(`When this code runs it shows these errors: ${errs.join(' | ')}. Find the cause, fix it, and return the whole corrected file. Keep everything else the same.`, { onCode, signal });
    onStatus?.('Testing again… 🧪');
    const errs2 = await testCode(fixed.html);
    out = { html: fixed.html, note: out.note, fixed: errs, remaining: errs2 };
  } else out.remaining = errs;
  return out;
}
async function genCode(request, { onCode, signal } = {}) {
  const ctx = `Current project (one HTML file):\n\`\`\`html\n${buildDoc().slice(0, 40000)}\n\`\`\`\n\nRequest: ${request}`;
  const msgs = [...codeHistory.slice(-4), { role: 'user', content: ctx }];
  const reply = await callAI('code', msgs, { signal, onText: ({ text }) => onCode?.(partialCode(text)) });
  const m = reply.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  const html = (m ? m[1] : partialCode(reply)).trim();
  if (!html) { const e = new Error('no code'); e.code = 'empty_completion'; throw e; }
  const note = reply.replace(/```[\s\S]*?(```|$)/g, '').trim() || 'Done! Check the preview.';
  codeHistory.push({ role: 'user', content: request }, { role: 'assistant', content: note.slice(0, 600) });
  return { html, note };
}

/* ---------------- permission system (always asks) ---------------- */
const permLog = [];
function askPermission(what, why, onAllowSync) {
  return new Promise(res => {
    const m = $('#permModal');
    $('#permTitle').textContent = `Can Shobot use your ${what}?`;
    $('#permText').textContent = `${why} Shobot asks every time and never remembers your answer.`;
    m.hidden = false; Avatar.play('thinking', 60000); beep('send');
    const done = ok => {
      m.hidden = true; $('#permAllow').onclick = $('#permDeny').onclick = null;
      Avatar.play(ok ? 'happy' : 'surprised', 1500); beep(ok ? 'ok' : 'no');
      permLog.unshift({ what, ok, at: new Date() }); renderPermLog(); res(ok);
    };
    $('#permAllow').onclick = () => { try { onAllowSync?.(); } catch (e) { console.warn(e); } done(true); };
    $('#permDeny').onclick = () => done(false);
  });
}
function renderPermLog() {
  $('#permLog').innerHTML = permLog.slice(0, 30).map(p => `<li><span class="${p.ok ? 'ok' : 'no'}">${p.ok ? '✓ Allowed' : '✕ Denied'}</span> · ${esc(p.what)} <span class="muted">· ${p.at.toLocaleTimeString()}</span></li>`).join('') || '<li class="muted">No requests yet.</li>';
}

/* ---------------- helpers ---------------- */
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function md(text) {
  const parts = String(text).split(/```(\w*)\n?([\s\S]*?)```/g);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      const t = esc(parts[i]).replace(/^#{1,4}\s+(.+)$/gm, '<b class="md-h">$1</b>').replace(/^\s*[-*]\s+/gm, '• ').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      out += t.split(/\n{2,}/).filter(x => x.trim()).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    } else if (i % 3 === 2) out += `<pre><code>${esc(parts[i])}</code></pre>`;
  }
  return out;
}
function extractJSON(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('no JSON');
  return JSON.parse(text.slice(s, e + 1));
}
async function download(name, blob) {
  const dl = await downloadsPromise;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); } catch (e) { if (e.code !== 'declined') toast("Couldn't save the file here."); }
    return;
  }
  if (IN_CLAUDE) { toast('Saving files is not available here.'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function speak(text, force, onDone) {
  if (!(settings.voice || force) || !('speechSynthesis' in window) || !text) return false;
  const u = new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g, ' ').replace(/[*`#]/g, '').slice(0, 600));
  u.rate = 1.05; u.pitch = 1.35;
  u.onstart = () => { if (!Avatar.jobs) Avatar.set('talking'); };
  u.onend = u.onerror = () => { if (!Avatar.jobs) Avatar.set('idle'); onDone?.(); };
  speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
}

/* ---------------- UI motion ---------------- */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PALETTE = ['#ffd21f', '#e21fd8', '#19e3a0', '#ff8a1f', '#6c3cf0', '#38bdf8', '#ffffff'];
const rnd = (a, b) => a + Math.random() * (b - a);
function makeSky() {
  const sky = $('#sky'); if (REDUCED) return;
  const kinds = ['dot', 'dot', 'stick', 'ring', 'star', 'star', 'planet'];
  const n = innerWidth < 600 ? 16 : 26;
  for (let i = 0; i < n; i++) {
    const k = kinds[i % kinds.length], el = document.createElement('i'); el.className = k;
    const size = k === 'stick' ? [rnd(14, 26), rnd(5, 7)] : k === 'planet' ? [rnd(14, 22)] : k === 'star' ? [rnd(8, 16)] : [rnd(5, 12)];
    el.style.cssText = `left:${rnd(0, 100)}%;top:${rnd(0, 100)}%;width:${size[0]}px;height:${size[1] || size[0]}px;--c:${PALETTE[i % PALETTE.length]};--t:${rnd(14, 32)}s;--d:${-rnd(0, 20)}s;--r0:${rnd(0, 180)}deg;--x1:${rnd(-60, 60)}px;--y1:${rnd(-60, 60)}px;--x2:${rnd(-60, 60)}px;--y2:${rnd(-60, 60)}px`;
    sky.appendChild(el);
  }
}
const RIPPLE = '.btn,.chip,.grid-btns button,.card,.send-btn,.nav-btn,.ms-btn,.seg button,.icon-btn,.attach-menu button,.chat-list .open';
document.addEventListener('pointerdown', e => {
  const b = e.target.closest(RIPPLE); if (!b || REDUCED) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
  const sp = document.createElement('span'); sp.className = 'ripple';
  sp.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.appendChild(sp); setTimeout(() => sp.remove(), 600);
}, { passive: true });
function stagger(els) { [...els].forEach((el, i) => el.style.setProperty('--i', i)); }
let confettiBits = [], confettiOn = false;
function confetti(x = innerWidth / 2, y = innerHeight / 2, count = 70) {
  if (REDUCED) return;
  const cv = $('#confetti'), ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let i = 0; i < count; i++) {
    const a = rnd(-Math.PI, 0), v = rnd(4, 11);
    confettiBits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, s: rnd(5, 10), r: rnd(0, 6), vr: rnd(-0.3, 0.3), c: PALETTE[i % PALETTE.length], life: rnd(60, 100), shape: i % 3 });
  }
  if (confettiOn) return; confettiOn = true;
  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    confettiBits = confettiBits.filter(p => p.life-- > 0);
    for (const p of confettiBits) {
      p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillStyle = p.c;
      if (p.shape === 0) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.6, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0, -p.s / 2); ctx.lineTo(p.s / 2, p.s / 2); ctx.lineTo(-p.s / 2, p.s / 2); ctx.fill(); }
      ctx.restore();
    }
    if (confettiBits.length) requestAnimationFrame(tick); else { confettiOn = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  };
  requestAnimationFrame(tick);
}
function confettiFrom(el) { const r = el.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + Math.min(r.height / 2, 160)); }

/* ---------------- router ---------------- */
const modules = {};
let current = null;
function loadModule(name) {
  if (name === 'studio3d' && !modules.studio3d) {
    modules.studio3d = import('./studio3d.js').then(m => m.init(api)).catch(err => {
      console.error(err); $('#stageLoading').textContent = '3D Studio needs internet to load. Try again later.'; delete modules.studio3d; throw err;
    });
  }
  if (name === 'music' && !modules.music) modules.music = import('./music.js').then(m => m.init(api));
  return modules[name] || Promise.resolve(null);
}
async function go(view) {
  if (!$('#view-' + view)) view = 'chat';
  const order = ['chat', 'code', 'studio3d', 'music', 'test', 'phone', 'me'];
  if (current && current !== view) $('.views').dataset.dir = order.indexOf(view) > order.indexOf(current) ? 'right' : 'left';
  current = view;
  $('.mode-switch').dataset.on = view === 'chat' || view === 'code' ? view : 'none';
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + view));
  $$('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === view));
  try { history.replaceState(null, '', '#' + view); } catch {}
  Avatar.poke();
  if (view === 'test') renderDevices();
  if (view === 'studio3d' || view === 'music') { const m = await loadModule(view); m?.onShow?.(); return m; }
  return null;
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

/* ---------------- CHAT ---------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const titleOf = msgs => { const u = msgs.find(m => m.role === 'user'); return u ? String(u.content || '📷 Picture').replace(/\s+/g, ' ').slice(0, 40) : 'New chat'; };
let chats = store.get('chats', null);
if (!Array.isArray(chats)) {
  const old = store.get('chat', []);
  chats = old.length ? [{ id: uid(), title: titleOf(old), updated: Date.now(), messages: old }] : [];
  store.del('chat');
}
let currentId = store.get('currentChat', null);
if (!chats.some(c => c.id === currentId)) currentId = chats[0]?.id || null;
const curChat = () => chats.find(c => c.id === currentId) || null;
const curMsgs = () => curChat()?.messages || [];
function saveChats() {
  chats.sort((a, b) => b.updated - a.updated); chats = chats.slice(0, 40);
  store.set('currentChat', currentId);
  try { localStorage.setItem('shobot.chats', JSON.stringify(chats)); }
  catch { // storage full: keep pictures only in the newest chat
    chats.slice(1).forEach(c => c.messages.forEach(m => delete m.images)); store.set('chats', chats);
  }
}
const msgsEl = $('#messages'), scrollEl = $('#chatScroll'), input = $('#chatInput');
const nearBottom = () => scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 140;
const toBottom = (force) => { if (force || nearBottom()) scrollEl.scrollTop = scrollEl.scrollHeight; };

function addMsg(role, content, images) {
  const row = document.createElement('div'); row.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
  const b = document.createElement('div'); b.className = 'bubble';
  b.innerHTML = (images && images.length ? `<div class="pics">${images.map(src => `<img alt="Picture" src="${esc(src)}">`).join('')}</div>` : '') + md(content);
  row.appendChild(b); msgsEl.appendChild(row);
  showHero(false); toBottom(true);
  return b;
}
function showHero(on) { $('#chatHero').hidden = !on; $('#chatBuddy').hidden = on; }
function renderChat() {
  msgsEl.innerHTML = ''; msgsEl.classList.add('instant');
  requestAnimationFrame(() => requestAnimationFrame(() => msgsEl.classList.remove('instant')));
  const msgs = curMsgs();
  showHero(!msgs.length);
  msgs.forEach(m => addMsg(m.card ? 'bot' : m.role, m.role === 'assistant' && !m.card ? stripActions(m.content).text : m.content, m.images));
  $('#chatTitle').textContent = curChat()?.title || 'New chat';
  renderChatList();
}
function remember(role, content, extra = {}, chatId = currentId) {
  let c = chats.find(x => x.id === chatId);
  if (!c) { c = { id: uid(), title: 'New chat', updated: Date.now(), messages: [] }; chats.unshift(c); if (chatId === currentId) currentId = c.id; }
  c.messages.push({ role, content, ...extra });
  if (c.messages.length > 80) c.messages.splice(0, c.messages.length - 80);
  c.updated = Date.now();
  if (c.title === 'New chat' && role === 'user') c.title = titleOf(c.messages);
  saveChats();
  if (c.id === currentId) $('#chatTitle').textContent = c.title;
  renderChatList();
}

/* ---- chats: new, open, delete ---- */
function when(ts) {
  const d = new Date(ts), now = new Date();
  return d.toDateString() === now.toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
function renderChatList() {
  const ul = $('#chatList');
  if (!chats.length) { ul.innerHTML = '<li class="empty">No chats yet. Say hi to Shobot!</li>'; return; }
  requestAnimationFrame(() => stagger(ul.children));
  ul.innerHTML = chats.map(c => `<li class="${c.id === currentId ? 'on' : ''}" data-id="${c.id}"><button type="button" class="open"><b>${esc(c.title)}</b><small>${when(c.updated)} · ${c.messages.length} messages</small></button><button type="button" class="del" aria-label="Delete ${esc(c.title)}">🗑</button></li>`).join('');
}
function openDrawer() { renderChatList(); $('#chatDrawer').hidden = false; }
function closeDrawer() { $('#chatDrawer').hidden = true; }
function newChat() {
  closeDrawer(); stopTalk?.();
  if (!curMsgs().length) { input.focus(); return; }
  currentId = null; store.set('currentChat', null);
  attachments.length = 0; renderTray();
  renderChat(); go('chat'); Avatar.play('teleport', 1700); confetti(innerWidth / 2, 140, 40); input.focus();
}
function openChat(id) { currentId = id; store.set('currentChat', id); closeDrawer(); renderChat(); go('chat'); }
function deleteChat(id) {
  chats = chats.filter(c => c.id !== id);
  if (id === currentId) currentId = chats[0]?.id || null;
  saveChats(); renderChat(); toast('Chat deleted 🗑');
}
$('#chatsBtn').addEventListener('click', openDrawer);
$('#drawerClose').addEventListener('click', closeDrawer);
$('#chatDrawer').addEventListener('click', e => { if (e.target.id === 'chatDrawer') closeDrawer(); });
$('#newChatBtn').addEventListener('click', newChat);
$('#drawerNew').addEventListener('click', newChat);
$('#chatList').addEventListener('click', e => {
  const li = e.target.closest('li[data-id]'); if (!li) return;
  if (e.target.closest('.open')) return openChat(li.dataset.id);
  const del = e.target.closest('.del'); if (!del) return;
  if (del.classList.contains('armed')) return deleteChat(li.dataset.id);
  del.classList.add('armed'); del.textContent = 'Delete?';
  setTimeout(() => { if (del.isConnected) { del.classList.remove('armed'); del.textContent = '🗑'; } }, 3000);
});

/* ---- pictures: attach from photos or camera ---- */
const attachments = [];
async function prepImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const draw = max => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c;
    };
    const blob = await new Promise(r => draw(1280).toBlob(r, 'image/jpeg', 0.85));
    return { blob, thumb: draw(360).toDataURL('image/jpeg', 0.7) };
  } finally { URL.revokeObjectURL(url); }
}
async function addAttachments(fileList) {
  for (const f of [...fileList].slice(0, 4 - attachments.length)) {
    if (!f.type.startsWith('image/')) continue;
    try { attachments.push(await prepImage(f)); } catch { toast("That picture can't be opened. Try a JPG or PNG."); }
  }
  if (fileList.length > 4) toast('Up to 4 pictures at a time.');
  renderTray();
}
function renderTray() {
  const t = $('#attachTray'); t.hidden = !attachments.length;
  t.innerHTML = attachments.map((a, i) => `<div class="thumb"><img alt="Picture ${i + 1}" src="${a.thumb}"><button type="button" data-i="${i}" aria-label="Remove picture">×</button></div>`).join('');
}
$('#attachTray').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) { attachments.splice(+b.dataset.i, 1); renderTray(); } });
$('#attachBtn').addEventListener('click', () => { $('#attachMenu').hidden = !$('#attachMenu').hidden; });
$('#attachPhotos').addEventListener('click', () => { $('#attachMenu').hidden = true; $('#picInput').click(); });
let camTarget = 'tray';
function openCameraInput(target) { camTarget = target; const i = $('#camInput'); i.value = ''; i.click(); }
$('#attachCamera').addEventListener('click', () => {
  $('#attachMenu').hidden = true;
  askPermission('camera', 'To take a photo for Shobot to look at.', () => openCameraInput('tray'));
});
$('#picInput').addEventListener('change', e => { addAttachments(e.target.files); e.target.value = ''; input.focus(); });
$('#camInput').addEventListener('change', async e => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
  if (camTarget === 'phone') {
    const { thumb } = await prepImage(files[0]).catch(() => ({}));
    info(thumb ? `<img class="photo-out" alt="Photo" src="${thumb}"><br>📸 Nice photo!` : "That photo can't be opened.");
    return;
  }
  await addAttachments(files);
  if (camTarget === 'chat') sendChat('📷 Here is my photo. What do you see?');
  else toast('Photo added. Ask Shobot about it! 📷');
});

function stripActions(text) {
  const actions = [];
  const t = text.replace(/\[\[action:([a-z0-9_]+)(?:\|([^\]]*))?\]\]/gi, (_, a, arg) => { actions.push({ a: a.toLowerCase(), arg: (arg || '').trim() }); return ''; })
    .replace(/\[\[action:[^\]]*$/i, '').trim();
  return { text: t, actions };
}

/* ---- live work card ---- */
function workCard(kind, title) {
  const row = document.createElement('div'); row.className = 'msg bot';
  row.innerHTML = `<div class="bubble wide"><div class="work">
    <div class="work-head"><span class="live-dot"></span><span class="tag">LIVE</span><span>Shobot's screen · ${esc(kind)}</span><span class="work-status">Starting…</span></div>
    <div class="work-screen"><div class="facecam"><div class="shobot"></div></div></div>
    <div class="work-progress"><i></i></div>
    <div class="work-note"></div>
    <div class="work-foot"></div></div></div>`;
  msgsEl.appendChild(row); showHero(false); toBottom(true);
  const w = row.querySelector('.work');
  Avatar.mount(row.querySelector('.facecam .shobot'));
  const card = {
    row, el: w, screen: w.querySelector('.work-screen'), foot: w.querySelector('.work-foot'), note: w.querySelector('.work-note'),
    status(t) { w.querySelector('.work-status').textContent = t; },
    progress(f) { w.querySelector('.work-progress i').style.width = Math.max(3, Math.min(100, f * 100)) + '%'; },
    done(t) { w.classList.add('done'); w.querySelector('.tag').textContent = 'DONE'; if (t) card.status(t); if (row.isConnected) confettiFrom(w); },
    fail(t) { w.classList.add('done'); w.querySelector('.tag').textContent = 'STOPPED'; card.status(t); },
    button(label, fn, ghost = true) { const b = document.createElement('button'); b.className = 'btn' + (ghost ? ' ghost' : ''); b.textContent = label; b.onclick = fn; b.style.setProperty('--i', card.foot.children.length); card.foot.appendChild(b); return b; },
  };
  return card;
}
function stopButton(card, ctl) {
  const b = card.button('■ Stop', () => ctl.abort());
  return () => b.remove();
}

async function chatBuild3d(desc) {
  const cid = currentId;
  desc = desc || 'a cute robot';
  const detail = /super|ultra|very detail|ละเอียดมาก|เยอะ/i.test(desc) ? 'super' : /simple|easy|ง่าย/i.test(desc) ? 'simple' : 'detailed';
  const card = workCard('3D build', desc);
  card.status('Getting my tools…');
  Avatar.startJob('building');
  const ctl = new AbortController(); const unStop = stopButton(card, ctl);
  let screen, parts = [], planned = 0;
  try {
    const { createLiveScreen } = await import('./livescreen.js');
    screen = createLiveScreen(card.screen);
    card.status('Planning the model…');
    const res = await gen3d(desc, detail, {
      signal: ctl.signal,
      onTitle: t => { planned = +t.parts || 0; card.status(`Building “${t.title}”…`); },
      onPart: d => {
        parts.push(d); screen.add(d);
        card.status(`Part ${parts.length}${planned ? ' / ~' + planned : ''}${d.n ? ' · ' + d.n : ''}`);
        if (planned) card.progress(parts.length / planned);
      },
    });
    screen.done(); unStop();
    card.done(`Finished “${res.title}” · ${parts.length} parts`);
    remember('assistant', `🧱 I built **${res.title}** with ${parts.length} parts!`, { card: '3d' }, cid);
    store.set('lastBuild', parts);
    card.button('Open in 3D Studio', async () => { const m = await go('studio3d'); m?.load(parts); }, false);
    card.button('Save .GLB', async () => {
      const { THREE, makeMesh } = await import('./model3d.js');
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      const g = new THREE.Group(); parts.forEach(p => g.add(makeMesh(p)));
      new GLTFExporter().parse(g, r => download('shobot-model.glb', new Blob([r], { type: 'model/gltf-binary' })), () => toast('Export failed'), { binary: true });
    });
    Avatar.endJob(); beep('ok');
  } catch (e) {
    console.warn(e); unStop();
    if (parts.length) { screen?.done(); card.fail(`Stopped at ${parts.length} parts`); card.button('Open in 3D Studio', async () => { const m = await go('studio3d'); m?.load(parts); }, false); }
    else { card.fail(e.code ? aiErrorText(e) : "I couldn't load my 3D tools. Check the internet and try again."); screen?.destroy(); }
    Avatar.endJob(false); if (e.code !== 'cancelled') Avatar.play('surprised', 1400);
  }
  toBottom();
}

async function chatCode(request) {
  const cid = currentId;
  request = request || 'a fun mini game';
  const card = workCard('coding', request);
  card.screen.classList.add('code');
  const pre = document.createElement('pre'); pre.className = 'live-code'; card.screen.prepend(pre);
  card.status('Opening my laptop…');
  Avatar.startJob('coding');
  const ctl = new AbortController(); const unStop = stopButton(card, ctl);
  let lines = 0;
  try {
    const { html, note, fixed, remaining } = await genTestedCode(request, {
      signal: ctl.signal,
      onStatus: t => card.status(t),
      onCode: code => {
        const all = code.split('\n'); lines = all.length;
        pre.innerHTML = esc(all.slice(-22).join('\n')) + '<span class="cursor"></span>';
        card.status(`Typing line ${lines}…`); card.progress(Math.min(0.95, lines / 300));
      },
    });
    unStop();
    files = { html, css: '', js: '' }; loadFile('html'); run();
    pre.remove();
    const fr = document.createElement('iframe'); fr.title = 'Preview'; fr.setAttribute('sandbox', 'allow-scripts allow-forms');
    fr.srcdoc = buildDoc(); card.screen.prepend(fr);
    card.note.textContent = '🤖 ' + note.slice(0, 300) + (fixed ? `\n🔧 I found and fixed ${fixed.length} bug${fixed.length > 1 ? 's' : ''} by myself.` : '') + (remaining?.length ? '\n⚠️ There may still be a small bug. Ask me to fix it!' : '\n✅ Tested: no errors.');
    card.done(`Done · ${html.split('\n').length} lines of code`);
    remember('assistant', `⌨️ I coded **${request}**! ${note.slice(0, 200)}`, { card: 'code' }, cid);
    card.button('Open in Code', () => go('code'), false);
    card.button('Test on devices', () => { $('#testSrc').value = 'code'; go('test'); });
    card.button('Save file', () => download('shobot-project.html', new Blob([buildDoc()], { type: 'text/html' })));
    Avatar.endJob(); beep('ok');
  } catch (e) {
    console.warn(e); unStop(); card.fail(aiErrorText(e));
    Avatar.endJob(false); if (e.code !== 'cancelled') Avatar.play('surprised', 1400);
  }
  toBottom();
}

async function chatBeat(desc) {
  const cid = currentId;
  desc = desc || 'a happy dance beat';
  const card = workCard('music', desc);
  card.status('Putting on my headphones…');
  Avatar.startJob('djing');
  const grid = document.createElement('div'); grid.className = 'beat'; card.screen.prepend(grid);
  try {
    const m = await loadModule('music');
    let chars = 0;
    const res = await m.make(desc, { quiet: true, autoplay: false, onText: ({ text }) => { chars = text.length; card.status('Writing notes…'); card.progress(Math.min(0.9, chars / 900)); } });
    const rows = [...m.DRUMS.map(d => ({ c: d.c, on: i => !!res.song.drums[d.id][i] })), ...m.NOTES.map((n, ni) => ({ c: '#ffd21f', on: i => res.song.melody[i] === ni }))];
    grid.style.gridTemplateRows = `repeat(${rows.length},1fr)`;
    grid.innerHTML = rows.map(r => Array.from({ length: 16 }, (_, i) => `<i class="${r.on(i) ? 'on' : ''}" style="--c:${r.c}"></i>`).join('')).join('');
    const cells = [...grid.children];
    const off = m.onStep(s => cells.forEach((c, i) => c.classList.toggle('now', i % 16 === s)));
    card.done(`“${res.title}” · ${res.song.bpm} BPM`);
    remember('assistant', `🎧 I made a beat: **${res.title}**!`, { card: 'music' }, cid);
    const playBtn = card.button('▶ Play', () => m.toggle(), false);
    m.onState(p => (playBtn.textContent = p ? '⏹ Stop' : '▶ Play'));
    card.button('Open in Music', () => go('music'));
    Avatar.endJob(); m.toggle();
    void off;
  } catch (e) {
    console.warn(e); card.fail(aiErrorText(e)); grid.remove();
    Avatar.endJob(false); Avatar.play('surprised', 1400);
  }
  toBottom();
}

/* ---- Team mode: 3 to 10 helper agents work at the same time ---- */
const ROLE_EMOJI = { researcher: '🔎', writer: '✍️', coder: '💻', designer: '🎨', builder3d: '🧱', musician: '🎵', teacher: '🧑‍🏫', mathematician: '➗', storyteller: '📖', gamer: '🎮', scientist: '🔬', critic: '🧐', planner: '🗺️', artist: '🖌️', checker: '✅' };
const ROLE_ANIM = { coder: 'coding', builder3d: 'building', designer: 'building', artist: 'building', musician: 'djing' };
const TEAM_HUES = [0, 150, 200, 265, 320, 35, 95, 175, 235, 290];
const DEFAULT_ROLES = ['researcher', 'writer', 'teacher', 'designer', 'critic', 'scientist', 'storyteller', 'mathematician', 'coder', 'gamer'];
const BOT_NAMES = ['Zip', 'Bolt', 'Pixel', 'Nova', 'Gizmo', 'Sprocket', 'Echo', 'Byte', 'Comet', 'Widget'];
function miniBot(el, hue) {
  el.appendChild($('#shobot-tpl').content.cloneNode(true));
  const svg = el.querySelector('svg'); svg.style.filter = `hue-rotate(${hue}deg)`;
  const set = st => svg.setAttribute('class', 'av ' + st); set('idle'); return set;
}
async function pool(items, limit, fn) {
  let next = 0;
  const worker = async () => { while (next < items.length) { const k = next++; await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
async function callRetry(mode, msgs, opts = {}, onWait) {
  for (let t = 0; ; t++) {
    try { return await callAI(mode, msgs, opts); }
    catch (e) {
      if (e.code === 'rate_limited' && t < 4 && !opts.signal?.aborted) {
        const sec = Math.min(60, e.retryAfter || 6 * (t + 1)); onWait?.(t, sec);
        await new Promise(r => setTimeout(r, sec * 1000)); continue;
      }
      throw e;
    }
  }
}
const plain = t => String(t).replace(/```[\s\S]*?```/g, ' [code] ').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();

async function chatTeam(task, size = 5, images) {
  task = (task || '').trim() || 'Help me with a big project';
  size = Math.max(3, Math.min(10, Math.round(+size) || 5));
  const cid = currentId, ctl = new AbortController();
  Avatar.startJob('thinking');
  const row = document.createElement('div'); row.className = 'msg bot';
  row.innerHTML = `<div class="bubble wide"><div class="work team">
    <div class="work-head"><span class="live-dot"></span><span class="tag">LIVE</span><span>👥 Shobot Team · ${size} agents</span><span class="work-status">Planning…</span></div>
    <div class="team-goal"><div class="shobot team-leader"></div><div class="team-goal-text"><b>Shobot, team leader</b><p>Splitting the job into ${size} parts…</p></div></div>
    <div class="team-grid"></div>
    <div class="team-check" hidden></div>
    <div class="work-progress"><i></i></div>
    <div class="work-foot"></div></div></div>`;
  msgsEl.appendChild(row); showHero(false); toBottom(true);
  const w = row.querySelector('.work'), grid = w.querySelector('.team-grid'), foot = w.querySelector('.work-foot');
  const status = t => (w.querySelector('.work-status').textContent = t);
  const progress = f => (w.querySelector('.work-progress i').style.width = Math.max(4, Math.min(100, f * 100)) + '%');
  Avatar.mount(w.querySelector('.team-leader'));
  const stop = document.createElement('button'); stop.className = 'btn ghost'; stop.textContent = '■ Stop the team'; stop.onclick = () => ctl.abort(); foot.appendChild(stop);
  const ctx = curMsgs().slice(-7, -1).map(m => `${m.role === 'user' ? userName() : 'Shobot'}: ${plain(m.content).slice(0, 400)}`).join('\n');
  progress(0.04);
  try {
    // 1. The leader plans the jobs
    let plan = null;
    try {
      const txt = await callRetry('plan', [{ role: 'user', content: `${ctx ? 'Recent chat, for context:\n' + ctx + '\n\n' : ''}TASK: ${task}\nNUMBER OF AGENTS: ${size}` }],
        { signal: ctl.signal, system: TEAM_PROMPTS.plan(size), images }, (t, sec) => status(`Brain is busy, waiting ${sec}s…`));
      plan = extractJSON(txt);
    } catch (e) { if (e.code === 'cancelled' || ctl.signal.aborted) throw e; if (e.code && e.code !== 'upstream_error' && e.code !== 'empty_completion') throw e; }
    const agents = (Array.isArray(plan?.agents) ? plan.agents : []).slice(0, size).map((a, i) => ({
      name: String(a.name || BOT_NAMES[i]).slice(0, 24), role: String(a.role || DEFAULT_ROLES[i]).toLowerCase().slice(0, 24), task: String(a.task || task).slice(0, 600),
    }));
    while (agents.length < size) { const i = agents.length; agents.push({ name: BOT_NAMES[i], role: DEFAULT_ROLES[i], task: `Help with this from the point of view of a ${DEFAULT_ROLES[i]}: ${task}` }); }
    const goal = String(plan?.goal || task).slice(0, 200);
    w.querySelector('.team-goal-text p').textContent = goal;
    status(`${size} agents are working…`); progress(0.1);

    // 2. Every agent works on its own job, a few at a time
    const tiles = agents.map((a, i) => {
      const t = document.createElement('div'); t.className = 'agent'; t.dataset.state = 'waiting';
      const hue = TEAM_HUES[i % TEAM_HUES.length];
      t.style.setProperty('--agent-c', `hsl(${(48 + hue) % 360} 95% 62%)`); t.style.setProperty('--i', i);
      a.emoji = ROLE_EMOJI[a.role] || '🤖';
      t.innerHTML = `<div class="agent-top"><div class="agent-bot"></div><div class="agent-info"><b>${a.emoji} ${esc(a.name)}</b><small>${esc(a.role)} · <span class="agent-state">waiting</span></small></div></div><div class="agent-task">${esc(a.task)}</div><div class="agent-out"></div>`;
      grid.appendChild(t);
      const setBot = miniBot(t.querySelector('.agent-bot'), hue);
      t.addEventListener('click', () => { t.classList.toggle('open'); if (t.classList.contains('open') && a.result) t.querySelector('.agent-out').innerHTML = md(a.result); else if (a.result) t.querySelector('.agent-out').textContent = plain(a.result).slice(0, 260); });
      return { el: t, setBot, setState: s => { t.dataset.state = s; t.querySelector('.agent-state').textContent = s; } };
    });
    toBottom();
    let finished = 0;
    await pool(agents, IN_CLAUDE ? 3 : 2, async (a, i) => {
      if (ctl.signal.aborted) return;
      const tile = tiles[i]; const out = tile.el.querySelector('.agent-out');
      tile.setState('working'); tile.setBot(ROLE_ANIM[a.role] || 'thinking');
      try {
        a.result = await callRetry('agent', [{ role: 'user', content: `TEAM GOAL: ${goal}\nWHAT ${userName().toUpperCase()} ASKED: ${task}\n\nYOUR JOB: ${a.task}` }], {
          signal: ctl.signal, system: TEAM_PROMPTS.agent(a, size),
          onText: ({ text }) => { if (!tile.el.classList.contains('open')) out.textContent = plain(text).slice(-260); },
        }, (t, sec) => tile.setState(`resting ${sec}s`));
        tile.setState('done'); tile.setBot('happy'); setTimeout(() => tile.setBot('idle'), 1800);
        if (!tile.el.classList.contains('open')) out.textContent = plain(a.result).slice(0, 260);
      } catch (e) {
        if (ctl.signal.aborted) { tile.setState('stopped'); tile.setBot('sleep'); return; }
        a.result = ''; tile.setState('had a problem'); tile.setBot('surprised'); out.textContent = aiErrorText(e);
      }
      finished++; status(`${finished} of ${size} agents done`); progress(0.1 + 0.65 * (finished / size));
    });
    if (ctl.signal.aborted) throw Object.assign(new Error('stopped'), { code: 'cancelled' });
    const good = agents.filter(a => a.result);
    if (!good.length) throw Object.assign(new Error('no results'), { code: 'empty_completion' });
    const work = agents.map(a => `### ${a.name} (${a.role})\nJob: ${a.task}\n\n${a.result || '(no result)'}`).join('\n\n');

    // 3. Checker reviews everything
    const check = w.querySelector('.team-check'); check.hidden = false;
    check.innerHTML = `<div class="agent-top"><div class="agent-bot"></div><div class="agent-info"><b>✅ Checker</b><small>quality control · <span class="agent-state">checking</span></small></div></div><div class="agent-out"></div>`;
    const setCheck = miniBot(check.querySelector('.agent-bot'), 120); setCheck('thinking');
    status('Checker is checking the work…'); toBottom();
    let review = '';
    try {
      review = await callRetry('review', [{ role: 'user', content: `The user asked: ${task}\nTeam goal: ${goal}\n\n${work}` }],
        { signal: ctl.signal, system: TEAM_PROMPTS.review(), onText: ({ text }) => (check.querySelector('.agent-out').innerHTML = md(text)) });
      check.querySelector('.agent-state').textContent = 'done'; setCheck('happy');
    } catch (e) { if (ctl.signal.aborted) throw e; check.querySelector('.agent-state').textContent = 'skipped'; setCheck('surprised'); }
    progress(0.85);

    // 4. The leader writes the final answer
    status('Shobot is putting it all together…'); Avatar.set('talking');
    const bubble = addMsg('bot', ''); bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    const finalText = await callRetry('final', [{ role: 'user', content: `${userName()} asked: ${task}\nTeam goal: ${goal}\n\n${work}\n\n### Checker's notes\n${review || '(no notes)'}` }], {
      signal: ctl.signal, system: TEAM_PROMPTS.final(), images,
      onText: ({ text }) => { bubble.classList.add('streaming'); bubble.innerHTML = md(stripActions(text).text || '…'); toBottom(); },
    });
    bubble.classList.remove('streaming');
    const { text: clean, actions } = stripActions(finalText);
    bubble.innerHTML = md(clean || '👍');
    stop.remove();
    w.classList.add('done'); w.querySelector('.tag').textContent = 'DONE'; progress(1);
    status(`Done · ${good.length} agents + Checker worked together`); confettiFrom(w);
    remember('assistant', `👥 **Team of ${size}** worked on: ${goal}\n${agents.map(a => `${a.emoji} ${a.name} (${a.role}): ${a.task}`).join('\n')}`, { card: 'team' }, cid);
    remember('assistant', finalText, {}, cid);
    Avatar.endJob(); beep('ok'); toBottom();
    speak(clean);
    for (const act of actions) runAction(act);
    return clean;
  } catch (e) {
    console.warn(e); stop.remove();
    w.classList.add('done'); w.querySelector('.tag').textContent = 'STOPPED';
    status(e.code === 'cancelled' || ctl.signal.aborted ? 'The team stopped.' : aiErrorText(e));
    Avatar.endJob(false); if (!ctl.signal.aborted) Avatar.play('surprised', 1400);
    return null;
  }
}

/* team size button: Off → 3 → 5 → 7 → 10 */
const TEAM_STEPS = [0, 3, 5, 7, 10];
function showTeamBtn() {
  const n = settings.team || 0;
  $('#teamSize').textContent = n ? `${n} agents` : 'Off';
  $('#teamBtn').setAttribute('aria-pressed', n ? 'true' : 'false');
  input.placeholder = n ? `Give your team of ${n} a big job…` : 'Message Shobot…';
}
$('#teamBtn').addEventListener('click', () => {
  const i = TEAM_STEPS.indexOf(settings.team || 0);
  settings.team = TEAM_STEPS[(i + 1) % TEAM_STEPS.length]; saveSettings(); showTeamBtn();
  if (settings.team) { toast(`👥 Team mode: ${settings.team} agents will work together`); Avatar.play('wave', 1500); }
});

const avatarMoves = ['dance', 'wave', 'happy', 'spin', 'sleep', 'surprised', 'thinking', 'teleport'];
async function runAction({ a, arg }) {
  if (avatarMoves.includes(a)) { Avatar.play(a, a === 'sleep' ? 5000 : 4000); return; }
  if (a === 'remember') {
    const fact = arg.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (fact && !memories.some(m => m.toLowerCase() === fact.toLowerCase())) { memories.push(fact); saveMemories(); toast('🧠 Shobot will remember: ' + fact); }
    return;
  }
  if (a === 'team') {
    const m = arg.match(/^(\d+)\s*\|\s*([\s\S]*)$/);
    return chatTeam(m ? m[2] : arg, m ? +m[1] : (settings.team || 5));
  }
  if (a === 'build3d') return chatBuild3d(arg);
  if (a === 'beat') return chatBeat(arg);
  if (a === 'code') return chatCode(arg);
  if (a === 'open') { go(arg); return; }
  const ab = abilities.find(x => x.id === a);
  if (ab) return useAbility(ab, { fromChat: true });
}

function localReply(text) {
  const t = text.toLowerCase();
  if (/dance/.test(t)) return 'Watch my moves! 🕺 [[action:dance]]';
  if (/\b(wave|hi|hello|hey)\b|สวัสดี/.test(t)) return `Hi ${userName()}! 👋 [[action:wave]]`;
  if (/sleep|tired/.test(t)) return 'Zzz… 😴 [[action:sleep]]';
  return null;
}

let chatBusy = false;
async function sendChat(text, { silent } = {}) {
  text = (text || '').trim();
  if (chatBusy || (!text && !attachments.length)) return null;
  const pics = attachments.splice(0); renderTray(); $('#attachMenu').hidden = true;
  if (!text) text = 'What do you see in this picture?';
  chatBusy = true; $('#sendBtn').disabled = true;
  beep('send'); input.value = ''; autosize();
  const sb = $('#sendBtn'); sb.classList.remove('fly'); void sb.offsetWidth; sb.classList.add('fly');
  $('#aiDot').classList.add('busy');
  remember('user', text, pics.length ? { images: pics.map(p => p.thumb) } : {}); addMsg('user', text, pics.map(p => p.thumb));
  if (settings.team) {
    $('#aiDot').classList.remove('busy');
    try { return await chatTeam(text, settings.team, pics.map(p => p.blob)); }
    finally { chatBusy = false; $('#sendBtn').disabled = false; }
  }
  const bubble = addMsg('bot', '');
  bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  if (!Avatar.jobs) Avatar.set('thinking');
  const msgs = curMsgs().slice(-20);
  const history = msgs.map((m, i) => ({ role: m.role, content: (m.images?.length && i < msgs.length - 1 ? `[${m.images.length} picture(s) were shared here earlier]\n` : '') + m.content }));
  let reply = '';
  try {
    reply = await callAI('chat', history, {
      images: pics.map(p => p.blob),
      onText: ({ text }) => { if (!Avatar.jobs) Avatar.set('talking'); bubble.classList.add('streaming'); bubble.innerHTML = md(stripActions(text).text || '…'); toBottom(); },
    });
  } catch (e) {
    console.warn(e);
    reply = (e.text && stripActions(e.text).text) || localReply(text) || aiErrorText(e);
  }
  bubble.classList.remove('streaming'); $('#aiDot').classList.remove('busy');
  const { text: clean, actions } = stripActions(reply);
  remember('assistant', reply);
  bubble.innerHTML = md(clean || '👍'); toBottom();
  beep('recv');
  chatBusy = false; $('#sendBtn').disabled = false;
  if (!Avatar.jobs && !silent) {
    if (!speak(clean)) { Avatar.set('idle'); if (!actions.length) Avatar.play('happy', 1200); }
  }
  for (const act of actions) runAction(act);
  return clean;
}

function autosize() { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px'; }
input.addEventListener('input', autosize);
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(input.value); } });
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat(input.value); });
$$('.chip').forEach(c => c.addEventListener('click', () => {
  const p = c.dataset.prompt, tgt = c.dataset.target;
  if (!tgt) return sendChat(p);
  remember('user', p); addMsg('user', p);
  if (tgt === '3d') chatBuild3d(p.replace(/^build (me )?/i, ''));
  else if (tgt === 'music') chatBeat(p);
  else if (tgt === 'code') chatCode(p);
}));

/* ---- talk mode: Shobot listens, answers out loud, then listens again ---- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let talking = false, rec = null, silentTries = 0;
function setTalkUI(t) { $('#talkBar').hidden = !talking; if (t) $('#talkText').textContent = t; $('#micBtn').classList.toggle('live', talking); }
async function startTalk() {
  if (IN_CLAUDE || !SR) {
    $('#voiceTip').hidden = false;
    $('#voiceTip .muted').hidden = !IN_CLAUDE;
    return;
  }
  if (!(await askPermission('microphone', 'So Shobot can hear what you say and talk back.'))) return;
  talking = true; silentTries = 0; setTalkUI('Listening… say something!'); listen();
}
function stopTalk() {
  if (!talking) return;
  talking = false; try { rec?.abort(); } catch {} rec = null;
  try { speechSynthesis.cancel(); } catch {}
  setTalkUI(); if (!Avatar.jobs) Avatar.set('idle');
}
function listen() {
  if (!talking) return;
  rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.continuous = false;
  let finalText = '';
  if (!Avatar.jobs) Avatar.set('listening');
  setTalkUI('Listening… 👂');
  rec.onresult = e => {
    const t = [...e.results].map(r => r[0].transcript).join('');
    setTalkUI('“' + t + '”');
    if (e.results[e.results.length - 1].isFinal) finalText = t;
  };
  rec.onerror = e => { if (['not-allowed', 'service-not-allowed'].includes(e.error)) { toast('The browser blocked the microphone.'); stopTalk(); } };
  rec.onend = async () => {
    rec = null; if (!talking) return;
    if (!finalText.trim()) {
      if (++silentTries >= 3) { stopTalk(); toast('Tap 🎙️ when you want to talk again.'); return; }
      setTimeout(listen, 250); return;
    }
    silentTries = 0; setTalkUI('Shobot is thinking… 🤔');
    const reply = await sendChat(finalText, { silent: true });
    if (!talking) return;
    setTalkUI('Shobot is talking… 🔊');
    await new Promise(r => { if (!reply || !speak(reply, true, r)) r(); });
    setTimeout(listen, 250);
  };
  try { rec.start(); } catch { setTimeout(listen, 600); }
}
$('#micBtn').addEventListener('click', () => (talking ? stopTalk() : startTalk()));
$('#talkStop').addEventListener('click', stopTalk);
$('#voiceTipOk').addEventListener('click', () => { $('#voiceTip').hidden = true; input.focus(); });

/* ---------------- CODE ---------------- */
const TEMPLATES = {
  hello: { html: '<h1>Hello from Shobot! 🤖</h1>\n<p>Edit me and press Run.</p>\n<button id="b">Click me</button>\n<p id="out"></p>', css: 'body{font-family:system-ui;background:#2c1860;color:#fff;display:grid;place-items:center;align-content:center;min-height:100vh;margin:0;text-align:center}\nbutton{font-size:20px;padding:12px 24px;border:0;border-radius:14px;background:#ffd21f}', js: "let n = 0;\ndocument.getElementById('b').onclick = () => { n++; document.getElementById('out').textContent = 'Beep boop x' + n + ' 🤖'; };" },
  game: { html: '<h1>Score: <span id="s">0</span></h1>\n<div id="t">🎯</div>', css: 'body{margin:0;height:100vh;background:#19e3a0;font-family:system-ui;overflow:hidden}\nh1{text-align:center}\n#t{position:absolute;font-size:60px;cursor:pointer;user-select:none;transition:all .2s}', js: "let s=0;const t=document.getElementById('t');\nfunction move(){t.style.left=Math.random()*(innerWidth-70)+'px';t.style.top=60+Math.random()*(innerHeight-140)+'px'}\nt.onclick=()=>{s++;document.getElementById('s').textContent=s;move()};\nmove();setInterval(move,1200);" },
  clock: { html: '<div id="c"></div>', css: 'body{margin:0;height:100vh;display:grid;place-items:center;background:#0b0418}\n#c{font:700 18vw monospace;color:#e21fd8;text-shadow:0 0 20px #e21fd8,0 0 60px #6c3cf0}', js: "const c=document.getElementById('c');\nsetInterval(()=>c.textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}),250);" },
  todo: { html: '<h2>My to-do list</h2>\n<form id="f"><input id="i" placeholder="New task"><button>Add</button></form>\n<ul id="l"></ul>', css: 'body{font-family:system-ui;max-width:420px;margin:30px auto;padding:0 16px}\ninput{padding:10px;width:65%}\nbutton{padding:10px}\nli{padding:8px;cursor:pointer}\nli.done{text-decoration:line-through;opacity:.5}', js: "f.onsubmit=e=>{e.preventDefault();if(!i.value)return;const li=document.createElement('li');li.textContent=i.value;li.onclick=()=>li.classList.toggle('done');l.appendChild(li);i.value=''};" },
};
let files = store.get('code', TEMPLATES.hello);
let curFile = 'html';
const editor = $('#editor'), gutter = $('#gutter'), preview = $('#preview');
let codeHistory = [];

function buildDoc() {
  let h = files.html || '';
  const css = files.css ? `<style>\n${files.css}\n</style>` : '';
  const js = files.js ? `<script>\n${files.js}\n<\/script>` : '';
  if (/<html[\s>]/i.test(h) || /<!doctype/i.test(h)) {
    if (css) h = /<\/head>/i.test(h) ? h.replace(/<\/head>/i, css + '\n</head>') : css + h;
    if (js) h = /<\/body>/i.test(h) ? h.replace(/<\/body>(?![\s\S]*<\/body>)/i, js + '\n</body>') : h + js;
    return h;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css}</head><body>\n${h}\n${js}</body></html>`;
}
function loadFile(f) {
  curFile = f; editor.value = files[f] || '';
  $$('#fileTabs button').forEach(b => b.classList.toggle('on', b.dataset.file === f));
  updateGutter();
}
function updateGutter() {
  const n = editor.value.split('\n').length;
  gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
  gutter.scrollTop = editor.scrollTop;
}
function run() { preview.srcdoc = buildDoc(); store.set('code', files); }
let runT;
editor.addEventListener('input', () => { files[curFile] = editor.value; updateGutter(); clearTimeout(runT); runT = setTimeout(run, 700); });
editor.addEventListener('scroll', () => (gutter.scrollTop = editor.scrollTop));
editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault(); const s = editor.selectionStart; editor.setRangeText('  ', s, editor.selectionEnd, 'end'); editor.dispatchEvent(new Event('input')); }
});
$$('#fileTabs button').forEach(b => b.addEventListener('click', () => loadFile(b.dataset.file)));
function showPane(p) {
  $('#codePanes').dataset.pane = p;
  $$('#codePaneToggle button').forEach(x => x.classList.toggle('on', x.dataset.pane === p));
  if (p === 'preview') run();
}
$$('#codePaneToggle button').forEach(b => b.addEventListener('click', () => showPane(b.dataset.pane)));
showPane('editor');
$('#runBtn').addEventListener('click', () => { run(); Avatar.play('happy', 1200); if (innerWidth < 900) showPane('preview'); });
$('#dlCodeBtn').addEventListener('click', () => download('shobot-project.html', new Blob([buildDoc()], { type: 'text/html' })));
$('#toTestBtn').addEventListener('click', () => { $('#testSrc').value = 'code'; go('test'); });
$('#templateSel').addEventListener('change', e => {
  const t = TEMPLATES[e.target.value]; if (!t) return;
  files = { ...t }; loadFile('html'); run(); e.target.value = ''; toast('Template loaded ✨');
});

function codeLog(text, me) {
  const d = document.createElement('div'); d.className = 'cl' + (me ? ' me' : ''); d.textContent = text;
  $('#codeLog').appendChild(d); $('#codeLog').scrollTop = 1e6; return d;
}
let codeCtl = null;
async function codeAsk(text) {
  text = (text || '').trim(); if (!text || codeCtl) return;
  codeLog(text, true); const wait = codeLog('Shobot is coding… ⌨️');
  Avatar.startJob('coding'); $('#codeInput').value = '';
  codeCtl = new AbortController(); $('#codeSend').textContent = '■';
  showPane('editor'); loadFile('html');
  try {
    const { html, note, fixed, remaining } = await genTestedCode(text, {
      signal: codeCtl.signal,
      onStatus: t => (wait.textContent = t),
      onCode: code => { editor.value = code; updateGutter(); editor.scrollTop = editor.scrollHeight; wait.textContent = `Shobot is typing… line ${code.split('\n').length}`; },
    });
    files = { html, css: '', js: '' }; loadFile('html'); run();
    wait.textContent = '🤖 ' + note.slice(0, 400) + (fixed ? ` 🔧 Fixed ${fixed.length} bug${fixed.length > 1 ? 's' : ''} by myself.` : '') + (remaining?.length ? ' ⚠️ Maybe one bug left: ' + remaining[0] : ' ✅ Tested: no errors.');
    Avatar.endJob(); beep('ok');
    if (innerWidth < 900) showPane('preview');
  } catch (e) {
    console.warn(e); wait.textContent = '🤖 ' + aiErrorText(e); loadFile('html');
    Avatar.endJob(false); Avatar.play('surprised', 1200);
  } finally { codeCtl = null; $('#codeSend').textContent = '➤'; }
}
$('#codeForm').addEventListener('submit', e => { e.preventDefault(); if (codeCtl) codeCtl.abort(); else codeAsk($('#codeInput').value); });

/* ---------------- TEST LAB ---------------- */
const DEVICES = {
  phone: { label: 'Phone (390×844)', w: 390, h: 844, fr: 46, fp: 12, cls: 'phone' },
  ipad: { label: 'iPad (820×1180)', w: 820, h: 1180, fr: 34, fp: 18, cls: 'ipad' },
  computer: { label: 'Computer (1440×900)', w: 1440, h: 900, fr: 14, fp: 10, cls: 'computer' },
};
let devSel = 'phone', rotated = false;
function renderDevices() {
  const box = $('#devices'); if (current !== 'test') return;
  const list = devSel === 'all' ? ['phone', 'ipad', 'computer'] : [devSel];
  const availW = Math.max(260, box.clientWidth - 32);
  const availH = Math.max(320, innerHeight - 260);
  box.innerHTML = '';
  const dims = list.map(k => (rotated && k !== 'computer') ? [DEVICES[k].h, DEVICES[k].w] : [DEVICES[k].w, DEVICES[k].h]);
  const commonScale = Math.min(1, (availW - 60 - list.length * 40) / dims.reduce((a, d) => a + d[0], 0), (availH - 40) / Math.max(...dims.map(d => d[1])));
  const src = $('#testSrc').value, url = $('#testUrl').value.trim();
  list.forEach(k => {
    const d = DEVICES[k];
    let w = d.w, h = d.h;
    if (rotated && k !== 'computer') [w, h] = [h, w];
    const s = devSel === 'all' && innerWidth >= 900 ? commonScale : Math.min(1, (availW - d.fp * 2) / w, (availH - d.fp * 2) / h);
    const wrap = document.createElement('div'); wrap.className = 'device';
    wrap.innerHTML = `<div class="frame ${d.cls}" style="--fr:${Math.max(10, d.fr * s * 1.6)}px;--fp:${d.fp}px"><div class="screen" style="width:${w * s}px;height:${h * s}px"><iframe title="${d.label}" style="width:${w}px;height:${h}px;transform:scale(${s})"></iframe></div></div><div class="device-label">${d.label}${rotated && k !== 'computer' ? ' · sideways' : ''} · ${Math.round(s * 100)}%</div>`;
    const fr = wrap.querySelector('iframe');
    if (src === 'url' && url && !IN_CLAUDE) { fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups'); fr.src = /^https?:\/\//.test(url) ? url : 'https://' + url; }
    else { fr.setAttribute('sandbox', 'allow-scripts allow-forms'); fr.srcdoc = buildDoc(); }
    wrap.style.setProperty('--i', box.children.length);
    box.appendChild(wrap);
  });
}
$$('#deviceSeg button').forEach(b => b.addEventListener('click', () => {
  devSel = b.dataset.dev; $$('#deviceSeg button').forEach(x => x.classList.toggle('on', x === b)); renderDevices();
}));
$('#rotateBtn').addEventListener('click', () => { rotated = !rotated; renderDevices(); });
$('#reloadTestBtn').addEventListener('click', renderDevices);
$('#urlForm').addEventListener('submit', e => { e.preventDefault(); if ($('#testUrl').value.trim() && !IN_CLAUDE) $('#testSrc').value = 'url'; renderDevices(); });
$('#testSrc').addEventListener('change', renderDevices);
if (IN_CLAUDE) { $('#testSrc option[value=url]').disabled = true; $('#testUrl').placeholder = 'Website links work on the Vercel version of Shobot'; $('#testUrl').disabled = true; }
let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(renderDevices, 200); });

/* ---------------- PHONE CONTROL ---------------- */
const phoneInfo = $('#phoneInfo'), camVideo = $('#camVideo'), camShot = $('#camShot'), micMeter = $('#micMeter');
let camStream = null, micStream = null, torchStream = null, wakeLock = null, motionOn = false;
let sink = null; // a chat card that also shows the result
function info(html) { phoneInfo.innerHTML = html; if (sink) sink.innerHTML = html; }
function stopCam() { camStream?.getTracks().forEach(t => t.stop()); camStream = null; camVideo.classList.remove('show'); }
function stopMic() { micStream?.getTracks().forEach(t => t.stop()); micStream = null; micMeter.classList.remove('show'); }
function stopTorch() { torchStream?.getTracks().forEach(t => t.stop()); torchStream = null; }
const nope = msg => { info('😕 ' + msg); Avatar.play('surprised', 1400); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const NEEDS_SITE = 'This works when Shobot runs on its own website (the Vercel version).';

const abilities = [
  { id: 'camera', icon: '📷', name: 'Camera', why: 'To take a photo.', sync: ({ fromChat }) => { if (IN_CLAUDE || fromChat) openCameraInput(fromChat ? 'chat' : 'phone'); }, async run({ fromChat }) {
    if (IN_CLAUDE || fromChat) { info('📷 Camera open. Take a photo!'); return; }
    if (false) { // (old in-page snapshot kept for reference)
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = s; await v.play(); await wait(700);
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
      s.getTracks().forEach(t => t.stop());
      info(`<img class="photo-out" alt="Photo" src="${c.toDataURL('image/jpeg', 0.85)}"><br>📸 Snap!`); return;
    }
    if (camStream) {
      camShot.width = camVideo.videoWidth; camShot.height = camVideo.videoHeight;
      camShot.getContext('2d').drawImage(camVideo, 0, 0); camShot.classList.add('show');
      camShot.toBlob(b => b && download('shobot-photo.png', b)); stopCam(); info('📸 Photo taken!'); return;
    }
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    camVideo.srcObject = camStream; camVideo.classList.add('show'); await camVideo.play(); camShot.classList.remove('show');
    info('Camera on. Tap <b>Camera</b> again to snap a photo.');
  } },
  { id: 'mic', icon: '🎤', name: 'Microphone', why: 'To hear how loud it is around you.', site: true, async run({ fromChat }) {
    if (micStream) { stopMic(); info('Microphone off.'); return; }
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = audioCtx(), src = ac.createMediaStreamSource(micStream), an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize); micMeter.classList.add('show'); let peak = 0;
    const tick = () => { if (!micStream) return; an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); peak = Math.max(peak, m); micMeter.firstElementChild.style.width = Math.min(100, m * 1.2) + '%'; requestAnimationFrame(tick); };
    tick();
    if (fromChat) { info('Listening for 4 seconds… 👂'); await wait(4000); stopMic(); info(`I heard you! Loudness: <b>${Math.min(100, Math.round(peak * 1.2))}/100</b> ${peak > 60 ? '📢 So loud!' : peak > 20 ? '🙂 Nice and clear' : '🤫 Very quiet'}`); return; }
    info('Listening… make some noise! Tap <b>Microphone</b> again to stop.');
  } },
  { id: 'location', icon: '📍', name: 'Location', why: 'To find where you are on the map.', site: true, run() {
    return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(p => {
      const { latitude: a, longitude: o, accuracy } = p.coords;
      info(`You are at <b>${a.toFixed(4)}, ${o.toFixed(4)}</b> (±${Math.round(accuracy)} m)<br><a style="color:#ffd21f" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${a}&mlon=${o}#map=16/${a}/${o}">Open map</a>`); res();
    }, rej, { enableHighAccuracy: true, timeout: 15000 }));
  } },
  { id: 'vibrate', icon: '📳', name: 'Vibrate', perm: 'vibration', why: 'To make your phone buzz.', site: true, run() {
    if (!navigator.vibrate) return nope("This device doesn't let websites vibrate (iPhones and iPads don't).");
    navigator.vibrate([200, 100, 200, 100, 500]); info('Bzzzt! 📳');
  } },
  { id: 'notify', icon: '🔔', name: 'Notifications', perm: 'notifications', why: 'To send you a little notification.', site: true, async run() {
    if (!('Notification' in window)) return nope('Notifications need Shobot added to your Home Screen on iPhone/iPad.');
    const p = await Notification.requestPermission();
    if (p !== 'granted') return nope('Notifications are turned off for this site.');
    new Notification('Shobot 🤖', { body: 'Beep boop! This is your notification.' }); info('Notification sent! 🔔');
  } },
  { id: 'flashlight', icon: '🔦', name: 'Flashlight', why: "To turn on your camera's light.", site: true, async run() {
    if (torchStream) { stopTorch(); info('Flashlight off.'); return; }
    torchStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const tr = torchStream.getVideoTracks()[0];
    if (!tr.getCapabilities?.().torch) { stopTorch(); return nope("This browser can't control the flashlight (it works on many Android phones in Chrome)."); }
    await tr.applyConstraints({ advanced: [{ torch: true }] }); info('Flashlight on! Tap again to turn off.');
  } },
  { id: 'motion', icon: '🧭', name: 'Motion sensor', why: 'To feel how you tilt your device.', site: true, async run() {
    if (motionOn) { motionOn = false; removeEventListener('deviceorientation', onTilt); info('Motion sensor off.'); return; }
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
      const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return nope('Motion access was blocked.');
    }
    motionOn = true; addEventListener('deviceorientation', onTilt); info('Tilt your device! (Tap again to stop.)');
  } },
  { id: 'share', icon: '📤', name: 'Share', perm: 'share menu', why: 'To open the share menu so you can send Shobot to a friend.', site: true, async run() {
    if (!navigator.share) { await navigator.clipboard?.writeText(location.href); return info('Link copied instead! 📋'); }
    await navigator.share({ title: 'Shobot', text: 'Check out my AI, Shobot! 🤖', url: location.href });
  } },
  { id: 'fullscreen', icon: '⛶', name: 'Full screen', perm: 'whole screen', why: 'To fill your whole screen.', async run() {
    const el = document.documentElement;
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (!el.requestFullscreen) return nope('Full screen is not supported here. On iPhone, add Shobot to your Home Screen instead.');
    await el.requestFullscreen();
  } },
  { id: 'clipboard', icon: '📋', name: 'Clipboard', why: 'To copy a message for you to paste.', async run() {
    await navigator.clipboard.writeText('Hello from Shobot 🤖'); info('Copied “Hello from Shobot 🤖”. Paste it anywhere!');
  } },
  { id: 'wakelock', icon: '🌞', name: 'Keep screen on', perm: 'screen (to keep it on)', why: 'To stop your screen from turning off.', async run() {
    if (wakeLock) { await wakeLock.release(); wakeLock = null; info('Screen can sleep again.'); return; }
    if (!navigator.wakeLock) return nope('This browser cannot keep the screen awake.');
    wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => (wakeLock = null)); info('Screen will stay on 🌞 (tap again to stop)');
  } },
  { id: 'speaker', icon: '🔊', name: 'Speaker', why: 'To say hello out loud.', run() {
    if (!speak(`Hello ${userName()}! I am Shobot, your robot helper.`, true)) return nope('Speech is not supported here.');
    info('Shobot is talking 🔊');
  } },
];
const unavailable = a => (IN_CLAUDE && a.site) || (['camera', 'mic', 'flashlight'].includes(a.id) && !navigator.mediaDevices?.getUserMedia) || (a.id === 'location' && !navigator.geolocation);
function onTilt(e) {
  const g = Math.round(e.gamma || 0), b = Math.round(e.beta || 0);
  info(`Tilt left/right: <b>${g}°</b> · forward/back: <b>${b}°</b>`);
  Avatar.svgs.forEach(s => (s.style.transform = `rotate(${Math.max(-25, Math.min(25, g / 2))}deg)`));
}
async function useAbility(ab, { fromChat } = {}) {
  let card = null;
  if (fromChat) {
    const row = document.createElement('div'); row.className = 'msg bot';
    row.innerHTML = `<div class="bubble"><b>${ab.icon} ${esc(ab.name)}</b><div class="ab-out muted">Waiting for your answer…</div></div>`;
    msgsEl.appendChild(row); toBottom(true); card = row.querySelector('.ab-out');
  }
  if (unavailable(ab)) { sink = card; nope(NEEDS_SITE); sink = null; return; }
  const turningOff = (ab.id === 'camera' && camStream && !fromChat) || (ab.id === 'mic' && micStream) || (ab.id === 'flashlight' && torchStream) || (ab.id === 'wakelock' && wakeLock) || (ab.id === 'motion' && motionOn) || (ab.id === 'fullscreen' && document.fullscreenElement);
  // Turning something off never needs permission. Everything else asks, every time.
  if (!turningOff) {
    const ok = await askPermission(ab.perm || ab.name.toLowerCase(), ab.why, () => ab.sync?.({ fromChat }));
    if (!ok) { sink = card; info('No problem. Shobot did nothing.'); sink = null; return; }
  }
  sink = card;
  try { await ab.run({ fromChat }); renderCards(); if (!turningOff) Avatar.play('happy', 1400); }
  catch (e) { console.warn(e); nope((e && e.name === 'NotAllowedError') ? 'Your browser blocked it. You can allow it in your browser settings.' : 'That did not work on this device.'); renderCards(); }
  finally { sink = null; toBottom(); }
  if (ab.id === 'motion' && !motionOn) Avatar.svgs.forEach(s => (s.style.transform = ''));
}
function renderCards() {
  const on = { camera: !!camStream, mic: !!micStream, flashlight: !!torchStream, wakelock: !!wakeLock, motion: motionOn };
  $('#abilityCards').innerHTML = abilities.map(a => {
    const off = unavailable(a);
    return `<button class="card ${on[a.id] ? 'active' : ''} ${off ? 'off' : ''}" data-ab="${a.id}"><span class="ic">${a.icon}</span><b>${a.name}${on[a.id] ? ' · on' : ''}</b><small>${off ? 'Needs the Vercel version' : a.why}</small></button>`;
  }).join('');
  stagger($$('#abilityCards .card'));
  $$('#abilityCards .card').forEach(c => c.addEventListener('click', () => useAbility(abilities.find(a => a.id === c.dataset.ab))));
}
if (IN_CLAUDE) $('#phoneNote').textContent = 'Some phone tools (camera, microphone, location, vibration) only work when Shobot runs on its own website. They are marked below.';

/* ---------------- ME (avatar moves) ---------------- */
$$('#moves button').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.anim;
  if (a === 'idle') { Avatar.temp = null; Avatar.set('idle'); return; }
  Avatar.play(a, a === 'teleport' ? 1800 : a === 'sleep' ? 6000 : 4000);
}));

/* ---------------- settings ---------------- */
$('#settingsBtn').addEventListener('click', () => {
  $('#userName').value = settings.name; $('#voiceOn').checked = settings.voice; $('#soundOn').checked = settings.sound;
  pickBrain(settings.brain); renderMemories();
  $('#settingsModal').hidden = false;
});
$('#settingsClose').addEventListener('click', () => {
  settings.name = $('#userName').value.trim(); settings.voice = $('#voiceOn').checked; settings.sound = $('#soundOn').checked;
  settings.brain = $('#brainSeg .on')?.dataset.brain || 'smart';
  saveSettings(); $('#settingsModal').hidden = true; toast('Saved ✓'); checkAI();
});
const BRAIN_INFO = {
  fast: 'Answers in a flash. Good for quick questions.',
  smart: 'Thinks a little first. Better answers for most things.',
  genius: 'Thinks the hardest. Best for big projects, homework and detailed 3D, but slower.',
};
function pickBrain(b) {
  $$('#brainSeg button').forEach(x => x.classList.toggle('on', x.dataset.brain === b));
  $('#brainInfo').textContent = BRAIN_INFO[b] || '';
}
$$('#brainSeg button').forEach(b => b.addEventListener('click', () => pickBrain(b.dataset.brain)));
function renderMemories() {
  const ul = $('#memList');
  ul.innerHTML = memories.length ? memories.map((m, i) => `<li><span>${esc(m)}</span><button type="button" data-i="${i}" aria-label="Forget this">✕</button></li>`).join('') : '<li class="muted">Nothing yet. Tell Shobot what you like!</li>';
}
$('#memList').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) { memories.splice(+b.dataset.i, 1); saveMemories(); renderMemories(); } });
$('#forgetAll').addEventListener('click', e => {
  if (e.target.dataset.armed) { memories = []; saveMemories(); renderMemories(); e.target.textContent = 'Forget everything'; delete e.target.dataset.armed; return; }
  e.target.dataset.armed = '1'; e.target.textContent = 'Tap again to forget';
  setTimeout(() => { e.target.textContent = 'Forget everything'; delete e.target.dataset.armed; }, 3000);
});
$('#clearChatBtn').addEventListener('click', () => { $('#settingsModal').hidden = true; if (currentId) deleteChat(currentId); else toast('This chat is already empty'); });
$('#installTip').addEventListener('click', () => ($('#installText').hidden = false));

/* ---------------- shared API for modules ---------------- */
const api = { Avatar, callAI, gen3d, toast, beep, download, extractJSON, store, audioCtx, go, confetti };
window.Shobot = api;

/* ---------------- boot ---------------- */
makeSky(); showTeamBtn();
stagger($$('.chips .chip')); stagger($$('#moves button')); stagger($$('#shapeBtns button')); stagger($$('#attachMenu button'));
Avatar.init();
renderChat(); loadFile('html'); run(); renderCards();
go((location.hash || '#chat').slice(1));
checkAI();
