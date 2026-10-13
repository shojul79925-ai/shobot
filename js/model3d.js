// Shared 3D model kit: turns Shobot's part descriptions into three.js meshes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
const D2R = Math.PI / 180;
export const SHAPES = ['box', 'roundbox', 'sphere', 'hemisphere', 'cylinder', 'cone', 'pyramid', 'torus', 'ring', 'capsule', 'wedge', 'gem', 'rock', 'lathe', 'extrude', 'tube', 'plane'];
export const FINISHES = ['plastic', 'matte', 'metal', 'glass', 'glow', 'rubber'];

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const vec3 = (a, d) => (Array.isArray(a) ? [num(a[0], d[0]), num(a[1], d[1]), num(a[2], d[2])] : d.slice());
const pts2 = a => (Array.isArray(a) ? a.slice(0, 80).filter(p => Array.isArray(p)).map(p => [num(p[0]), num(p[1])]) : []);
const pts3 = a => (Array.isArray(a) ? a.slice(0, 60).filter(p => Array.isArray(p)).map(p => [num(p[0]), num(p[1]), num(p[2])]) : []);

/** Accept both the short streaming keys (s,c,p,r,k,m,n) and long keys. */
export function normalize(o = {}) {
  let s = String(o.s || o.shape || 'box').toLowerCase();
  if (!SHAPES.includes(s)) s = { cube: 'box', ball: 'sphere', tube_path: 'tube', pipe: 'tube', dome: 'hemisphere', donut: 'torus', floor: 'plane' }[s] || 'box';
  const d = {
    s,
    c: /^#[0-9a-f]{3,8}$/i.test(o.c || o.color || '') ? (o.c || o.color) : '#ffd21f',
    p: vec3(o.p || o.position, [0, 0.5, 0]),
    r: vec3(o.r || o.rotation, [0, 0, 0]),
    k: vec3(o.k || o.scale, s === 'plane' ? [6, 1, 6] : [1, 1, 1]),
    m: FINISHES.includes(o.m || o.finish) ? (o.m || o.finish) : 'plastic',
  };
  if (o.n || o.name) d.n = String(o.n || o.name).slice(0, 40);
  if (o.o != null) d.o = Math.max(0.05, Math.min(1, num(o.o, 1)));
  if (s === 'lathe' || s === 'extrude') d.pts = pts2(o.pts || o.points);
  if (s === 'extrude') d.d = Math.max(0.01, num(o.d ?? o.depth, 0.2));
  if (s === 'tube') { d.path = pts3(o.path || o.pts); d.rad = Math.max(0.005, num(o.rad ?? o.radius, 0.05)); }
  return d;
}

function geometry(d) {
  switch (d.s) {
    case 'roundbox': return new RoundedBoxGeometry(1, 1, 1, 3, 0.12);
    case 'sphere': return new THREE.SphereGeometry(0.5, 40, 24);
    case 'hemisphere': return new THREE.SphereGeometry(0.5, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 40);
    case 'cone': return new THREE.ConeGeometry(0.5, 1, 40);
    case 'pyramid': { const g = new THREE.ConeGeometry(0.7071, 1, 4); g.rotateY(Math.PI / 4); return g; }
    case 'torus': return new THREE.TorusGeometry(0.4, 0.15, 20, 56);
    case 'ring': return new THREE.TorusGeometry(0.47, 0.03, 10, 64);
    case 'capsule': return new THREE.CapsuleGeometry(0.3, 0.6, 8, 20);
    case 'gem': return new THREE.OctahedronGeometry(0.5);
    case 'rock': return new THREE.DodecahedronGeometry(0.5, 0);
    case 'plane': return new THREE.BoxGeometry(1, 0.05, 1);
    case 'wedge': {
      const sh = new THREE.Shape(); sh.moveTo(-0.5, -0.5); sh.lineTo(0.5, -0.5); sh.lineTo(-0.5, 0.5); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g;
    }
    case 'lathe': {
      const p = d.pts.length >= 2 ? d.pts : [[0, 0], [0.5, 0], [0.5, 1], [0, 1]];
      return new THREE.LatheGeometry(p.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), 48);
    }
    case 'extrude': {
      const p = d.pts.length >= 3 ? d.pts : [[-0.5, -0.5], [0.5, -0.5], [0, 0.5]];
      const sh = new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y)));
      const bev = Math.min(0.03, d.d / 4);
      const g = new THREE.ExtrudeGeometry(sh, { depth: d.d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 16 });
      g.translate(0, 0, -d.d / 2); return g;
    }
    case 'tube': {
      const p = d.path.length >= 2 ? d.path : [[0, 0, 0], [0, 1, 0]];
      const curve = new THREE.CatmullRomCurve3(p.map(v => new THREE.Vector3(...v)));
      return new THREE.TubeGeometry(curve, Math.min(200, p.length * 16), d.rad, 12, false);
    }
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

