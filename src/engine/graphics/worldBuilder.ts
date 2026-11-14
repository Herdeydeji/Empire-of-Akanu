import * as THREE from 'three';
import { KINGDOMS } from '../../config/kingdoms';
import { REGIONS } from '../../config/regions';
import { generateInitialSettlement } from '../../config/settlement';
import {
  BuildingEntity,
  CharacterEntity,
  EnvironmentNodeEntity,
  GraphicsQuality,
  KingdomId,
  RegionId,
  SelectableEntity,
} from '../../types/game';
import {
  createSeededRandom,
  distanceToSegment2D,
  sampleTerrainHeight,
  sampleTerrainSlope,
  valueNoise2D,
  WATER_LEVEL,
} from '../math/noise';
import { cloneWorldEntities } from '../persistence/saveSystem';
import {
  createInitialVillageLivestock,
  LivestockEntity,
} from '../simulation/livestockSim';
import {
  buildProceduralStructure,
  createBuildingMaterialLibrary,
  createPlacementGhostVisual,
  PlacementGhostVisual,
  syncBuildingConstructionVisual,
} from './buildingFactory';
import {
  CharacterVisualRig,
  createProceduralCharacterRig,
} from './characterFactory';
import {
  createLivestockVisualRig,
  LivestockVisualRig,
  updateLivestockRigAnimation,
} from './livestockFactory';
import { ProceduralTextureSet } from './proceduralTextures';
import { createDynamicWaterMaterial } from './waterShader';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface ResourceNodeVisualEntry {
  entity: EnvironmentNodeEntity;
  group: THREE.Group;
  activeVisual: THREE.Object3D;
  depletedVisual: THREE.Object3D | null;
}

export type VfxBurstKind =
  | 'dust'
  | 'spark'
  | 'smoke'
  | 'water_drop'
  | 'water_ripple'
  | 'building_complete';

export interface BuiltWorldScene {
  root: THREE.Group;
  buildings: BuildingEntity[];
  characters: CharacterEntity[];
  resourceNodes: EnvironmentNodeEntity[];
  livestock: LivestockEntity[];
  capitalCenters: Record<KingdomId, { x: number; z: number }>;
  entitiesById: Map<string, SelectableEntity>;
  characterRigs: CharacterVisualRig[];
  livestockRigs: LivestockVisualRig[];
  birdPositions: { x: number; y: number; z: number }[];
  raycastTargets: THREE.Object3D[];
  terrainMesh: THREE.Mesh;
  waterMesh: THREE.Mesh;
  selectionRings: THREE.Mesh[];
  moveMarkerMesh: THREE.Mesh;
  placementGhost: PlacementGhostVisual;
  addBuildingEntity: (bld: BuildingEntity) => void;
  removeBuildingEntity: (buildingId: string) => void;
  syncBuildingVisual: (buildingId: string) => void;
  syncResourceNodeVisual: (nodeId: string) => void;
  addCharacterEntity: (char: CharacterEntity) => void;
  updateLivestockVisuals: () => void;
  updateWater: (elapsedSeconds: number) => void;
  updateEnvironment: (elapsedSeconds: number, dt: number, focusX?: number, focusZ?: number) => void;
  spawnVfxBurst: (x: number, y: number, z: number, kind: VfxBurstKind) => void;
  dispose: () => void;
}

const WORLD_SPAN = 224;
const SELECTION_RING_POOL_SIZE = 24;

function mergeNonIndexedParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  for (const part of parts) {
    const geo = part.index ? part.toNonIndexed() : part.clone();
    if (!geo.attributes.normal) {
      geo.computeVertexNormals();
    }
    if (!geo.attributes.uv) {
      const count = geo.attributes.position.count;
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    prepared.push(geo);
    part.dispose();
  }
  const merged = BufferGeometryUtils.mergeGeometries(prepared, false);
  for (const g of prepared) g.dispose();
  return merged ?? new THREE.BufferGeometry();
}

function createFracturedRockGeometry(
  radius: number,
  seedOffset: number,
  withMossTint: boolean,
): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(radius, 1);
  const geo = base.toNonIndexed();
  base.dispose();

  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const len = Math.max(0.001, Math.hypot(vx, vy, vz));
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;
    const facet =
      Math.sin(nx * 5.2 + seedOffset) * 0.16 +
      Math.cos(nz * 4.7 - seedOffset * 0.6) * 0.14 +
      Math.sin(ny * 7.1 + nx * 3.3) * 0.11;
    const scale = 1.0 + facet;
    const flatBottom = ny < -0.15 ? 0.68 : 1.0;
    pos.setXYZ(i, vx * scale, vy * scale * flatBottom, vz * scale);
  }
  geo.computeVertexNormals();

  if (withMossTint) {
    const norms = geo.attributes.normal as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const colStone = new THREE.Color('#efeae2');
    const colCrevice = new THREE.Color('#8c8274');
    const colMoss = new THREE.Color('#5d7d3d');
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const ny = norms.getY(i);
      const py = pos.getY(i);
      c.copy(colStone);
      if (py < 0.05) {
        c.lerp(colCrevice, 0.55);
      }
      if (ny > 0.52 && py > 0.0) {
        const mossAmt = Math.min(0.65, (ny - 0.52) * 1.4);
        c.lerp(colMoss, mossAmt);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  return geo;
}

function createOrganicBarkTrunkGeometry(
  archetype: 'acacia_baobab' | 'rainforest_canopy' | 'highland_cedar' | 'river_palm' | 'coastal_palm',
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  if (archetype === 'coastal_palm' || archetype === 'river_palm') {
    // Segmented gently curving palm bole
    const segs = 5;
    let curX = 0;
    let curY = 0;
    let curZ = 0;
    for (let s = 0; s < segs; s++) {
      const rBot = 0.24 - s * 0.025;
      const rTop = 0.215 - s * 0.025;
      const segH = 0.94;
      const tilt = 0.06 + s * 0.028;
      const cyl = new THREE.CylinderGeometry(rTop, rBot, segH, 9);
      cyl.translate(0, segH * 0.5, 0);
      cyl.rotateZ(-tilt);
      cyl.translate(curX, curY, curZ);
      parts.push(cyl);
      curX += Math.sin(tilt) * segH * 0.92;
      curY += Math.cos(tilt) * segH * 0.94;
      curZ += 0.04 * (s % 2 === 0 ? 1 : -1);
    }
    // Root flare ring
    for (let r = 0; r < 4; r++) {
      const ang = (r / 4) * Math.PI * 2 + 0.3;
      const root = new THREE.CylinderGeometry(0.06, 0.13, 0.55, 6);
      root.translate(0, 0.2, 0);
      root.rotateZ(0.45);
      root.rotateY(ang);
      root.translate(Math.cos(ang) * 0.14, 0, Math.sin(ang) * 0.14);
      parts.push(root);
    }
    return mergeNonIndexedParts(parts);
  }

  if (archetype === 'highland_cedar') {
    const main = new THREE.CylinderGeometry(0.14, 0.38, 4.4, 9);
    main.translate(0, 2.2, 0);
    parts.push(main);

    for (let r = 0; r < 4; r++) {
      const ang = (r / 4) * Math.PI * 2;
      const buttress = new THREE.CylinderGeometry(0.08, 0.19, 0.85, 6);
      buttress.translate(0, 0.35, 0);
      buttress.rotateZ(0.48);
      buttress.rotateY(ang);
      buttress.translate(Math.cos(ang) * 0.2, 0, Math.sin(ang) * 0.2);
      parts.push(buttress);
    }

    for (let b = 0; b < 6; b++) {
      const ang = b * 1.15;
      const tierY = 2.1 + Math.floor(b / 3) * 1.15;
      const limb = new THREE.CylinderGeometry(0.045, 0.09, 1.35, 6);
      limb.translate(0, 0.65, 0);
      limb.rotateZ(1.02);
      limb.rotateY(ang);
      limb.translate(0, tierY, 0);
      parts.push(limb);
    }
    return mergeNonIndexedParts(parts);
  }

  if (archetype === 'rainforest_canopy') {
    // Broad fluted buttress trunk + spreading heavy boughs
    const main = new THREE.CylinderGeometry(0.44, 0.72, 2.8, 10);
    main.translate(0, 1.4, 0);
    parts.push(main);

    for (let r = 0; r < 5; r++) {
      const ang = (r / 5) * Math.PI * 2;
      const buttress = new THREE.CylinderGeometry(0.14, 0.32, 1.4, 6);
      buttress.translate(0, 0.65, 0);
      buttress.rotateZ(0.42);
      buttress.rotateY(ang);
      buttress.translate(Math.cos(ang) * 0.42, 0, Math.sin(ang) * 0.42);
      parts.push(buttress);
    }

    const boughAngles = [0.2, 1.75, 3.35, 4.9];
    for (let i = 0; i < boughAngles.length; i++) {
      const ang = boughAngles[i];
      const bough = new THREE.CylinderGeometry(0.13, 0.26, 2.15, 7);
      bough.translate(0, 1.05, 0);
      bough.rotateZ(0.66 + (i % 2) * 0.14);
      bough.rotateY(ang);
      bough.translate(0, 2.25, 0);
      parts.push(bough);
    }
    return mergeNonIndexedParts(parts);
  }

  // Iconic Acacia Savanna: flared roots, gnarled lower trunk, 4 spreading multi-tier umbrella boughs
  const lower = new THREE.CylinderGeometry(0.24, 0.40, 1.95, 9);
  lower.rotateZ(0.05);
  lower.translate(0, 0.96, 0);
  parts.push(lower);

  for (let r = 0; r < 4; r++) {
    const ang = (r / 4) * Math.PI * 2 + 0.4;
    const root = new THREE.CylinderGeometry(0.07, 0.17, 0.78, 6);
    root.translate(0, 0.35, 0);
    root.rotateZ(0.55);
    root.rotateY(ang);
    root.translate(Math.cos(ang) * 0.22, 0, Math.sin(ang) * 0.22);
    parts.push(root);
  }

  const boughs = [
    { ang: 0.2, tilt: 0.68, len: 2.15 },
    { ang: 1.85, tilt: 0.76, len: 2.25 },
    { ang: 3.4, tilt: 0.64, len: 2.05 },
    { ang: 4.95, tilt: 0.72, len: 2.18 },
  ];
  for (const b of boughs) {
    const limb = new THREE.CylinderGeometry(0.075, 0.16, b.len, 7);
    limb.translate(0, b.len * 0.5, 0);
    limb.rotateZ(b.tilt);
    limb.rotateY(b.ang);
    limb.translate(0.04, 1.75, 0);
    parts.push(limb);
  }
  return mergeNonIndexedParts(parts);
}

function createOrganicLeafCanopyGeometry(
  archetype: 'acacia_baobab' | 'rainforest_canopy' | 'highland_cedar' | 'river_palm' | 'coastal_palm',
  compact = false,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const scaleMod = compact ? 0.84 : 1.0;

  if (archetype === 'coastal_palm' || archetype === 'river_palm') {
    // 11 gracefully arched drooping palm fronds radiating from curved palm tip (~0.52, 4.35, 0)
    const tipX = 0.50;
    const tipY = 4.32;
    const frondCount = 11;
    for (let f = 0; f < frondCount; f++) {
      const yaw = (f / frondCount) * Math.PI * 2;
      const elev = f % 2 === 0 ? 0.28 : 0.06;

      // Inner ascending frond half
      const seg1 = new THREE.PlaneGeometry(1.15 * scaleMod, 1.55 * scaleMod, 1, 2);
      seg1.rotateX(-Math.PI / 2 + elev);
      seg1.translate(0, 0.14, 0.72 * scaleMod);
      seg1.rotateY(yaw);
      seg1.translate(tipX, tipY, 0);
      parts.push(seg1);

      // Outer drooping frond tip
      const seg2 = new THREE.PlaneGeometry(1.05 * scaleMod, 1.45 * scaleMod, 1, 2);
      seg2.rotateX(-Math.PI / 2 - 0.42);
      seg2.translate(0, -0.22, 1.98 * scaleMod);
      seg2.rotateY(yaw);
      seg2.translate(tipX, tipY + (f % 2 === 0 ? 0.22 : 0.04), 0);
      parts.push(seg2);
    }
    return mergeNonIndexedParts(parts);
  }

  let rSeed = 913;
  const r = () => {
    rSeed = (rSeed * 1664525 + 1013904223) >>> 0;
    return rSeed / 4294967296;
  };

  const addSprigCluster = (
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    cardCount: number,
    cardSize: number,
  ) => {
    for (let i = 0; i < cardCount; i++) {
      const ang = (i / cardCount) * Math.PI * 2 + r() * 0.7;
      const dist = 0.25 + r() * 0.75;
      const px = cx + Math.cos(ang) * rx * dist;
      const py = cy + (r() - 0.45) * ry * 2;
      const pz = cz + Math.sin(ang) * rz * dist;

      // Crossed double card so foliage has 3D fullness from both overhead & side angles
      const sz = cardSize * (0.85 + r() * 0.38) * scaleMod;
      const pitch = (r() - 0.5) * 0.85;
      const yaw = r() * Math.PI * 2;

      const c1 = new THREE.PlaneGeometry(sz, sz);
      c1.rotateX(pitch);
      c1.rotateY(yaw);
      c1.translate(px, py, pz);
      parts.push(c1);

      const c2 = new THREE.PlaneGeometry(sz * 0.92, sz * 0.92);
      c2.rotateX(pitch + 0.55);
      c2.rotateY(yaw + Math.PI * 0.48);
      c2.translate(px, py, pz);
      parts.push(c2);
    }
  };

  if (archetype === 'highland_cedar') {
    addSprigCluster(0, 2.35, 0, 1.55, 0.35, 1.55, 9, 1.75);
    addSprigCluster(0, 3.35, 0, 1.25, 0.35, 1.25, 8, 1.65);
    addSprigCluster(0, 4.25, 0, 0.85, 0.35, 0.85, 6, 1.45);
    addSprigCluster(0, 5.0, 0, 0.42, 0.28, 0.42, 4, 1.15);
    return mergeNonIndexedParts(parts);
  }

  if (archetype === 'rainforest_canopy') {
    addSprigCluster(0, 4.25, 0, 1.45, 0.75, 1.45, 10, 2.25);
    addSprigCluster(-1.25, 3.65, 0.55, 1.05, 0.65, 1.05, 6, 2.0);
    addSprigCluster(1.25, 3.75, -0.45, 1.05, 0.65, 1.05, 6, 2.0);
    addSprigCluster(0.35, 3.55, 1.2, 0.95, 0.55, 0.95, 5, 1.85);
    addSprigCluster(-0.35, 3.6, -1.2, 0.95, 0.55, 0.95, 5, 1.85);
    return mergeNonIndexedParts(parts);
  }

  // Acacia Savanna: wide layered flat-topped horizontal sprays at bough ends
  addSprigCluster(0, 3.85, 0, 1.55, 0.28, 1.55, 9, 2.1);
  addSprigCluster(-1.45, 3.35, 0.35, 1.15, 0.25, 1.05, 6, 1.85);
  addSprigCluster(1.42, 3.45, -0.35, 1.15, 0.25, 1.05, 6, 1.85);
  addSprigCluster(0.25, 3.4, 1.38, 1.05, 0.24, 1.05, 5, 1.75);
  addSprigCluster(-0.25, 3.48, -1.35, 1.05, 0.24, 1.05, 5, 1.75);
  return mergeNonIndexedParts(parts);
}

function createCrossedGrassTuftGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const plane = new THREE.PlaneGeometry(1.32, 0.9, 1, 2);
    const pos = plane.attributes.position as THREE.BufferAttribute;
    const cols = new Float32Array(pos.count * 3);
    for (let v = 0; v < pos.count; v++) {
      const py = pos.getY(v) + 0.45; // 0..0.90
      const hNorm = Math.max(0, Math.min(1, py / 0.9));
      // Subtle forward/outward natural arch so top-down RTS pitch sees lush blade coverage
      pos.setY(v, py);
      pos.setZ(v, Math.pow(hNorm, 1.65) * 0.28);
      const rootAo = 0.74 + hNorm * 0.36;
      cols[v * 3] = rootAo;
      cols[v * 3 + 1] = rootAo;
      cols[v * 3 + 2] = rootAo * 0.97;
    }
    plane.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    plane.rotateX(0.14);
    plane.rotateY((i / 4) * Math.PI + (i % 2) * 0.19);
    parts.push(plane);
  }
  const merged = mergeNonIndexedParts(parts);
  merged.computeVertexNormals();
  return merged;
}

