// "Shobot's screen": a small live 3D view that shows parts appearing as Shobot builds.
import { THREE, makeMesh, setupStage, frameTarget, dispose } from './model3d.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const live = [];

export function createLiveScreen(container) {
  // Browsers allow only a few WebGL views at once: freeze older screens into pictures.
  while (live.length >= 3) live.shift().freeze();

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  setupStage(renderer, scene, { grid: true });
  const camera = new THREE.PerspectiveCamera(45, 1.6, 0.05, 300);
  camera.position.set(5, 4, 7);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true; orbit.autoRotate = true; orbit.autoRotateSpeed = 1.6; orbit.target.set(0, 1, 0);
  const group = new THREE.Group(); scene.add(group);

  const popping = [];
  let want = null, alive = true;

  function resize() {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  renderer.setAnimationLoop(t => {
    if (!container.isConnected) { api.destroy(); return; } // chat was switched or deleted
    for (let i = popping.length - 1; i >= 0; i--) {
      const p = popping[i], k = Math.min(1, (t - p.t0) / 320);
      const e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // back-out ease
      p.mesh.scale.copy(p.to).multiplyScalar(Math.max(0.001, e));
      if (k >= 1) { p.mesh.scale.copy(p.to); popping.splice(i, 1); }
    }
    if (want) { orbit.target.lerp(want.target, 0.06); camera.position.lerp(want.position, 0.04); }
    orbit.update(); renderer.render(scene, camera);
  });

  const api = {
    meshes: () => group.children,
    add(def) {
      if (!alive) return null;
      const m = makeMesh(def);
      popping.push({ mesh: m, to: m.scale.clone(), t0: performance.now() });
      m.scale.setScalar(0.001);
      group.add(m);
      if (group.children.length % 3 === 1) want = frameTarget(group) || want;
      return m;
    },
    done() { want = frameTarget(group) || want; orbit.autoRotateSpeed = 0.9; },
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    freeze() {
      if (!alive) return;
      const img = new Image(); img.src = api.snapshot(); img.alt = 'Shobot build'; img.className = 'frozen';
      api.destroy(); container.appendChild(img);
    },
    destroy() {
      if (!alive) return; alive = false;
      renderer.setAnimationLoop(null); ro.disconnect(); orbit.dispose();
      group.children.forEach(dispose); renderer.dispose(); renderer.forceContextLoss?.();
      renderer.domElement.remove();
      const i = live.indexOf(api); if (i >= 0) live.splice(i, 1);
    },
  };
  live.push(api);
  return api;
}