function material(d, wire) {
  const base = { color: d.c, wireframe: !!wire, flatShading: d.s === 'rock' || d.s === 'gem' };
  const m = new THREE.MeshStandardMaterial(base);
  ({
    plastic: () => { m.roughness = 0.4; m.metalness = 0.05; },
    matte: () => { m.roughness = 0.95; m.metalness = 0; },
    rubber: () => { m.roughness = 0.8; m.metalness = 0; m.color.multiplyScalar(0.85); },
    metal: () => { m.roughness = 0.22; m.metalness = 0.95; },
    glass: () => { m.roughness = 0.05; m.metalness = 0.1; m.transparent = true; m.opacity = 0.35; m.depthWrite = false; },
    glow: () => { m.roughness = 0.5; m.emissive = new THREE.Color(d.c); m.emissiveIntensity = 1.4; },
  }[d.m] || (() => {}))();
  if (d.o != null && d.o < 1) { m.transparent = true; m.opacity = d.o; }
  if (['lathe', 'extrude', 'hemisphere', 'tube'].includes(d.s)) m.side = THREE.DoubleSide;
  return m;
}

export function makeMesh(def, wire) {
  const d = normalize(def);
  const mesh = new THREE.Mesh(geometry(d), material(d, wire));
  mesh.userData.def = d;
  mesh.castShadow = d.m !== 'glass'; mesh.receiveShadow = true;
  mesh.position.set(...d.p);
  mesh.scale.set(d.k[0] || 1, d.k[1] || 1, d.k[2] || 1);
  mesh.rotation.set(d.r[0] * D2R, d.r[1] * D2R, d.r[2] * D2R);
  return mesh;
}

/** Current state of a mesh as a part definition (for saving / reopening). */
export function toDef(mesh) {
  const d = { ...mesh.userData.def };
  d.c = '#' + mesh.material.color.getHexString();
  d.p = mesh.position.toArray().map(n => +n.toFixed(3));
  d.k = mesh.scale.toArray().map(n => +n.toFixed(3));
  d.r = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].map(n => +(n / D2R).toFixed(1));
  return d;
}

export function dispose(mesh) { mesh.geometry.dispose(); mesh.material.dispose(); }

/** Lights, environment reflections, ground, grid. */
export function setupStage(renderer, scene, { grid = true } = {}) {
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color('#24134d');
  scene.add(new THREE.HemisphereLight('#ffffff', '#6c3cf0', 0.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.8);
  sun.position.set(6, 12, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, far: 60 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.28 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  if (grid) { const g = new THREE.GridHelper(30, 30, '#e21fd8', '#4b2d93'); g.material.transparent = true; g.material.opacity = 0.45; scene.add(g); }
  return { sun };
}

/** Point a camera (and orbit target) at everything in `obj`. */
export function frameTarget(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return null;
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  const pos = c.clone().add(new THREE.Vector3(1, 0.65, 1.35).normalize().multiplyScalar(Math.max(3.5, size * 1.15)));
  return { target: c, position: pos };
}

/** Feed streamed text; calls onLine(obj) for each complete JSON line. */
export function lineReader(onLine) {
  let pending = '';
  const eat = line => {
    line = line.trim().replace(/,$/, '');
    if (!line.startsWith('{')) return;
    try { onLine(JSON.parse(line)); } catch {}
  };
  return {
    push(delta) { const lines = (pending + delta).split('\n'); pending = lines.pop(); lines.forEach(eat); },
    end() { if (pending) eat(pending); pending = ''; },
  };
}
