import * as THREE from 'three';

export interface ProceduralTextureSet {
  terrainBump: THREE.CanvasTexture;
  masonryBump: THREE.CanvasTexture;
  thatchBump: THREE.CanvasTexture;
  timberNormal: THREE.CanvasTexture;
  fabricNormal: THREE.CanvasTexture;
  waterBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  selectionRing: THREE.CanvasTexture;
  masonryMap: THREE.CanvasTexture;
  thatchMap: THREE.CanvasTexture;
  timberMap: THREE.CanvasTexture;
  bannerMap: THREE.CanvasTexture;
  shieldHideMap: THREE.CanvasTexture;
  foliageMap: THREE.CanvasTexture;
  smokePuffMap: THREE.CanvasTexture;
  cloudPuffMap: THREE.CanvasTexture;
  // Organic high-realism maps
  soilMap: THREE.CanvasTexture;
  soilNormal: THREE.CanvasTexture;
  grassTurfMap: THREE.CanvasTexture;
  grassTurfNormal: THREE.CanvasTexture;
  gravelPathMap: THREE.CanvasTexture;
  gravelPathNormal: THREE.CanvasTexture;
  cliffRockMap: THREE.CanvasTexture;
  cliffRockNormal: THREE.CanvasTexture;
  fallenLeafMap: THREE.CanvasTexture;
  dustMoteMap: THREE.CanvasTexture;
  barkMap: THREE.CanvasTexture;
  barkNormal: THREE.CanvasTexture;
  leafClusterMap: THREE.CanvasTexture;
  grassTuftMap: THREE.CanvasTexture;
  waterRippleMap: THREE.CanvasTexture;
  dispose: () => void;
}

