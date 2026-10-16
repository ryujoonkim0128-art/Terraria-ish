// Renders every crop's fruit as a small voxel image for the hotbar, shop and basket.
import { CROPS } from './data.js';
import { fruitVox } from './models.js';
import { mesh } from './voxel.js';

const T = window.THREE;
export const ICON = {};
export function makeIcons() {
  const S = 96;
  const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(S, S); r.outputEncoding = T.sRGBEncoding; r.setClearColor(0, 0);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xffffff, 0x8899aa, 0.75));
  const d = new T.DirectionalLight(0xffffff, 0.9); d.position.set(-2, 4, 3); scene.add(d);
  const mat = new T.MeshLambertMaterial({ vertexColors: true });
  for (const c of CROPS) {
    const V = fruitVox(c.id, 'r', true);
    const [a, b] = V.bounds();
    const g = mesh(V, { offset: [-(a[0] + b[0] + 1) / 2, -(a[1] + b[1] + 1) / 2, -(a[2] + b[2] + 1) / 2] });
    const m = new T.Mesh(g, mat);
    scene.add(m);
    const size = Math.max(b[0] - a[0], b[1] - a[1], b[2] - a[2]) + 1;
    const h = size * 0.78;
    const cam = new T.OrthographicCamera(-h, h, h, -h, 0.1, 100);
    cam.position.set(size * 1.2, size * 1.1, size * 1.6); cam.lookAt(0, 0, 0);
    r.render(scene, cam);
    ICON[c.id] = r.domElement.toDataURL();
    scene.remove(m); g.dispose();
  }
  r.dispose();
  if (r.forceContextLoss) r.forceContextLoss();
}
