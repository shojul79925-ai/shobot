// Shobot Music Studio
const $ = s => document.querySelector(s);

const DRUMS = [
  { id: 'kick', label: '🥁 Kick', c: '#ff8a1f' },
  { id: 'snare', label: '🪘 Snare', c: '#e21fd8' },
  { id: 'hat', label: '✨ Hi-hat', c: '#19e3a0' },
  { id: 'clap', label: '👏 Clap', c: '#38bdf8' },
];
const NOTES = ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4']; // melody rows (top = high)
const STEPS = 16;
const freq = n => { const m = n.match(/^([A-G])(#?)(\d)$/); const i = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0); return 440 * 2 ** ((i + (+m[3] + 1) * 12 - 69) / 12); };

export function init(api) {
  const ac = api.audioCtx();
  const master = ac.createGain(); master.gain.value = 0.8;
  const comp = ac.createDynamicsCompressor(); master.connect(comp).connect(ac.destination);
  const recDest = ac.createMediaStreamDestination(); comp.connect(recDest);

  let noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

  const empty = () => ({ drums: Object.fromEntries(DRUMS.map(d => [d.id, Array(STEPS).fill(0)])), melody: Array(STEPS).fill(-1), bpm: 110, inst: 'synth' });
  let song = Object.assign(empty(), api.store.get('song', {}));
  const save = () => api.store.set('song', song);

  /* ---- sounds ---- */
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const SOUND = {
    kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3); env(g, t, 0.005, 1, 0.35); o.connect(g).connect(master); o.start(t); o.stop(t + 0.4); },
    noise(t, hp, dur, vol) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp; env(g, t, 0.002, vol, dur); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.05); },
    snare(t) { SOUND.noise(t, 1500, 0.18, 0.5); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 190; env(g, t, 0.002, 0.4, 0.1); o.connect(g).connect(master); o.start(t); o.stop(t + 0.15); },
    hat(t) { SOUND.noise(t, 7000, 0.05, 0.25); },
    clap(t) { [0, 0.012, 0.024].forEach(x => SOUND.noise(t + x, 1200, 0.08, 0.35)); },
  };
  function note(f, t, inst = song.inst, len = 0.25) {
    const g = ac.createGain(); g.connect(master);
    const mk = (type, fr, det = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = det; o.connect(g); o.start(t); o.stop(t + len + 0.6); return o; };
    if (inst === 'synth') { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(3000, t); f2.frequency.exponentialRampToValueAtTime(600, t + len); g.disconnect(); g.connect(f2).connect(master); mk('sawtooth', f, -8); mk('sawtooth', f, 8); env(g, t, 0.01, 0.18, len + 0.15); }
    else if (inst === 'piano') { mk('triangle', f); mk('sine', f * 2); env(g, t, 0.005, 0.35, len + 0.5); }
    else if (inst === 'pluck') { mk('square', f); env(g, t, 0.002, 0.18, 0.18); }
    else if (inst === 'bass') { mk('sine', f / 2); mk('square', f / 4); env(g, t, 0.01, 0.35, len + 0.1); }
    else { mk('sine', f * 2); mk('sine', f * 5.04); env(g, t, 0.002, 0.25, 0.9); }
  }

  /* ---- grid ---- */
  const seq = $('#seq'); const cells = {};
  function buildGrid() {
    seq.innerHTML = '';
    const row = (key, label, color, isOn, toggle) => {
      const l = document.createElement('div'); l.className = 'lbl'; l.textContent = label; seq.appendChild(l);
      cells[key] = [];
      for (let i = 0; i < STEPS; i++) {
        const b = document.createElement('button'); b.className = 'cell' + (Math.floor(i / 4) % 2 ? ' q' : ''); b.style.setProperty('--c', color);
        b.setAttribute('aria-label', `${label} step ${i + 1}`);
        b.classList.toggle('on', isOn(i));
        b.addEventListener('click', () => { toggle(i); refresh(); save(); });
        seq.appendChild(b); cells[key].push(b);
      }
    };
    DRUMS.forEach(d => row(d.id, d.label, d.c, i => !!song.drums[d.id][i], i => { song.drums[d.id][i] = song.drums[d.id][i] ? 0 : 1; if (song.drums[d.id][i]) SOUND[d.id](ac.currentTime); }));
    const gap = document.createElement('div'); gap.className = 'gap'; seq.appendChild(gap);
    NOTES.forEach((n, ni) => row('n' + ni, '🎵 ' + n, '#ffd21f', i => song.melody[i] === ni, i => { song.melody[i] = song.melody[i] === ni ? -1 : ni; if (song.melody[i] === ni) note(freq(n), ac.currentTime); }));
  }
  function refresh() {
    DRUMS.forEach(d => cells[d.id].forEach((b, i) => b.classList.toggle('on', !!song.drums[d.id][i])));
    NOTES.forEach((_, ni) => cells['n' + ni].forEach((b, i) => b.classList.toggle('on', song.melody[i] === ni)));
  }

  /* ---- transport ---- */
  let playing = false, step = 0, nextT = 0, timer = null;
  const stateFns = new Set();
  const stepDur = () => 60 / song.bpm / 4;
  function schedule() {
    while (nextT < ac.currentTime + 0.12) {
      const s = step;
      DRUMS.forEach(d => song.drums[d.id][s] && SOUND[d.id](nextT));
      if (song.melody[s] >= 0) note(freq(NOTES[song.melody[s]]), nextT, song.inst, stepDur() * 1.6);
      const at = (nextT - ac.currentTime) * 1000;
      setTimeout(() => highlight(s), Math.max(0, at));
      nextT += stepDur(); step = (step + 1) % STEPS;
    }
  }
  const stepFns = new Set();
  function highlight(s) {
    if (!playing) return;
    stepFns.forEach(f => { try { f(s); } catch {} });
    Object.values(cells).forEach(arr => arr.forEach((b, i) => b.classList.toggle('now', i === s)));
  }
  function play() {
    if (playing) return; ac.resume(); playing = true; step = 0; nextT = ac.currentTime + 0.05;
    timer = setInterval(schedule, 25); $('#playBtn').textContent = '⏹ Stop'; api.Avatar.set('djing'); stateFns.forEach(f => f(true));
  }
  function stop() {
    playing = false; clearInterval(timer); $('#playBtn').textContent = '▶ Play';
    Object.values(cells).forEach(arr => arr.forEach(b => b.classList.remove('now')));
    if (api.Avatar.base === 'djing') api.Avatar.set('idle');
    stepFns.forEach(f => { try { f(-1); } catch {} }); stateFns.forEach(f => f(false));
  }
  $('#playBtn').addEventListener('click', () => (playing ? stop() : play()));
  const bpm = $('#bpm');
  bpm.value = song.bpm; $('#bpmVal').textContent = song.bpm;
  bpm.addEventListener('input', () => { song.bpm = +bpm.value; $('#bpmVal').textContent = bpm.value; save(); });
  const inst = $('#instSel'); inst.value = song.inst;
  inst.addEventListener('change', () => { song.inst = inst.value; save(); note(freq('C4'), ac.currentTime); });
  $('#clearBeatBtn').addEventListener('click', () => { const b = song.bpm, i = song.inst; song = empty(); song.bpm = b; song.inst = i; refresh(); save(); });

  /* ---- recording ---- */
  let mr = null, chunks = [];
  $('#recBtn').addEventListener('click', () => {
    if (mr) { mr.stop(); return; }
    if (!window.MediaRecorder) return api.toast('Recording is not supported in this browser');
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
    mr = new MediaRecorder(recDest.stream, type ? { mimeType: type } : undefined); chunks = [];
    mr.ondataavailable = e => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
      const url = URL.createObjectURL(blob);
      $('#recOut').innerHTML = `<audio controls src="${url}"></audio><button class="btn" id="saveSongBtn">⬇ Save song</button>`;
      $('#saveSongBtn').onclick = () => api.download(`shobot-song.${ext}`, blob);
      mr = null; $('#recBtn').textContent = '⏺ Record'; api.toast('Song recorded! 🎶');
    };
    mr.start(); $('#recBtn').textContent = '⏹ Stop rec'; if (!playing) play(); api.toast('Recording… press Stop rec when done');
  });

  /* ---- piano ---- */
  const piano = $('#piano');
  const KEYS = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5', 'C6'];
  const PC = 'awsedftgyhujkolp;'; // computer keyboard map (first 17 keys)
  const whites = KEYS.filter(k => !k.includes('#'));
  const keyEls = {};
  whites.forEach(k => { const el = document.createElement('button'); el.className = 'key'; el.textContent = k.replace(/\d/, ''); el.dataset.n = k; piano.appendChild(el); keyEls[k] = el; });
  KEYS.forEach((k, i) => {
    if (!k.includes('#')) return;
    const wi = whites.indexOf(KEYS[i - 1]);
    const el = document.createElement('button'); el.className = 'key black'; el.dataset.n = k;
    el.style.left = `calc(${((wi + 1) / whites.length) * 100}% - 2.5%)`; piano.appendChild(el); keyEls[k] = el;
  });
  const hit = k => { if (!k) return; ac.resume(); note(freq(k), ac.currentTime, song.inst, 0.35); keyEls[k].classList.add('down'); setTimeout(() => keyEls[k].classList.remove('down'), 180); api.Avatar.play('dance', 900); };
  piano.addEventListener('pointerdown', e => { const k = e.target.closest('.key'); if (k) { e.preventDefault(); hit(k.dataset.n); } });
  addEventListener('keydown', e => {
    if (!document.querySelector('#view-music.on') || e.repeat || /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); playing ? stop() : play(); return; }
    const i = PC.indexOf(e.key.toLowerCase()); if (i >= 0) hit(KEYS[i]);
  });

  /* ---- AI beat ---- */
  async function make(desc, opts = {}) {
    desc = (desc || '').trim(); if (!desc) return null;
    $('#beatInput').value = desc;
    if (!api.Avatar.jobs) api.Avatar.set('djing'); if (!opts.quiet) api.toast('Shobot is making your beat… 🎧', 4000);
    try {
      const data = api.extractJSON(await api.callAI('music', [{ role: 'user', content: desc }], { onText: opts.onText }));
      const n = song = empty();
      if (data.bpm) n.bpm = Math.max(60, Math.min(180, Math.round(data.bpm)));
      if (['synth', 'piano', 'pluck', 'bass', 'bell'].includes(data.instrument)) n.inst = data.instrument;
      DRUMS.forEach(d => { const a = data.drums?.[d.id]; if (Array.isArray(a)) for (let i = 0; i < STEPS; i++) n.drums[d.id][i] = a[i] ? 1 : 0; });
      if (Array.isArray(data.melody)) for (let i = 0; i < STEPS; i++) { const v = data.melody[i]; const idx = typeof v === 'string' ? NOTES.indexOf(v) : (Number.isInteger(v) ? v : -1); n.melody[i] = idx >= 0 && idx < NOTES.length ? idx : -1; }
      bpm.value = n.bpm; $('#bpmVal').textContent = n.bpm; inst.value = n.inst;
      refresh(); save(); stop(); if (opts.autoplay !== false) play(); else if (!api.Avatar.jobs) api.Avatar.set('idle');
      if (!opts.quiet) api.toast(data.title ? `Now playing: ${data.title} 🎶` : 'Your beat is ready! 🎶');
      return { title: data.title || 'New beat', song: JSON.parse(JSON.stringify(song)) };
    } catch (e) {
      console.warn(e); if (!api.Avatar.jobs) { api.Avatar.set('idle'); api.Avatar.play('surprised', 1400); }
      if (!opts.quiet) api.toast("Shobot couldn't make that beat right now. Try again!");
      throw e;
    }
  }
  $('#beatForm').addEventListener('submit', e => { e.preventDefault(); make($('#beatInput').value).catch(() => {}); });

  // starter beat if empty
  if (!Object.values(song.drums).some(a => a.some(Boolean))) {
    [0, 6, 8, 11].forEach(i => (song.drums.kick[i] = 1)); [4, 12].forEach(i => (song.drums.snare[i] = 1));
    for (let i = 0; i < 16; i += 2) song.drums.hat[i] = 1;
    [7, -1, 5, -1, 4, -1, 5, -1, 7, -1, 5, 4, 3, -1, 4, -1].forEach((v, i) => (song.melody[i] = v));
  }
  buildGrid();

  return {
    make, onShow() {},
    toggle() { playing ? stop() : play(); }, isPlaying: () => playing,
    song: () => song, DRUMS, NOTES,
    onStep(f) { stepFns.add(f); return () => stepFns.delete(f); },
    onState(f) { stateFns.add(f); return () => stateFns.delete(f); },
  };
}
