// Renders icon.png (512x512): a voxel strawberry bush on a soil block, from the game's own models.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage();
await p.goto(`http://localhost:${server.address().port}/test/blank.html`);
const url = await p.evaluate(async () => {
  const T = window.THREE;
  const M = await import('../src/models.js');
  const { Vox, mesh } = await import('../src/voxel.js');
  const r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(512, 512); r.outputEncoding = T.sRGBEncoding; r.setClearColor(0x8fd4ff, 1);
  r.shadowMap.enabled = true;
  const s = new T.Scene();
  s.add(new T.HemisphereLight(0xffffff, 0x6a8a5a, 0.8));
  const d = new T.DirectionalLight(0xfff2dc, 1); d.position.set(-6, 12, 8); d.castShadow = true; s.add(d);
  const mat = new T.MeshLambertMaterial({ vertexColors: true });
  const V = new Vox(Math.random);
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) { V.set(x, -2, z, '#6a4228'); V.set(x, -1, z, x * x + z * z < 30 ? '#8e5c3a' : '#78cc6c'); }
  const ground = new T.Mesh(mesh(V), mat); ground.receiveShadow = true; s.add(ground);
  const plant = new T.Mesh(M.plantGeo('strawberry', 5, 1), mat); plant.position.y = -0; plant.castShadow = true; s.add(plant);
  for (const pt of M.ANCHORS.strawberry.pts) { const f = new T.Mesh(M.fruitGeo('strawberry', 'r'), mat); f.position.set(...pt); f.scale.setScalar(1.3); s.add(f); }
  const cam = new T.OrthographicCamera(-7.5, 7.5, 7.5, -7.5, 1, 100);
  cam.position.set(8, 12, 14); cam.lookAt(0, 1.5, 0);
  r.render(s, cam);
  return r.domElement.toDataURL('image/png');
});
fs.writeFileSync('icon.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('wrote icon.png');
await browser.close(); server.close();