function buildNormalTextureFromHeight(
  heights: Float32Array,
  size: number,
  strength: number,
  repeat: number,
  aniso: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const sample = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return heights[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hD = sample(x, y - 1);
      const hU = sample(x, y + 1);
      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const invLen = 1.0 / Math.hypot(dx, dy, dz);
      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round((dx * invLen * 0.5 + 0.5) * 255)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round((dy * invLen * 0.5 + 0.5) * 255)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round((dz * invLen * 0.5 + 0.5) * 255)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  return tex;
}

export function createProceduralTextureSet(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.max(1, Math.min(16, maxAnisotropy));

  let seed = 101;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // 1. Tileable terrain micro-relief bump map (512x512)
  const terrainCanvas = document.createElement('canvas');
  terrainCanvas.width = 512;
  terrainCanvas.height = 512;
  const tCtx = terrainCanvas.getContext('2d')!;
  tCtx.fillStyle = '#808080';
  tCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 11000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 0.8 + rand() * 4.2;
    const v = Math.floor(78 + rand() * 98);
    tCtx.fillStyle = `rgb(${v},${v},${v})`;
    tCtx.beginPath();
    tCtx.arc(x, y, r, 0, Math.PI * 2);
    tCtx.fill();
  }
  const terrainBump = new THREE.CanvasTexture(terrainCanvas);
  terrainBump.wrapS = THREE.RepeatWrapping;
  terrainBump.wrapT = THREE.RepeatWrapping;
  terrainBump.repeat.set(48, 48);
  terrainBump.anisotropy = aniso;

  // 2. Coursed earthen / stone masonry bump map (512x512)
  const masonryCanvas = document.createElement('canvas');
  masonryCanvas.width = 512;
  masonryCanvas.height = 512;
  const mCtx = masonryCanvas.getContext('2d')!;
  mCtx.fillStyle = '#929292';
  mCtx.fillRect(0, 0, 512, 512);
  const rows = 12;
  const rowH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    mCtx.fillStyle = '#484848';
    mCtx.fillRect(0, y, 512, 3);
    const cols = 6;
    const colW = 512 / cols;
    const offset = (r % 2) * (colW * 0.5);
    for (let c = 0; c <= cols; c++) {
      const x = (c * colW + offset) % 512;
      mCtx.fillStyle = '#505050';
      mCtx.fillRect(x, y, 3, rowH);
      const tone = Math.floor(125 + rand() * 42);
      mCtx.fillStyle = `rgba(${tone},${tone},${tone},0.45)`;
      mCtx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);
    }
  }
  const masonryBump = new THREE.CanvasTexture(masonryCanvas);
  masonryBump.wrapS = THREE.RepeatWrapping;
  masonryBump.wrapT = THREE.RepeatWrapping;
  masonryBump.repeat.set(3, 3);
  masonryBump.anisotropy = aniso;

  // 3. Woven thatch / reed roof bump map (256x256)
  const thatchCanvas = document.createElement('canvas');
  thatchCanvas.width = 256;
  thatchCanvas.height = 256;
  const thCtx = thatchCanvas.getContext('2d')!;
  thCtx.fillStyle = '#787878';
  thCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const v = Math.floor(72 + rand() * 130);
    thCtx.strokeStyle = `rgb(${v},${v},${v})`;
    thCtx.lineWidth = 1.6;
    thCtx.beginPath();
    thCtx.moveTo(x, y);
    thCtx.lineTo(x + (rand() - 0.5) * 4, y + 12 + rand() * 12);
    thCtx.stroke();
  }
  const thatchBump = new THREE.CanvasTexture(thatchCanvas);
  thatchBump.wrapS = THREE.RepeatWrapping;
  thatchBump.wrapT = THREE.RepeatWrapping;
  thatchBump.repeat.set(6, 4);
  thatchBump.anisotropy = aniso;

  // 4. Timber wood grain normal map (256x256)
  const timberCanvas = document.createElement('canvas');
  timberCanvas.width = 256;
  timberCanvas.height = 256;
  const tmCtx = timberCanvas.getContext('2d')!;
  tmCtx.fillStyle = '#808080';
  tmCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 3) {
    const grain = Math.sin(x * 0.14 + Math.sin(x * 0.035) * 4.5) * 38;
    const nx = Math.floor(128 + grain);
    tmCtx.fillStyle = `rgb(${nx}, 128, 255)`;
    tmCtx.fillRect(x, 0, 3, 256);
  }
  const timberNormal = new THREE.CanvasTexture(timberCanvas);
  timberNormal.wrapS = THREE.RepeatWrapping;
  timberNormal.wrapT = THREE.RepeatWrapping;
  timberNormal.repeat.set(2, 6);
  timberNormal.anisotropy = aniso;

  // 5. Woven fabric garment normal map (128x128)
  const fabricCanvas = document.createElement('canvas');
  fabricCanvas.width = 128;
  fabricCanvas.height = 128;
  const fbCtx = fabricCanvas.getContext('2d')!;
  fbCtx.fillStyle = '#808080';
  fbCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const isWeft = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0;
      const nx = isWeft ? 160 : 96;
      const ny = isWeft ? 96 : 160;
      fbCtx.fillStyle = `rgb(${nx}, ${ny}, 255)`;
      fbCtx.fillRect(x, y, 4, 4);
    }
  }
  const fabricNormal = new THREE.CanvasTexture(fabricCanvas);
  fabricNormal.wrapS = THREE.RepeatWrapping;
  fabricNormal.wrapT = THREE.RepeatWrapping;
  fabricNormal.repeat.set(8, 8);
  fabricNormal.anisotropy = aniso;

  // 6. Water ripple bump map (256x256)
  const waterCanvas = document.createElement('canvas');
  waterCanvas.width = 256;
  waterCanvas.height = 256;
  const wCtx = waterCanvas.getContext('2d')!;
  wCtx.fillStyle = '#808080';
  wCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    for (let x = 0; x < 256; x += 2) {
      const wave =
        Math.sin((x / 256) * Math.PI * 12) * 0.5 +
        Math.cos((y / 256) * Math.PI * 16 + x * 0.05) * 0.5;
      const val = Math.floor(128 + wave * 56);
      wCtx.fillStyle = `rgb(${val},${val},${val})`;
      wCtx.fillRect(x, y, 2, 2);
    }
  }
  const waterBump = new THREE.CanvasTexture(waterCanvas);
  waterBump.wrapS = THREE.RepeatWrapping;
  waterBump.wrapT = THREE.RepeatWrapping;
  waterBump.repeat.set(24, 24);

  // 7. Soft radial contact shadow disc
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(12, 8, 4, 0.65)');
  grad.addColorStop(0.55, 'rgba(12, 8, 4, 0.32)');
  grad.addColorStop(1, 'rgba(12, 8, 4, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  // 8. Crisp RTS golden selection reticle ring
  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = 256;
  ringCanvas.height = 256;
  const rCtx = ringCanvas.getContext('2d')!;
  rCtx.clearRect(0, 0, 256, 256);
  rCtx.strokeStyle = '#f5c451';
  rCtx.lineWidth = 7;
  rCtx.beginPath();
  rCtx.arc(128, 128, 108, 0, Math.PI * 2);
  rCtx.stroke();
  rCtx.strokeStyle = 'rgba(255, 232, 166, 0.75)';
  rCtx.lineWidth = 3;
  rCtx.setLineDash([14, 10]);
  rCtx.beginPath();
  rCtx.arc(128, 128, 94, 0, Math.PI * 2);
  rCtx.stroke();
  rCtx.setLineDash([]);
  rCtx.fillStyle = '#ffe28a';
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const cx = 128 + Math.cos(angle) * 108;
    const cy = 128 + Math.sin(angle) * 108;
    rCtx.save();
    rCtx.translate(cx, cy);
    rCtx.rotate(angle + Math.PI / 4);
    rCtx.fillRect(-5, -5, 10, 10);
    rCtx.restore();
  }
  const selectionRing = new THREE.CanvasTexture(ringCanvas);
  selectionRing.colorSpace = THREE.SRGBColorSpace;
  selectionRing.anisotropy = aniso;

  // 9. Authentic African Earthen Plaster & Mudbrick Masonry Albedo Map (512x512)
  const masAlbedoCanvas = document.createElement('canvas');
  masAlbedoCanvas.width = 512;
  masAlbedoCanvas.height = 512;
  const maCtx = masAlbedoCanvas.getContext('2d')!;
  maCtx.fillStyle = '#cfa77e';
  maCtx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) {
    const shade = Math.floor(185 + rand() * 44);
    maCtx.fillStyle = `rgba(${shade + 22}, ${shade}, ${shade - 34}, 0.42)`;
    maCtx.fillRect(0, y, 512, 28);
    maCtx.fillStyle = 'rgba(75, 48, 28, 0.35)';
    maCtx.fillRect(0, y + 29, 512, 3);
  }
  for (let i = 0; i < 7500; i++) {
    const px = rand() * 512;
    const py = rand() * 512;
    const fleckType = rand();
    if (fleckType < 0.32) {
      maCtx.strokeStyle = 'rgba(218, 178, 82, 0.65)';
      maCtx.lineWidth = 1.2;
      maCtx.beginPath();
      maCtx.moveTo(px, py);
      maCtx.lineTo(px + (rand() - 0.5) * 8, py + rand() * 6);
      maCtx.stroke();
    } else if (fleckType < 0.66) {
      maCtx.fillStyle = 'rgba(136, 54, 30, 0.44)';
      maCtx.fillRect(px, py, 2, 2);
    } else {
      maCtx.fillStyle = 'rgba(245, 232, 210, 0.48)';
      maCtx.fillRect(px, py, 1.5, 1.5);
    }
  }
  const masonryMap = new THREE.CanvasTexture(masAlbedoCanvas);
  masonryMap.colorSpace = THREE.SRGBColorSpace;
  masonryMap.wrapS = THREE.RepeatWrapping;
  masonryMap.wrapT = THREE.RepeatWrapping;
  masonryMap.repeat.set(4, 4);
  masonryMap.anisotropy = aniso;

  // 10. Golden Woven Thatch & Bundled Reed Roof Albedo Map (512x512)
  const thatchAlbedoCanvas = document.createElement('canvas');
  thatchAlbedoCanvas.width = 512;
  thatchAlbedoCanvas.height = 512;
  const thaCtx = thatchAlbedoCanvas.getContext('2d')!;
  thaCtx.fillStyle = '#ae7a3c';
  thaCtx.fillRect(0, 0, 512, 512);
  const tierH = 42;
  for (let t = 0; t < 512; t += tierH) {
    thaCtx.fillStyle = 'rgba(48, 30, 12, 0.68)';
    thaCtx.fillRect(0, t, 512, 6);
    for (let x = 0; x < 512; x += 2) {
      const yellowTint = Math.floor(155 + rand() * 72);
      const greenTint = Math.floor(108 + rand() * 48);
      thaCtx.fillStyle = `rgb(${yellowTint + 28}, ${yellowTint}, ${Math.floor(greenTint * 0.58)})`;
      thaCtx.fillRect(x, t + 4, 1.8, tierH - 5);
    }
    thaCtx.strokeStyle = 'rgba(84, 52, 22, 0.88)';
    thaCtx.lineWidth = 3.5;
    thaCtx.beginPath();
    thaCtx.moveTo(0, t + tierH * 0.7);
    thaCtx.lineTo(512, t + tierH * 0.7);
    thaCtx.stroke();
  }
  const thatchMap = new THREE.CanvasTexture(thatchAlbedoCanvas);
  thatchMap.colorSpace = THREE.SRGBColorSpace;
  thatchMap.wrapS = THREE.RepeatWrapping;
  thatchMap.wrapT = THREE.RepeatWrapping;
  thatchMap.repeat.set(4, 4);
  thatchMap.anisotropy = aniso;

  // 11. Weathered African Hardwood (Iroko / Mahogany) Albedo Map (512x512)
  const timberAlbedoCanvas = document.createElement('canvas');
  timberAlbedoCanvas.width = 512;
  timberAlbedoCanvas.height = 512;
  const tmaCtx = timberAlbedoCanvas.getContext('2d')!;
  tmaCtx.fillStyle = '#5c3a21';
  tmaCtx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 3) {
    const wave = Math.sin(x * 0.08) * 12 + Math.cos(x * 0.02) * 20;
    const darkness = Math.floor(75 + Math.sin(x * 0.15 + wave * 0.05) * 35);
    tmaCtx.fillStyle = `rgba(${darkness + 25}, ${darkness}, ${Math.max(10, darkness - 25)}, 0.55)`;
    tmaCtx.fillRect(x, 0, 3, 512);
  }
  for (let k = 0; k < 5; k++) {
    const kx = 60 + rand() * 380;
    const ky = 60 + rand() * 380;
    const kGrad = tmaCtx.createRadialGradient(kx, ky, 3, kx, ky, 28);
    kGrad.addColorStop(0, '#2d180b');
    kGrad.addColorStop(0.6, '#462714');
    kGrad.addColorStop(1, 'rgba(92, 58, 33, 0)');
    tmaCtx.fillStyle = kGrad;
    tmaCtx.beginPath();
    tmaCtx.arc(kx, ky, 28, 0, Math.PI * 2);
    tmaCtx.fill();
  }
  const timberMap = new THREE.CanvasTexture(timberAlbedoCanvas);
  timberMap.colorSpace = THREE.SRGBColorSpace;
  timberMap.wrapS = THREE.RepeatWrapping;
  timberMap.wrapT = THREE.RepeatWrapping;
  timberMap.repeat.set(2, 6);
  timberMap.anisotropy = aniso;

  // 12. African Royal Geometric Textile Banner Map (256x256)
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 256;
  bannerCanvas.height = 256;
  const bnCtx = bannerCanvas.getContext('2d')!;
  bnCtx.fillStyle = '#b8321a';
  bnCtx.fillRect(0, 0, 256, 256);
  bnCtx.strokeStyle = '#f5c342';
  bnCtx.lineWidth = 5;
  for (let cy = 16; cy < 256; cy += 64) {
    for (let cx = 16; cx < 256; cx += 64) {
      bnCtx.strokeRect(cx, cy, 32, 32);
      bnCtx.fillStyle = '#e8a826';
      bnCtx.beginPath();
      bnCtx.arc(cx + 16, cy + 16, 6, 0, Math.PI * 2);
      bnCtx.fill();
    }
    bnCtx.beginPath();
    bnCtx.moveTo(0, cy + 48);
    for (let x = 0; x <= 256; x += 16) {
      bnCtx.lineTo(x, (x / 16) % 2 === 0 ? cy + 40 : cy + 54);
    }
    bnCtx.stroke();
  }
  const bannerMap = new THREE.CanvasTexture(bannerCanvas);
  bannerMap.colorSpace = THREE.SRGBColorSpace;
  bannerMap.wrapS = THREE.RepeatWrapping;
  bannerMap.wrapT = THREE.RepeatWrapping;
  bannerMap.repeat.set(1, 2);
  bannerMap.anisotropy = aniso;

  // 13. Authentic African Dappled Ox-Hide Shield Texture (256x256)
  const hideCanvas = document.createElement('canvas');
  hideCanvas.width = 256;
  hideCanvas.height = 256;
  const hCtx = hideCanvas.getContext('2d')!;
  hCtx.fillStyle = '#ede5d8';
  hCtx.fillRect(0, 0, 256, 256);
  hCtx.fillStyle = '#261b14';
  for (let p = 0; p < 8; p++) {
    const px = rand() * 256;
    const py = rand() * 256;
    const pr = 25 + rand() * 45;
    hCtx.beginPath();
    hCtx.ellipse(px, py, pr, pr * (0.6 + rand() * 0.8), rand() * Math.PI, 0, Math.PI * 2);
    hCtx.fill();
  }
  hCtx.fillStyle = '#7a3e1d';
  for (let p = 0; p < 6; p++) {
    const px = rand() * 256;
    const py = rand() * 256;
    const pr = 18 + rand() * 32;
    hCtx.beginPath();
    hCtx.ellipse(px, py, pr, pr * 0.8, rand() * Math.PI, 0, Math.PI * 2);
    hCtx.fill();
  }
  hCtx.strokeStyle = '#18120c';
  hCtx.lineWidth = 4;
  hCtx.beginPath();
  hCtx.moveTo(128, 0);
  hCtx.lineTo(128, 256);
  hCtx.stroke();
  hCtx.fillStyle = '#bda078';
  for (let y = 10; y < 256; y += 14) {
    hCtx.fillRect(122, y, 12, 4);
  }
  const shieldHideMap = new THREE.CanvasTexture(hideCanvas);
  shieldHideMap.colorSpace = THREE.SRGBColorSpace;
  shieldHideMap.anisotropy = aniso;

  // 14. Dappled Acacia & Forest Foliage Canopy Texture (256x256)
  const folCanvas = document.createElement('canvas');
  folCanvas.width = 256;
  folCanvas.height = 256;
  const flCtx = folCanvas.getContext('2d')!;
  flCtx.fillStyle = '#4a6b2f';
  flCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 2 + rand() * 6;
    const gVal = Math.floor(80 + rand() * 95);
    const rVal = Math.floor(gVal * 0.72);
    flCtx.fillStyle = `rgba(${rVal}, ${gVal}, 28, 0.45)`;
    flCtx.beginPath();
    flCtx.arc(x, y, r, 0, Math.PI * 2);
    flCtx.fill();
  }
  const foliageMap = new THREE.CanvasTexture(folCanvas);
  foliageMap.colorSpace = THREE.SRGBColorSpace;
  foliageMap.wrapS = THREE.RepeatWrapping;
  foliageMap.wrapT = THREE.RepeatWrapping;
  foliageMap.repeat.set(3, 3);
  foliageMap.anisotropy = aniso;

  // 15. Soft Volumetric Smoke / Dust Puff Billboard Sprite (128x128)
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 128;
  smokeCanvas.height = 128;
  const smCtx = smokeCanvas.getContext('2d')!;
  smCtx.clearRect(0, 0, 128, 128);
  for (let lobe = 0; lobe < 5; lobe++) {
    const cx = 64 + (rand() - 0.5) * 28;
    const cy = 64 + (rand() - 0.5) * 28;
    const r = 28 + rand() * 20;
    const g = smCtx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(245, 240, 232, 0.55)');
    g.addColorStop(0.55, 'rgba(220, 212, 198, 0.24)');
    g.addColorStop(1, 'rgba(200, 190, 178, 0)');
    smCtx.fillStyle = g;
    smCtx.beginPath();
    smCtx.arc(cx, cy, r, 0, Math.PI * 2);
    smCtx.fill();
  }
  const smokePuffMap = new THREE.CanvasTexture(smokeCanvas);
  smokePuffMap.colorSpace = THREE.SRGBColorSpace;

  // 16. Soft Atmospheric Cloud Cluster Sprite (256x128)
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 256;
  cloudCanvas.height = 128;
  const clCtx = cloudCanvas.getContext('2d')!;
  clCtx.clearRect(0, 0, 256, 128);
  const cloudLobes: [number, number, number][] = [
    [128, 66, 56],
    [88, 72, 42],
    [168, 72, 42],
    [110, 52, 38],
    [150, 54, 36],
  ];
  for (const [cx, cy, rad] of cloudLobes) {
    const cg = clCtx.createRadialGradient(cx, cy, 6, cx, cy, rad);
    cg.addColorStop(0, 'rgba(255, 250, 240, 0.68)');
    cg.addColorStop(0.6, 'rgba(248, 240, 226, 0.25)');
    cg.addColorStop(1, 'rgba(248, 240, 226, 0)');
    clCtx.fillStyle = cg;
    clCtx.beginPath();
    clCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    clCtx.fill();
  }
  const cloudPuffMap = new THREE.CanvasTexture(cloudCanvas);
  cloudPuffMap.colorSpace = THREE.SRGBColorSpace;

  // 17. Organic Rich Soil & Humus Albedo + Normal Maps (512x512)
  const soilCanvas = document.createElement('canvas');
  soilCanvas.width = 512;
  soilCanvas.height = 512;
  const soCtx = soilCanvas.getContext('2d')!;
  soCtx.fillStyle = '#6c4f37';
  soCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9500; i++) {
    const px = rand() * 512;
    const py = rand() * 512;
    const r = 1 + rand() * 4.5;
    const shade = rand();
    if (shade < 0.35) {
      soCtx.fillStyle = `rgba(58, 39, 24, ${0.22 + rand() * 0.28})`;
    } else if (shade < 0.72) {
      soCtx.fillStyle = `rgba(128, 95, 64, ${0.18 + rand() * 0.24})`;
    } else {
      soCtx.fillStyle = `rgba(166, 136, 98, ${0.14 + rand() * 0.2})`;
    }
    soCtx.beginPath();
    soCtx.arc(px, py, r, 0, Math.PI * 2);
    soCtx.fill();
  }
  const soilMap = new THREE.CanvasTexture(soilCanvas);
  soilMap.colorSpace = THREE.SRGBColorSpace;
  soilMap.wrapS = THREE.RepeatWrapping;
  soilMap.wrapT = THREE.RepeatWrapping;
  soilMap.repeat.set(3, 3);
  soilMap.anisotropy = aniso;

  const soilNormCanvas = document.createElement('canvas');
  soilNormCanvas.width = 256;
  soilNormCanvas.height = 256;
  const snCtx = soilNormCanvas.getContext('2d')!;
  snCtx.fillStyle = 'rgb(128, 128, 255)';
  snCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const px = rand() * 256;
    const py = rand() * 256;
    const rad = 1.2 + rand() * 3.2;
    const nx = Math.floor(96 + rand() * 64);
    const ny = Math.floor(96 + rand() * 64);
    snCtx.fillStyle = `rgb(${nx}, ${ny}, 248)`;
    snCtx.beginPath();
    snCtx.arc(px, py, rad, 0, Math.PI * 2);
    snCtx.fill();
  }
  const soilNormal = new THREE.CanvasTexture(soilNormCanvas);
  soilNormal.wrapS = THREE.RepeatWrapping;
  soilNormal.wrapT = THREE.RepeatWrapping;
  soilNormal.repeat.set(3, 3);
  soilNormal.anisotropy = aniso;

  // 18. Deeply Furrowed Hardwood / Acacia Bark Map & Normal Map (512x512)
  const barkCanvas = document.createElement('canvas');
  barkCanvas.width = 512;
  barkCanvas.height = 512;
  const bkCtx = barkCanvas.getContext('2d')!;
  bkCtx.fillStyle = '#4e392a';
  bkCtx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 4) {
    const furrow = Math.sin(x * 0.24 + Math.cos(x * 0.06) * 2.5);
    const v = Math.floor(62 + furrow * 24 + (rand() - 0.5) * 18);
    bkCtx.fillStyle = `rgb(${v + 18}, ${v + 4}, ${Math.max(16, v - 8)})`;
    bkCtx.fillRect(x, 0, 4, 512);
  }
  for (let i = 0; i < 1600; i++) {
    const px = rand() * 512;
    const py = rand() * 512;
    const len = 10 + rand() * 36;
    bkCtx.strokeStyle = rand() < 0.55 ? 'rgba(28, 19, 13, 0.52)' : 'rgba(132, 118, 88, 0.35)';
    bkCtx.lineWidth = 1.4 + rand() * 2.2;
    bkCtx.beginPath();
    bkCtx.moveTo(px, py);
    bkCtx.lineTo(px + (rand() - 0.5) * 5, py + len);
    bkCtx.stroke();
  }
  const barkMap = new THREE.CanvasTexture(barkCanvas);
  barkMap.colorSpace = THREE.SRGBColorSpace;
  barkMap.wrapS = THREE.RepeatWrapping;
  barkMap.wrapT = THREE.RepeatWrapping;
  barkMap.repeat.set(2, 3);
  barkMap.anisotropy = aniso;

  const barkNormCanvas = document.createElement('canvas');
  barkNormCanvas.width = 256;
  barkNormCanvas.height = 256;
  const bknCtx = barkNormCanvas.getContext('2d')!;
  bknCtx.fillStyle = 'rgb(128, 128, 255)';
  bknCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 2) {
    const g = Math.floor(128 + Math.cos(x * 0.45) * 52);
    bknCtx.fillStyle = `rgb(${g}, 128, 250)`;
    bknCtx.fillRect(x, 0, 2, 256);
  }
  const barkNormal = new THREE.CanvasTexture(barkNormCanvas);
  barkNormal.wrapS = THREE.RepeatWrapping;
  barkNormal.wrapT = THREE.RepeatWrapping;
  barkNormal.repeat.set(2, 3);
  barkNormal.anisotropy = aniso;

  // 19. Alpha-Cutout Compound Botanical Leaf Sprig Cluster (512x512 RGBA)
  const leafCanvas = document.createElement('canvas');
  leafCanvas.width = 512;
  leafCanvas.height = 512;
  const lfCtx = leafCanvas.getContext('2d')!;
  lfCtx.clearRect(0, 0, 512, 512);
  // Central & branching twigs
  lfCtx.strokeStyle = '#5a432b';
  lfCtx.lineWidth = 5;
  lfCtx.lineCap = 'round';
  lfCtx.beginPath();
  lfCtx.moveTo(256, 480);
  lfCtx.quadraticCurveTo(252, 280, 256, 65);
  lfCtx.stroke();
  for (let b = 0; b < 8; b++) {
    const by = 415 - b * 44;
    const dir = b % 2 === 0 ? -1 : 1;
    lfCtx.lineWidth = 3;
    lfCtx.beginPath();
    lfCtx.moveTo(256, by);
    lfCtx.quadraticCurveTo(256 + dir * 70, by - 22, 256 + dir * 155, by - 58);
    lfCtx.stroke();
  }
  // Hundreds of layered compound leaflets with warm sunlit rim & deep olive interior
  for (let i = 0; i < 380; i++) {
    const rDist = Math.pow(rand(), 0.68) * 212;
    const ang = rand() * Math.PI * 2;
    const lx = 256 + Math.cos(ang) * rDist;
    const ly = 256 + Math.sin(ang) * rDist * 0.88;
    const leafW = 11 + rand() * 14;
    const leafL = 20 + rand() * 24;
    const rot = ang + (rand() - 0.5) * 0.9;
    const gShade = Math.floor(118 + (1 - rDist / 225) * 35 + rand() * 58);
    const rShade = Math.floor(gShade * (0.64 + rand() * 0.16));
    const bShade = Math.floor(32 + rand() * 26);

    lfCtx.save();
    lfCtx.translate(lx, ly);
    lfCtx.rotate(rot);
    lfCtx.fillStyle = `rgb(${rShade}, ${gShade}, ${bShade})`;
    lfCtx.beginPath();
    lfCtx.ellipse(0, 0, leafL * 0.5, leafW * 0.5, 0, 0, Math.PI * 2);
    lfCtx.fill();
    lfCtx.strokeStyle = `rgba(${Math.min(255, rShade + 36)}, ${Math.min(255, gShade + 34)}, ${bShade + 12}, 0.5)`;
    lfCtx.lineWidth = 1;
    lfCtx.beginPath();
    lfCtx.moveTo(-leafL * 0.42, 0);
    lfCtx.lineTo(leafL * 0.42, 0);
    lfCtx.stroke();
    lfCtx.restore();
  }
  const leafClusterMap = new THREE.CanvasTexture(leafCanvas);
  leafClusterMap.colorSpace = THREE.SRGBColorSpace;
  leafClusterMap.anisotropy = aniso;

  // 20. High-Definition Alpha-Cutout Multi-Blade Grass & Reed Tuft (512x512 RGBA)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 512;
  grassCanvas.height = 512;
  const grCtx = grassCanvas.getContext('2d')!;
  grCtx.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 56; i++) {
    const baseX = 112 + rand() * 288;
    const spread = (baseX - 256) * (0.45 + rand() * 0.95);
    const windLean = (rand() - 0.35) * 44;
    const tipX = baseX + spread + windLean;
    const tipY = 26 + rand() * 180;
    const width = 6 + rand() * 7;
    const midX = (baseX + tipX) * 0.5 + (rand() - 0.5) * 22;
    const midY = (512 + tipY) * 0.5;

    // Root-to-tip sunlit gradient (darker shaded soil root -> bright neutral-warm tip so instance color tints naturally)
    const bladeGrad = grCtx.createLinearGradient(baseX, 512, tipX, tipY);
    const isDryStraw = rand() < 0.22;
    if (isDryStraw) {
      bladeGrad.addColorStop(0, '#5a4e36');
      bladeGrad.addColorStop(0.55, '#d6c48e');
      bladeGrad.addColorStop(1, '#f4e6b8');
    } else {
      const lum = Math.floor(182 + rand() * 64);
      const rLum = Math.floor(lum * (0.86 + rand() * 0.14));
      const bLum = Math.floor(lum * (0.58 + rand() * 0.12));
      bladeGrad.addColorStop(0, `rgb(${Math.floor(rLum * 0.48)}, ${Math.floor(lum * 0.5)}, ${Math.floor(bLum * 0.45)})`);
      bladeGrad.addColorStop(0.45, `rgb(${Math.floor(rLum * 0.88)}, ${Math.floor(lum * 0.92)}, ${Math.floor(bLum * 0.85)})`);
      bladeGrad.addColorStop(1, `rgb(${Math.min(255, rLum + 26)}, ${Math.min(255, lum + 22)}, ${Math.min(255, bLum + 18)})`);
    }

    grCtx.fillStyle = bladeGrad;
    grCtx.beginPath();
    grCtx.moveTo(baseX - width * 0.5, 512);
    grCtx.quadraticCurveTo(midX - width * 0.22, midY, tipX, tipY);
    grCtx.quadraticCurveTo(midX + width * 0.32, midY, baseX + width * 0.5, 512);
    grCtx.closePath();
    grCtx.fill();
  }
  const grassTuftMap = new THREE.CanvasTexture(grassCanvas);
  grassTuftMap.colorSpace = THREE.SRGBColorSpace;
  grassTuftMap.anisotropy = aniso;

  // 21. Concentric Water Ripple Sprite (128x128 RGBA)
  const ripCanvas = document.createElement('canvas');
  ripCanvas.width = 128;
  ripCanvas.height = 128;
  const rpCtx = ripCanvas.getContext('2d')!;
  rpCtx.clearRect(0, 0, 128, 128);
  for (const [radius, lw, alpha] of [
    [54, 4, 0.72],
    [38, 3, 0.45],
    [22, 2, 0.25],
  ] as [number, number, number][]) {
    rpCtx.strokeStyle = `rgba(232, 252, 255, ${alpha})`;
    rpCtx.lineWidth = lw;
    rpCtx.beginPath();
    rpCtx.arc(64, 64, radius, 0, Math.PI * 2);
    rpCtx.stroke();
  }
  const waterRippleMap = new THREE.CanvasTexture(ripCanvas);
  waterRippleMap.colorSpace = THREE.SRGBColorSpace;

  // 22. Neutral-Balanced PBR Grass Turf Albedo + Heightfield Normal (512 / 256)
  const turfCanvas = document.createElement('canvas');
  turfCanvas.width = 512;
  turfCanvas.height = 512;
  const tfCtx = turfCanvas.getContext('2d')!;
  tfCtx.fillStyle = '#c8cbb8';
  tfCtx.fillRect(0, 0, 512, 512);
  const turfH = new Float32Array(256 * 256);
  turfH.fill(0.45);
  // Dark humus & root thatch pockets
  for (let i = 0; i < 4800; i++) {
    const px = rand() * 512;
    const py = rand() * 512;
    const r = 1.6 + rand() * 6.5;
    const isDark = rand() < 0.48;
    tfCtx.fillStyle = isDark
      ? `rgba(88, 76, 56, ${0.14 + rand() * 0.2})`
      : `rgba(232, 234, 210, ${0.12 + rand() * 0.18})`;
    tfCtx.beginPath();
    tfCtx.arc(px, py, r, 0, Math.PI * 2);
    tfCtx.fill();
  }
  // Dense criss-crossed turf grass blades & dry clover stems
  for (let i = 0; i < 8500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const ang = rand() * Math.PI * 2;
    const len = 4 + rand() * 10;
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    const lum = Math.floor(158 + rand() * 88);
    tfCtx.strokeStyle = rand() < 0.18
      ? `rgba(218, 198, 148, 0.58)`
      : `rgba(${Math.floor(lum * 0.92)}, ${lum}, ${Math.floor(lum * 0.82)}, 0.55)`;
    tfCtx.lineWidth = 1.0 + rand() * 1.4;
    tfCtx.beginPath();
    tfCtx.moveTo(x, y);
    tfCtx.lineTo(ex, ey);
    tfCtx.stroke();

    const hx = Math.floor((x / 512) * 256) & 255;
    const hy = Math.floor((y / 512) * 256) & 255;
    turfH[hy * 256 + hx] += 0.32 + rand() * 0.45;
  }
  const grassTurfMap = new THREE.CanvasTexture(turfCanvas);
  grassTurfMap.colorSpace = THREE.SRGBColorSpace;
  grassTurfMap.wrapS = THREE.RepeatWrapping;
  grassTurfMap.wrapT = THREE.RepeatWrapping;
  grassTurfMap.anisotropy = aniso;
  const grassTurfNormal = buildNormalTextureFromHeight(turfH, 256, 2.4, 1, aniso);

  // 23. Compacted Gravel, Crushed Stone & Dusty Dirt Trail Albedo + Normal (512 / 256)
  const gravCanvas = document.createElement('canvas');
  gravCanvas.width = 512;
  gravCanvas.height = 512;
  const gvCtx = gravCanvas.getContext('2d')!;
  gvCtx.fillStyle = '#c4bab0';
  gvCtx.fillRect(0, 0, 512, 512);
  const gravH = new Float32Array(256 * 256);
  gravH.fill(0.4);
  for (let i = 0; i < 6500; i++) {
    const px = rand() * 512;
    const py = rand() * 512;
    const r = 1.2 + rand() * 4.2;
    const tone = rand();
    gvCtx.fillStyle =
      tone < 0.4
        ? `rgba(116, 102, 86, ${0.22 + rand() * 0.26})`
        : tone < 0.8
          ? `rgba(196, 184, 168, ${0.22 + rand() * 0.25})`
          : `rgba(235, 226, 212, ${0.25 + rand() * 0.22})`;
    gvCtx.beginPath();
    gvCtx.arc(px, py, r, 0, Math.PI * 2);
    gvCtx.fill();
  }
  // Sharp angular gravel pebbles & crevices
  for (let i = 0; i < 2400; i++) {
    const px = rand() * 512;
    const py = rand() * 512;
    const rx = 2.0 + rand() * 5.2;
    const ry = 1.4 + rand() * 3.8;
    const ang = rand() * Math.PI;
    const v = Math.floor(136 + rand() * 98);
    gvCtx.save();
    gvCtx.translate(px, py);
    gvCtx.rotate(ang);
    gvCtx.fillStyle = `rgba(${v + 8}, ${v}, ${v - 10}, 0.72)`;
    gvCtx.fillRect(-rx * 0.5, -ry * 0.5, rx, ry);
    gvCtx.strokeStyle = 'rgba(64, 54, 46, 0.45)';
    gvCtx.lineWidth = 0.8;
    gvCtx.strokeRect(-rx * 0.5, -ry * 0.5, rx, ry);
    gvCtx.restore();

    const cx = Math.floor((px / 512) * 256);
    const cy = Math.floor((py / 512) * 256);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const wx = ((cx + ox) & 255);
        const wy = ((cy + oy) & 255);
        gravH[wy * 256 + wx] += ox === 0 && oy === 0 ? 0.85 : 0.42;
      }
    }
  }
  const gravelPathMap = new THREE.CanvasTexture(gravCanvas);
  gravelPathMap.colorSpace = THREE.SRGBColorSpace;
  gravelPathMap.wrapS = THREE.RepeatWrapping;
  gravelPathMap.wrapT = THREE.RepeatWrapping;
  gravelPathMap.anisotropy = aniso;
  const gravelPathNormal = buildNormalTextureFromHeight(gravH, 256, 3.2, 1, aniso);

  // 24. Striated Cliff Rock & Escarpment Bedrock Albedo + Normal (512 / 256)
  const cliffCanvas = document.createElement('canvas');
  cliffCanvas.width = 512;
  cliffCanvas.height = 512;
  const cfCtx = cliffCanvas.getContext('2d')!;
  cfCtx.fillStyle = '#b4aca4';
  cfCtx.fillRect(0, 0, 512, 512);
  const cliffH = new Float32Array(256 * 256);
  for (let y = 0; y < 256; y++) {
    const strata = Math.sin((y / 256) * Math.PI * 14) * 0.25 + Math.sin((y / 256) * Math.PI * 34) * 0.14;
    for (let x = 0; x < 256; x++) {
      const crack = Math.cos((x / 256) * Math.PI * 8 + Math.sin(y * 0.08) * 1.6) * 0.18;
      cliffH[y * 256 + x] = 0.5 + strata + crack;
    }
  }
  // Horizontal sedimentary rock strata bands
  for (let y = 0; y < 512; y += 6) {
    const bandShift = Math.sin(y * 0.09) * 26 + (rand() - 0.5) * 24;
    const tone = Math.floor(156 + bandShift);
    cfCtx.fillStyle = `rgba(${tone + 10}, ${tone}, ${tone - 10}, 0.52)`;
    cfCtx.fillRect(0, y, 512, 4 + rand() * 5);
    if (rand() < 0.28) {
      cfCtx.fillStyle = 'rgba(54, 44, 38, 0.48)';
      cfCtx.fillRect(0, y, 512, 2);
    }
  }
  // Angular fracture lines & lichen/mineral speckles
  for (let i = 0; i < 180; i++) {
    const sx = rand() * 512;
    const sy = rand() * 512;
    cfCtx.strokeStyle = rand() < 0.6 ? 'rgba(46, 38, 34, 0.46)' : 'rgba(224, 214, 198, 0.32)';
    cfCtx.lineWidth = 1.2 + rand() * 2.2;
    cfCtx.beginPath();
    cfCtx.moveTo(sx, sy);
    cfCtx.lineTo(sx + (rand() - 0.5) * 65, sy + 18 + rand() * 44);
    cfCtx.stroke();
  }
  for (let i = 0; i < 4200; i++) {
    const px = rand() * 512;
    const py = rand() * 512;
    const sz = 1 + rand() * 3.2;
    const v = Math.floor(88 + rand() * 140);
    cfCtx.fillStyle = `rgba(${v}, ${v - 4}, ${v - 8}, 0.34)`;
    cfCtx.fillRect(px, py, sz, sz);
    const cx = Math.floor((px / 512) * 256) & 255;
    const cy = Math.floor((py / 512) * 256) & 255;
    cliffH[cy * 256 + cx] += (rand() - 0.5) * 0.55;
  }
  const cliffRockMap = new THREE.CanvasTexture(cliffCanvas);
  cliffRockMap.colorSpace = THREE.SRGBColorSpace;
  cliffRockMap.wrapS = THREE.RepeatWrapping;
  cliffRockMap.wrapT = THREE.RepeatWrapping;
  cliffRockMap.anisotropy = aniso;
  const cliffRockNormal = buildNormalTextureFromHeight(cliffH, 256, 4.1, 1, aniso);

  // 25. Alpha-Cutout Fallen Ground Leaves Cluster (256x256 RGBA)
  const flCanvas = document.createElement('canvas');
  flCanvas.width = 256;
  flCanvas.height = 256;
  const fCtx = flCanvas.getContext('2d')!;
  fCtx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 14; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 16 + rand() * 82;
    const lx = 128 + Math.cos(ang) * dist;
    const ly = 128 + Math.sin(ang) * dist;
    const rot = rand() * Math.PI * 2;
    const lLen = 20 + rand() * 20;
    const lWid = 9 + rand() * 9;
    const palettePick = rand();
    const fillCol =
      palettePick < 0.38
        ? '#b87c38' // sunlit amber leaf
        : palettePick < 0.72
          ? '#8c622e' // warm dry umber
          : palettePick < 0.9
            ? '#7e8a3c' // fallen olive-green
            : '#5c3c22'; // dark aged mulch
    fCtx.save();
    fCtx.translate(lx, ly);
    fCtx.rotate(rot);
    fCtx.fillStyle = fillCol;
    fCtx.beginPath();
    fCtx.moveTo(-lLen * 0.5, 0);
    fCtx.quadraticCurveTo(0, -lWid * 0.65, lLen * 0.5, 0);
    fCtx.quadraticCurveTo(0, lWid * 0.65, -lLen * 0.5, 0);
    fCtx.fill();
    fCtx.strokeStyle = 'rgba(42, 26, 14, 0.55)';
    fCtx.lineWidth = 1.1;
    fCtx.beginPath();
    fCtx.moveTo(-lLen * 0.48, 0);
    fCtx.lineTo(lLen * 0.45, 0);
    fCtx.stroke();
    fCtx.restore();
  }
  const fallenLeafMap = new THREE.CanvasTexture(flCanvas);
  fallenLeafMap.colorSpace = THREE.SRGBColorSpace;
  fallenLeafMap.anisotropy = aniso;

  // 26. Warm Sunlit Dust Mote Sprite (64x64 RGBA)
  const dmCanvas = document.createElement('canvas');
  dmCanvas.width = 64;
  dmCanvas.height = 64;
  const dmCtx = dmCanvas.getContext('2d')!;
  dmCtx.clearRect(0, 0, 64, 64);
  const dmGrad = dmCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  dmGrad.addColorStop(0, 'rgba(255, 240, 205, 0.95)');
  dmGrad.addColorStop(0.45, 'rgba(244, 212, 162, 0.5)');
  dmGrad.addColorStop(1, 'rgba(232, 195, 142, 0)');
  dmCtx.fillStyle = dmGrad;
  dmCtx.beginPath();
  dmCtx.arc(32, 32, 30, 0, Math.PI * 2);
  dmCtx.fill();
  const dustMoteMap = new THREE.CanvasTexture(dmCanvas);
  dustMoteMap.colorSpace = THREE.SRGBColorSpace;

  return {
    terrainBump,
    masonryBump,
    thatchBump,
    timberNormal,
    fabricNormal,
    waterBump,
    contactShadow,
    selectionRing,
    masonryMap,
    thatchMap,
    timberMap,
    bannerMap,
    shieldHideMap,
    foliageMap,
    smokePuffMap,
    cloudPuffMap,
    soilMap,
    soilNormal,
    grassTurfMap,
    grassTurfNormal,
    gravelPathMap,
    gravelPathNormal,
    cliffRockMap,
    cliffRockNormal,
    fallenLeafMap,
    dustMoteMap,
    barkMap,
    barkNormal,
    leafClusterMap,
    grassTuftMap,
    waterRippleMap,
    dispose: () => {
      terrainBump.dispose();
      masonryBump.dispose();
      thatchBump.dispose();
      timberNormal.dispose();
      fabricNormal.dispose();
      waterBump.dispose();
      contactShadow.dispose();
      selectionRing.dispose();
      masonryMap.dispose();
      thatchMap.dispose();
      timberMap.dispose();
      bannerMap.dispose();
      shieldHideMap.dispose();
      foliageMap.dispose();
      smokePuffMap.dispose();
      cloudPuffMap.dispose();
      soilMap.dispose();
      soilNormal.dispose();
      grassTurfMap.dispose();
      grassTurfNormal.dispose();
      gravelPathMap.dispose();
      gravelPathNormal.dispose();
      cliffRockMap.dispose();
      cliffRockNormal.dispose();
      fallenLeafMap.dispose();
      dustMoteMap.dispose();
      barkMap.dispose();
      barkNormal.dispose();
      leafClusterMap.dispose();
      grassTuftMap.dispose();
      waterRippleMap.dispose();
    },
  };
}


