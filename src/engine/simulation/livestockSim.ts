import { BuildingEntity, KingdomId, RegionConfig, WorldPosition } from '../../types/game';
import {
  createSeededRandom,
  sampleTerrainHeight,
  sampleTerrainSlope,
  WATER_LEVEL,
} from '../math/noise';

export type LivestockKind = 'cattle' | 'goat' | 'chicken';

export interface LivestockEntity {
  id: string;
  kind: LivestockKind;
  kingdomId: KingdomId;
  variant: number;
  position: WorldPosition;
  rotationY: number;
  homeX: number;
  homeZ: number;
  wanderRadius: number;
  targetX: number;
  targetZ: number;
  speed: number;
  state: 'grazing' | 'walking' | 'resting';
  stateTimer: number;
  gaitPhase: number;
  headBobPhase: number;
}

function isDryAnimalSpot(
  x: number,
  z: number,
  buildings: BuildingEntity[],
  region: RegionConfig,
  seed: number,
): boolean {
  if (Math.abs(x) > 84 || Math.abs(z) > 84) return false;
  const y = sampleTerrainHeight(x, z, region, seed);
  if (y < WATER_LEVEL + 0.28) return false;
  if (sampleTerrainSlope(x, z, region, seed) > 0.58) return false;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (b.constructionState === 'destroyed') continue;
    const minR = b.archetype === 'cultivated_farm' ? b.footprintRadius * 0.72 : b.footprintRadius + 0.75;
    if (Math.hypot(x - b.position.x, z - b.position.z) < minR) {
      return false;
    }
  }
  return true;
}

function findDryAnchorNear(
  cx: number,
  cz: number,
  minDist: number,
  maxDist: number,
  rand: () => number,
  buildings: BuildingEntity[],
  region: RegionConfig,
  seed: number,
): { x: number; z: number } {
  for (let attempt = 0; attempt < 24; attempt++) {
    const ang = rand() * Math.PI * 2;
    const dist = minDist + rand() * (maxDist - minDist);
    const x = cx + Math.cos(ang) * dist;
    const z = cz + Math.sin(ang) * dist;
    if (isDryAnimalSpot(x, z, buildings, region, seed)) {
      return { x, z };
    }
  }
  const yFallback = sampleTerrainHeight(cx, cz, region, seed);
  if (yFallback >= WATER_LEVEL + 0.25) return { x: cx, z: cz };
  return { x: cx, z: cz - 6 };
}

