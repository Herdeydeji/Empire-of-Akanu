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
 * Sculpts dramatic rolling hills, sharp domain-warped ridges, sedimentary terraces,
 * and eroded rain gullies while preserving a smooth settlement terrace and riverbeds.
 */
export function sampleTerrainHeight(
  x: number,
  z: number,
  region: RegionConfig,
  seed: number,
): number {
  const { elevationScale, ridgeSharpness, riverWidth, hasCoastline } = region.terrain;

  // Domain warp coordinates so hills and ridges curve organically rather than forming grid bumps
  const warpX = x + fbm2D(x * 0.012 + 3.1, z * 0.012 - 5.7, seed + 17, 2) * 14.0;
  const warpZ = z + fbm2D(x * 0.012 - 8.4, z * 0.012 + 4.9, seed + 53, 2) * 14.0;

  // Rolling macro valleys & hills + sharp folded ridge crests
  const macro = fbm2D(warpX * 0.013, warpZ * 0.013, seed, 4);
  const ridgeRaw = 1.0 - Math.abs(fbm2D(warpX * 0.022 + 11.3, warpZ * 0.022 - 7.1, seed + 311, 3));
  const ridged = Math.pow(Math.max(0, ridgeRaw), Math.max(0.85, ridgeSharpness * 1.18));

  // Eroded gullies / dry wash channels along hillsides
  const gullyRaw = Math.abs(fbm2D(warpX * 0.045 - 4.2, warpZ * 0.045 + 6.8, seed + 509, 2));
  const gullyCarve = (1.0 - smoothstep(Math.min(1, gullyRaw * 2.8))) * 0.95;

  // Micro soil undulation
  const detail = fbm2D(x * 0.075, z * 0.075, seed + 733, 2) * 0.28;
  const fineGrain = valueNoise2D(x * 0.22, z * 0.22, seed + 881) * 0.06;

  let h =
    0.75 +
    macro * elevationScale * 0.56 +
    ridged * elevationScale * 0.95 -
    gullyCarve * (0.35 + elevationScale * 0.14) +
    detail +
    fineGrain;

  // Gentle sedimentary plateau terracing on elevated hillsides (y > 2.3)
  if (h > 2.3) {
    const stepH = 2.4;
    const rel = (h - 2.3) / stepH;
    const band = Math.floor(rel);
    const frac = rel - band;
    // Soft tread & steeper riser profile
    const terraced = band + Math.pow(smoothstep(frac), 1.45);
    const terracedH = 2.3 + terraced * stepH;
    h = h * 0.58 + terracedH * 0.42;
  }

  // Dramatic outer mountain ridges & terraced escarpments framing the horizon (clear of river valley)
  const radialDist = Math.hypot(x, z);
  const riverClearDist = hasCoastline ? Math.max(0, 22 - z) : Math.abs(z - getRiverCenterZ(x, seed));
  const riverCorridorAtten = hasCoastline
    ? z < 16
      ? 1
      : 0
    : Math.max(0, Math.min(1, (riverClearDist - riverWidth * 1.6) / 10));
  if (!hasCoastline || z < 18) {
    const rimT = Math.max(0, Math.min(1, (radialDist - 68) / 46));
    const rimSmooth = rimT * rimT * (3 - 2 * rimT);
    const rimFold = 0.55 + 0.72 * Math.pow(1.0 - Math.abs(valueNoise2D(warpX * 0.036, warpZ * 0.036, seed + 919)), 1.3);
    const rimStep = (8.4 + elevationScale * 1.25) * rimFold;
    h += rimSmooth * rimStep * riverCorridorAtten;
  }

  // Gently flatten the central settlement terrace so compounds, paths, and farms sit flush
  const settlementDist = Math.hypot(x - 1.5, z + 2.0);
  const terraceBlend = 1 - Math.max(0, Math.min(1, (settlementDist - 18) / 16));
  const smoothTerrace = terraceBlend * terraceBlend * (3 - 2 * terraceBlend);
  const targetPlateau = 1.24 + detail * 0.12;
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
    const streamX = -24 + z * 0.35 + Math.sin(z * 0.08) * 3.5;
    const streamDist = Math.abs(x - streamX);
    if (z < shorelineZ + 4 && streamDist < riverWidth * 1.3) {
      const st = 1 - Math.min(1, streamDist / (riverWidth * 1.3));
      h -= st * st * 2.3;
    }
  } else {
    const riverZ = getRiverCenterZ(x, seed);
    const distToRiver = Math.abs(z - riverZ);
    const halfSpan = riverWidth * 1.38;
    if (distToRiver < halfSpan) {
      const rt = 1 - distToRiver / halfSpan;
      const carve = rt * rt * (3 - 2 * rt);
      const bedDepth = -2.05 + detail * 0.16;
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

export interface RiverShorePoint {
  bankX: number;
  bankZ: number;
  waterX: number;
  waterZ: number;
  bankY: number;
}

const shoreCache = new Map<string, RiverShorePoint>();

/**
 * Finds the nearest dry walkable riverbank point adjacent to real shallow water
 * so farmers can walk to the river edge, face the water, and scoop water without walking underwater.
 */
export function findNearestRiverShorePoint(
  fromX: number,
  fromZ: number,
  region: RegionConfig,
  seed: number,
): RiverShorePoint {
  const key = `${region.id}:${seed}:${Math.round(fromX / 2) * 2}:${Math.round(fromZ / 2) * 2}`;
  const cached = shoreCache.get(key);
  if (cached) return cached;

  let best: RiverShorePoint | null = null;
  let bestDistSq = Infinity;

  // Radial spiral search outward up to 68m to locate shoreline
  for (let radius = 3; radius <= 68; radius += 3) {
    const steps = Math.max(12, Math.round(radius * 1.4));
    for (let s = 0; s < steps; s++) {
      const ang = (s / steps) * Math.PI * 2;
      const bx = fromX + Math.cos(ang) * radius;
      const bz = fromZ + Math.sin(ang) * radius;
      if (Math.abs(bx) > 84 || Math.abs(bz) > 84) continue;

      const by = sampleTerrainHeight(bx, bz, region, seed);
      if (by < WATER_LEVEL + 0.08 || by > WATER_LEVEL + 0.48) continue;
      if (sampleTerrainSlope(bx, bz, region, seed) > 0.62) continue;

      // Check adjacent probes in 8 directions at 1.45m to verify real water edge
      let foundWater: { x: number; z: number } | null = null;
      for (let d = 0; d < 8; d++) {
        const dang = (d / 8) * Math.PI * 2;
        const wx = bx + Math.cos(dang) * 1.45;
        const wz = bz + Math.sin(dang) * 1.45;
        const wy = sampleTerrainHeight(wx, wz, region, seed);
        if (wy <= WATER_LEVEL + 0.04) {
          foundWater = { x: wx, z: wz };
          break;
        }
      }

      if (foundWater) {
        const dSq = (bx - fromX) ** 2 + (bz - fromZ) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = {
            bankX: bx,
            bankZ: bz,
            waterX: foundWater.x,
            waterZ: foundWater.z,
            bankY: by,
          };
        }
      }
    }
    if (best && radius >= Math.sqrt(bestDistSq) + 4) {
      break;
    }
  }

  // Fallback directly toward canonical river center
  if (!best) {
    const riverZ = getRiverCenterZ(fromX, seed);
    const bankZ = riverZ - region.terrain.riverWidth * 1.15;
    const bankY = Math.max(WATER_LEVEL + 0.14, sampleTerrainHeight(fromX, bankZ, region, seed));
    best = {
      bankX: fromX,
      bankZ,
      waterX: fromX,
      waterZ: riverZ,
      bankY,
    };
  }

  if (shoreCache.size > 400) {
    shoreCache.clear();
  }
  shoreCache.set(key, best);
  return best;
}