function applyWindSwayShader(
  mat: THREE.MeshStandardMaterial,
  windTimeUniform: { value: number },
  heightStart: number,
  amp: number,
): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTimeUniform;
    shader.vertexShader =
      `uniform float uWindTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float swayWeight = max(0.0, transformed.y - ${heightStart.toFixed(2)});
        float worldX = transformed.x;
        float worldZ = transformed.z;
        #ifdef USE_INSTANCING
          worldX += instanceMatrix[3][0];
          worldZ += instanceMatrix[3][2];
        #endif
        float waveBand = sin(uWindTime * 1.85 - worldX * 0.13 - worldZ * 0.11);
        float flutter = 0.42 * cos(uWindTime * 3.1 + worldX * 0.47 - worldZ * 0.39);
        float gust = (waveBand * 0.85 + 0.25 + flutter);
        transformed.x += swayWeight * ${amp.toFixed(4)} * gust;
        transformed.z += swayWeight * ${(amp * 0.68).toFixed(4)} * (waveBand * 0.7 + cos(uWindTime * 1.4 + worldZ * 0.35) * 0.4);`,
      );
  };
  mat.customProgramCacheKey = () => `wind_sway_wave_${heightStart}_${amp}`;
}

export function buildProceduralWorld(
  kingdomId: KingdomId,
  regionId: RegionId,
  seed: number,
  quality: GraphicsQuality,
  textures: ProceduralTextureSet,
  savedWorldEntities?: {
    buildings: BuildingEntity[];
    characters: CharacterEntity[];
    resourceNodes: EnvironmentNodeEntity[];
  },
): BuiltWorldScene {
  const kingdom = KINGDOMS[kingdomId];
  const region = REGIONS[regionId];
  const rand = createSeededRandom(seed + 17);
  const windTimeUniform = { value: 0 };

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(obj: T): T => {
    disposables.push(obj);
    return obj;
  };

  const root = new THREE.Group();
  const baseSettlement = generateInitialSettlement(kingdomId, region, seed);
  const worldState = savedWorldEntities
    ? cloneWorldEntities(savedWorldEntities)
    : cloneWorldEntities({
        buildings: baseSettlement.buildings,
        characters: baseSettlement.characters,
        resourceNodes: baseSettlement.resourceNodes,
      });

  const buildings = worldState.buildings;
  const characters = worldState.characters;
  const resourceNodes = worldState.resourceNodes;

  const entitiesById = new Map<string, SelectableEntity>();
  const raycastTargets: THREE.Object3D[] = [];
  const buildingVisualsById = new Map<
    string,
    { entity: BuildingEntity; group: THREE.Group; collider: THREE.Mesh }
  >();
  const nodeVisualsById = new Map<string, ResourceNodeVisualEntry>();

  // 1. High-Tessellation Multi-Layer PBR Splat Terrain Mesh
  const segments =
    quality === 'low' ? 144 : quality === 'medium' ? 184 : quality === 'ultra' ? 240 : 216;
  const terrainGeo = track(new THREE.PlaneGeometry(WORLD_SPAN, WORLD_SPAN, segments, segments));
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const vertexCount = posAttr.count;
  const colors = new Float32Array(vertexCount * 3);
  const splatWeights = new Float32Array(vertexCount * 4);

  const colGrassLow = new THREE.Color(region.palette.grassLow);
  const colGrassHigh = new THREE.Color(region.palette.grassHigh);
  const colPath = new THREE.Color(region.palette.soilPath);
  const colRock = new THREE.Color(region.palette.rockPrimary);
  const colSand = new THREE.Color(region.palette.sandBank);
  const scratchColor = new THREE.Color();

  for (let i = 0; i < vertexCount; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = sampleTerrainHeight(vx, vz, region, seed);
    posAttr.setY(i, vy);

    const slope = sampleTerrainSlope(vx, vz, region, seed);
    const grassPatch = (valueNoise2D(vx * 0.065, vz * 0.065, seed + 55) + 1) * 0.5;
    const soilPatch = (valueNoise2D(vx * 0.095 + 17.2, vz * 0.095 - 9.4, seed + 191) + 1) * 0.5;
    scratchColor.copy(colGrassLow).lerp(colGrassHigh, grassPatch);

    // Splat weights: x = soil/gravel trail, y = cliff rock, z = sand/shore gravel, w = grass turf
    let wSoil = Math.max(0, (soilPatch - 0.52) * 0.85);
    let wRock = 0;
    let wSand = 0;
    let wGrass = 1.0 - wSoil;

    // Sandy/pebbled riverbank & shallow shore transition
    if (vy < WATER_LEVEL + 1.05) {
      const bankT = Math.max(0, Math.min(1, (WATER_LEVEL + 1.05 - vy) / 1.32));
      scratchColor.lerp(colSand, bankT * 0.92);
      wSand = Math.max(wSand, bankT * 1.15);
      wGrass *= 1.0 - bankT * 0.85;
    }

    // Compacted earthen settlement plaza, worn trails & dry soil halos
    let minRoadRatio = 999;
    for (let r = 0; r < baseSettlement.roads.length; r++) {
      const rd = baseSettlement.roads[r];
      const d = distanceToSegment2D(vx, vz, rd.from[0], rd.from[1], rd.to[0], rd.to[1]);
      minRoadRatio = Math.min(minRoadRatio, d / rd.width);
    }
    const plazaDist = Math.hypot(vx, vz - 1.5);
    if (plazaDist < 8.8) {
      minRoadRatio = Math.min(minRoadRatio, plazaDist / 8.8);
    }
    if (minRoadRatio < 1.32 && vy > WATER_LEVEL + 0.22) {
      const roadBlend = Math.max(0, Math.min(1, (1.32 - minRoadRatio) * 1.05));
      scratchColor.lerp(colPath, Math.min(0.94, roadBlend * 1.05));
      wSoil = Math.max(wSoil, roadBlend * 1.35);
      wGrass *= 1.0 - roadBlend * 0.92;
    }

    // Steep hillslopes, terraced risers & high mountain ridges expose striated cliff bedrock
    const highRockT = vy > 5.8 ? Math.min(0.75, (vy - 5.8) / 5.2) : 0;
    const slopeRockT = slope > 0.28 ? Math.min(1.0, (slope - 0.28) / 0.36) : 0;
    const combinedRock = Math.max(slopeRockT, highRockT * 0.72);
    if (combinedRock > 0.01) {
      scratchColor.lerp(colRock, combinedRock * 0.94);
      wRock = combinedRock * 1.45;
      wGrass *= 1.0 - combinedRock * 0.88;
      wSoil *= 1.0 - combinedRock * 0.55;
    }

    const wSum = Math.max(0.0001, wSoil + wRock + wSand + wGrass);
    splatWeights[i * 4] = wSoil / wSum;
    splatWeights[i * 4 + 1] = wRock / wSum;
    splatWeights[i * 4 + 2] = wSand / wSum;
    splatWeights[i * 4 + 3] = wGrass / wSum;

    colors[i * 3] = scratchColor.r;
    colors[i * 3 + 1] = scratchColor.g;
    colors[i * 3 + 2] = scratchColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.setAttribute('aSplatWeights', new THREE.BufferAttribute(splatWeights, 4));
  terrainGeo.computeVertexNormals();

  const terrainMat = track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.34,
    }),
  );

  // World-space 4-layer PBR splatting, anti-tiling dual-scale UVs, slope rock strata & normal perturbation
  terrainMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterLevel = { value: WATER_LEVEL };
    shader.uniforms.uGrassMap = { value: textures.grassTurfMap };
    shader.uniforms.uGrassNorm = { value: textures.grassTurfNormal };
    shader.uniforms.uGravelMap = { value: textures.gravelPathMap };
    shader.uniforms.uGravelNorm = { value: textures.gravelPathNormal };
    shader.uniforms.uCliffMap = { value: textures.cliffRockMap };
    shader.uniforms.uCliffNorm = { value: textures.cliffRockNormal };
    shader.uniforms.uSoilMap = { value: textures.soilMap };
    shader.uniforms.uSoilNorm = { value: textures.soilNormal };

    shader.vertexShader =
      `attribute vec4 aSplatWeights;\nvarying vec4 vSplatWeights;\nvarying vec3 vWorldPos;\nvarying vec3 vWorldNorm;\n` +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vSplatWeights = aSplatWeights;
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader =
      `uniform float uWaterLevel;
      uniform sampler2D uGrassMap;
      uniform sampler2D uGrassNorm;
      uniform sampler2D uGravelMap;
      uniform sampler2D uGravelNorm;
      uniform sampler2D uCliffMap;
      uniform sampler2D uCliffNorm;
      uniform sampler2D uSoilMap;
      uniform sampler2D uSoilNorm;
      varying vec4 vSplatWeights;
      varying vec3 vWorldPos;
      varying vec3 vWorldNorm;

      vec3 sampleAntiTile(sampler2D tex, vec2 p, float scaleA, float scaleB, float blendNoise) {
        vec2 uvA = p * scaleA;
        vec2 rotP = vec2(p.x * 0.8 - p.y * 0.6, p.x * 0.6 + p.y * 0.8);
        vec2 uvB = rotP * scaleB + vec2(0.37, 0.71);
        return mix(texture2D(tex, uvA).rgb, texture2D(tex, uvB).rgb, blendNoise);
      }
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float macroBreak = smoothstep(-0.65, 0.65, sin(vWorldPos.x * 0.085 + cos(vWorldPos.z * 0.072)) * cos(vWorldPos.z * 0.091));
          vec4 w = vSplatWeights;
          float wTot = max(0.001, w.x + w.y + w.z + w.w);
          w /= wTot;

          // Triplanar-friendly cliff coordinates so vertical hill walls show crisp horizontal strata
          float topMask = smoothstep(0.55, 0.90, abs(vWorldNorm.y));
          vec2 cliffSideUv = vec2((vWorldPos.x + vWorldPos.z) * 0.16, vWorldPos.y * 0.25);
          vec2 cliffTopUv = vWorldPos.xz * 0.15;
          vec3 cliffTex = mix(texture2D(uCliffMap, cliffSideUv).rgb, texture2D(uCliffMap, cliffTopUv).rgb, topMask);

          vec3 grassTex = sampleAntiTile(uGrassMap, vWorldPos.xz, 0.22, 0.105, macroBreak);
          vec3 gravelTex = sampleAntiTile(uGravelMap, vWorldPos.xz, 0.24, 0.115, macroBreak);
          vec3 soilTex = sampleAntiTile(uSoilMap, vWorldPos.xz, 0.20, 0.095, macroBreak);

          // Blend trail gravel + rich humus on soil channel; blend gravel pebbles on sandy riverbank
          vec3 pathDetail = mix(soilTex * 1.42, gravelTex * 1.18, 0.62);
          vec3 shoreDetail = mix(gravelTex * 1.24, grassTex * 1.18, 0.25);
          vec3 turfDetail = grassTex * 1.22;
          vec3 rockDetail = cliffTex * 1.26;

          vec3 texComposite = pathDetail * w.x + rockDetail * w.y + shoreDetail * w.z + turfDetail * w.w;

          // Macro color variation & fine soil grit to prevent uniform surface sheen
          float wMacro = sin(vWorldPos.x * 0.34 + cos(vWorldPos.z * 0.29)) * cos(vWorldPos.z * 0.37);
          float wMicro = sin(vWorldPos.x * 3.1 + vWorldPos.z * 2.6) * cos(vWorldPos.z * 3.7 - vWorldPos.x * 2.1);
          float grit = fract(sin(dot(floor(vWorldPos.xz * 8.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
          diffuseColor.rgb *= texComposite * (1.0 + wMacro * 0.08 + wMicro * 0.05 + grit * 0.075);

          // Subtle crevice AO at steep bases + warm hilltop golden-hour slope contrast
          float cliffBaseAo = 1.0 - (1.0 - abs(vWorldNorm.y)) * 0.2;
          float hillWarmth = smoothstep(1.5, 8.5, vWorldPos.y);
          float slopeSun = dot(normalize(vWorldNorm), normalize(vec3(0.68, 0.44, 0.51)));
          float directionalRelief = mix(0.82, 1.12, clamp(slopeSun * 0.5 + 0.5, 0.0, 1.0));
          diffuseColor.rgb *= cliffBaseAo * mix(1.0, directionalRelief, 0.42 + hillWarmth * 0.28);

          // Darkened damp mud & pebble sheen along shoreline
          float wetBand = smoothstep(uWaterLevel + 0.52, uWaterLevel - 0.12, vWorldPos.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.52, 0.47, 0.42), wetBand * 0.78);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          {
            float macroN = smoothstep(-0.65, 0.65, sin(vWorldPos.x * 0.085 + cos(vWorldPos.z * 0.072)) * cos(vWorldPos.z * 0.091));
            vec4 nw = vSplatWeights;
            nw /= max(0.001, nw.x + nw.y + nw.z + nw.w);

            vec3 nGrass = sampleAntiTile(uGrassNorm, vWorldPos.xz, 0.22, 0.105, macroN) * 2.0 - 1.0;
            vec3 nGravel = sampleAntiTile(uGravelNorm, vWorldPos.xz, 0.24, 0.115, macroN) * 2.0 - 1.0;
            vec3 nSoil = sampleAntiTile(uSoilNorm, vWorldPos.xz, 0.20, 0.095, macroN) * 2.0 - 1.0;
            float topMaskN = smoothstep(0.55, 0.90, abs(vWorldNorm.y));
            vec2 cliffSideUvN = vec2((vWorldPos.x + vWorldPos.z) * 0.16, vWorldPos.y * 0.25);
            vec2 cliffTopUvN = vWorldPos.xz * 0.15;
            vec3 nCliff = mix(texture2D(uCliffNorm, cliffSideUvN).rgb, texture2D(uCliffNorm, cliffTopUvN).rgb, topMaskN) * 2.0 - 1.0;

            vec3 blendedN =
              mix(nSoil, nGravel, 0.62) * (nw.x + nw.z) * 0.92 +
              nCliff * nw.y * 1.18 +
              nGrass * nw.w * 0.85;

            vec3 wn = normalize(vWorldNorm);
            vec3 tAxis = normalize(abs(wn.z) < 0.9 ? cross(wn, vec3(0.0, 0.0, 1.0)) : cross(wn, vec3(1.0, 0.0, 0.0)));
            vec3 bAxis = normalize(cross(wn, tAxis));
            vec3 perturbedWorld = normalize(wn + tAxis * blendedN.x * 0.65 + bAxis * blendedN.y * 0.65);
            normal = normalize((viewMatrix * vec4(perturbedWorld, 0.0)).xyz);
          }`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          vec4 rw = vSplatWeights;
          rw /= max(0.001, rw.x + rw.y + rw.z + rw.w);
          float baseRough = rw.x * 0.94 + rw.y * 0.84 + rw.z * 0.89 + rw.w * 0.88;
          float wetShoreRough = smoothstep(uWaterLevel + 0.48, uWaterLevel - 0.1, vWorldPos.y);
          roughnessFactor = mix(baseRough, 0.32, wetShoreRough * 0.82);`,
        );
  };
  terrainMat.customProgramCacheKey = () => 'terrain_pbr_splat_v2';

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  // 2. Depth-Aware Animated River / Coastal Water Plane with aTerrainY
  const waterGeo = track(new THREE.PlaneGeometry(WORLD_SPAN, WORLD_SPAN, 96, 96));
  waterGeo.rotateX(-Math.PI / 2);
  const waterPos = waterGeo.attributes.position as THREE.BufferAttribute;
  const terrainHeights = new Float32Array(waterPos.count);
  for (let i = 0; i < waterPos.count; i++) {
    terrainHeights[i] = sampleTerrainHeight(
      waterPos.getX(i),
      waterPos.getZ(i),
      region,
      seed,
    );
  }
  waterGeo.setAttribute('aTerrainY', new THREE.BufferAttribute(terrainHeights, 1));

  const waterMat = track(
    createDynamicWaterMaterial(
      region.palette.waterShallow,
      region.palette.waterDeep,
      textures.waterBump,
      WATER_LEVEL,
    ),
  );
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = WATER_LEVEL;
  waterMesh.receiveShadow = true;
  root.add(waterMesh);

  // 2B. Atmospheric GLSL Gradient Sky Dome with Golden-Hour Sun Halo
  const skyGeo = track(new THREE.SphereGeometry(188, 24, 16));
  const skyMat = track(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(region.palette.skyTop) },
        uHorizonColor: { value: new THREE.Color(region.palette.skyHorizon) },
        uSunColor: { value: new THREE.Color(region.palette.sunColor) },
        uSunDir: { value: new THREE.Vector3(0.68, 0.44, 0.51).normalize() },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        varying vec3 vWorldDir;
        void main() {
          float h = clamp(vWorldDir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.52));
          float sunDot = max(dot(normalize(vWorldDir), uSunDir), 0.0);
          float halo = pow(sunDot, 14.0) * 0.36 + pow(sunDot, 96.0) * 0.65;
          col += uSunColor * halo;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.renderOrder = -2;
  root.add(skyDome);

  // 2C. Drifting Layered Cloud Sprites (skipped on low quality)
  const cloudSprites: { sprite: THREE.Sprite; speed: number; baseZ: number }[] = [];
  if (quality !== 'low') {
    const cloudMat = track(
      new THREE.SpriteMaterial({
        map: textures.cloudPuffMap,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        fog: true,
      }),
    );
    const cloudCount = quality === 'ultra' ? 14 : 9;
    for (let c = 0; c < cloudCount; c++) {
      const sp = new THREE.Sprite(cloudMat);
      const cx = (rand() - 0.5) * 210;
      const cy = 38 + rand() * 16;
      const cz = (rand() - 0.5) * 210;
      sp.position.set(cx, cy, cz);
      const w = 24 + rand() * 18;
      sp.scale.set(w, w * 0.46, 1);
      root.add(sp);
      cloudSprites.push({ sprite: sp, speed: 0.8 + rand() * 0.9, baseZ: cz });
    }
  }

  // 3. Build Kingdom Settlement Buildings & Dynamic Building Mutators
  const buildingMatsByKingdom: Partial<
    Record<KingdomId, ReturnType<typeof createBuildingMaterialLibrary>>
  > = {};
  const getBuildingMats = (kId: KingdomId) => {
    if (!buildingMatsByKingdom[kId]) {
      buildingMatsByKingdom[kId] = track(
        createBuildingMaterialLibrary(KINGDOMS[kId] ?? kingdom, textures),
      );
    }
    return buildingMatsByKingdom[kId]!;
  };
  const colliderMat = track(new THREE.MeshBasicMaterial({ visible: false }));

  const disposeExtraOnGroup = (grp: THREE.Group) => {
    const extras = grp.userData.extraDisposables as { dispose: () => void }[] | undefined;
    if (extras) {
      for (const item of extras) item.dispose();
    }
  };

  const mountBuildingVisual = (bld: BuildingEntity) => {
    if (buildingVisualsById.has(bld.id)) return;
    entitiesById.set(bld.id, bld);
    const bldGroup = buildProceduralStructure(bld, getBuildingMats(bld.kingdomId));
    root.add(bldGroup);

    const colliderHeight =
      bld.archetype === 'cultivated_farm'
        ? 1.4
        : bld.archetype === 'watch_post' || bld.archetype === 'royal_palace'
          ? 8.0
          : 4.6;
    const colliderGeo = track(
      new THREE.CylinderGeometry(
        bld.footprintRadius * 0.92,
        bld.footprintRadius * 0.98,
        colliderHeight,
        10,
      ),
    );
    const proxy = new THREE.Mesh(colliderGeo, colliderMat);
    proxy.position.set(
      bld.position.x,
      bld.position.y + colliderHeight * 0.5,
      bld.position.z,
    );
    proxy.userData.entityId = bld.id;
    root.add(proxy);
    raycastTargets.push(proxy);
    buildingVisualsById.set(bld.id, { entity: bld, group: bldGroup, collider: proxy });
  };

  for (const bld of buildings) {
    mountBuildingVisual(bld);
  }

  // 4. Shared Organic Bark, Foliage & Fractured Rock Materials
  const goldOreMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#eab738'),
      roughness: 0.24,
      metalness: 0.86,
    }),
  );
  const ironOreMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7a3e2e'),
      roughness: 0.52,
      metalness: 0.58,
    }),
  );
  const stoneOutcropMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(region.palette.rockPrimary),
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
      bumpMap: textures.masonryBump,
      bumpScale: 0.12,
    }),
  );
  const woodBarkMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(region.palette.trunkColor),
      map: textures.barkMap,
      normalMap: textures.barkNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  const heartwoodStumpMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b68952'),
      map: textures.timberMap,
      roughness: 0.74,
      metalness: 0.02,
    }),
  );
  const leafClusterMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(region.palette.foliagePrimary),
      map: textures.leafClusterMap,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  applyWindSwayShader(leafClusterMat, windTimeUniform, 2.2, 0.032);

  const faunaHideMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b6783d'),
      roughness: 0.72,
      metalness: 0.02,
    }),
  );
  const faunaHornMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2b2119'),
      roughness: 0.48,
      metalness: 0.08,
    }),
  );

  const rockBoulderGeo = track(createFracturedRockGeometry(1.12, 1.7, true));
  const crystalGeo = track(new THREE.OctahedronGeometry(0.45, 0));
  const harvestTreeTrunkGeo = track(createOrganicBarkTrunkGeometry(region.terrain.treeArchetype));
  const harvestTreeCanopyGeo = track(createOrganicLeafCanopyGeometry(region.terrain.treeArchetype, true));
  const stumpOuterGeo = track(new THREE.CylinderGeometry(0.32, 0.48, 0.56, 9));
  const stumpCutTopGeo = track(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 9));

  const applyNodeDepletionState = (entry: ResourceNodeVisualEntry) => {
    const { entity, activeVisual, depletedVisual } = entry;
    if (
      entity.nodeKind === 'harvestable_tree' ||
      entity.nodeKind === 'timber_grove' ||
      entity.nodeKind === 'gold_outcrop' ||
      entity.nodeKind === 'iron_deposit' ||
      entity.nodeKind === 'stone_quarry'
    ) {
      activeVisual.visible = !entity.depleted;
      if (depletedVisual) depletedVisual.visible = entity.depleted;
    } else {
      activeVisual.visible = !entity.depleted;
      if (depletedVisual) depletedVisual.visible = true;
    }
  };

  for (const node of resourceNodes) {
    entitiesById.set(node.id, node);
    const nodeGroup = new THREE.Group();
    nodeGroup.position.set(node.position.x, node.position.y, node.position.z);
    nodeGroup.rotation.y = node.rotationY;

    const activeVisual = new THREE.Group();
    const depletedVisual = new THREE.Group();
    nodeGroup.add(activeVisual);
    nodeGroup.add(depletedVisual);

    if (
      node.nodeKind === 'gold_outcrop' ||
      node.nodeKind === 'iron_deposit' ||
      node.nodeKind === 'stone_quarry'
    ) {
      for (let k = 0; k < 4; k++) {
        const angle = (k / 4) * Math.PI * 2 + 0.3;
        const dist = k === 0 ? 0 : 1.35;
        const boulder = new THREE.Mesh(rockBoulderGeo, stoneOutcropMat);
        boulder.position.set(
          Math.cos(angle) * dist,
          0.48 + (k === 0 ? 0.4 : 0),
          Math.sin(angle) * dist,
        );
        boulder.scale.set(1.25 - k * 0.12, 0.92 + (k === 0 ? 0.5 : 0), 1.15);
        boulder.rotation.set(k * 0.25, k * 1.1, 0.15);
        boulder.castShadow = true;
        boulder.receiveShadow = true;
        activeVisual.add(boulder);

        const rubble = new THREE.Mesh(rockBoulderGeo, stoneOutcropMat);
        rubble.position.set(Math.cos(angle) * (dist * 0.8), 0.15, Math.sin(angle) * (dist * 0.8));
        rubble.scale.set(0.62, 0.26, 0.62);
        rubble.receiveShadow = true;
        depletedVisual.add(rubble);
      }

      if (node.nodeKind !== 'stone_quarry') {
        const veinMat = node.nodeKind === 'gold_outcrop' ? goldOreMat : ironOreMat;
        for (let v = 0; v < 5; v++) {
          const ang = v * 1.25;
          const seam = new THREE.Mesh(crystalGeo, veinMat);
          seam.position.set(Math.cos(ang) * 0.95, 0.85 + (v % 2) * 0.45, Math.sin(ang) * 0.95);
          seam.rotation.set(v * 0.5, v * 0.8, 0.3);
          seam.scale.set(1.1, 0.65, 0.85);
          seam.castShadow = true;
          activeVisual.add(seam);
        }
      }
      depletedVisual.visible = false;
    } else if (node.nodeKind === 'harvestable_tree') {
      const trunk = new THREE.Mesh(harvestTreeTrunkGeo, woodBarkMat);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      activeVisual.add(trunk);

      const canopy = new THREE.Mesh(harvestTreeCanopyGeo, leafClusterMat);
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      activeVisual.add(canopy);

      const stumpBark = new THREE.Mesh(stumpOuterGeo, woodBarkMat);
      stumpBark.position.set(0, 0.24, 0);
      stumpBark.castShadow = true;
      depletedVisual.add(stumpBark);

      const stumpRing = new THREE.Mesh(stumpCutTopGeo, heartwoodStumpMat);
      stumpRing.position.set(0, 0.52, 0);
      depletedVisual.add(stumpRing);
      depletedVisual.visible = false;
    } else if (node.nodeKind === 'timber_grove') {
      for (let t = 0; t < 3; t++) {
        const tx = (t - 1) * 1.75;
        const tz = (t % 2) * 1.15 - 0.5;
        const sub = new THREE.Group();
        sub.position.set(tx, 0, tz);
        sub.rotation.y = t * 2.1;
        sub.scale.setScalar(0.84 + t * 0.1);

        const trunk = new THREE.Mesh(harvestTreeTrunkGeo, woodBarkMat);
        trunk.castShadow = true;
        sub.add(trunk);

        const canopy = new THREE.Mesh(harvestTreeCanopyGeo, leafClusterMat);
        canopy.castShadow = true;
        sub.add(canopy);
        activeVisual.add(sub);

        const stump = new THREE.Mesh(stumpOuterGeo, woodBarkMat);
        stump.position.set(tx, 0.24, tz);
        depletedVisual.add(stump);
        const stumpTop = new THREE.Mesh(stumpCutTopGeo, heartwoodStumpMat);
        stumpTop.position.set(tx, 0.52, tz);
        depletedVisual.add(stumpTop);
      }
      depletedVisual.visible = false;
    } else if (node.nodeKind === 'hunting_ground') {
      const cairn = new THREE.Mesh(rockBoulderGeo, stoneOutcropMat);
      cairn.scale.set(0.55, 0.42, 0.55);
      cairn.position.set(0, 0.22, 0);
      cairn.castShadow = true;
      depletedVisual.add(cairn);

      const antelopeBodyGeo = track(new THREE.CapsuleGeometry(0.16, 0.52, 6, 10));
      antelopeBodyGeo.rotateX(Math.PI / 2);
      const antelopeNeckGeo = track(new THREE.CylinderGeometry(0.065, 0.105, 0.44, 7));
      const antelopeHeadGeo = track(new THREE.SphereGeometry(0.11, 8, 8));
      const antelopeLegGeo = track(new THREE.CylinderGeometry(0.032, 0.022, 0.56, 6));
      const antelopeHornGeo = track(new THREE.ConeGeometry(0.02, 0.28, 5));

      for (let g = 0; g < 3; g++) {
        const ang = (g / 3) * Math.PI * 2 + 0.4;
        const gx = Math.cos(ang) * 1.75;
        const gz = Math.sin(ang) * 1.55;
        const animalGroup = new THREE.Group();
        animalGroup.position.set(gx, 0, gz);
        animalGroup.rotation.y = ang + 1.2;

        const body = new THREE.Mesh(antelopeBodyGeo, faunaHideMat);
        body.position.set(0, 0.60, 0);
        body.castShadow = true;
        animalGroup.add(body);

        const neck = new THREE.Mesh(antelopeNeckGeo, faunaHideMat);
        neck.position.set(0, 0.84, 0.30);
        neck.rotation.x = 0.35;
        animalGroup.add(neck);

        const head = new THREE.Mesh(antelopeHeadGeo, faunaHideMat);
        head.scale.set(0.75, 0.85, 1.45);
        head.position.set(0, 1.04, 0.45);
        animalGroup.add(head);

        for (const side of [-1, 1]) {
          const horn = new THREE.Mesh(antelopeHornGeo, faunaHornMat);
          horn.position.set(side * 0.04, 1.18, 0.38);
          horn.rotation.x = -0.35;
          horn.rotation.z = side * -0.15;
          animalGroup.add(horn);
        }

        for (const lx of [-0.11, 0.11]) {
          for (const lz of [-0.26, 0.26]) {
            const leg = new THREE.Mesh(antelopeLegGeo, faunaHideMat);
            leg.position.set(lx, 0.28, lz);
            animalGroup.add(leg);
          }
        }
        activeVisual.add(animalGroup);
      }
      depletedVisual.visible = true;
    } else {
      const post = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.1, 0.12, 2.1, 7)),
        woodBarkMat,
      );
      post.position.set(0, 0.8, 0);
      post.castShadow = true;
      depletedVisual.add(post);

      for (let b = 0; b < 3; b++) {
        const trap = new THREE.Mesh(
          track(new THREE.ConeGeometry(0.42, 0.95, 8)),
          getBuildingMats(kingdomId).thatch,
        );
        trap.rotation.z = Math.PI / 2.2;
        trap.position.set(-0.9 + b * 0.95, 0.28, 0.45 * (b % 2));
        trap.castShadow = true;
        activeVisual.add(trap);
      }
      depletedVisual.visible = true;
    }

    const entry: ResourceNodeVisualEntry = {
      entity: node,
      group: nodeGroup,
      activeVisual,
      depletedVisual,
    };
    applyNodeDepletionState(entry);
    nodeVisualsById.set(node.id, entry);
    root.add(nodeGroup);

    const colliderRadius = Math.max(1.35, node.footprintRadius * 0.9);
    const nodeProxy = new THREE.Mesh(
      track(new THREE.CylinderGeometry(colliderRadius, colliderRadius, 3.4, 8)),
      colliderMat,
    );
    nodeProxy.position.set(node.position.x, node.position.y + 1.6, node.position.z);
    nodeProxy.userData.entityId = node.id;
    root.add(nodeProxy);
    raycastTargets.push(nodeProxy);
  }

  // 5. High-Realism Instanced Organic Vegetation, Fractured Rocks & Shoreline Stones
  const qualityMultiplier =
    quality === 'low' ? 0.5 : quality === 'medium' ? 0.85 : quality === 'ultra' ? 1.3 : 1.15;
  const maxTrees = Math.floor(125 * region.terrain.treeDensity * qualityMultiplier);
  const maxRocks = Math.floor(92 * region.terrain.rockDensity * qualityMultiplier);

  const isOccupiedBySettlement = (x: number, z: number, minClearance: number): boolean => {
    if (Math.hypot(x, z - 1.5) < 12.5 + minClearance) return true;
    for (const b of buildings) {
      if (Math.hypot(x - b.position.x, z - b.position.z) < b.footprintRadius + minClearance) {
        return true;
      }
    }
    for (const n of resourceNodes) {
      if (Math.hypot(x - n.position.x, z - n.position.z) < n.footprintRadius + minClearance) {
        return true;
      }
    }
    for (const rd of baseSettlement.roads) {
      if (
        distanceToSegment2D(x, z, rd.from[0], rd.from[1], rd.to[0], rd.to[1]) <
        rd.width + minClearance * 0.65
      ) {
        return true;
      }
    }
    return false;
  };

  const trunkGeo = track(createOrganicBarkTrunkGeometry(region.terrain.treeArchetype));
  const canopyGeo = track(createOrganicLeafCanopyGeometry(region.terrain.treeArchetype, false));

  const treeTrunkMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(region.palette.trunkColor),
      map: textures.barkMap,
      normalMap: textures.barkNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  const treeCanopyInstMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: textures.leafClusterMap,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  applyWindSwayShader(treeCanopyInstMat, windTimeUniform, 2.2, 0.036);

  const treePlacements: { x: number; y: number; z: number; scale: number; rot: number; tint: number }[] = [];
  let attempts = 0;
  while (treePlacements.length < maxTrees && attempts < maxTrees * 8) {
    attempts++;
    const x = (rand() - 0.5) * 184;
    const z = (rand() - 0.5) * 184;
    const y = sampleTerrainHeight(x, z, region, seed);
    const slope = sampleTerrainSlope(x, z, region, seed);

    if (y < WATER_LEVEL + 0.35 || slope > 0.52) continue;
    if (isOccupiedBySettlement(x, z, 2.8)) continue;

    treePlacements.push({
      x,
      y,
      z,
      scale: 0.82 + rand() * 0.56,
      rot: rand() * Math.PI * 2,
      tint: rand(),
    });
  }

  if (treePlacements.length > 0) {
    const trunkInst = new THREE.InstancedMesh(trunkGeo, treeTrunkMat, treePlacements.length);
    const canopyInst = new THREE.InstancedMesh(canopyGeo, treeCanopyInstMat, treePlacements.length);

    trunkInst.castShadow = quality !== 'low';
    trunkInst.receiveShadow = true;
    canopyInst.castShadow = quality !== 'low';
    canopyInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const cPrimary = new THREE.Color(region.palette.foliagePrimary);
    const cSecondary = new THREE.Color(region.palette.foliageSecondary);
    const instColor = new THREE.Color();

    treePlacements.forEach((tp, idx) => {
      dummy.position.set(tp.x, tp.y - 0.14, tp.z);
      dummy.rotation.set((rand() - 0.5) * 0.06, tp.rot, (rand() - 0.5) * 0.06);
      dummy.scale.setScalar(tp.scale);
      dummy.updateMatrix();

      trunkInst.setMatrixAt(idx, dummy.matrix);
      canopyInst.setMatrixAt(idx, dummy.matrix);

      instColor.copy(cPrimary).lerp(cSecondary, tp.tint);
      instColor.offsetHSL((rand() - 0.5) * 0.025, 0.03, (rand() - 0.5) * 0.05);
      canopyInst.setColorAt(idx, instColor);
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;

    trunkInst.computeBoundingSphere();
    canopyInst.computeBoundingSphere();

    root.add(trunkInst);
    root.add(canopyInst);
  }

  // Dense Fallen Ground Leaf Scatter beneath canopies & hill hollows
  const maxLeaves =
    quality === 'low' ? 280 : quality === 'medium' ? 620 : quality === 'ultra' ? 1150 : 880;
  const leafPatchGeo = track(new THREE.PlaneGeometry(1.45, 1.45));
  leafPatchGeo.rotateX(-Math.PI / 2);
  const leafPatchMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: textures.fallenLeafMap,
      alphaTest: 0.36,
      roughness: 0.9,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );

  const leafPlacements: { x: number; y: number; z: number; scale: number; rot: number; tone: number }[] = [];
  if (treePlacements.length > 0) {
    const canopyLeafTarget = Math.floor(maxLeaves * 0.62);
    for (let i = 0; i < canopyLeafTarget; i++) {
      const tp = treePlacements[i % treePlacements.length];
      const ang = rand() * Math.PI * 2;
      const dist = 0.65 + rand() * 4.2;
      const lx = tp.x + Math.cos(ang) * dist;
      const lz = tp.z + Math.sin(ang) * dist;
      const ly = sampleTerrainHeight(lx, lz, region, seed);
      if (ly < WATER_LEVEL + 0.14 || sampleTerrainSlope(lx, lz, region, seed) > 0.48) continue;
      leafPlacements.push({
        x: lx,
        y: ly,
        z: lz,
        scale: (0.72 + rand() * 0.75) * tp.scale,
        rot: rand() * Math.PI * 2,
        tone: rand(),
      });
    }
  }
  attempts = 0;
  while (leafPlacements.length < maxLeaves && attempts < maxLeaves * 5) {
    attempts++;
    const x = (rand() - 0.5) * 165;
    const z = (rand() - 0.5) * 165;
    const y = sampleTerrainHeight(x, z, region, seed);
    if (y < WATER_LEVEL + 0.18 || sampleTerrainSlope(x, z, region, seed) > 0.38) continue;
    if (isOccupiedBySettlement(x, z, 0.85)) continue;
    leafPlacements.push({
      x,
      y,
      z,
      scale: 0.65 + rand() * 0.8,
      rot: rand() * Math.PI * 2,
      tone: rand(),
    });
  }
  if (leafPlacements.length > 0) {
    const leafInst = new THREE.InstancedMesh(leafPatchGeo, leafPatchMat, leafPlacements.length);
    leafInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const cDry = new THREE.Color('#c79d5e');
    const cOlive = new THREE.Color(region.palette.foliageSecondary).lerp(colGrassHigh, 0.35);
    const cUmber = new THREE.Color('#9c7344');
    const lCol = new THREE.Color();
    leafPlacements.forEach((lp, idx) => {
      dummy.position.set(lp.x, lp.y + 0.028, lp.z);
      dummy.rotation.set((rand() - 0.5) * 0.12, lp.rot, (rand() - 0.5) * 0.12);
      dummy.scale.setScalar(lp.scale * 0.88);
      dummy.updateMatrix();
      leafInst.setMatrixAt(idx, dummy.matrix);

      if (lp.tone < 0.45) lCol.copy(cDry).lerp(cUmber, lp.tone / 0.45);
      else lCol.copy(cOlive).lerp(cDry, (lp.tone - 0.45) / 0.55);
      leafInst.setColorAt(idx, lCol);
    });
    leafInst.instanceMatrix.needsUpdate = true;
    if (leafInst.instanceColor) leafInst.instanceColor.needsUpdate = true;
    leafInst.computeBoundingSphere();
    root.add(leafInst);
  }

  // Fractured Mossy Rocks, Embedded Slope Cliff Ledges & Loose Trail/Field Stones
  const instRockGeo = track(createFracturedRockGeometry(0.95, 4.3, true));
  const instRockMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.04,
      map: textures.cliffRockMap,
      normalMap: textures.cliffRockNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
    }),
  );
  const rockPlacements: {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    rot: number;
    shade: number;
  }[] = [];
  attempts = 0;
  while (rockPlacements.length < maxRocks && attempts < maxRocks * 7) {
    attempts++;
    const x = (rand() - 0.5) * 188;
    const z = (rand() - 0.5) * 188;
    const y = sampleTerrainHeight(x, z, region, seed);
    if (y < WATER_LEVEL - 0.2) continue;
    if (isOccupiedBySettlement(x, z, 2.2)) continue;

    rockPlacements.push({
      x,
      y,
      z,
      sx: 0.72 + rand() * 1.45,
      sy: 0.52 + rand() * 1.1,
      sz: 0.72 + rand() * 1.35,
      rot: rand() * Math.PI * 2,
      shade: 0.82 + rand() * 0.34,
    });
  }

  // Embedded Cliff Buttresses & Terraced Outcrops on steep hillsides (slope > 0.34)
  const cliffTarget = Math.floor(
    (quality === 'low' ? 44 : quality === 'medium' ? 88 : quality === 'ultra' ? 145 : 115) *
      region.terrain.rockDensity,
  );
  attempts = 0;
  let cliffPlaced = 0;
  while (cliffPlaced < cliffTarget && attempts < cliffTarget * 16) {
    attempts++;
    const x = (rand() - 0.5) * 198;
    const z = (rand() - 0.5) * 198;
    const y = sampleTerrainHeight(x, z, region, seed);
    const slope = sampleTerrainSlope(x, z, region, seed);
    if (y < WATER_LEVEL + 0.65 || slope < 0.34) continue;
    if (isOccupiedBySettlement(x, z, 2.6)) continue;

    rockPlacements.push({
      x,
      y: y - 0.35,
      z,
      sx: 1.55 + rand() * 2.25,
      sy: 0.85 + rand() * 1.45,
      sz: 1.45 + rand() * 2.05,
      rot: rand() * Math.PI * 2,
      shade: 0.76 + rand() * 0.32,
    });
    cliffPlaced++;
  }

  // Dense Loose Field Stones, Trail Gravel Stones & Shoreline Cobbles
  const looseStoneTarget =
    quality === 'low' ? 240 : quality === 'medium' ? 460 : quality === 'ultra' ? 860 : 660;
  attempts = 0;
  let loosePlaced = 0;
  while (loosePlaced < looseStoneTarget && attempts < looseStoneTarget * 8) {
    attempts++;
    const x = (rand() - 0.5) * 176;
    const z = (rand() - 0.5) * 176;
    const y = sampleTerrainHeight(x, z, region, seed);
    if (y < WATER_LEVEL - 0.38) continue;
    // Allow stones along road borders & hill bases while avoiding building centers
    let insideBuilding = false;
    for (const b of buildings) {
      if (Math.hypot(x - b.position.x, z - b.position.z) < b.footprintRadius + 0.9) {
        insideBuilding = true;
        break;
      }
    }
    if (insideBuilding) continue;

    const isShore = y <= WATER_LEVEL + 0.42;
    const scaleBoost = isShore ? 1.15 : 0.75 + rand() * 0.65;
    rockPlacements.push({
      x,
      y: y - 0.04,
      z,
      sx: (0.14 + rand() * 0.28) * scaleBoost,
      sy: (0.09 + rand() * 0.16) * scaleBoost,
      sz: (0.14 + rand() * 0.28) * scaleBoost,
      rot: rand() * Math.PI * 2,
      shade: isShore ? 0.66 + rand() * 0.24 : 0.78 + rand() * 0.34,
    });
    loosePlaced++;
  }

  if (rockPlacements.length > 0) {
    const rockInst = new THREE.InstancedMesh(instRockGeo, instRockMat, rockPlacements.length);
    rockInst.castShadow = quality !== 'low';
    rockInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const baseRockCol = new THREE.Color(region.palette.rockPrimary).lerp(new THREE.Color('#d9d2c7'), 0.28);
    const tintCol = new THREE.Color();

    rockPlacements.forEach((rp, idx) => {
      dummy.position.set(rp.x, rp.y + rp.sy * 0.18, rp.z);
      dummy.rotation.set(rand() * 0.32, rp.rot, rand() * 0.32);
      dummy.scale.set(rp.sx, rp.sy, rp.sz);
      dummy.updateMatrix();
      rockInst.setMatrixAt(idx, dummy.matrix);

      tintCol.copy(baseRockCol).multiplyScalar(rp.shade);
      rockInst.setColorAt(idx, tintCol);
    });
    rockInst.instanceMatrix.needsUpdate = true;
    if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
    rockInst.computeBoundingSphere();
    root.add(rockInst);
  }

  // Dense Wind-Swept Grass Meadows (Root-to-Tip AO + Undulating Patch Clustering)
  const meadowBaseCount =
    quality === 'low' ? 1800 : quality === 'medium' ? 3200 : quality === 'ultra' ? 6200 : 4800;
  const maxMeadowGrass = Math.floor(meadowBaseCount * region.terrain.grassDensity);

  const grassTuftGeo = track(createCrossedGrassTuftGeometry());
  const grassInstMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      vertexColors: true,
      map: textures.grassTuftMap,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.84,
      metalness: 0.0,
    }),
  );
  applyWindSwayShader(grassInstMat, windTimeUniform, 0.06, 0.16);

  const grassPlacements: { x: number; y: number; z: number; scale: number; rot: number; blend: number }[] = [];
  attempts = 0;
  while (grassPlacements.length < maxMeadowGrass && attempts < maxMeadowGrass * 5) {
    attempts++;
    // Concentrate 72% of dense grass tufts within the scenic 128m basin & hillsides, 28% across outer ridges
    const span = attempts % 10 < 7 ? 128 : 176;
    const x = (rand() - 0.5) * span;
    const z = (rand() - 0.5) * span;
    const clusterNoise = (valueNoise2D(x * 0.055, z * 0.055, seed + 211) + 1) * 0.5;
    if (clusterNoise < 0.22 && rand() > 0.32) continue;

    const y = sampleTerrainHeight(x, z, region, seed);
    if (y < WATER_LEVEL + 0.08 || sampleTerrainSlope(x, z, region, seed) > 0.48) continue;
    if (isOccupiedBySettlement(x, z, 0.65)) continue;

    grassPlacements.push({
      x,
      y,
      z,
      scale: (0.78 + rand() * 0.88) * (0.85 + clusterNoise * 0.35),
      rot: rand() * Math.PI * 2,
      blend: Math.max(0, Math.min(1, clusterNoise * 0.72 + rand() * 0.42)),
    });
  }

  if (grassPlacements.length > 0) {
    const grassInst = new THREE.InstancedMesh(
      grassTuftGeo,
      grassInstMat,
      grassPlacements.length,
    );
    grassInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const gCol = new THREE.Color();

    grassPlacements.forEach((gp, idx) => {
      dummy.position.set(gp.x, gp.y - 0.05, gp.z);
      dummy.rotation.set((rand() - 0.5) * 0.16, gp.rot, (rand() - 0.5) * 0.16);
      dummy.scale.set(gp.scale, gp.scale * (0.82 + gp.blend * 0.48), gp.scale);
      dummy.updateMatrix();
      grassInst.setMatrixAt(idx, dummy.matrix);

      gCol.copy(colGrassLow).lerp(colGrassHigh, gp.blend);
      gCol.offsetHSL((rand() - 0.5) * 0.02, 0.02, (rand() - 0.5) * 0.06);
      grassInst.setColorAt(idx, gCol);
    });
    grassInst.instanceMatrix.needsUpdate = true;
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    grassInst.computeBoundingSphere();
    root.add(grassInst);
  }

  // 5B. Organic Shrubs (Crossed Leaf-Sprig Bushes) & Wildflowers
  const shrubCount = quality === 'low' ? 38 : quality === 'medium' ? 82 : 128;
  const shrubBushGeo = track(
    mergeNonIndexedParts([
      (() => {
        const p = new THREE.PlaneGeometry(1.05, 0.88);
        p.translate(0, 0.36, 0);
        return p;
      })(),
      (() => {
        const p = new THREE.PlaneGeometry(1.05, 0.88);
        p.translate(0, 0.36, 0);
        p.rotateY(Math.PI / 3);
        return p;
      })(),
      (() => {
        const p = new THREE.PlaneGeometry(0.95, 0.76);
        p.translate(0, 0.32, 0);
        p.rotateY((Math.PI * 2) / 3);
        return p;
      })(),
    ]),
  );
  const shrubMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: textures.leafClusterMap,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0.01,
    }),
  );
  applyWindSwayShader(shrubMat, windTimeUniform, 0.12, 0.08);

  const shrubPlacements: { x: number; y: number; z: number; s: number; t: number }[] = [];
  attempts = 0;
  while (shrubPlacements.length < shrubCount && attempts < shrubCount * 6) {
    attempts++;
    const x = (rand() - 0.5) * 160;
    const z = (rand() - 0.5) * 160;
    const y = sampleTerrainHeight(x, z, region, seed);
    if (y < WATER_LEVEL + 0.15 || sampleTerrainSlope(x, z, region, seed) > 0.48) continue;
    if (isOccupiedBySettlement(x, z, 1.3)) continue;
    shrubPlacements.push({ x, y, z, s: 0.65 + rand() * 0.82, t: rand() });
  }
  if (shrubPlacements.length > 0) {
    const shrubInst = new THREE.InstancedMesh(shrubBushGeo, shrubMat, shrubPlacements.length);
    shrubInst.castShadow = quality === 'high' || quality === 'ultra';
    shrubInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const cPrim = new THREE.Color(region.palette.foliagePrimary);
    const cSec = new THREE.Color(region.palette.foliageSecondary);
    const sCol = new THREE.Color();
    shrubPlacements.forEach((sp, idx) => {
      dummy.position.set(sp.x, sp.y - 0.04, sp.z);
      dummy.rotation.set(0, sp.t * Math.PI * 2, 0);
      dummy.scale.set(sp.s * 1.15, sp.s * 0.9, sp.s);
      dummy.updateMatrix();
      shrubInst.setMatrixAt(idx, dummy.matrix);
      sCol.copy(cPrim).lerp(cSec, sp.t);
      shrubInst.setColorAt(idx, sCol);
    });
    shrubInst.instanceMatrix.needsUpdate = true;
    if (shrubInst.instanceColor) shrubInst.instanceColor.needsUpdate = true;
    shrubInst.computeBoundingSphere();
    root.add(shrubInst);
  }

  // Tall swaying Riverbank Reeds clustered along water shore
  const reedCount = quality === 'low' ? 45 : 140;
  const reedMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(region.palette.foliageSecondary),
      map: textures.grassTuftMap,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.84,
    }),
  );
  applyWindSwayShader(reedMat, windTimeUniform, 0.1, 0.16);

  const reedPlacements: { x: number; y: number; z: number; h: number; r: number }[] = [];
  attempts = 0;
  while (reedPlacements.length < reedCount && attempts < reedCount * 14) {
    attempts++;
    const x = (rand() - 0.5) * 165;
    const z = (rand() - 0.5) * 165;
    const y = sampleTerrainHeight(x, z, region, seed);
    if (y < WATER_LEVEL - 0.16 || y > WATER_LEVEL + 0.52) continue;
    if (isOccupiedBySettlement(x, z, 1.0)) continue;
    reedPlacements.push({ x, y, z, h: 1.1 + rand() * 0.85, r: rand() * Math.PI * 2 });
  }
  if (reedPlacements.length > 0) {
    const reedInst = new THREE.InstancedMesh(grassTuftGeo, reedMat, reedPlacements.length);
    const dummy = new THREE.Object3D();
    reedPlacements.forEach((rp, idx) => {
      dummy.position.set(rp.x, rp.y - 0.05, rp.z);
      dummy.rotation.set((rand() - 0.5) * 0.18, rp.r, (rand() - 0.5) * 0.18);
      dummy.scale.set(0.95, rp.h, 0.95);
      dummy.updateMatrix();
      reedInst.setMatrixAt(idx, dummy.matrix);
    });
    reedInst.instanceMatrix.needsUpdate = true;
    reedInst.computeBoundingSphere();
    root.add(reedInst);
  }

  // 5C. Soaring High-Altitude Savanna/Coastal Birds
  const birdFlock: {
    group: THREE.Group;
    leftWing: THREE.Mesh;
    rightWing: THREE.Mesh;
    radius: number;
    speed: number;
    phase: number;
    center: [number, number, number];
  }[] = [];
  if (quality !== 'low') {
    const birdMat = track(
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#231b15'), side: THREE.DoubleSide }),
    );
    const wingGeo = track(new THREE.PlaneGeometry(0.45, 0.14));
    const birdCount = 6;
    for (let b = 0; b < birdCount; b++) {
      const bg = new THREE.Group();
      const lw = new THREE.Mesh(wingGeo, birdMat);
      lw.position.x = -0.22;
      const rw = new THREE.Mesh(wingGeo, birdMat);
      rw.position.x = 0.22;
      bg.add(lw, rw);
      root.add(bg);
      birdFlock.push({
        group: bg,
        leftWing: lw,
        rightWing: rw,
        radius: 18 + (b % 3) * 11,
        speed: 0.16 + (b % 2) * 0.05,
        phase: b * 1.15,
        center: [(b - 2.5) * 10, 21 + (b % 3) * 3.5, (b % 2 === 0 ? -1 : 1) * 14],
      });
    }
  }
  const birdPositions = birdFlock.map((b) => ({
    x: b.center[0] + b.radius,
    y: b.center[1],
    z: b.center[2],
  }));

  // 5C-2. Camera-Tracked Golden Sunlit Dust Motes & Windborne Leaves
  const dustBoxHalf = 34;
  const dustBoxSpan = dustBoxHalf * 2;
  const dustCount =
    quality === 'low' ? 160 : quality === 'medium' ? 280 : quality === 'ultra' ? 440 : 360;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustVelocities = new Float32Array(dustCount * 3);
  const dustLocalOffsets = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const ox = (rand() - 0.5) * dustBoxSpan;
    const oy = 0.6 + rand() * 11.5;
    const oz = (rand() - 0.5) * dustBoxSpan;
    dustLocalOffsets[i * 3] = ox;
    dustLocalOffsets[i * 3 + 1] = oy;
    dustLocalOffsets[i * 3 + 2] = oz;
    dustPositions[i * 3] = ox;
    dustPositions[i * 3 + 1] = oy;
    dustPositions[i * 3 + 2] = oz;
    dustVelocities[i * 3] = 0.55 + rand() * 0.95;
    dustVelocities[i * 3 + 1] = (rand() - 0.45) * 0.22;
    dustVelocities[i * 3 + 2] = 0.25 + (rand() - 0.5) * 0.65;
  }
  const dustGeo = track(new THREE.BufferGeometry());
  const dustPosAttr = new THREE.BufferAttribute(dustPositions, 3);
  dustPosAttr.setUsage(THREE.DynamicDrawUsage);
  dustGeo.setAttribute('position', dustPosAttr);
  const dustMat = track(
    new THREE.PointsMaterial({
      map: textures.dustMoteMap,
      color: new THREE.Color(region.palette.sunColor).lerp(new THREE.Color('#e8c796'), 0.45),
      size: 0.42,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    }),
  );
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.frustumCulled = false;
  root.add(dustPoints);

  const windLeafCount = quality === 'low' ? 12 : quality === 'medium' ? 22 : 34;
  const windLeafSprites: {
    sprite: THREE.Sprite;
    ox: number;
    oy: number;
    oz: number;
    vx: number;
    vz: number;
    phase: number;
  }[] = [];
  const windLeafMat = track(
    new THREE.SpriteMaterial({
      map: textures.fallenLeafMap,
      color: new THREE.Color('#d8a862'),
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      fog: true,
    }),
  );
  for (let i = 0; i < windLeafCount; i++) {
    const sp = new THREE.Sprite(windLeafMat);
    const sz = 0.42 + rand() * 0.36;
    sp.scale.set(sz, sz * 0.65, 1);
    root.add(sp);
    windLeafSprites.push({
      sprite: sp,
      ox: (rand() - 0.5) * dustBoxSpan,
      oy: 0.9 + rand() * 7.5,
      oz: (rand() - 0.5) * dustBoxSpan,
      vx: 1.45 + rand() * 1.4,
      vz: 0.55 + (rand() - 0.5) * 0.9,
      phase: rand() * Math.PI * 2,
    });
  }

  // 5D. Pooled Smoke, Dust, Combat Spark, Falling Water Droplets & Expanding River Ripples
  interface VfxParticle {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    active: boolean;
    age: number;
    life: number;
    vx: number;
    vy: number;
    vz: number;
    gravity: number;
    startScale: number;
    endScale: number;
    baseOpacity: number;
  }
  const vfxPoolSize = quality === 'low' ? 24 : 56;
  const vfxPool: VfxParticle[] = [];
  for (let p = 0; p < vfxPoolSize; p++) {
    const mat = track(
      new THREE.SpriteMaterial({
        map: textures.smokePuffMap,
        color: new THREE.Color('#e6dfd5'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    root.add(sprite);
    vfxPool.push({
      sprite,
      mat,
      active: false,
      age: 0,
      life: 1.5,
      vx: 0,
      vy: 1,
      vz: 0,
      gravity: 0,
      startScale: 0.5,
      endScale: 1.8,
      baseOpacity: 0.5,
    });
  }

  interface WaterRippleSlot {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    active: boolean;
    age: number;
    life: number;
  }
  const rippleGeo = track(new THREE.PlaneGeometry(1.0, 1.0));
  rippleGeo.rotateX(-Math.PI / 2);
  const ripplePool: WaterRippleSlot[] = [];
  for (let r = 0; r < 14; r++) {
    const mat = track(
      new THREE.MeshBasicMaterial({
        map: textures.waterRippleMap,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const mesh = new THREE.Mesh(rippleGeo, mat);
    mesh.visible = false;
    mesh.renderOrder = 3;
    root.add(mesh);
    ripplePool.push({ mesh, mat, active: false, age: 0, life: 1.15 });
  }

  // 5E. Pooled Building Completion Celebration VFX (Rising Golden Aura & Spiral Shimmer Motes)
  interface CompletionAuraSlot {
    haloMesh: THREE.Mesh;
    haloMat: THREE.MeshBasicMaterial;
    pillarMesh: THREE.Mesh;
    pillarMat: THREE.MeshBasicMaterial;
    baseY: number;
    active: boolean;
    age: number;
    life: number;
  }
  const auraHaloGeo = track(new THREE.RingGeometry(0.85, 1.38, 36));
  auraHaloGeo.rotateX(-Math.PI / 2);

  const auraPillarGeo = track(new THREE.CylinderGeometry(1.15, 2.15, 5.6, 28, 4, true));
  auraPillarGeo.translate(0, 2.8, 0);
  {
    const pPos = auraPillarGeo.attributes.position as THREE.BufferAttribute;
    const cols = new Float32Array(pPos.count * 3);
    for (let i = 0; i < pPos.count; i++) {
      const hFrac = Math.max(0, Math.min(1, pPos.getY(i) / 5.6));
      // Warm bright gold near base/mid, tapering gracefully to soft transparency near top
      const fade = Math.pow(1 - hFrac, 1.35) * (0.35 + 0.65 * Math.sin(hFrac * Math.PI));
      cols[i * 3] = 1.0 * fade;
      cols[i * 3 + 1] = 0.84 * fade;
      cols[i * 3 + 2] = 0.36 * fade;
    }
    auraPillarGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }

  const completionAuraPool: CompletionAuraSlot[] = [];
  for (let a = 0; a < 5; a++) {
    const haloMat = track(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffd85c'),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const haloMesh = new THREE.Mesh(auraHaloGeo, haloMat);
    haloMesh.visible = false;
    haloMesh.renderOrder = 7;
    root.add(haloMesh);

    const pillarMat = track(
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const pillarMesh = new THREE.Mesh(auraPillarGeo, pillarMat);
    pillarMesh.visible = false;
    pillarMesh.renderOrder = 7;
    root.add(pillarMesh);

    completionAuraPool.push({
      haloMesh,
      haloMat,
      pillarMesh,
      pillarMat,
      baseY: 0,
      active: false,
      age: 0,
      life: 1.85,
    });
  }

  interface GoldenMoteSlot {
    sprite: THREE.Sprite;
    mat: THREE.SpriteMaterial;
    active: boolean;
    age: number;
    life: number;
    centerX: number;
    centerZ: number;
    baseY: number;
    angle: number;
    angSpeed: number;
    radius: number;
    vy: number;
    baseScale: number;
  }
  const goldenMotePool: GoldenMoteSlot[] = [];
  for (let g = 0; g < 38; g++) {
    const mat = track(
      new THREE.SpriteMaterial({
        map: textures.dustMoteMap,
        color: new THREE.Color('#ffe57f'),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.renderOrder = 8;
    root.add(sprite);
    goldenMotePool.push({
      sprite,
      mat,
      active: false,
      age: 0,
      life: 1.6,
      centerX: 0,
      centerZ: 0,
      baseY: 0,
      angle: 0,
      angSpeed: 2.0,
      radius: 1.5,
      vy: 2.5,
      baseScale: 0.6,
    });
  }

  let vfxCursor = 0;
  let rippleCursor = 0;
  let auraCursor = 0;
  let goldenCursor = 0;
  let smokeEmitTimer = 0;

  const spawnVfxBurst = (
    x: number,
    y: number,
    z: number,
    kind: VfxBurstKind,
  ) => {
    if (kind === 'building_complete') {
      const aura = completionAuraPool[auraCursor % completionAuraPool.length];
      auraCursor++;
      aura.active = true;
      aura.age = 0;
      aura.life = 1.9;
      aura.baseY = y;
      aura.haloMesh.visible = true;
      aura.haloMesh.position.set(x, y + 0.14, z);
      aura.haloMesh.scale.setScalar(1.1);
      aura.haloMat.opacity = 0.85;
      aura.pillarMesh.visible = true;
      aura.pillarMesh.position.set(x, y + 0.05, z);
      aura.pillarMesh.scale.set(1.0, 0.4, 1.0);
      aura.pillarMat.opacity = 0.52;

      const moteCount = quality === 'low' ? 10 : 18;
      for (let m = 0; m < moteCount; m++) {
        const gm = goldenMotePool[goldenCursor % goldenMotePool.length];
        goldenCursor++;
        gm.active = true;
        gm.age = 0;
        gm.life = 1.35 + Math.random() * 0.65;
        gm.centerX = x;
        gm.centerZ = z;
        gm.baseY = y + 0.35 + Math.random() * 0.8;
        gm.angle = (m / moteCount) * Math.PI * 2 + Math.random() * 0.4;
        gm.angSpeed = 1.4 + Math.random() * 1.4;
        gm.radius = 1.1 + Math.random() * 1.85;
        gm.vy = 2.1 + Math.random() * 1.9;
        gm.baseScale = 0.48 + Math.random() * 0.42;
        gm.sprite.visible = true;
        gm.sprite.position.set(
          x + Math.cos(gm.angle) * gm.radius,
          gm.baseY,
          z + Math.sin(gm.angle) * gm.radius,
        );
        gm.sprite.scale.setScalar(gm.baseScale);
        gm.mat.opacity = 0.92;
      }
      return;
    }

    if (kind === 'water_ripple') {
      const slot = ripplePool[rippleCursor % ripplePool.length];
      rippleCursor++;
      slot.active = true;
      slot.age = 0;
      slot.life = 1.1;
      slot.mesh.visible = true;
      slot.mesh.position.set(x, y, z);
      slot.mesh.scale.setScalar(0.45);
      slot.mat.opacity = 0.85;
      return;
    }

    const count =
      kind === 'smoke'
        ? 1
        : kind === 'spark'
          ? 2
          : kind === 'water_drop'
            ? 5
            : 3;
    for (let i = 0; i < count; i++) {
      const slot = vfxPool[vfxCursor % vfxPool.length];
      vfxCursor++;
      slot.active = true;
      slot.age = 0;
      slot.sprite.visible = true;
      slot.sprite.position.set(
        x + (Math.random() - 0.5) * (kind === 'water_drop' ? 0.25 : 0.45),
        y + (Math.random() - 0.5) * 0.2,
        z + (Math.random() - 0.5) * (kind === 'water_drop' ? 0.25 : 0.45),
      );
      if (kind === 'smoke') {
        slot.life = 2.4 + Math.random() * 0.9;
        slot.vx = 0.25 + (Math.random() - 0.5) * 0.18;
        slot.vy = 1.05 + Math.random() * 0.4;
        slot.vz = (Math.random() - 0.5) * 0.18;
        slot.gravity = 0;
        slot.startScale = 0.52;
        slot.endScale = 2.1;
        slot.baseOpacity = 0.34;
        slot.mat.color.set('#d8d0c5');
      } else if (kind === 'spark') {
        slot.life = 0.55 + Math.random() * 0.25;
        slot.vx = (Math.random() - 0.5) * 2.4;
        slot.vy = 1.2 + Math.random() * 1.4;
        slot.vz = (Math.random() - 0.5) * 2.4;
        slot.gravity = 3.2;
        slot.startScale = 0.45;
        slot.endScale = 0.95;
        slot.baseOpacity = 0.78;
        slot.mat.color.set('#fbbf24');
      } else if (kind === 'water_drop') {
        slot.life = 0.42 + Math.random() * 0.2;
        slot.vx = (Math.random() - 0.5) * 1.2;
        slot.vy = 0.35 + Math.random() * 0.45;
        slot.vz = (Math.random() - 0.5) * 1.2;
        slot.gravity = 6.8;
        slot.startScale = 0.22;
        slot.endScale = 0.42;
        slot.baseOpacity = 0.82;
        slot.mat.color.set('#9ce7ff');
      } else {
        slot.life = 1.15 + Math.random() * 0.45;
        slot.vx = (Math.random() - 0.5) * 1.1;
        slot.vy = 0.65 + Math.random() * 0.5;
        slot.vz = (Math.random() - 0.5) * 1.1;
        slot.gravity = 0;
        slot.startScale = 0.65;
        slot.endScale = 1.85;
        slot.baseOpacity = 0.42;
        slot.mat.color.set('#cbb799');
      }
      slot.mat.opacity = slot.baseOpacity;
      slot.sprite.scale.setScalar(slot.startScale);
    }
  };

  // 6. Articulated Economic Villager Characters & Dynamic Spawn Mutator
  const characterRigs: CharacterVisualRig[] = [];
  const mountCharacterVisual = (charEntity: CharacterEntity) => {
    entitiesById.set(charEntity.id, charEntity);
    const rig = createProceduralCharacterRig(charEntity, textures);
    characterRigs.push(rig);
    root.add(rig.root);
    raycastTargets.push(rig.collider);
  };

  for (const charEntity of characters) {
    mountCharacterVisual(charEntity);
  }

  // 6B. Domestic Village Livestock (Cattle, Goats & Chickens)
  const livestock = createInitialVillageLivestock(buildings, region, seed, kingdomId);
  const livestockRigs: LivestockVisualRig[] = [];
  for (const animal of livestock) {
    const rig = createLivestockVisualRig(animal, textures);
    livestockRigs.push(rig);
    root.add(rig.root);
  }

  // 7. Pooled RTS Selection Ground Reticle Rings
  const ringGeo = track(new THREE.PlaneGeometry(2.2, 2.2));
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = track(
    new THREE.MeshBasicMaterial({
      map: textures.selectionRing,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),
  );

  const selectionRings: THREE.Mesh[] = [];
  for (let i = 0; i < SELECTION_RING_POOL_SIZE; i++) {
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.visible = false;
    ringMesh.renderOrder = 5;
    root.add(ringMesh);
    selectionRings.push(ringMesh);
  }

  const moveRingGeo = track(new THREE.RingGeometry(0.45, 0.72, 24));
  moveRingGeo.rotateX(-Math.PI / 2);
  const moveRingMat = track(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#86efac'),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const moveMarkerMesh = new THREE.Mesh(moveRingGeo, moveRingMat);
  moveMarkerMesh.visible = false;
  moveMarkerMesh.renderOrder = 6;
  root.add(moveMarkerMesh);

  // 8. 3D Building Placement Ghost Preview
  const placementGhost = track(createPlacementGhostVisual());
  root.add(placementGhost.root);

  return {
    root,
    buildings,
    characters,
    resourceNodes,
    livestock,
    capitalCenters: baseSettlement.capitalCenters,
    entitiesById,
    characterRigs,
    livestockRigs,
    birdPositions,
    raycastTargets,
    terrainMesh,
    waterMesh,
    selectionRings,
    moveMarkerMesh,
    placementGhost,
    addBuildingEntity: (bld: BuildingEntity) => {
      if (!buildings.includes(bld)) {
        buildings.push(bld);
      }
      mountBuildingVisual(bld);
    },
    removeBuildingEntity: (buildingId: string) => {
      const entry = buildingVisualsById.get(buildingId);
      if (entry) {
        disposeExtraOnGroup(entry.group);
        root.remove(entry.group);
        root.remove(entry.collider);
        const rayIdx = raycastTargets.indexOf(entry.collider);
        if (rayIdx >= 0) raycastTargets.splice(rayIdx, 1);
        buildingVisualsById.delete(buildingId);
      }
      entitiesById.delete(buildingId);
      const bIdx = buildings.findIndex((b) => b.id === buildingId);
      if (bIdx >= 0) buildings.splice(bIdx, 1);
    },
    syncBuildingVisual: (buildingId: string) => {
      const entry = buildingVisualsById.get(buildingId);
      if (!entry) return;
      if (entry.entity.constructionState === 'destroyed') {
        disposeExtraOnGroup(entry.group);
        root.remove(entry.group);
        root.remove(entry.collider);
        const rayIdx = raycastTargets.indexOf(entry.collider);
        if (rayIdx >= 0) raycastTargets.splice(rayIdx, 1);
        buildingVisualsById.delete(buildingId);
        entitiesById.delete(buildingId);
        return;
      }
      syncBuildingConstructionVisual(entry.group, entry.entity);
    },
    syncResourceNodeVisual: (nodeId: string) => {
      const entry = nodeVisualsById.get(nodeId);
      if (entry) {
        applyNodeDepletionState(entry);
      }
    },
    addCharacterEntity: (char: CharacterEntity) => {
      if (!characters.includes(char)) {
        characters.push(char);
      }
      mountCharacterVisual(char);
    },
    updateLivestockVisuals: () => {
      for (let i = 0; i < livestockRigs.length; i++) {
        const rig = livestockRigs[i];
        const animal = livestock[i];
        if (rig && animal) {
          updateLivestockRigAnimation(rig, animal);
        }
      }
    },
    updateWater: (elapsedSeconds: number) => {
      const shaderMat = waterMat as unknown as THREE.ShaderMaterial;
      if (shaderMat.uniforms && shaderMat.uniforms.uTime) {
        shaderMat.uniforms.uTime.value = elapsedSeconds;
      }
      textures.waterBump.offset.x = elapsedSeconds * 0.032;
      textures.waterBump.offset.y = elapsedSeconds * 0.019;
      waterMesh.position.y = WATER_LEVEL + Math.sin(elapsedSeconds * 1.4) * 0.018;
    },
    updateEnvironment: (elapsedSeconds: number, dt: number, focusX = 0, focusZ = 0) => {
      windTimeUniform.value = elapsedSeconds;

      for (const cl of cloudSprites) {
        cl.sprite.position.x += cl.speed * dt;
        if (cl.sprite.position.x > 115) {
          cl.sprite.position.x = -115;
        }
        cl.sprite.position.z = cl.baseZ + Math.sin(elapsedSeconds * 0.08 + cl.baseZ) * 2.5;
      }

      // Wrap sunlit golden dust motes smoothly inside the camera's active field of view
      const wrapCoord = (val: number, center: number) => {
        const delta = val - center;
        const wrapped = ((((delta + dustBoxHalf) % dustBoxSpan) + dustBoxSpan) % dustBoxSpan) - dustBoxHalf;
        return center + wrapped;
      };
      for (let i = 0; i < dustCount; i++) {
        const idx = i * 3;
        dustLocalOffsets[idx] += dustVelocities[idx] * dt;
        dustLocalOffsets[idx + 1] +=
          (dustVelocities[idx + 1] + Math.sin(elapsedSeconds * 1.4 + i) * 0.12) * dt;
        dustLocalOffsets[idx + 2] += dustVelocities[idx + 2] * dt;
        if (dustLocalOffsets[idx + 1] > 12.2) dustLocalOffsets[idx + 1] = 0.6;
        if (dustLocalOffsets[idx + 1] < 0.5) dustLocalOffsets[idx + 1] = 11.8;

        dustPositions[idx] = wrapCoord(dustLocalOffsets[idx], focusX);
        dustPositions[idx + 1] = dustLocalOffsets[idx + 1];
        dustPositions[idx + 2] = wrapCoord(dustLocalOffsets[idx + 2], focusZ);
      }
      dustPosAttr.needsUpdate = true;

      for (const wl of windLeafSprites) {
        wl.ox += wl.vx * dt;
        wl.oz += wl.vz * dt;
        const wx = wrapCoord(wl.ox, focusX);
        const wz = wrapCoord(wl.oz, focusZ);
        const wy = wl.oy + Math.sin(elapsedSeconds * 2.1 + wl.phase) * 0.55;
        wl.sprite.position.set(wx, wy, wz);
        wl.sprite.material.rotation = elapsedSeconds * 1.35 + wl.phase;
      }

      for (let i = 0; i < birdFlock.length; i++) {
        const b = birdFlock[i];
        const ang = elapsedSeconds * b.speed + b.phase;
        const bx = b.center[0] + Math.cos(ang) * b.radius;
        const by = b.center[1] + Math.sin(elapsedSeconds * 0.7 + b.phase) * 0.9;
        const bz = b.center[2] + Math.sin(ang) * b.radius;
        b.group.position.set(bx, by, bz);
        b.group.rotation.y = -ang;
        const flap = Math.sin(elapsedSeconds * 6.5 + b.phase) * 0.45;
        b.leftWing.rotation.z = flap;
        b.rightWing.rotation.z = -flap;
        if (birdPositions[i]) {
          birdPositions[i].x = bx;
          birdPositions[i].y = by;
          birdPositions[i].z = bz;
        }
      }

      // Gentle woodsmoke from hearths/smithies & construction dust
      smokeEmitTimer += dt;
      if (smokeEmitTimer >= 0.48) {
        smokeEmitTimer = 0;
        for (const [, entry] of buildingVisualsById) {
          if (entry.entity.constructionState === 'completed') {
            if (entry.group.userData.smokeEmitterLocal) {
              const local = entry.group.userData.smokeEmitterLocal as THREE.Vector3;
              const cosR = Math.cos(entry.entity.rotationY);
              const sinR = Math.sin(entry.entity.rotationY);
              const wx = entry.entity.position.x + local.x * cosR + local.z * sinR;
              const wz = entry.entity.position.z - local.x * sinR + local.z * cosR;
              spawnVfxBurst(wx, entry.entity.position.y + local.y, wz, 'smoke');
            } else if (
              (entry.entity.archetype === 'dwelling_house' ||
                entry.entity.archetype === 'residential_compound') &&
              Math.random() < 0.14
            ) {
              spawnVfxBurst(
                entry.entity.position.x + 1.45,
                entry.entity.position.y + 0.65,
                entry.entity.position.z + 0.5,
                'smoke',
              );
            }
          } else if (
            entry.entity.constructionState === 'under_construction' &&
            Math.random() < 0.45
          ) {
            spawnVfxBurst(
              entry.entity.position.x,
              entry.entity.position.y + 0.9,
              entry.entity.position.z,
              'dust',
            );
          }
        }
      }

      for (const slot of vfxPool) {
        if (!slot.active) continue;
        slot.age += dt;
        const t = slot.age / slot.life;
        if (t >= 1) {
          slot.active = false;
          slot.sprite.visible = false;
          continue;
        }
        slot.vy -= slot.gravity * dt;
        slot.sprite.position.x += slot.vx * dt;
        slot.sprite.position.y += slot.vy * dt;
        slot.sprite.position.z += slot.vz * dt;
        const scale = slot.startScale + (slot.endScale - slot.startScale) * t;
        slot.sprite.scale.setScalar(scale);
        const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        slot.mat.opacity = Math.max(0, slot.baseOpacity * fade);
      }

      for (const rSlot of ripplePool) {
        if (!rSlot.active) continue;
        rSlot.age += dt;
        const t = rSlot.age / rSlot.life;
        if (t >= 1) {
          rSlot.active = false;
          rSlot.mesh.visible = false;
          continue;
        }
        rSlot.mesh.scale.setScalar(0.55 + t * 2.15);
        rSlot.mat.opacity = Math.max(0, (1 - t) * 0.82);
      }

      for (const aura of completionAuraPool) {
        if (!aura.active) continue;
        aura.age += dt;
        const t = aura.age / aura.life;
        if (t >= 1) {
          aura.active = false;
          aura.haloMesh.visible = false;
          aura.pillarMesh.visible = false;
          continue;
        }
        const easeOut = 1 - Math.pow(1 - t, 2.2);
        const fade = t < 0.16 ? t / 0.16 : 1 - (t - 0.16) / 0.84;
        aura.haloMesh.scale.setScalar(1.0 + easeOut * 4.4);
        aura.haloMat.opacity = Math.max(0, fade * 0.82);
        aura.pillarMesh.position.y = aura.baseY + t * 1.65;
        aura.pillarMesh.scale.set(1.0 + easeOut * 0.42, 0.55 + easeOut * 0.95, 1.0 + easeOut * 0.42);
        aura.pillarMat.opacity = Math.max(0, fade * 0.52);
      }

      for (const gm of goldenMotePool) {
        if (!gm.active) continue;
        gm.age += dt;
        const t = gm.age / gm.life;
        if (t >= 1) {
          gm.active = false;
          gm.sprite.visible = false;
          continue;
        }
        const curAng = gm.angle + gm.age * gm.angSpeed;
        const curRad = gm.radius * (1.0 + t * 0.35);
        gm.sprite.position.set(
          gm.centerX + Math.cos(curAng) * curRad,
          gm.baseY + gm.age * gm.vy,
          gm.centerZ + Math.sin(curAng) * curRad,
        );
        const fade = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        gm.sprite.scale.setScalar(gm.baseScale * (1.0 + t * 0.45));
        gm.mat.opacity = Math.max(0, fade * 0.92);
      }
    },
    spawnVfxBurst,
    dispose: () => {
      for (const [, entry] of buildingVisualsById) {
        disposeExtraOnGroup(entry.group);
      }
      for (const rig of characterRigs) {
        rig.dispose();
      }
      for (const rig of livestockRigs) {
        rig.dispose();
      }
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