export function createInitialVillageLivestock(
  buildings: BuildingEntity[],
  region: RegionConfig,
  seed: number,
  playerKingdomId: KingdomId,
): LivestockEntity[] {
  const rand = createSeededRandom(seed + 8821);
  const livestock: LivestockEntity[] = [];

  // Group buildings by kingdomId to anchor herds authentically inside each village
  const byKingdom = new Map<KingdomId, BuildingEntity[]>();
  for (const b of buildings) {
    const list = byKingdom.get(b.kingdomId) ?? [];
    list.push(b);
    byKingdom.set(b.kingdomId, list);
  }

  for (const [kingdomId, kBuildings] of byKingdom.entries()) {
    const isPlayer = kingdomId === playerKingdomId;
    const farmAnchor =
      kBuildings.find((b) => b.archetype === 'cultivated_farm') ??
      kBuildings.find((b) => b.archetype === 'granary_storehouse') ??
      kBuildings[0];
    const dwellingAnchor =
      kBuildings.find((b) => b.archetype === 'dwelling_house') ??
      kBuildings.find((b) => b.archetype === 'residential_compound') ??
      kBuildings[0];
    const compoundAnchor =
      kBuildings.find((b) => b.archetype === 'royal_compound') ?? kBuildings[0];

    if (!compoundAnchor) continue;

    // 1. Cattle pasture herd near farms/outer meadow
    const cattleCenter = farmAnchor ?? compoundAnchor;
    const cattleCount = isPlayer ? 5 : 3;
    for (let i = 0; i < cattleCount; i++) {
      const pos = findDryAnchorNear(
        cattleCenter.position.x + (i % 2 === 0 ? 4.5 : -4.5),
        cattleCenter.position.z + 3.5,
        3.2,
        10.5,
        rand,
        buildings,
        region,
        seed,
      );
      const y = Math.max(WATER_LEVEL + 0.28, sampleTerrainHeight(pos.x, pos.z, region, seed));
      livestock.push({
        id: `livestock_${kingdomId}_cattle_${i}`,
        kind: 'cattle',
        kingdomId,
        variant: i % 3,
        position: { x: pos.x, y, z: pos.z },
        rotationY: rand() * Math.PI * 2,
        homeX: pos.x,
        homeZ: pos.z,
        wanderRadius: 7.5,
        targetX: pos.x,
        targetZ: pos.z,
        speed: 0,
        state: i % 2 === 0 ? 'grazing' : 'resting',
        stateTimer: 1.5 + rand() * 4.5,
        gaitPhase: rand() * Math.PI * 2,
        headBobPhase: rand() * Math.PI * 2,
      });
    }

    // 2. Goats roaming homestead margins & granary edges
    const goatAnchor = dwellingAnchor ?? compoundAnchor;
    const goatCount = isPlayer ? 6 : 3;
    for (let i = 0; i < goatCount; i++) {
      const pos = findDryAnchorNear(
        goatAnchor.position.x,
        goatAnchor.position.z,
        3.6,
        9.5,
        rand,
        buildings,
        region,
        seed,
      );
      const y = Math.max(WATER_LEVEL + 0.28, sampleTerrainHeight(pos.x, pos.z, region, seed));
      livestock.push({
        id: `livestock_${kingdomId}_goat_${i}`,
        kind: 'goat',
        kingdomId,
        variant: i % 3,
        position: { x: pos.x, y, z: pos.z },
        rotationY: rand() * Math.PI * 2,
        homeX: pos.x,
        homeZ: pos.z,
        wanderRadius: 6.5,
        targetX: pos.x,
        targetZ: pos.z,
        speed: 0,
        state: i % 3 === 0 ? 'walking' : 'grazing',
        stateTimer: 1.0 + rand() * 3.8,
        gaitPhase: rand() * Math.PI * 2,
        headBobPhase: rand() * Math.PI * 2,
      });
    }

    // 3. Chickens scratching and pecking right around courtyard dwellings & granaries
    const chickenAnchor =
      kBuildings.find((b) => b.archetype === 'granary_storehouse') ??
      dwellingAnchor ??
      compoundAnchor;
    const chickenCount = isPlayer ? 9 : 4;
    for (let i = 0; i < chickenCount; i++) {
      const base = i % 2 === 0 ? chickenAnchor : compoundAnchor;
      const pos = findDryAnchorNear(
        base.position.x,
        base.position.z,
        2.8,
        7.5,
        rand,
        buildings,
        region,
        seed,
      );
      const y = Math.max(WATER_LEVEL + 0.28, sampleTerrainHeight(pos.x, pos.z, region, seed));
      livestock.push({
        id: `livestock_${kingdomId}_chicken_${i}`,
        kind: 'chicken',
        kingdomId,
        variant: i % 3,
        position: { x: pos.x, y, z: pos.z },
        rotationY: rand() * Math.PI * 2,
        homeX: pos.x,
        homeZ: pos.z,
        wanderRadius: 4.5,
        targetX: pos.x,
        targetZ: pos.z,
        speed: 0,
        state: i % 2 === 0 ? 'grazing' : 'walking',
        stateTimer: 0.6 + rand() * 2.4,
        gaitPhase: rand() * Math.PI * 2,
        headBobPhase: rand() * Math.PI * 2,
      });
    }
  }

  return livestock;
}

