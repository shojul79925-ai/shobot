// Shobot 3D Studio
import { THREE, makeMesh, toDef, dispose, setupStage, frameTarget } from './model3d.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

export const SHOBOT_MODEL = [
  { s: 'cone', c: '#6c3cf0', p: [0, 1.05, 0], k: [1.5, 1.6, 1.3], r: [180, 0, 0], n: 'body' },
  { s: 'roundbox', c: '#ffffff', p: [0, 1.4, 0.5], k: [0.5, 0.38, 0.08], n: 'chest screen' },
  { s: 'box', c: '#ffd21f', p: [0, 1.4, 0.55], k: [0.38, 0.27, 0.02], m: 'glow', n: 'screen light' },
  { s: 'sphere', c: '#ffd21f', p: [0, 2.6, 0], k: [2, 1.8, 1.8], n: 'helmet' },
  { s: 'capsule', c: '#5b2bd6', p: [0, 2.55, 0.6], k: [1.5, 1.05, 0.65], r: [0, 0, 90], n: 'visor rim' },
  { s: 'capsule', c: '#d21ee0', p: [0, 2.55, 0.66], k: [1.35, 0.95, 0.6], r: [0, 0, 90], m: 'glass', o: 0.85, n: 'visor' },
  { s: 'sphere', c: '#ffffff', p: [-0.3, 2.62, 0.95], k: [0.22, 0.3, 0.1], m: 'glow', n: 'left eye' },
  { s: 'sphere', c: '#ffffff', p: [0.3, 2.62, 0.95], k: [0.22, 0.3, 0.1], m: 'glow', n: 'right eye' },
  { s: 'cylinder', c: '#6c3cf0', p: [-1.0, 2.6, 0], k: [0.75, 0.16, 0.75], r: [0, 0, 90], n: 'left ear' },
  { s: 'cylinder', c: '#ff8a1f', p: [-1.08, 2.6, 0], k: [0.55, 0.12, 0.55], r: [0, 0, 90], n: 'left ear light' },
  { s: 'cylinder', c: '#6c3cf0', p: [1.0, 2.6, 0], k: [0.75, 0.16, 0.75], r: [0, 0, 90], n: 'right ear' },
  { s: 'cylinder', c: '#ff8a1f', p: [1.08, 2.6, 0], k: [0.55, 0.12, 0.55], r: [0, 0, 90], n: 'right ear light' },
  { s: 'cylinder', c: '#6c3cf0', p: [0, 3.7, 0], k: [0.08, 0.45, 0.08], m: 'metal', n: 'antenna' },
  { s: 'sphere', c: '#19e3a0', p: [0, 4.0, 0], k: [0.3, 0.3, 0.3], m: 'glow', n: 'antenna bulb' },
  { s: 'capsule', c: '#ffd21f', p: [-1.15, 1.35, 0], k: [0.7, 0.7, 0.7], r: [0, 0, 15], n: 'left arm' },
  { s: 'capsule', c: '#ffd21f', p: [1.15, 1.35, 0], k: [0.7, 0.7, 0.7], r: [0, 0, -15], n: 'right arm' },
  { s: 'cone', c: '#ff8a1f', p: [0, 0.12, 0], k: [0.35, 0.4, 0.35], r: [180, 0, 0], m: 'glow', n: 'jet flame' },
];

