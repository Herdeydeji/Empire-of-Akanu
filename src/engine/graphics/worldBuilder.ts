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
import { ProceduralTextureSet } from './proceduralTextures';
import { createDynamicWaterMaterial } from './waterShader';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface ResourceNodeVisualEntry {
  entity: EnvironmentNodeEntity;
  group: THREE.Group;
  activeVisual: THREE.Object3D;
  depletedVisual: THREE.Object3D | null;
}

export interface BuiltWorldScene {
  root: THREE.Group;
  buildings: BuildingEntity[];
  characters: CharacterEntity[];
  resourceNodes: EnvironmentNodeEntity[];
  entitiesById: Map<string, SelectableEntity>;
  characterRigs: CharacterVisualRig[];
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
  updateWater: (elapsedSeconds: number) => void;
  dispose: () => void;
}

const WORLD_SPAN = 224;
const SELECTION_RING_POOL_SIZE = 24;

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

  // 1. Procedural Vertex-Colored Terrain Mesh with Road Blending & Slope Rockiness
  const segments = quality === 'low' ? 92 : quality === 'medium' ? 128 : 156;
  const terrainGeo = track(new THREE.PlaneGeometry(WORLD_SPAN, WORLD_SPAN, segments, segments));
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const vertexCount = posAttr.count;
  const colors = new Float32Array(vertexCount * 3);

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
    scratchColor.copy(colGrassLow).lerp(colGrassHigh, grassPatch);

    // Blend sandy/fertile riverbank near water elevation
    if (vy < WATER_LEVEL + 0.85) {
      const bankT = Math.max(0, Math.min(1, (WATER_LEVEL + 0.85 - vy) / 1.1));
      scratchColor.lerp(colSand, bankT * 0.88);
    }

    // Blend compacted earthen settlement plaza & roads
    let minRoadRatio = 999;
    for (let r = 0; r < baseSettlement.roads.length; r++) {
      const rd = baseSettlement.roads[r];
      const d = distanceToSegment2D(vx, vz, rd.from[0], rd.from[1], rd.to[0], rd.to[1]);
      minRoadRatio = Math.min(minRoadRatio, d / rd.width);
    }
    const plazaDist = Math.hypot(vx, vz - 1.5);
    if (plazaDist < 8.5) {
      minRoadRatio = Math.min(minRoadRatio, plazaDist / 8.5);
    }
    if (minRoadRatio < 1.25 && vy > WATER_LEVEL + 0.25) {
      const roadBlend = Math.max(0, Math.min(1, 1.25 - minRoadRatio));
      scratchColor.lerp(colPath, Math.min(0.9, roadBlend * 1.1));
    }

    // Steep escarpments & kopjes expose warm bedrock
    if (slope > 0.36) {
      const rockT = Math.max(0, Math.min(1, (slope - 0.36) / 0.42));
      scratchColor.lerp(colRock, rockT * 0.92);
    }

    colors[i * 3] = scratchColor.r;
    colors[i * 3 + 1] = scratchColor.g;
    colors[i * 3 + 2] = scratchColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.35,
      bumpMap: textures.terrainBump,
      bumpScale: 0.085,
    }),
  );

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  // 2. Animated River / Coastal Harbour Dynamic Water Plane
  const waterGeo = track(new THREE.PlaneGeometry(WORLD_SPAN, WORLD_SPAN, 96, 96));
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = track(
    createDynamicWaterMaterial(
      region.palette.waterShallow,
      region.palette.waterDeep,
      textures.waterBump,
    ),
  );
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = WATER_LEVEL;
  waterMesh.receiveShadow = true;
  root.add(waterMesh);

  // 3. Build Kingdom Settlement Buildings & Dynamic Building Mutators
  const buildingMats = track(createBuildingMaterialLibrary(kingdom, textures));
  const colliderMat = track(new THREE.MeshBasicMaterial({ visible: false }));

  const mountBuildingVisual = (bld: BuildingEntity) => {
    entitiesById.set(bld.id, bld);
    const bldGroup = buildProceduralStructure(bld, buildingMats);
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

  // 4. Build Selectable Resource Nodes (Outcrops, Individual Harvestable Trees, Fisheries & Hunting Grounds)
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
      roughness: 0.88,
      metalness: 0.05,
      bumpMap: textures.masonryBump,
      bumpScale: 0.1,
    }),
  );
  const woodLogMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(region.palette.trunkColor),
      map: textures.timberMap,
      roughness: 0.78,
      metalness: 0.04,
      normalMap: textures.timberNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
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
  const foliageRichMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(region.palette.foliagePrimary),
      map: textures.foliageMap,
      roughness: 0.82,
      metalness: 0.02,
      bumpMap: textures.thatchBump,
      bumpScale: 0.06,
    }),
  );
  const foliageAccentMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(region.palette.foliageSecondary),
      map: textures.foliageMap,
      roughness: 0.8,
      metalness: 0.02,
      bumpMap: textures.thatchBump,
      bumpScale: 0.05,
    }),
  );
  const faunaHideMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b6783d'),
      roughness: 0.72,
      metalness: 0.02,
    }),
  );

  const rockBoulderGeo = track(new THREE.DodecahedronGeometry(1.1, 1));
  const crystalGeo = track(new THREE.OctahedronGeometry(0.45, 0));
  const singleTrunkGeo = track(new THREE.CylinderGeometry(0.19, 0.36, 3.6, 8));
  const singleCrownLowGeo = track(new THREE.CylinderGeometry(2.35, 1.5, 0.82, 9));
  const singleCrownTopGeo = track(new THREE.CylinderGeometry(1.55, 1.05, 0.62, 8));
  const stumpOuterGeo = track(new THREE.CylinderGeometry(0.32, 0.44, 0.52, 8));
  const stumpCutTopGeo = track(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 8));

  const applyNodeDepletionState = (entry: ResourceNodeVisualEntry) => {
    const { entity, activeVisual, depletedVisual } = entry;
    if (entity.nodeKind === 'harvestable_tree' || entity.nodeKind === 'timber_grove') {
      activeVisual.visible = !entity.depleted;
      if (depletedVisual) depletedVisual.visible = entity.depleted;
    } else if (
      entity.nodeKind === 'gold_outcrop' ||
      entity.nodeKind === 'iron_deposit' ||
      entity.nodeKind === 'stone_quarry'
    ) {
      // Shrink boulder cluster & hide gleaming ore veins when mineral deposit is exhausted
      activeVisual.visible = !entity.depleted;
      if (depletedVisual) depletedVisual.visible = entity.depleted;
    } else {
      // Fishery traps or hunting ground wildlife hide while depleted/regrowing
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
          0.55 + (k === 0 ? 0.45 : 0),
          Math.sin(angle) * dist,
        );
        boulder.scale.set(1.3 - k * 0.12, 0.95 + (k === 0 ? 0.55 : 0), 1.15);
        boulder.rotation.set(k * 0.4, k * 1.1, 0.2);
        boulder.castShadow = true;
        boulder.receiveShadow = true;
        activeVisual.add(boulder);

        // Low rubble remnant when exhausted
        const rubble = new THREE.Mesh(rockBoulderGeo, stoneOutcropMat);
        rubble.position.set(Math.cos(angle) * (dist * 0.8), 0.18, Math.sin(angle) * (dist * 0.8));
        rubble.scale.set(0.65, 0.28, 0.65);
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
      // Multi-part harvestable tree + felled hardwood stump
      const trunk = new THREE.Mesh(singleTrunkGeo, woodLogMat);
      trunk.position.set(0, 1.75, 0);
      trunk.castShadow = true;
      activeVisual.add(trunk);

      const crown1 = new THREE.Mesh(singleCrownLowGeo, foliageRichMat);
      crown1.position.set(0, 3.6, 0);
      crown1.castShadow = true;
      crown1.receiveShadow = true;
      activeVisual.add(crown1);

      const crown2 = new THREE.Mesh(singleCrownTopGeo, foliageAccentMat);
      crown2.position.set(0.22, 4.25, -0.15);
      crown2.castShadow = true;
      activeVisual.add(crown2);

      const stumpBark = new THREE.Mesh(stumpOuterGeo, woodLogMat);
      stumpBark.position.set(0, 0.24, 0);
      stumpBark.castShadow = true;
      depletedVisual.add(stumpBark);

      const stumpRing = new THREE.Mesh(stumpCutTopGeo, heartwoodStumpMat);
      stumpRing.position.set(0, 0.51, 0);
      depletedVisual.add(stumpRing);
      depletedVisual.visible = false;
    } else if (node.nodeKind === 'timber_grove') {
      for (let t = 0; t < 3; t++) {
        const tx = (t - 1) * 1.65;
        const tz = (t % 2) * 1.1 - 0.5;
        const trunk = new THREE.Mesh(singleTrunkGeo, woodLogMat);
        trunk.position.set(tx, 1.8, tz);
        trunk.castShadow = true;
        activeVisual.add(trunk);

        const crown = new THREE.Mesh(singleCrownLowGeo, foliageRichMat);
        crown.position.set(tx, 3.85 + t * 0.2, tz);
        crown.castShadow = true;
        activeVisual.add(crown);

        const stump = new THREE.Mesh(stumpOuterGeo, woodLogMat);
        stump.position.set(tx, 0.24, tz);
        depletedVisual.add(stump);
      }
      depletedVisual.visible = false;
    } else if (node.nodeKind === 'hunting_ground') {
      // Permanent stone cairn & tall brush marker + grazing savanna game animals when active
      const cairn = new THREE.Mesh(rockBoulderGeo, stoneOutcropMat);
      cairn.scale.set(0.55, 0.42, 0.55);
      cairn.position.set(0, 0.22, 0);
      cairn.castShadow = true;
      depletedVisual.add(cairn);

      for (let g = 0; g < 3; g++) {
        const ang = (g / 3) * Math.PI * 2 + 0.4;
        const gx = Math.cos(ang) * 1.75;
        const gz = Math.sin(ang) * 1.55;
        const animalGroup = new THREE.Group();
        animalGroup.position.set(gx, 0, gz);
        animalGroup.rotation.y = ang + 1.2;

        // Stylized multi-part savanna antelope (torso, neck, head, 4 legs, horns)
        const body = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.36, 0.34, 0.82)),
          faunaHideMat,
        );
        body.position.set(0, 0.58, 0);
        body.castShadow = true;
        animalGroup.add(body);

        const neck = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.08, 0.12, 0.42, 6)),
          faunaHideMat,
        );
        neck.position.set(0, 0.85, 0.34);
        neck.rotation.x = 0.35;
        animalGroup.add(neck);

        const head = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.18, 0.16, 0.3)),
          faunaHideMat,
        );
        head.position.set(0, 1.02, 0.48);
        animalGroup.add(head);

        for (const lx of [-0.12, 0.12]) {
          for (const lz of [-0.28, 0.28]) {
            const leg = new THREE.Mesh(
              track(new THREE.CylinderGeometry(0.035, 0.03, 0.52, 5)),
              woodLogMat,
            );
            leg.position.set(lx, 0.26, lz);
            animalGroup.add(leg);
          }
        }
        activeVisual.add(animalGroup);
      }
      depletedVisual.visible = true;
    } else {
      // Fertile riverbank fishery: mooring post + woven fish-trap baskets
      const post = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.1, 0.12, 2.1, 6)),
        woodLogMat,
      );
      post.position.set(0, 0.8, 0);
      post.castShadow = true;
      depletedVisual.add(post);

      for (let b = 0; b < 3; b++) {
        const trap = new THREE.Mesh(
          track(new THREE.ConeGeometry(0.42, 0.95, 8)),
          buildingMats.thatch,
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

  // 5. Instanced Procedural Multi-Part Background Vegetation (Trees, Rocks, Grass)
  const qualityMultiplier = quality === 'low' ? 0.48 : quality === 'medium' ? 0.82 : 1.15;
  const maxTrees = Math.floor(125 * region.terrain.treeDensity * qualityMultiplier);
  const maxRocks = Math.floor(88 * region.terrain.rockDensity * qualityMultiplier);
  const maxGrass = Math.floor(360 * region.terrain.grassDensity * qualityMultiplier);

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

  const isPalm =
    region.terrain.treeArchetype === 'coastal_palm' ||
    region.terrain.treeArchetype === 'river_palm';
  const isHighland = region.terrain.treeArchetype === 'highland_cedar';
  const isForest = region.terrain.treeArchetype === 'rainforest_canopy';

  // Realistic organic branched trunk with flared root base & angled boughs
  let trunkGeo: THREE.BufferGeometry;
  if (isPalm) {
    const palmStem = new THREE.CylinderGeometry(0.12, 0.26, 4.4, 8);
    palmStem.translate(0, 2.2, 0);
    trunkGeo = track(palmStem);
  } else if (isHighland) {
    const cedarStem = new THREE.CylinderGeometry(0.16, 0.38, 4.0, 8);
    cedarStem.translate(0, 2.0, 0);
    trunkGeo = track(cedarStem);
  } else if (isForest) {
    // Massive baobab swollen fluted trunk
    const baobabBase = new THREE.CylinderGeometry(0.55, 0.95, 3.2, 10);
    baobabBase.translate(0, 1.6, 0);
    trunkGeo = track(baobabBase);
  } else {
    // Savannah Umbrella Acacia with angled support boughs
    const mainStem = new THREE.CylinderGeometry(0.22, 0.42, 2.8, 8);
    mainStem.translate(0, 1.4, 0);
    const leftBough = new THREE.CylinderGeometry(0.13, 0.18, 1.8, 6);
    leftBough.rotateZ(0.38);
    leftBough.translate(-0.65, 2.85, 0.2);
    const rightBough = new THREE.CylinderGeometry(0.13, 0.18, 1.8, 6);
    rightBough.rotateZ(-0.38);
    rightBough.translate(0.65, 2.85, -0.2);
    const merged = BufferGeometryUtils.mergeGeometries([mainStem, leftBough, rightBough]);
    trunkGeo = track(merged || mainStem);
  }

  // Distinctive regional African canopy geometries
  const canopyLowerGeo = track(
    isHighland
      ? new THREE.ConeGeometry(2.35, 3.2, 9)
      : isPalm
        ? new THREE.ConeGeometry(2.85, 0.65, 8) // Arching feathered palm rosette
        : isForest
          ? new THREE.DodecahedronGeometry(2.65, 1) // Massive rainforest hardwood dome
          : new THREE.CylinderGeometry(3.6, 2.2, 0.48, 12), // Iconic flat-topped African umbrella acacia
  );
  canopyLowerGeo.translate(0, isHighland ? 3.4 : isPalm ? 4.1 : 3.65, 0);

  const canopyUpperGeo = track(
    isHighland
      ? new THREE.ConeGeometry(1.65, 2.4, 8)
      : isPalm
        ? new THREE.SphereGeometry(0.55, 6, 6) // Clustered coconuts/dates under crown
        : isForest
          ? new THREE.DodecahedronGeometry(1.95, 1)
          : new THREE.CylinderGeometry(2.45, 1.35, 0.42, 10), // Upper tiered acacia umbrella tier
  );
  canopyUpperGeo.translate(0, isHighland ? 4.9 : isPalm ? 3.85 : 4.25, 0);

  const treeTrunkMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(region.palette.trunkColor),
      map: textures.timberMap,
      roughness: 0.82,
      metalness: 0.04,
      normalMap: textures.timberNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
    }),
  );
  const treeCanopyMat1 = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: textures.foliageMap,
      roughness: 0.78,
      metalness: 0.02,
      bumpMap: textures.thatchBump,
      bumpScale: 0.06,
    }),
  );
  const treeCanopyMat2 = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      map: textures.foliageMap,
      roughness: 0.74,
      metalness: 0.02,
      bumpMap: textures.thatchBump,
      bumpScale: 0.05,
    }),
  );

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
      scale: 0.78 + rand() * 0.58,
      rot: rand() * Math.PI * 2,
      tint: rand(),
    });
  }

  if (treePlacements.length > 0) {
    const trunkInst = new THREE.InstancedMesh(trunkGeo, treeTrunkMat, treePlacements.length);
    const canopy1Inst = new THREE.InstancedMesh(
      canopyLowerGeo,
      treeCanopyMat1,
      treePlacements.length,
    );
    const canopy2Inst = new THREE.InstancedMesh(
      canopyUpperGeo,
      treeCanopyMat2,
      treePlacements.length,
    );

    trunkInst.castShadow = quality !== 'low';
    canopy1Inst.castShadow = quality !== 'low';
    canopy1Inst.receiveShadow = true;
    canopy2Inst.castShadow = quality === 'high';

    const dummy = new THREE.Object3D();
    const cPrimary = new THREE.Color(region.palette.foliagePrimary);
    const cSecondary = new THREE.Color(region.palette.foliageSecondary);
    const instColor = new THREE.Color();

    treePlacements.forEach((tp, idx) => {
      dummy.position.set(tp.x, tp.y - 0.12, tp.z);
      dummy.rotation.set((rand() - 0.5) * 0.06, tp.rot, (rand() - 0.5) * 0.06);
      dummy.scale.setScalar(tp.scale);
      dummy.updateMatrix();

      trunkInst.setMatrixAt(idx, dummy.matrix);
      canopy1Inst.setMatrixAt(idx, dummy.matrix);

      dummy.position.x += 0.25 * tp.scale;
      dummy.rotation.y += 0.6;
      dummy.updateMatrix();
      canopy2Inst.setMatrixAt(idx, dummy.matrix);

      instColor.copy(cPrimary).lerp(cSecondary, tp.tint);
      canopy1Inst.setColorAt(idx, instColor);
      instColor.offsetHSL(0.01, 0.02, 0.04);
      canopy2Inst.setColorAt(idx, instColor);
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    canopy1Inst.instanceMatrix.needsUpdate = true;
    canopy2Inst.instanceMatrix.needsUpdate = true;
    if (canopy1Inst.instanceColor) canopy1Inst.instanceColor.needsUpdate = true;
    if (canopy2Inst.instanceColor) canopy2Inst.instanceColor.needsUpdate = true;

    trunkInst.computeBoundingSphere();
    canopy1Inst.computeBoundingSphere();
    canopy2Inst.computeBoundingSphere();

    root.add(trunkInst);
    root.add(canopy1Inst);
    root.add(canopy2Inst);
  }

  const instRockGeo = track(new THREE.DodecahedronGeometry(0.95, 0));
  const instRockMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.88,
      metalness: 0.04,
      bumpMap: textures.masonryBump,
      bumpScale: 0.12,
    }),
  );
  const rockPlacements: { x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number; shade: number }[] = [];
  attempts = 0;
  while (rockPlacements.length < maxRocks && attempts < maxRocks * 7) {
    attempts++;
    const x = (rand() - 0.5) * 188;
    const z = (rand() - 0.5) * 188;
    const y = sampleTerrainHeight(x, z, region, seed);
    if (y < WATER_LEVEL - 0.15) continue;
    if (isOccupiedBySettlement(x, z, 2.2)) continue;

    rockPlacements.push({
      x,
      y,
      z,
      sx: 0.7 + rand() * 1.45,
      sy: 0.5 + rand() * 1.15,
      sz: 0.7 + rand() * 1.35,
      rot: rand() * Math.PI * 2,
      shade: 0.82 + rand() * 0.34,
    });
  }

  if (rockPlacements.length > 0) {
    const rockInst = new THREE.InstancedMesh(instRockGeo, instRockMat, rockPlacements.length);
    rockInst.castShadow = quality !== 'low';
    rockInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const baseRockCol = new THREE.Color(region.palette.rockPrimary);
    const tintCol = new THREE.Color();

    rockPlacements.forEach((rp, idx) => {
      dummy.position.set(rp.x, rp.y + rp.sy * 0.25, rp.z);
      dummy.rotation.set(rand() * 0.4, rp.rot, rand() * 0.4);
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

  const grassBladeGeo = track(new THREE.ConeGeometry(0.18, 0.78, 4));
  grassBladeGeo.translate(0, 0.36, 0);
  const grassInstMat = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.86,
      metalness: 0.0,
    }),
  );

  const grassPlacements: { x: number; y: number; z: number; scale: number; rot: number; blend: number }[] = [];
  attempts = 0;
  while (grassPlacements.length < maxGrass && attempts < maxGrass * 5) {
    attempts++;
    const x = (rand() - 0.5) * 155;
    const z = (rand() - 0.5) * 155;
    const y = sampleTerrainHeight(x, z, region, seed);
    if (y < WATER_LEVEL + 0.05 || sampleTerrainSlope(x, z, region, seed) > 0.42) continue;
    if (isOccupiedBySettlement(x, z, 1.0)) continue;

    grassPlacements.push({
      x,
      y,
      z,
      scale: 0.7 + rand() * 0.75,
      rot: rand() * Math.PI * 2,
      blend: rand(),
    });
  }

  if (grassPlacements.length > 0) {
    const grassInst = new THREE.InstancedMesh(
      grassBladeGeo,
      grassInstMat,
      grassPlacements.length,
    );
    const dummy = new THREE.Object3D();
    const gCol = new THREE.Color();

    grassPlacements.forEach((gp, idx) => {
      dummy.position.set(gp.x, gp.y - 0.04, gp.z);
      dummy.rotation.set((rand() - 0.5) * 0.18, gp.rot, (rand() - 0.5) * 0.18);
      dummy.scale.set(gp.scale, gp.scale * (0.85 + gp.blend * 0.45), gp.scale);
      dummy.updateMatrix();
      grassInst.setMatrixAt(idx, dummy.matrix);

      gCol.copy(colGrassLow).lerp(colGrassHigh, gp.blend);
      grassInst.setColorAt(idx, gCol);
    });
    grassInst.instanceMatrix.needsUpdate = true;
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    grassInst.computeBoundingSphere();
    root.add(grassInst);
  }

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

  // 7. Pooled RTS Selection Ground Reticle Rings (supports single & multi-villager selection)
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

  // Move-order ground confirmation marker ring
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
    entitiesById,
    characterRigs,
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
    updateWater: (elapsedSeconds: number) => {
      const shaderMat = waterMat as unknown as THREE.ShaderMaterial;
      if (shaderMat.uniforms && shaderMat.uniforms.uTime) {
        shaderMat.uniforms.uTime.value = elapsedSeconds;
      }
      textures.waterBump.offset.x = elapsedSeconds * 0.032;
      textures.waterBump.offset.y = elapsedSeconds * 0.019;
      waterMesh.position.y = WATER_LEVEL + Math.sin(elapsedSeconds * 1.4) * 0.02;
    },
    dispose: () => {
      for (const rig of characterRigs) {
        rig.dispose();
      }
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