function shortestAngle(from: number, to: number): number {
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function stepVillageLivestock(
  livestock: LivestockEntity[],
  buildings: BuildingEntity[],
  rawDt: number,
  region: RegionConfig,
  seed: number,
  elapsedSeconds: number,
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return;

  for (let i = 0; i < livestock.length; i++) {
    const animal = livestock[i];
    animal.stateTimer -= dt;
    animal.headBobPhase += dt * (animal.kind === 'chicken' ? 7.5 : 2.6);

    if (animal.stateTimer <= 0) {
      // Deterministic pseudo-random roll based on id hash & elapsed time
      const roll = Math.abs(Math.sin((i + 1) * 19.37 + elapsedSeconds * 3.17));
      if (animal.state === 'walking') {
        animal.state = roll < 0.72 || animal.kind === 'chicken' ? 'grazing' : 'resting';
        animal.stateTimer = animal.kind === 'chicken' ? 1.4 + roll * 2.2 : 2.5 + roll * 5.0;
        animal.speed = 0;
      } else {
        // Pick a fresh nearby dry waypoint around home pasture
        let chosenX = animal.homeX;
        let chosenZ = animal.homeZ;
        for (let tries = 0; tries < 5; tries++) {
          const ang = ((roll + tries * 0.27) % 1) * Math.PI * 2;
          const dist = (0.3 + ((roll * (tries + 1)) % 0.7)) * animal.wanderRadius;
          const tx = animal.homeX + Math.cos(ang) * dist;
          const tz = animal.homeZ + Math.sin(ang) * dist;
          if (isDryAnimalSpot(tx, tz, buildings, region, seed)) {
            chosenX = tx;
            chosenZ = tz;
            break;
          }
        }
        animal.targetX = chosenX;
        animal.targetZ = chosenZ;
        animal.state = 'walking';
        animal.stateTimer = 2.2 + roll * 3.6;
      }
    }

    if (animal.state === 'walking') {
      const dx = animal.targetX - animal.position.x;
      const dz = animal.targetZ - animal.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.32) {
        animal.state = 'grazing';
        animal.stateTimer = animal.kind === 'chicken' ? 1.6 : 3.2;
        animal.speed = 0;
        continue;
      }

      const maxSpeed =
        animal.kind === 'cattle' ? 0.85 : animal.kind === 'goat' ? 1.25 : 1.05;
      const step = Math.min(dist, maxSpeed * dt);
      let nx = animal.position.x + (dx / dist) * step;
      let nz = animal.position.z + (dz / dist) * step;

      // Solid building push-out
      for (let bIdx = 0; bIdx < buildings.length; bIdx++) {
        const b = buildings[bIdx];
        if (b.constructionState === 'destroyed') continue;
        const minR = b.footprintRadius + 0.55;
        const bx = nx - b.position.x;
        const bz = nz - b.position.z;
        const bd = Math.hypot(bx, bz);
        if (bd < minR && bd > 0.001) {
          nx = b.position.x + (bx / bd) * minR;
          nz = b.position.z + (bz / bd) * minR;
        }
      }

      const ny = sampleTerrainHeight(nx, nz, region, seed);
      if (ny < WATER_LEVEL + 0.22) {
        // Turn back safely away from river water
        animal.targetX = animal.homeX;
        animal.targetZ = animal.homeZ;
        animal.speed = 0;
        animal.state = 'grazing';
        animal.stateTimer = 1.5;
        continue;
      }

      animal.position.x = nx;
      animal.position.z = nz;
      animal.position.y = ny;
      animal.speed = step / dt;
      animal.gaitPhase += step * (animal.kind === 'chicken' ? 10.5 : 5.2);

      const yaw = Math.atan2(dx, dz);
      animal.rotationY += shortestAngle(animal.rotationY, yaw) * Math.min(1, dt * 6);
    } else {
      animal.speed = 0;
      animal.position.y = Math.max(
        WATER_LEVEL + 0.24,
        sampleTerrainHeight(animal.position.x, animal.position.z, region, seed),
      );
    }
  }
}
