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
  dispose: () => void;
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
  for (let i = 0; i < 9500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 1 + rand() * 4.5;
    const v = Math.floor(85 + rand() * 85);
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
  for (let i = 0; i < 2400; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const v = Math.floor(75 + rand() * 125);
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
  for (let x = 0; x < 256; x += 4) {
    const grain = Math.sin(x * 0.12 + Math.sin(x * 0.03) * 4) * 35;
    const nx = Math.floor(128 + grain);
    tmCtx.fillStyle = `rgb(${nx}, 128, 255)`;
    tmCtx.fillRect(x, 0, 4, 256);
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

  // 9. Authentic African Earthen Plaster & Brick Masonry Albedo Map (512x512)
  const masAlbedoCanvas = document.createElement('canvas');
  masAlbedoCanvas.width = 512;
  masAlbedoCanvas.height = 512;
  const maCtx = masAlbedoCanvas.getContext('2d')!;
  maCtx.fillStyle = '#d6b28d';
  maCtx.fillRect(0, 0, 512, 512);
  // Organic earthen trowel strokes & horizontal lime wash bands
  for (let y = 0; y < 512; y += 32) {
    const shade = Math.floor(190 + rand() * 45);
    maCtx.fillStyle = `rgba(${shade + 20}, ${shade}, ${shade - 30}, 0.35)`;
    maCtx.fillRect(0, y, 512, 28);
    // Subtle mortar/course joints
    maCtx.fillStyle = 'rgba(75, 48, 28, 0.35)';
    maCtx.fillRect(0, y + 29, 512, 3);
  }
  // Straw flecks and mineral pigment granules
  for (let i = 0; i < 6000; i++) {
    const px = rand() * 512;
    const py = rand() * 512;
    const fleckType = rand();
    if (fleckType < 0.3) {
      // Golden straw bit
      maCtx.strokeStyle = 'rgba(215, 175, 75, 0.65)';
      maCtx.lineWidth = 1.2;
      maCtx.beginPath();
      maCtx.moveTo(px, py);
      maCtx.lineTo(px + (rand() - 0.5) * 8, py + rand() * 6);
      maCtx.stroke();
    } else if (fleckType < 0.65) {
      // Dark red iron oxide speckle
      maCtx.fillStyle = 'rgba(140, 55, 30, 0.45)';
      maCtx.fillRect(px, py, 2, 2);
    } else {
      // Quartz grit
      maCtx.fillStyle = 'rgba(245, 235, 215, 0.5)';
      maCtx.fillRect(px, py, 1.5, 1.5);
    }
  }
  const masonryMap = new THREE.CanvasTexture(masAlbedoCanvas);
  masonryMap.colorSpace = THREE.SRGBColorSpace;
  masonryMap.wrapS = THREE.RepeatWrapping;
  masonryMap.wrapT = THREE.RepeatWrapping;
  masonryMap.repeat.set(4, 4);
  masonryMap.anisotropy = aniso;

  // 10. Golden Woven Thatch & Reed Roof Albedo Map (512x512)
  const thatchAlbedoCanvas = document.createElement('canvas');
  thatchAlbedoCanvas.width = 512;
  thatchAlbedoCanvas.height = 512;
  const thaCtx = thatchAlbedoCanvas.getContext('2d')!;
  thaCtx.fillStyle = '#b88344';
  thaCtx.fillRect(0, 0, 512, 512);
  // Layered overlapping reed tiers
  const tierH = 42;
  for (let t = 0; t < 512; t += tierH) {
    // Drop shadow under tier overhang
    thaCtx.fillStyle = 'rgba(55, 35, 15, 0.65)';
    thaCtx.fillRect(0, t, 512, 6);
    // Vertical straw fibers
    for (let x = 0; x < 512; x += 2) {
      const yellowTint = Math.floor(165 + rand() * 65);
      const greenTint = Math.floor(115 + rand() * 45);
      thaCtx.fillStyle = `rgb(${yellowTint + 30}, ${yellowTint}, ${greenTint * 0.6})`;
      thaCtx.fillRect(x, t + 4, 1.8, tierH - 5);
    }
    // Horizontal woven fiber binding cord
    thaCtx.strokeStyle = 'rgba(90, 58, 25, 0.85)';
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
  // Rich wood grain streaks & knots
  for (let x = 0; x < 512; x += 3) {
    const wave = Math.sin(x * 0.08) * 12 + Math.cos(x * 0.02) * 20;
    const darkness = Math.floor(75 + Math.sin(x * 0.15 + wave * 0.05) * 35);
    tmaCtx.fillStyle = `rgba(${darkness + 25}, ${darkness}, ${Math.max(10, darkness - 25)}, 0.55)`;
    tmaCtx.fillRect(x, 0, 3, 512);
  }
  // Wood knots
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
  bnCtx.fillStyle = '#b8321a'; // Deep royal terracotta crimson
  bnCtx.fillRect(0, 0, 256, 256);
  // Gold geometric adinkra/kente diamond & chevron pattern
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
    // Chevron band
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
  hCtx.fillStyle = '#ede5d8'; // Ivory base cowhide
  hCtx.fillRect(0, 0, 256, 256);
  // Organic dark brown/black cattle hide patches
  hCtx.fillStyle = '#261b14';
  for (let p = 0; p < 8; p++) {
    const px = rand() * 256;
    const py = rand() * 256;
    const pr = 25 + rand() * 45;
    hCtx.beginPath();
    hCtx.ellipse(px, py, pr, pr * (0.6 + rand() * 0.8), rand() * Math.PI, 0, Math.PI * 2);
    hCtx.fill();
  }
  // Chestnut accent splashes
  hCtx.fillStyle = '#7a3e1d';
  for (let p = 0; p < 6; p++) {
    const px = rand() * 256;
    const py = rand() * 256;
    const pr = 18 + rand() * 32;
    hCtx.beginPath();
    hCtx.ellipse(px, py, pr, pr * 0.8, rand() * Math.PI, 0, Math.PI * 2);
    hCtx.fill();
  }
  // Vertical woven cane stitching down center spine
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
    },
  };
}

