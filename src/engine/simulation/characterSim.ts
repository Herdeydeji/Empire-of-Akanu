import { CharacterEntity, RegionConfig } from '../../types/game';
import { sampleTerrainHeight, WATER_LEVEL } from '../math/noise';

const WALK_SPEED = 2.05;
const RUN_SPEED = 4.15;
const ARRIVAL_RADIUS = 0.32;

function shortestAngleDelta(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Steps all civilian settlement characters deterministically by clamped delta time.
 * Coordinates animationState ('idle' | 'walking' | 'running') and gaitPhase directly
 * with distance traveled so characters never slide across the terrain.
 */
export function stepCharactersSimulation(
  characters: CharacterEntity[],
  rawDt: number,
  region: RegionConfig,
  seed: number,
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return;

  for (let i = 0; i < characters.length; i++) {
    const c = characters[i];
    if (c.waypoints.length === 0) {
      c.animationState = 'idle';
      c.speed = 0;
      c.gaitPhase += dt * 1.6;
      continue;
    }

    if (c.waitTimer > 0) {
      c.waitTimer = Math.max(0, c.waitTimer - dt);
      c.speed = 0;
      c.animationState = 'idle';
      c.activityLabel = `Observing ${c.role.toLowerCase()} post`;
      c.gaitPhase += dt * 1.8;
      if (c.waitTimer === 0) {
        c.currentWaypointIndex = (c.currentWaypointIndex + 1) % c.waypoints.length;
      }
      continue;
    }

    const targetWp = c.waypoints[c.currentWaypointIndex];
    const prevWpIndex =
      (c.currentWaypointIndex - 1 + c.waypoints.length) % c.waypoints.length;
    const isRunningLeg = Boolean(c.waypoints[prevWpIndex]?.runToNext);

    const dx = targetWp.x - c.position.x;
    const dz = targetWp.z - c.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist <= ARRIVAL_RADIUS) {
      c.position.x = targetWp.x;
      c.position.z = targetWp.z;
      c.position.y = Math.max(
        WATER_LEVEL + 0.05,
        sampleTerrainHeight(c.position.x, c.position.z, region, seed),
      );
      c.waitTimer = targetWp.waitSeconds;
      c.speed = 0;
      c.animationState = 'idle';
      c.activityLabel = `Attending ${c.role.toLowerCase()} station`;
      continue;
    }

    const desiredSpeed = isRunningLeg ? RUN_SPEED : WALK_SPEED;
    const moveStep = Math.min(dist, desiredSpeed * dt);
    const nx = dx / dist;
    const nz = dz / dist;

    c.position.x += nx * moveStep;
    c.position.z += nz * moveStep;
    c.position.y = Math.max(
      WATER_LEVEL + 0.05,
      sampleTerrainHeight(c.position.x, c.position.z, region, seed),
    );

    const desiredYaw = Math.atan2(nx, nz);
    const turnAlpha = 1 - Math.exp(-10 * dt);
    c.rotationY += shortestAngleDelta(c.rotationY, desiredYaw) * turnAlpha;

    c.speed = moveStep / dt;
    c.animationState = isRunningLeg ? 'running' : 'walking';
    c.activityLabel = isRunningLeg
      ? 'Running patrol courier route'
      : `Walking settlement path (${c.role})`;

    // Advance gait strictly proportional to world distance traveled so feet lock to ground stride
    const strideFreq = isRunningLeg ? 2.55 : 3.1;
    c.gaitPhase += moveStep * strideFreq;
  }
}