export function init(api) {
  const stage = $('#stage3d');
  $('#stageLoading').hidden = true;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  setupStage(renderer, scene);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 300);
  camera.position.set(6, 5, 8);

  const world = new THREE.Group(); scene.add(world);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true; orbit.target.set(0, 1, 0);
  const tc = new TransformControls(camera, renderer.domElement);
  tc.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; if (!e.value) save(); });
  scene.add(tc.getHelper());

  let selected = null, wire = false, building = null;
  const status = $('#studioStatus');

  function add(def) { const m = makeMesh(def, wire); world.add(m); return m; }
  function save() { api.store.set('scene3d', world.children.map(toDef)); $('#partCount').textContent = world.children.length; }
  function select(m) {
    selected = m;
    if (m) { tc.attach(m); $('#objColor').value = '#' + m.material.color.getHexString(); $('#partName').textContent = m.userData.def.n || m.userData.def.s; }
    else { tc.detach(); $('#partName').textContent = 'nothing'; }
  }
  function clearAll() { select(null); [...world.children].forEach(c => { dispose(c); world.remove(c); }); }
  function load(list) { clearAll(); (list || []).forEach(add); save(); frame(); }
  function frame() { const f = frameTarget(world); if (f) { orbit.target.copy(f.target); camera.position.copy(f.position); } }

  $$('#shapeBtns button').forEach(b => b.addEventListener('click', () => {
    const s = b.dataset.shape;
    if (s === 'robot') { SHOBOT_MODEL.forEach(add); save(); frame(); api.Avatar.play('happy', 1500); return; }
    const m = add({ s, p: [(Math.random() - 0.5) * 3, s === 'plane' ? 0.03 : 0.6, (Math.random() - 0.5) * 3], c: ['#ffd21f', '#e21fd8', '#19e3a0', '#ff8a1f', '#6c3cf0', '#38bdf8'][world.children.length % 6] });
    select(m); save();
  }));
  $$('#tModes button').forEach(b => b.addEventListener('click', () => {
    tc.setMode(b.dataset.tmode); $$('#tModes button').forEach(x => x.classList.toggle('on', x === b));
  }));
  $('#objColor').addEventListener('input', e => { if (selected) { selected.material.color.set(e.target.value); if (selected.userData.def.m === 'glow') selected.material.emissive.set(e.target.value); save(); } });
  $('#finishSel').addEventListener('change', e => {
    if (!selected) return api.toast('Tap a part first');
    const d = toDef(selected); d.m = e.target.value; const m = add(d); world.remove(selected); dispose(selected); select(m); save();
  });
  $('#dupBtn').addEventListener('click', () => {
    if (!selected) return api.toast('Tap a part first');
    const d = toDef(selected); d.p[0] += 0.6; select(add(d)); save();
  });
  $('#delBtn').addEventListener('click', () => {
    if (!selected) return api.toast('Tap a part first');
    const m = selected; select(null); world.remove(m); dispose(m); save();
  });
  $('#wireBtn').addEventListener('click', () => { wire = !wire; world.children.forEach(m => (m.material.wireframe = wire)); });
  let clearArmed = 0;
  $('#clear3dBtn').addEventListener('click', e => {
    if (Date.now() - clearArmed < 3000) { clearAll(); save(); e.target.textContent = 'Clear all'; return; }
    clearArmed = Date.now(); e.target.textContent = 'Tap again to clear';
    setTimeout(() => (e.target.textContent = 'Clear all'), 3000);
  });

  const exportGroup = () => { const g = new THREE.Group(); world.children.forEach(m => g.add(m.clone())); return g; };
  $('#glbBtn').addEventListener('click', () => {
    if (!world.children.length) return api.toast('Build something first!');
    new GLTFExporter().parse(exportGroup(), r => api.download('shobot-model.glb', new Blob([r], { type: 'model/gltf-binary' })), () => api.toast('Export failed'), { binary: true });
  });
  $('#stlBtn').addEventListener('click', () => {
    if (!world.children.length) return api.toast('Build something first!');
    api.download('shobot-model.stl', new Blob([new STLExporter().parse(exportGroup(), { binary: true })], { type: 'model/stl' }));
  });
  $('#pngBtn').addEventListener('click', () => {
    tc.detach(); renderer.render(scene, camera);
    renderer.domElement.toBlob(b => { api.download('shobot-3d.png', b); if (selected) tc.attach(selected); });
  });

  // tap to pick
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', e => (downAt = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || tc.dragging || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(world.children, false)[0];
    select(hit ? hit.object : null);
  });

  // AI build, live in the studio
  async function build(desc) {
    desc = (desc || '').trim(); if (!desc || building) return;
    building = new AbortController();
    const btn = $('#build3dBtn'); btn.textContent = 'Stop';
    clearAll(); status.textContent = 'Shobot is planning…';
    let n = 0;
    try {
      const res = await api.gen3d(desc, $('#detailSel').value, {
        signal: building.signal,
        onTitle: t => (status.textContent = `Building “${t.title}” (about ${t.parts} parts)…`),
        onPart: d => { add(d); n++; if (n % 4 === 1) { frame(); } status.textContent = `Part ${n}${d.n ? ': ' + d.n : ''}`; },
      });
      save(); frame(); status.textContent = `Done: ${res.title || desc} · ${n} parts`;
    } catch (e) {
      status.textContent = e.code === 'cancelled' ? `Stopped at ${n} parts` : "Shobot couldn't build that. Try again.";
      save();
    } finally { building = null; btn.textContent = 'Build'; }
  }
  $('#build3dForm').addEventListener('submit', e => {
    e.preventDefault();
    if (building) { building.abort(); return; }
    build($('#build3dInput').value);
  });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();
  renderer.setAnimationLoop(() => { orbit.update(); renderer.render(scene, camera); });

  const saved = api.store.get('scene3d', null);
  load(saved && saved.length ? saved : SHOBOT_MODEL);

  return { build, load, onShow: resize };
}
