import { RegionConfig } from '../../types/game';

export const WATER_LEVEL = -0.55;

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise2D(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fz = smoothstep(z - iz);

  const v00 = hash2D(ix, iz, seed);
  const v10 = hash2D(ix + 1, iz, seed);
  const v01 = hash2D(ix, iz + 1, seed);
  const v11 = hash2D(ix + 1, iz + 1, seed);

  const nx0 = v00 + (v10 - v00) * fx;
  const nx1 = v01 + (v11 - v01) * fx;
  return (nx0 + (nx1 - nx0) * fz) * 2 - 1;
}

export function fbm2D(
  x: number,
  z: number,
  seed: number,
  octaves = 4,
  lacunarity = 2.05,
  gain = 0.5,
): number {
  let amp = 1.0;
  let freq = 1.0;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, z * freq, seed + i * 97);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/**
 * Returns the Z centerline of the meandering river at world X.
 * Kept south of the central settlement clearing (~z = +29 around x = 0).
 */
export function getRiverCenterZ(x: number, seed: number): number {
  const phase = (seed % 100) * 0.0628;
  return 23.5 + Math.sin(x * 0.038 + phase) * 5.8 + Math.cos(x * 0.019 - phase * 0.5) * 3.2;
}

export function distanceToSegment2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 1e-6) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq));
  const projX = ax + t * vx;
  const projZ = az + t * vz;
  return Math.hypot(px - projX, pz - projZ);
}

/**
 * Computes terrain height Y at world (x, z) for the given RegionConfig and seed.
 * Flattens a gentle terrace around the starting settlement (radius ~26m)
 * while sculpting rivers, coastlines, hills, and natural outer perimeter ridges.
 */
export function sampleTerrainHeight(
  x: number,
  z: number,
  region: RegionConfig,
  seed: number,
): number {
  const { elevationScale, ridgeSharpness, riverWidth, hasCoastline } = region.terrain;

  // Base rolling macro & meso topography
  const macro = fbm2D(x * 0.014, z * 0.014, seed, 4);
  const ridged = Math.pow(Math.abs(fbm2D(x * 0.026 + 11.3, z * 0.026 - 7.1, seed + 311, 3)), ridgeSharpness);
  const detail = fbm2D(x * 0.08, z * 0.08, seed + 733, 2) * 0.32;

  let h = 0.85 + macro * elevationScale * 0.62 + ridged * elevationScale * 0.72 + detail;

  // Natural outer highlands / escarpment around world edge (never a flat box wall)
  const radialDist = Math.hypot(x, z);
  if (!hasCoastline || z < 20) {
    const rimT = Math.max(0, Math.min(1, (radialDist - 68) / 46));
    const rimSmooth = rimT * rimT * (3 - 2 * rimT);
    const rimNoise = 0.65 + 0.55 * Math.abs(valueNoise2D(x * 0.04, z * 0.04, seed + 919));
    h += rimSmooth * (5.5 + elevationScale * 0.9) * rimNoise;
  }

  // Gently flatten the central settlement terrace so compounds, paths, and farms sit naturally
  const settlementDist = Math.hypot(x - 1.5, z + 2.0);
  const terraceBlend = 1 - Math.max(0, Math.min(1, (settlementDist - 18) / 16));
  const smoothTerrace = terraceBlend * terraceBlend * (3 - 2 * terraceBlend);
  const targetPlateau = 1.25 + detail * 0.16;
  h = h * (1 - smoothTerrace) + targetPlateau * smoothTerrace;

  // Carve meandering river channel or southern coastal harbour bay
  if (hasCoastline) {
    const shorelineZ = 25.0 + Math.sin(x * 0.042) * 6.0 + Math.cos(x * 0.09) * 2.5;
    const bayDelta = z - shorelineZ;
    if (bayDelta > -8) {
      const coastT = Math.max(0, Math.min(1, (bayDelta + 8) / 18));
      const smoothCoast = coastT * coastT * (3 - 2 * coastT);
      const seaFloor = -2.4 + detail * 0.25;
      h = h * (1 - smoothCoast) + seaFloor * smoothCoast;
    }
    // Small freshwater estuary stream feeding into the harbour from north-west
    const streamX = -24 + z * 0.35 + Math.sin(z * 0.08) * 3.5;
    const streamDist = Math.abs(x - streamX);
    if (z < shorelineZ + 4 && streamDist < riverWidth * 1.3) {
      const st = 1 - Math.min(1, streamDist / (riverWidth * 1.3));
      h -= st * st * 2.3;
    }
  } else {
    const riverZ = getRiverCenterZ(x, seed);
    const distToRiver = Math.abs(z - riverZ);
    const halfSpan = riverWidth * 1.35;
    if (distToRiver < halfSpan) {
      const rt = 1 - distToRiver / halfSpan;
      const carve = rt * rt * (3 - 2 * rt);
      const bedDepth = -2.05 + detail * 0.18;
      h = h * (1 - carve) + bedDepth * carve;
    }
  }

  return h;
}

export function isWaterAt(x: number, z: number, region: RegionConfig, seed: number): boolean {
  return sampleTerrainHeight(x, z, region, seed) < WATER_LEVEL + 0.08;
}

export function sampleTerrainSlope(
  x: number,
  z: number,
  region: RegionConfig,
  seed: number,
): number {
  const eps = 0.75;
  const hx1 = sampleTerrainHeight(x + eps, z, region, seed);
  const hx0 = sampleTerrainHeight(x - eps, z, region, seed);
  const hz1 = sampleTerrainHeight(x, z + eps, region, seed);
  const hz0 = sampleTerrainHeight(x, z - eps, region, seed);
  const dx = (hx1 - hx0) / (2 * eps);
  const dz = (hz1 - hz0) / (2 * eps);
  return Math.hypot(dx, dz);
}
