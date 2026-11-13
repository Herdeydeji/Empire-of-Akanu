import { CameraRigState, RegionConfig } from '../../types/game';
import { sampleTerrainHeight, WATER_LEVEL } from '../math/noise';

export const MIN_CAMERA_DISTANCE = 15;
export const MAX_CAMERA_DISTANCE = 76;
export const DEFAULT_WORLD_BOUNDS = 78;

export function createInitialCameraRig(): CameraRigState {
  return {
    targetX: 0,
    targetZ: 4.5,
    desiredTargetX: 0,
    desiredTargetZ: 4.5,
    yaw: 0.52,
    desiredYaw: 0.52,
    distance: 44,
    desiredDistance: 44,
    minBounds: -DEFAULT_WORLD_BOUNDS,
    maxBounds: DEFAULT_WORLD_BOUNDS,
  };
}

export function clampCameraRigDesired(rig: CameraRigState): void {
  rig.desiredTargetX = Math.max(rig.minBounds, Math.min(rig.maxBounds, rig.desiredTargetX));
  rig.desiredTargetZ = Math.max(rig.minBounds, Math.min(rig.maxBounds, rig.desiredTargetZ));
  rig.desiredDistance = Math.max(
    MIN_CAMERA_DISTANCE,
    Math.min(MAX_CAMERA_DISTANCE, rig.desiredDistance),
  );
}

/**
 * Pans the camera target in camera-aligned horizontal plane coordinates.
 * forward > 0 moves forward along camera's horizontal gaze; right > 0 moves right.
 */
export function panCameraLocal(
  rig: CameraRigState,
  rightDelta: number,
  forwardDelta: number,
): void {
  const sinYaw = Math.sin(rig.yaw);
  const cosYaw = Math.cos(rig.yaw);
  // Camera stands at offset (+sinYaw * dist, +cosYaw * dist) looking toward target (0,0),
  // so camera forward vector in XZ is (-sinYaw, -cosYaw) and right vector is (cosYaw, -sinYaw).
  const fx = -sinYaw;
  const fz = -cosYaw;
  const rx = cosYaw;
  const rz = -sinYaw;

  rig.desiredTargetX += rx * rightDelta + fx * forwardDelta;
  rig.desiredTargetZ += rz * rightDelta + fz * forwardDelta;
  clampCameraRigDesired(rig);
}

export function zoomCamera(rig: CameraRigState, zoomDelta: number): void {
  rig.desiredDistance += zoomDelta;
  clampCameraRigDesired(rig);
}

export function rotateCamera(rig: CameraRigState, yawDelta: number): void {
  rig.desiredYaw += yawDelta;
}

export function focusCameraOnPoint(
  rig: CameraRigState,
  x: number,
  z: number,
  targetDistance?: number,
): void {
  rig.desiredTargetX = x;
  rig.desiredTargetZ = z;
  if (typeof targetDistance === 'number') {
    rig.desiredDistance = targetDistance;
  }
  clampCameraRigDesired(rig);
}

export interface ComputedCameraPose {
  eyeX: number;
  eyeY: number;
  eyeZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
}

/**
 * Exponentially damps camera state and computes elevated isometric RTS camera eye/lookAt coordinates,
 * guaranteeing terrain clearance so the camera never clips beneath hills.
 */
export function stepCameraRig(
  rig: CameraRigState,
  dt: number,
  region: RegionConfig,
  seed: number,
): ComputedCameraPose {
  const clampedDt = Math.min(Math.max(dt, 0), 0.05);
  clampCameraRigDesired(rig);

  const alphaPos = 1 - Math.exp(-10.5 * clampedDt);
  const alphaRot = 1 - Math.exp(-11.0 * clampedDt);
  const alphaZoom = 1 - Math.exp(-9.5 * clampedDt);

  rig.targetX += (rig.desiredTargetX - rig.targetX) * alphaPos;
  rig.targetZ += (rig.desiredTargetZ - rig.targetZ) * alphaPos;
  rig.yaw += (rig.desiredYaw - rig.yaw) * alphaRot;
  rig.distance += (rig.desiredDistance - rig.distance) * alphaZoom;

  // Pitch transitions smoothly from closer tactical angle (~37 deg) to high strategic isometric (~53 deg)
  const zoomRatio =
    (rig.distance - MIN_CAMERA_DISTANCE) / (MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE);
  const pitch = 0.64 + zoomRatio * 0.29; // radians above horizon

  const groundAtTarget = Math.max(
    WATER_LEVEL,
    sampleTerrainHeight(rig.targetX, rig.targetZ, region, seed),
  );
  const lookX = rig.targetX;
  const lookY = groundAtTarget + 0.65;
  const lookZ = rig.targetZ;

  const horizRadius = Math.cos(pitch) * rig.distance;
  const vertOffset = Math.sin(pitch) * rig.distance;

  const eyeX = lookX + Math.sin(rig.yaw) * horizRadius;
  const eyeZ = lookZ + Math.cos(rig.yaw) * horizRadius;
  const groundUnderEye = Math.max(
    WATER_LEVEL,
    sampleTerrainHeight(eyeX, eyeZ, region, seed),
  );
  const eyeY = Math.max(lookY + vertOffset, groundUnderEye + 4.0);

  return { eyeX, eyeY, eyeZ, lookX, lookY, lookZ };
}
