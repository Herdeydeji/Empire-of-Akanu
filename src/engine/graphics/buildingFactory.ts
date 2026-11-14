import * as THREE from 'three';
import { BUILDING_CATALOG } from '../../config/economy';
import { KINGDOMS } from '../../config/kingdoms';
import { BuildingArchetype, BuildingEntity, KingdomConfig } from '../../types/game';
import { ProceduralTextureSet } from './proceduralTextures';

export interface BuildingMaterialLibrary {
  masonry: THREE.MeshStandardMaterial;
  masonryDark: THREE.MeshStandardMaterial;
  thatch: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  banner: THREE.MeshStandardMaterial;
  metalTrim: THREE.MeshStandardMaterial;
  loamSoil: THREE.MeshStandardMaterial;
  cropStalk: THREE.MeshStandardMaterial;
  terracottaPot: THREE.MeshStandardMaterial;
  forgeEmber: THREE.MeshStandardMaterial;
  irrigationWater: THREE.MeshStandardMaterial;
  darkInterior: THREE.MeshBasicMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function getConstructionStageFromProgress(progress: number): 1 | 2 | 3 | 4 | 5 {
  const p = Math.max(0, Math.min(1, progress));
  if (p < 0.18) return 1;
  if (p < 0.38) return 2;
  if (p < 0.6) return 3;
  if (p < 0.82) return 4;
  return 5;
}

export function createBuildingMaterialLibrary(
  kingdom: KingdomConfig,
  textures: ProceduralTextureSet,
): BuildingMaterialLibrary {
  const masonry = new THREE.MeshStandardMaterial({
    color: new THREE.Color(kingdom.palette.masonryTint),
    map: textures.masonryMap,
    roughness: 0.82,
    metalness: 0.05,
    envMapIntensity: 0.55,
    bumpMap: textures.masonryBump,
    bumpScale: 0.08,
  });

  const masonryDark = new THREE.MeshStandardMaterial({
    color: new THREE.Color(kingdom.palette.masonryTint).multiplyScalar(0.65),
    map: textures.masonryMap,
    roughness: 0.86,
    metalness: 0.06,
    envMapIntensity: 0.45,
    bumpMap: textures.masonryBump,
    bumpScale: 0.07,
  });

  const thatch = new THREE.MeshStandardMaterial({
    color: new THREE.Color(kingdom.palette.roofTint),
    map: textures.thatchMap,
    roughness: 0.94,
    metalness: 0.02,
    envMapIntensity: 0.4,
    bumpMap: textures.thatchBump,
    bumpScale: 0.1,
  });

  const timber = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7a4f2c'),
    map: textures.timberMap,
    roughness: 0.70,
    metalness: 0.06,
    envMapIntensity: 0.5,
    normalMap: textures.timberNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
  });

  const banner = new THREE.MeshStandardMaterial({
    color: new THREE.Color(kingdom.palette.bannerCloth),
    map: textures.bannerMap,
    roughness: 0.58,
    metalness: 0.1,
    envMapIntensity: 0.6,
    normalMap: textures.fabricNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    side: THREE.DoubleSide,
  });

  const metalTrim = new THREE.MeshStandardMaterial({
    color: new THREE.Color(kingdom.palette.trimMetal),
    roughness: 0.22,
    metalness: 0.88,
    envMapIntensity: 1.3,
  });

  const loamSoil = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6b5038'),
    map: textures.soilMap,
    normalMap: textures.soilNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.35,
  });

  const cropStalk = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6a9a3a'),
    roughness: 0.76,
    metalness: 0.02,
  });

  const terracottaPot = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ab542e'),
    roughness: 0.56,
    metalness: 0.06,
    envMapIntensity: 0.5,
  });

  const forgeEmber = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff6e1a'),
    emissive: new THREE.Color('#e04e0f'),
    emissiveIntensity: 1.6,
    roughness: 0.4,
    metalness: 0.1,
  });

  const irrigationWater = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#14b8a6'),
    emissive: new THREE.Color('#0f766e'),
    emissiveIntensity: 0.35,
    roughness: 0.1,
    metalness: 0.4,
    transparent: true,
    opacity: 0.88,
    bumpMap: textures.waterBump,
    bumpScale: 0.04,
  });

  const darkInterior = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#140d08'),
  });

  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });

  return {
    masonry,
    masonryDark,
    thatch,
    timber,
    banner,
    metalTrim,
    loamSoil,
    cropStalk,
    terracottaPot,
    forgeEmber,
    irrigationWater,
    darkInterior,
    contactShadowMat,
    dispose: () => {
      masonry.dispose();
      masonryDark.dispose();
      thatch.dispose();
      timber.dispose();
      banner.dispose();
      metalTrim.dispose();
      loamSoil.dispose();
      cropStalk.dispose();
      terracottaPot.dispose();
      forgeEmber.dispose();
      irrigationWater.dispose();
      darkInterior.dispose();
      contactShadowMat.dispose();
    },
  };
}

function enableShadows(mesh: THREE.Mesh, cast = true, receive = true): THREE.Mesh {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function tagStage<T extends THREE.Object3D>(obj: T, stage: 1 | 2 | 3 | 4 | 5): T {
  obj.userData.buildStage = stage;
  if (obj.userData.baseScaleY === undefined) {
    obj.userData.baseScaleY = obj.scale.y;
  }
  return obj;
}

function addBannerPole(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  height: number,
  mats: BuildingMaterialLibrary,
): void {
  const pole = tagStage(
    enableShadows(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, height, 8), mats.timber)),
    5,
  );
  pole.position.set(x, y + height * 0.5, z);
  parent.add(pole);

  const finial = tagStage(
    enableShadows(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mats.metalTrim)),
    5,
  );
  finial.position.set(x, y + height + 0.12, z);
  parent.add(finial);

  const cloth = tagStage(
    enableShadows(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.35, 2, 3), mats.banner), true, false),
    5,
  );
  cloth.position.set(x + 0.38, y + height - 0.75, z);
  parent.add(cloth);
}

function addClayVessels(
  parent: THREE.Group,
  x: number,
  z: number,
  mats: BuildingMaterialLibrary,
): void {
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.16, 0.02),
    new THREE.Vector2(0.26, 0.24),
    new THREE.Vector2(0.18, 0.46),
    new THREE.Vector2(0.22, 0.54),
    new THREE.Vector2(0.14, 0.56),
  ];
  const latheGeo = new THREE.LatheGeometry(profile, 10);
  for (let i = 0; i < 2; i++) {
    const pot = tagStage(enableShadows(new THREE.Mesh(latheGeo, mats.terracottaPot)), 5);
    pot.position.set(x + i * 0.45, 0, z + (i % 2) * 0.28);
    pot.scale.setScalar(0.85 + i * 0.2);
    pot.userData.baseScaleY = pot.scale.y;
    parent.add(pot);
  }
}

function addToronBeams(
  parent: THREE.Group,
  width: number,
  height: number,
  depth: number,
  baseY: number,
  mats: BuildingMaterialLibrary,
): void {
  const beamGeo = new THREE.CylinderGeometry(0.045, 0.045, depth + 0.7, 6);
  beamGeo.rotateX(Math.PI / 2);
  for (const rowY of [baseY + height * 0.55, baseY + height * 0.82]) {
    for (const bx of [-width * 0.32, 0, width * 0.32]) {
      const b = tagStage(enableShadows(new THREE.Mesh(beamGeo, mats.timber)), 5);
      b.position.set(bx, rowY, 0);
      parent.add(b);
    }
  }
}

function addRoofRafters(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  radius: number,
  count: number,
  mats: BuildingMaterialLibrary,
): void {
  const rafterGeo = new THREE.CylinderGeometry(0.038, 0.045, radius * 0.58, 5);
  rafterGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const rafter = tagStage(enableShadows(new THREE.Mesh(rafterGeo, mats.timber), false, true), 4);
    rafter.position.set(x + Math.cos(ang) * radius, y, z + Math.sin(ang) * radius);
    rafter.rotation.y = -ang;
    rafter.rotation.z = -0.28;
    parent.add(rafter);
  }
}

function addVillageHearthProps(
  parent: THREE.Group,
  hx: number,
  hz: number,
  mats: BuildingMaterialLibrary,
): void {
  // Stone-ringed outdoor cooking hearth with glowing embers & simmering clay pot
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const stone = tagStage(
      enableShadows(new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), mats.masonryDark)),
      5,
    );
    stone.position.set(hx + Math.cos(ang) * 0.34, 0.08, hz + Math.sin(ang) * 0.34);
    stone.scale.set(1.2, 0.65, 1.0);
    stone.userData.baseScaleY = stone.scale.y;
    parent.add(stone);
  }
  const embers = tagStage(
    new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), mats.forgeEmber),
    5,
  );
  embers.scale.set(1.2, 0.45, 1.2);
  embers.position.set(hx, 0.08, hz);
  embers.userData.baseScaleY = embers.scale.y;
  parent.add(embers);

  const cookingPot = tagStage(
    enableShadows(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mats.terracottaPot)),
    5,
  );
  cookingPot.scale.set(1.0, 0.88, 1.0);
  cookingPot.position.set(hx, 0.24, hz);
  cookingPot.userData.baseScaleY = cookingPot.scale.y;
  parent.add(cookingPot);

  // Woven straw grain-drying mat nearby
  const mat = tagStage(
    enableShadows(new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.03, 12), mats.thatch), false, true),
    5,
  );
  mat.position.set(hx + 0.92, 0.03, hz - 0.38);
  parent.add(mat);
}

function buildConstructionScaffolding(
  radius: number,
  mats: BuildingMaterialLibrary,
): THREE.Group {
  const scaff = new THREE.Group();
  const r = Math.max(1.8, radius * 0.76);

  // Foundation earthen ring & corner stakes
  const slab = enableShadows(
    new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.12, 0.45, 12), mats.loamSoil),
    false,
    true,
  );
  slab.position.y = 0.05;
  scaff.add(slab);

  const postCount = 6;
  for (let i = 0; i < postCount; i++) {
    const ang = (i / postCount) * Math.PI * 2;
    const px = Math.cos(ang) * r;
    const pz = Math.sin(ang) * r;

    const pole = enableShadows(
      new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), mats.timber),
    );
    pole.position.set(px, 1.6, pz);
    scaff.add(pole);

    const nextAng = ((i + 1) / postCount) * Math.PI * 2;
    const nx = Math.cos(nextAng) * r;
    const nz = Math.sin(nextAng) * r;
    const span = Math.hypot(nx - px, nz - pz);

    for (const beamY of [1.2, 2.4]) {
      const ledger = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(span, 0.08, 0.08), mats.timber),
      );
      ledger.position.set((px + nx) * 0.5, beamY, (pz + nz) * 0.5);
      ledger.rotation.y = -Math.atan2(nz - pz, nx - px);
      scaff.add(ledger);
    }
  }

  // Stacked lumber & cut stone supply piles at construction site
  for (let k = 0; k < 3; k++) {
    const log = enableShadows(
      new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.4, 6), mats.timber),
    );
    log.rotation.z = Math.PI / 2;
    log.position.set(-r * 0.4, 0.22 + (k === 2 ? 0.18 : 0), r * 0.45 + (k % 2) * 0.24);
    scaff.add(log);
  }
  const stonePile = enableShadows(
    new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.48, 0.75), mats.masonryDark),
  );
  stonePile.position.set(r * 0.42, 0.32, r * 0.42);
  scaff.add(stonePile);

  return scaff;
}

export function syncBuildingConstructionVisual(
  rootGroup: THREE.Group,
  entity: BuildingEntity,
): void {
  const completedBody = rootGroup.userData.completedBody as THREE.Group | undefined;
  const scaffolding = rootGroup.userData.scaffolding as THREE.Group | undefined;
  if (!completedBody || !scaffolding) return;

  if (entity.constructionState === 'planned') {
    // Stage 0: staked foundation outline + scaffolding poles
    completedBody.visible = true;
    for (const child of completedBody.children) {
      const st = (child.userData.buildStage as number | undefined) ?? 3;
      const baseY = (child.userData.baseScaleY as number | undefined) ?? 1;
      child.visible = st === 1;
      child.scale.y = baseY * (st === 1 ? 0.55 : 1);
    }
    scaffolding.visible = true;
    scaffolding.scale.set(1, 0.42, 1);
  } else if (entity.constructionState === 'under_construction') {
    const prog = Math.max(0.03, Math.min(0.999, entity.constructionProgress));
    const activeStage = getConstructionStageFromProgress(prog);
    const stageBounds = [0, 0.18, 0.38, 0.6, 0.82, 1.0];
    const startP = stageBounds[activeStage - 1];
    const endP = stageBounds[activeStage];
    const subProg = Math.max(0.18, Math.min(1, (prog - startP) / Math.max(0.01, endP - startP)));

    completedBody.visible = true;
    completedBody.scale.set(1, 1, 1);
    for (const child of completedBody.children) {
      const st = (child.userData.buildStage as number | undefined) ?? inferPartStage(child);
      const baseY = (child.userData.baseScaleY as number | undefined) ?? 1;
      if (st < activeStage) {
        child.visible = true;
        child.scale.y = baseY;
      } else if (st === activeStage) {
        child.visible = true;
        child.scale.y = baseY * (0.25 + 0.75 * subProg);
      } else {
        child.visible = false;
      }
    }
    scaffolding.visible = true;
    scaffolding.scale.set(1, 0.52 + 0.48 * prog, 1);
  } else {
    completedBody.visible = true;
    completedBody.scale.set(1, 1, 1);
    for (const child of completedBody.children) {
      const baseY = (child.userData.baseScaleY as number | undefined) ?? 1;
      child.visible = true;
      child.scale.y = baseY;
    }
    scaffolding.visible = false;
  }

  // Sync moisture-reactive soil & multi-stage crops for cultivated farms
  if (entity.archetype === 'cultivated_farm' && entity.constructionState === 'completed') {
    const farmSoilMat = rootGroup.userData.farmSoilMat as THREE.MeshStandardMaterial | undefined;
    const moisture = Math.max(0, Math.min(1, entity.soilMoisture ?? 0.45));
    if (farmSoilMat) {
      // Dry warm earth (#85684a) -> Rich damp wet loam (#26170d)
      const dryCol = new THREE.Color('#85684a');
      const wetCol = new THREE.Color('#26170d');
      farmSoilMat.color.copy(dryCol).lerp(wetCol, moisture);
      farmSoilMat.roughness = 0.95 - moisture * 0.52;
    }

    const cropPlants = rootGroup.userData.cropPlants as
      | {
          group: THREE.Group;
          sprout: THREE.Object3D;
          leafy: THREE.Object3D;
          stalk: THREE.Object3D;
          grain: THREE.Object3D;
          baseScale: number;
        }[]
      | undefined;
    const grainMat = rootGroup.userData.cropGrainMat as THREE.MeshStandardMaterial | undefined;
    const progress = Math.max(0, Math.min(1, entity.cropGrowthProgress ?? 0.3));
    const stage = entity.cropGrowthStage ?? 1;

    if (grainMat) {
      const youngGreen = new THREE.Color('#5f9937');
      const ripeGold = new THREE.Color('#dfb038');
      const ripenT = Math.max(0, Math.min(1, (progress - 0.55) / 0.35));
      grainMat.color.copy(youngGreen).lerp(ripeGold, ripenT);
    }

    if (cropPlants) {
      for (const plant of cropPlants) {
        if (stage === 0) {
          // Stage 0: Seeded soil with tiny shoots barely emerging
          plant.sprout.visible = true;
          plant.sprout.scale.setScalar(0.48 + progress * 2.5);
          plant.leafy.visible = false;
          plant.stalk.visible = false;
          plant.grain.visible = false;
        } else if (stage === 1) {
          // Stage 1: Vibrant green sprouts
          plant.sprout.visible = true;
          plant.sprout.scale.setScalar(1.0);
          plant.leafy.visible = true;
          plant.leafy.scale.setScalar(0.55 + (progress - 0.14) * 1.4);
          plant.stalk.visible = false;
          plant.grain.visible = false;
        } else if (stage === 2) {
          // Stage 2: Leafy mid-height green stalks
          plant.sprout.visible = false;
          plant.leafy.visible = true;
          plant.leafy.scale.setScalar(1.0);
          plant.stalk.visible = true;
          plant.stalk.scale.set(0.85, 0.58 + (progress - 0.36) * 1.1, 0.85);
          plant.grain.visible = false;
        } else {
          // Stage 3 & 4: Tall flowering & golden harvest-ready stalks
          plant.sprout.visible = false;
          plant.leafy.visible = true;
          plant.leafy.scale.setScalar(1.05);
          plant.stalk.visible = true;
          const heightScale = stage === 4 ? 1.08 : 0.88 + (progress - 0.62) * 0.65;
          plant.stalk.scale.set(1, heightScale, 1);
          plant.grain.visible = true;
          const headScale = stage === 4 ? 1.12 : 0.68 + (progress - 0.62) * 1.4;
          plant.grain.scale.setScalar(headScale);
        }
      }
    }
  }
}

/**
 * Fallback spatial/material stage classifier for sub-meshes without explicit tagStage().
 * Stage 1: Plinth/foundation (low Y), Stage 2: Pillars/posts, Stage 3: Walls, Stage 4: Roofs/canopies, Stage 5: Finials/banners/props.
 */
function inferPartStage(obj: THREE.Object3D): 1 | 2 | 3 | 4 | 5 {
  if (obj.position.y <= 0.22) return 1;
  if (obj.position.y <= 1.08) return 2;
  if (obj.position.y < 2.35) return 3;
  return 4;
}

export function buildProceduralStructure(
  entity: BuildingEntity,
  mats: BuildingMaterialLibrary,
): THREE.Group {
  const kingdom = KINGDOMS[entity.kingdomId];
  const style = kingdom.architecturalStyle;
  const rootGroup = new THREE.Group();
  rootGroup.position.set(entity.position.x, entity.position.y, entity.position.z);
  rootGroup.rotation.y = entity.rotationY;

  if (entity.archetype !== 'cultivated_farm') {
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(entity.footprintRadius * 1.18, 24),
      mats.contactShadowMat,
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    rootGroup.add(shadowDisc);
  }

  const group = new THREE.Group();
  rootGroup.add(group);

  const scaffolding = buildConstructionScaffolding(entity.footprintRadius, mats);
  rootGroup.add(scaffolding);

  rootGroup.userData.completedBody = group;
  rootGroup.userData.scaffolding = scaffolding;

  if (entity.archetype === 'blacksmith_workshop') {
    rootGroup.userData.smokeEmitterLocal = new THREE.Vector3(-1.35, 3.85, -0.5);
  } else if (entity.archetype === 'watch_post') {
    rootGroup.userData.smokeEmitterLocal = new THREE.Vector3(0, 6.25, 0);
  } else if (entity.archetype === 'royal_palace' || entity.archetype === 'royal_compound') {
    rootGroup.userData.smokeEmitterLocal = new THREE.Vector3(0, 5.2, -0.4);
  }

  switch (entity.archetype) {
    case 'royal_compound': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.2, 1.65, 12), mats.masonryDark),
      );
      plinth.position.y = -0.5;
      group.add(plinth);

      const wallH = 2.1;
      const backWall = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(9.6, wallH, 0.65), mats.masonry),
      );
      backWall.position.set(0, wallH * 0.5 + 0.25, -4.6);
      group.add(backWall);

      for (const side of [-1, 1]) {
        const sideWall = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(0.65, wallH, 9.2), mats.masonry),
        );
        sideWall.position.set(side * 4.6, wallH * 0.5 + 0.25, 0);
        group.add(sideWall);

        const frontFlank = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(3.1, wallH, 0.65), mats.masonry),
        );
        frontFlank.position.set(side * 3.1, wallH * 0.5 + 0.25, 4.6);
        group.add(frontFlank);

        for (const cz of [-4.6, 4.6]) {
          const bastion = enableShadows(
            new THREE.Mesh(
              new THREE.CylinderGeometry(0.68, 0.85, wallH + 0.8, 10),
              mats.masonryDark,
            ),
          );
          bastion.position.set(side * 4.6, (wallH + 0.8) * 0.5 + 0.25, cz);
          group.add(bastion);

          const cap = enableShadows(
            new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.75, 10), mats.thatch),
          );
          cap.position.set(side * 4.6, wallH + 1.35, cz);
          group.add(cap);
        }

        const jamb = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.3, 0.95), mats.masonryDark),
        );
        jamb.position.set(side * 1.35, 1.9, 4.65);
        group.add(jamb);
      }

      const lintel = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.5, 1.05), mats.timber),
      );
      lintel.position.set(0, 3.55, 4.65);
      group.add(lintel);

      const crestPlaque = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 12), mats.metalTrim),
      );
      crestPlaque.rotation.x = Math.PI / 2;
      crestPlaque.position.set(0, 3.55, 5.18);
      group.add(crestPlaque);

      if (style === 'monumental_pylon') {
        const hall = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.4, 4.2, 4), mats.masonry),
        );
        hall.rotation.y = Math.PI / 4;
        hall.position.set(0, 2.35, -0.6);
        group.add(hall);

        const cornice = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 4.6), mats.metalTrim),
        );
        cornice.position.set(0, 4.55, -0.6);
        group.add(cornice);

        for (const ox of [-2.0, 2.0]) {
          const obelisk = enableShadows(
            new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.36, 4.6, 4), mats.masonryDark),
          );
          obelisk.rotation.y = Math.PI / 4;
          obelisk.position.set(ox, 2.55, 2.3);
          group.add(obelisk);

          const pyramidion = enableShadows(
            new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.48, 4), mats.metalTrim),
          );
          pyramidion.rotation.y = Math.PI / 4;
          pyramidion.position.set(ox, 5.05, 2.3);
          group.add(pyramidion);
        }
      } else if (style === 'canopy_timber') {
        const baseDrum = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.0, 2.8, 12), mats.masonry),
        );
        baseDrum.position.set(0, 1.65, -0.5);
        group.add(baseDrum);

        const lowerRoof = enableShadows(
          new THREE.Mesh(new THREE.ConeGeometry(4.1, 2.2, 14), mats.thatch),
        );
        lowerRoof.position.set(0, 3.6, -0.5);
        group.add(lowerRoof);

        const upperRoof = enableShadows(
          new THREE.Mesh(new THREE.ConeGeometry(2.7, 2.8, 14), mats.thatch),
        );
        upperRoof.position.set(0, 5.2, -0.5);
        group.add(upperRoof);

        const spire = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 1.5, 8), mats.metalTrim),
        );
        spire.position.set(0, 6.8, -0.5);
        group.add(spire);
      } else if (style === 'arcaded_compound') {
        const lowerHall = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.8, 4.8), mats.masonry),
        );
        lowerHall.position.set(0, 1.65, -0.6);
        group.add(lowerHall);

        const tierRoof1 = enableShadows(
          new THREE.Mesh(new THREE.ConeGeometry(4.5, 1.6, 4), mats.thatch),
        );
        tierRoof1.rotation.y = Math.PI / 4;
        tierRoof1.position.set(0, 3.65, -0.6);
        group.add(tierRoof1);

        const upperLantern = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.4, 2.8), mats.masonryDark),
        );
        upperLantern.position.set(0, 4.4, -0.6);
        group.add(upperLantern);

        const tierRoof2 = enableShadows(
          new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.5, 4), mats.thatch),
        );
        tierRoof2.rotation.y = Math.PI / 4;
        tierRoof2.position.set(0, 5.65, -0.6);
        group.add(tierRoof2);

        const goldCrest = enableShadows(
          new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), mats.metalTrim),
        );
        goldCrest.position.set(0, 6.6, -0.6);
        group.add(goldCrest);
      } else {
        const mainKeep = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.8, 4.8), mats.masonry),
        );
        mainKeep.position.set(0, 2.15, -0.6);
        group.add(mainKeep);

        addToronBeams(group, 5.4, 3.8, 4.8, 0.25, mats);

        const crownTower = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.85, 2.3, 8), mats.masonryDark),
        );
        crownTower.position.set(0, 4.8, -0.6);
        group.add(crownTower);

        const crownFinial = enableShadows(
          new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.3, 8), mats.metalTrim),
        );
        crownFinial.position.set(0, 6.45, -0.6);
        group.add(crownFinial);

        for (const px of [-2.3, 2.3]) {
          for (const pz of [-2.6, 1.4]) {
            const pinnacle = enableShadows(
              new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.55, 6), mats.masonryDark),
            );
            pinnacle.position.set(px, 4.7, pz);
            group.add(pinnacle);
          }
        }
      }

      addBannerPole(group, -2.1, 0.25, 5.25, 4.5, mats);
      addBannerPole(group, 2.1, 0.25, 5.25, 4.5, mats);
      addClayVessels(group, -2.8, 2.4, mats);
      break;
    }

    case 'residential_compound': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.85, 1.4, 12), mats.masonryDark),
      );
      plinth.position.y = -0.48;
      group.add(plinth);

      const ringWall = enableShadows(
        new THREE.Mesh(
          new THREE.CylinderGeometry(4.1, 4.25, 1.35, 14, 1, true, 0.45, Math.PI * 2 - 0.9),
          mats.masonry,
        ),
      );
      ringWall.position.y = 0.85;
      group.add(ringWall);

      const positions: [number, number, number][] = [
        [-1.35, -0.9, 1.65],
        [1.55, -0.6, 1.4],
        [0.15, 1.45, 1.25],
      ];
      positions.forEach(([hx, hz, rad], idx) => {
        const wall = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.06, 2.15, 12), mats.masonry),
        );
        wall.position.set(hx, 1.2, hz);
        group.add(wall);

        // Lower stepped thatch eave with deep shadow overhang
        const lowerEave = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.42, rad * 1.22, 0.35, 12), mats.thatch),
        );
        lowerEave.position.set(hx, 2.32, hz);
        group.add(lowerEave);

        // Conical thatched roof with fiber crest
        const roof = enableShadows(
          new THREE.Mesh(new THREE.ConeGeometry(rad * 1.25, 1.65 + idx * 0.15, 12), mats.thatch),
        );
        roof.position.set(hx, 3.25, hz);
        group.add(roof);

        // Wooden finial spire
        const finial = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.55, 6), mats.timber),
        );
        finial.position.set(hx, 4.2, hz);
        group.add(finial);

        // Wooden framed doorway facing courtyard
        const doorAngle = Math.atan2(-hz, -hx);
        const doorFrame = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, 0.15), mats.timber),
        );
        doorFrame.position.set(hx + Math.cos(doorAngle) * (rad * 0.95), 0.75, hz + Math.sin(doorAngle) * (rad * 0.95));
        doorFrame.rotation.y = -doorAngle + Math.PI / 2;
        group.add(doorFrame);

        addRoofRafters(group, hx, 2.22, hz, rad * 1.24, 10, mats);
      });

      addClayVessels(group, -0.3, 0.3, mats);
      addClayVessels(group, 0.45, -0.2, mats);
      addVillageHearthProps(group, -0.1, 0.15, mats);
      break;
    }

    case 'dwelling_house': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.0, 1.35, 12), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      const isRect = style === 'monumental_pylon' || style === 'arcaded_compound';
      if (isRect) {
        const body = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.35, 3.2), mats.masonry),
        );
        body.position.set(0, 1.35, 0);
        group.add(body);

        // Stepped eaves
        const eave = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.28, 3.6), mats.timber),
        );
        eave.position.set(0, 2.55, 0);
        group.add(eave);

        const roof = enableShadows(
          new THREE.Mesh(new THREE.ConeGeometry(3.15, 1.55, 4), mats.thatch),
        );
        roof.rotation.y = Math.PI / 4;
        roof.position.set(0, 3.45, 0);
        group.add(roof);
      } else {
        const body = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.2, 2.3, 14), mats.masonry),
        );
        body.position.set(0, 1.32, 0);
        group.add(body);

        // Lower projecting thatch overhang eave
        const lowerEave = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.45, 0.35, 14), mats.thatch),
        );
        lowerEave.position.set(0, 2.48, 0);
        group.add(lowerEave);

        const roof = enableShadows(
          new THREE.Mesh(new THREE.ConeGeometry(2.55, 1.95, 14), mats.thatch),
        );
        roof.position.set(0, 3.55, 0);
        group.add(roof);

        addRoofRafters(group, 0, 2.38, 0, 2.32, 12, mats);

        const finial = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.55, 6), mats.timber),
        );
        finial.position.set(0, 4.6, 0);
        group.add(finial);
      }

      // Recessed dark doorway alcove & wooden posts/lintel/plank door
      const doorRecess = tagStage(
        new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.48, 0.14), mats.darkInterior),
        3,
      );
      doorRecess.position.set(0, 0.94, 1.97);
      group.add(doorRecess);

      for (const sx of [-0.48, 0.48]) {
        const jamb = tagStage(
          enableShadows(new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.55, 0.45), mats.timber)),
          2,
        );
        jamb.position.set(sx, 0.95, 2.02);
        group.add(jamb);
      }
      const lintel = tagStage(
        enableShadows(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.52), mats.timber)),
        3,
      );
      lintel.position.set(0, 1.78, 2.05);
      group.add(lintel);

      const doorPanel = tagStage(
        enableShadows(new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.45, 0.08), mats.timber)),
        5,
      );
      doorPanel.position.set(0, 0.95, 1.93);
      group.add(doorPanel);

      // Entrance clay water urns, domestic cooking hearth, drying grain mat & firewood pile
      addClayVessels(group, 1.25, 1.65, mats);
      addVillageHearthProps(group, 1.78, 0.55, mats);
      const firewood = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.85, 6), mats.timber),
      );
      firewood.rotation.z = Math.PI / 2;
      firewood.position.set(-1.25, 0.22, 1.75);
      group.add(firewood);
      break;
    }

    case 'granary_storehouse': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.25, 4.2), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      for (const gx of [-1.25, 1.25]) {
        for (const sx of [-0.55, 0.55]) {
          for (const sz of [-0.55, 0.55]) {
            const stilt = enableShadows(
              new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.05, 6), mats.timber),
            );
            stilt.position.set(gx + sx, 0.62, sz);
            group.add(stilt);
          }
        }
        const deck = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.18, 12), mats.timber),
        );
        deck.position.set(gx, 1.15, 0);
        group.add(deck);

        const silo = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.08, 2.25, 12), mats.masonry),
        );
        silo.position.set(gx, 2.32, 0);
        group.add(silo);

        const cap = enableShadows(
          new THREE.Mesh(new THREE.ConeGeometry(1.38, 1.45, 12), mats.thatch),
        );
        cap.position.set(gx, 4.05, 0);
        group.add(cap);
      }

      const ladder = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.1, 0.1), mats.timber),
      );
      ladder.rotation.x = -0.28;
      ladder.position.set(-1.25, 1.15, 1.25);
      group.add(ladder);

      addClayVessels(group, 0.1, 1.35, mats);
      break;
    }

    case 'warehouse_storehouse': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.35, 5.2), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      const hall = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 3.6), mats.masonry),
      );
      hall.position.set(-0.6, 1.5, -0.3);
      group.add(hall);

      const roof = enableShadows(
        new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.55, 4), mats.thatch),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(-0.6, 3.45, -0.3);
      group.add(roof);

      // Open loading porch with stacked hardwood logs & stone blocks
      for (let l = 0; l < 4; l++) {
        const log = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 1.9, 7), mats.timber),
        );
        log.rotation.x = Math.PI / 2;
        log.position.set(2.2 + (l % 2) * 0.32, 0.35 + Math.floor(l / 2) * 0.28, -0.7);
        group.add(log);
      }
      for (let s = 0; s < 3; s++) {
        const block = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.65), mats.masonryDark),
        );
        block.position.set(2.15 + (s % 2) * 0.55, 0.42 + (s === 2 ? 0.45 : 0), 1.15);
        group.add(block);
      }
      addBannerPole(group, 2.6, 0.2, 2.0, 3.6, mats);
      break;
    }

    case 'market_courtyard': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.25, 5.8), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      for (const px of [-2.6, 0, 2.6]) {
        for (const pz of [-2.1, 2.1]) {
          const post = enableShadows(
            new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.8, 8), mats.timber),
          );
          post.position.set(px, 1.55, pz);
          group.add(post);
        }
      }

      const awning = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.25, 5.0), mats.thatch),
      );
      awning.position.set(0, 2.98, 0);
      group.add(awning);

      const bannerTrim = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.32, 5.1), mats.banner),
      );
      bannerTrim.position.set(0, 2.78, 0);
      group.add(bannerTrim);

      for (const tx of [-1.45, 1.45]) {
        const counter = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.78, 1.05), mats.masonry),
        );
        counter.position.set(tx, 0.56, -0.35);
        group.add(counter);

        const clothRoll = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.85, 8), mats.banner),
        );
        clothRoll.rotation.z = Math.PI / 2;
        clothRoll.position.set(tx, 1.08, -0.35);
        group.add(clothRoll);
      }

      // Woven spice & grain sacks stacked near the stalls
      for (let s = 0; s < 4; s++) {
        const sack = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.52, 8), mats.thatch),
        );
        sack.position.set(-2.2 + (s % 2) * 0.45, 0.26 + Math.floor(s / 2) * 0.28, 1.4 + (s % 2) * 0.2);
        group.add(sack);
      }

      // Bronze merchant balance scale on stall
      const scaleStand = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), mats.metalTrim),
      );
      scaleStand.position.set(1.4, 1.15, -0.4);
      group.add(scaleStand);

      const scaleBeam = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.03), mats.metalTrim),
      );
      scaleBeam.position.set(1.4, 1.38, -0.4);
      group.add(scaleBeam);

      addClayVessels(group, -0.35, 1.35, mats);
      addBannerPole(group, 2.95, 0.15, 2.45, 3.8, mats);
      break;
    }

    case 'mine_pit': {
      const rim = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.0, 1.2, 10), mats.masonryDark),
      );
      rim.position.y = -0.35;
      group.add(rim);

      const pitFloor = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.7, 0.45, 10), mats.loamSoil),
      );
      pitFloor.position.y = 0.28;
      group.add(pitFloor);

      // Timber A-frame hoist gantry over mine shaft
      for (const side of [-1.1, 1.1]) {
        const leg1 = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 6), mats.timber),
        );
        leg1.position.set(side, 1.7, -0.55);
        leg1.rotation.x = 0.22;
        group.add(leg1);

        const leg2 = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 6), mats.timber),
        );
        leg2.position.set(side, 1.7, 0.55);
        leg2.rotation.x = -0.22;
        group.add(leg2);
      }

      const crossBar = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.8, 8), mats.timber),
      );
      crossBar.rotation.z = Math.PI / 2;
      crossBar.position.set(0, 3.2, 0);
      group.add(crossBar);

      const bucket = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.55, 8), mats.metalTrim),
      );
      bucket.position.set(0, 1.5, 0);
      group.add(bucket);

      // Ore shed on flank
      const shed = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.65, 1.9), mats.masonry),
      );
      shed.position.set(1.9, 1.05, 1.4);
      group.add(shed);
      const shedRoof = enableShadows(
        new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.95, 4), mats.thatch),
      );
      shedRoof.rotation.y = Math.PI / 4;
      shedRoof.position.set(1.9, 2.3, 1.4);
      group.add(shedRoof);
      break;
    }

    case 'blacksmith_workshop': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.3, 4.8), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      // Clay-brick bloomery furnace chimney + glowing hearth
      const furnace = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.25, 3.6, 10), mats.masonryDark),
      );
      furnace.position.set(-1.35, 1.95, -0.5);
      group.add(furnace);

      const hearthGlow = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 8, 8),
        mats.forgeEmber,
      );
      hearthGlow.position.set(-0.95, 0.85, 0.35);
      group.add(hearthGlow);

      // Clay tuyere bellows pipe
      const tuyere = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.8, 6), mats.terracottaPot),
      );
      tuyere.rotation.z = Math.PI / 3;
      tuyere.position.set(-0.65, 0.65, 0.35);
      group.add(tuyere);

      // Shaded smithy canopy & anvil block
      const smithyHall = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.2, 2.8), mats.masonry),
      );
      smithyHall.position.set(0.95, 1.28, -0.4);
      group.add(smithyHall);

      const roof = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 3.6), mats.thatch),
      );
      roof.position.set(0.95, 2.52, 0.1);
      group.add(roof);

      const anvilBase = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.55, 8), mats.timber),
      );
      anvilBase.position.set(0.85, 0.45, 1.45);
      group.add(anvilBase);

      const anvilTop = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, 0.28), mats.metalTrim),
      );
      anvilTop.position.set(0.85, 0.82, 1.45);
      group.add(anvilTop);

      // Timber water quenching trough
      const trough = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.42, 1.25), mats.timber),
      );
      trough.position.set(2.0, 0.35, 1.3);
      group.add(trough);

      // Cooling weapon rack with standing finished swords & spearheads
      const rackFrame = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 1.0), mats.timber),
      );
      rackFrame.position.set(-2.15, 0.65, 1.2);
      group.add(rackFrame);

      for (let w = 0; w < 3; w++) {
        const blade = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.14), mats.metalTrim),
        );
        blade.position.set(-2.1, 0.75, 0.9 + w * 0.28);
        blade.rotation.x = 0.15;
        group.add(blade);
      }
      break;
    }

    case 'barracks_compound': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.35, 6.2), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      const garrison = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.75, 2.8), mats.masonry),
      );
      garrison.position.set(0, 1.55, -1.2);
      group.add(garrison);

      const roof = enableShadows(
        new THREE.Mesh(new THREE.ConeGeometry(4.1, 1.4, 4), mats.thatch),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, 3.55, -1.2);
      group.add(roof);

      // Courtyard perimeter walls & drill weapon racks
      for (const side of [-1, 1]) {
        const wall = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.55, 4.8), mats.masonryDark),
        );
        wall.position.set(side * 2.9, 0.95, 0.3);
        group.add(wall);
      }

      // Straw training drill dummy in courtyard
      const dummyPost = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 6), mats.timber),
      );
      dummyPost.position.set(-1.1, 0.8, 1.1);
      group.add(dummyPost);

      const dummyArms = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.1), mats.timber),
      );
      dummyArms.position.set(-1.1, 1.25, 1.1);
      group.add(dummyArms);

      const dummyTorso = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.75, 8), mats.thatch),
      );
      dummyTorso.position.set(-1.1, 1.1, 1.1);
      group.add(dummyTorso);

      const dummyHead = enableShadows(
        new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), mats.thatch),
      );
      dummyHead.position.set(-1.1, 1.62, 1.1);
      group.add(dummyHead);

      // Shield drying rack along inner wall
      for (let sh = 0; sh < 3; sh++) {
        const wallShield = enableShadows(
          new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mats.banner),
        );
        wallShield.scale.set(0.7, 1.2, 0.25);
        wallShield.position.set(2.6, 1.1, -0.6 + sh * 0.85);
        wallShield.rotation.y = -Math.PI / 2;
        group.add(wallShield);
      }

      addBannerPole(group, -2.5, 0.2, 2.6, 4.0, mats);
      addBannerPole(group, 2.5, 0.2, 2.6, 4.0, mats);
      break;
    }

    case 'archery_grounds': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.25, 5.8), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      const lodge = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.1, 2.1), mats.timber),
      );
      lodge.position.set(0, 1.22, -1.55);
      group.add(lodge);

      const roof = enableShadows(
        new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.35, 4), mats.thatch),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, 2.85, -1.55);
      group.add(roof);

      // Three archery target butts at front of range
      for (const tx of [-1.8, 0, 1.8]) {
        const stand = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.25, 6), mats.timber),
        );
        stand.position.set(tx, 0.72, 1.85);
        group.add(stand);

        const targetDisc = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.16, 12), mats.banner),
        );
        targetDisc.rotation.x = Math.PI / 2;
        targetDisc.position.set(tx, 1.15, 1.78);
        group.add(targetDisc);
      }
      break;
    }

    case 'cavalry_stables': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.3, 6.2), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      const stalls = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.35, 2.5), mats.masonry),
      );
      stalls.position.set(0, 1.35, -1.35);
      group.add(stalls);

      const roof = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.35, 3.2), mats.thatch),
      );
      roof.position.set(0, 2.7, -1.2);
      group.add(roof);

      // Timber paddock rails & fodder trough
      for (const px of [-2.8, 0, 2.8]) {
        const post = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.2, 6), mats.timber),
        );
        post.position.set(px, 0.75, 2.35);
        group.add(post);
      }
      const rail = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.1, 0.1), mats.timber),
      );
      rail.position.set(0, 1.05, 2.35);
      group.add(rail);

      // Fodder trough with hay
      const fodderTrough = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.55), mats.timber),
      );
      fodderTrough.position.set(-1.4, 0.35, 1.85);
      group.add(fodderTrough);

      addBannerPole(group, 3.0, 0.2, 2.4, 4.2, mats);
      break;
    }

    case 'weapon_workshop': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.3, 5.2), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      const workshop = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.5, 3.2), mats.masonry),
      );
      workshop.position.set(-0.6, 1.42, -0.4);
      group.add(workshop);

      const roof = enableShadows(
        new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 4), mats.thatch),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(-0.6, 3.25, -0.4);
      group.add(roof);

      const siegeWheel = enableShadows(
        new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 6, 12), mats.timber),
      );
      siegeWheel.position.set(1.75, 0.75, 1.1);
      group.add(siegeWheel);
      addBannerPole(group, 2.2, 0.2, -1.6, 3.8, mats);
      break;
    }

    case 'royal_palace': {
      const plinth1 = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.4, 8.8), mats.masonryDark),
      );
      plinth1.position.y = -0.4;
      group.add(plinth1);

      const plinth2 = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.85, 7.0), mats.masonry),
      );
      plinth2.position.y = 0.65;
      group.add(plinth2);

      const grandHall = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.6, 5.0), mats.masonry),
      );
      grandHall.position.set(0, 2.8, -0.3);
      group.add(grandHall);

      const upperCrown = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 2.2, 8), mats.masonryDark),
      );
      upperCrown.position.set(0, 5.4, -0.3);
      group.add(upperCrown);

      const goldDome = enableShadows(
        new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.85, 8), mats.metalTrim),
      );
      goldDome.position.set(0, 7.25, -0.3);
      group.add(goldDome);

      for (const sx of [-3.6, 3.6]) {
        for (const sz of [-3.2, 3.2]) {
          const tower = enableShadows(
            new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.92, 3.8, 10), mats.masonryDark),
          );
          tower.position.set(sx, 2.2, sz);
          group.add(tower);

          const cap = enableShadows(
            new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.95, 10), mats.metalTrim),
          );
          cap.position.set(sx, 4.5, sz);
          group.add(cap);
        }
      }
      addBannerPole(group, -2.2, 0.9, 3.8, 4.6, mats);
      addBannerPole(group, 2.2, 0.9, 3.8, 4.6, mats);
      break;
    }

    case 'council_chambers': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 1.4, 12), mats.masonryDark),
      );
      plinth.position.y = -0.42;
      group.add(plinth);

      const drum = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 2.9, 10), mats.masonry),
      );
      drum.position.y = 1.65;
      group.add(drum);

      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const col = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.8, 8), mats.masonryDark),
        );
        col.position.set(Math.cos(ang) * 3.55, 1.6, Math.sin(ang) * 3.55);
        group.add(col);
      }

      const dome = enableShadows(
        new THREE.Mesh(new THREE.ConeGeometry(3.95, 1.9, 10), mats.thatch),
      );
      dome.position.y = 3.95;
      group.add(dome);

      const crest = enableShadows(
        new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), mats.metalTrim),
      );
      crest.position.y = 5.05;
      group.add(crest);
      break;
    }

    case 'royal_treasury': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.4, 5.6), mats.masonryDark),
      );
      plinth.position.y = -0.42;
      group.add(plinth);

      const vault = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 3.4, 4), mats.masonry),
      );
      vault.rotation.y = Math.PI / 4;
      vault.position.y = 1.9;
      group.add(vault);

      const goldRoof = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.45, 3.8), mats.metalTrim),
      );
      goldRoof.position.y = 3.75;
      group.add(goldRoof);

      const vaultDoor = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.35), mats.metalTrim),
      );
      vaultDoor.position.set(0, 1.15, 2.15);
      group.add(vaultDoor);
      break;
    }

    case 'cultivated_farm': {
      // Instance-specific moisture-reactive soil material + ripening grain material
      const farmSoilMat = mats.loamSoil.clone();
      const cropGrainMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#6ea338'),
        roughness: 0.72,
        metalness: 0.04,
      });
      rootGroup.userData.farmSoilMat = farmSoilMat;
      rootGroup.userData.cropGrainMat = cropGrainMat;
      rootGroup.userData.extraDisposables = [farmSoilMat, cropGrainMat];

      // 1. Multi-tier Stepped Terraced Earthworks
      const lowerTerrace = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.45, 3.6), farmSoilMat),
        false,
        true,
      );
      lowerTerrace.position.set(0, -0.05, 1.85);
      group.add(lowerTerrace);

      const upperTerrace = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.72, 3.6), farmSoilMat),
        false,
        true,
      );
      upperTerrace.position.set(0, 0.22, -1.85);
      group.add(upperTerrace);

      const retainingWall = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.55, 0.38), mats.masonryDark),
        true,
        true,
      );
      retainingWall.position.set(0, 0.16, 0.05);
      group.add(retainingWall);

      // 2. Central Sunken Stone-Lined Feeder Canal & Water Reservoir Trough
      const canalTrench = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 7.6), mats.masonryDark),
        false,
        true,
      );
      canalTrench.position.set(0, 0.06, 0);
      group.add(canalTrench);

      const waterRibbon = new THREE.Mesh(
        new THREE.PlaneGeometry(0.56, 7.4),
        mats.irrigationWater,
      );
      waterRibbon.rotation.x = -Math.PI / 2;
      waterRibbon.position.set(0, 0.15, 0);
      group.add(waterRibbon);

      const bridge = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.55), mats.timber),
      );
      bridge.position.set(0, 0.28, 0.05);
      group.add(bridge);

      const sluicePost = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.85, 6), mats.timber),
      );
      sluicePost.position.set(0.48, 0.52, 0.05);
      group.add(sluicePost);

      // 3. Furrowed Crop Rows with Multi-Stage Morphing Crop Plants
      const furrowGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.8, 6);
      furrowGeo.rotateZ(Math.PI / 2);

      const sproutGeo = new THREE.ConeGeometry(0.08, 0.24, 5);
      const leafyGeo = new THREE.ConeGeometry(0.22, 0.34, 6);
      const stalkStemGeo = new THREE.CylinderGeometry(0.032, 0.044, 1.05, 5);
      const leafGeo = new THREE.PlaneGeometry(0.44, 0.12);
      const grainHeadGeo = new THREE.ConeGeometry(0.11, 0.40, 6);

      const cropPlants: {
        group: THREE.Group;
        sprout: THREE.Object3D;
        leafy: THREE.Object3D;
        stalk: THREE.Object3D;
        grain: THREE.Object3D;
        baseScale: number;
      }[] = [];

      const addCropPlant = (px: number, py: number, pz: number, baseScale = 1.0) => {
        const plant = new THREE.Group();
        plant.position.set(px, py, pz);
        plant.scale.setScalar(baseScale);

        // Stage 0/1: Tender green sprout
        const sprout = enableShadows(new THREE.Mesh(sproutGeo, mats.cropStalk), false, true);
        sprout.position.y = 0.12;
        plant.add(sprout);

        // Stage 1/2: Lush leafy rosette
        const leafy = enableShadows(new THREE.Mesh(leafyGeo, mats.cropStalk), true, false);
        leafy.position.y = 0.22;
        plant.add(leafy);

        // Stage 2/3/4: Tall stalk + radiating leaf blades
        const stalk = new THREE.Group();
        const stem = enableShadows(new THREE.Mesh(stalkStemGeo, mats.cropStalk), true, false);
        stem.position.y = 0.52;
        stem.rotation.z = Math.sin(px * 3.0 + pz * 2.0) * 0.08;
        stalk.add(stem);

        for (let l = 0; l < 3; l++) {
          const leaf = enableShadows(new THREE.Mesh(leafGeo, mats.cropStalk), true, false);
          const ang = l * 2.1 + px;
          leaf.position.set(Math.cos(ang) * 0.16, 0.34 + l * 0.22, Math.sin(ang) * 0.16);
          leaf.rotation.set(0.35, ang, -0.4);
          stalk.add(leaf);
        }
        plant.add(stalk);

        // Stage 3/4: Plump grain panicle that ripens green -> harvest gold
        const grain = enableShadows(new THREE.Mesh(grainHeadGeo, cropGrainMat), true, false);
        grain.position.set(0, 1.15, 0);
        plant.add(grain);

        group.add(plant);
        cropPlants.push({ group: plant, sprout, leafy, stalk, grain, baseScale });
      };

      for (const side of [-1, 1]) {
        for (let r = 0; r < 3; r++) {
          const fz = 0.85 + r * 1.0;
          const fx = side * 2.3;
          const furrow = enableShadows(new THREE.Mesh(furrowGeo, farmSoilMat), false, true);
          furrow.position.set(fx, 0.22, fz);
          group.add(furrow);

          for (let s = -2; s <= 2; s++) {
            addCropPlant(
              fx + s * 0.72 + (r % 2) * 0.1,
              0.22,
              fz + (s % 2) * 0.05,
              0.88 + ((Math.abs(s + r) % 3) * 0.12),
            );
          }
        }
      }

      for (const side of [-1, 1]) {
        for (let r = 0; r < 3; r++) {
          const fz = -2.85 + r * 1.0;
          const fx = side * 2.3;
          const furrow = enableShadows(new THREE.Mesh(furrowGeo, farmSoilMat), false, true);
          furrow.position.set(fx, 0.62, fz);
          group.add(furrow);

          for (let s = -2; s <= 2; s++) {
            addCropPlant(
              fx + s * 0.72 + (r % 2) * 0.1,
              0.62,
              fz + (s % 2) * 0.05,
              0.92 + ((Math.abs(s + r) % 3) * 0.12),
            );
          }
        }
      }

      rootGroup.userData.cropPlants = cropPlants;

      // 4. Perimeter Wattle Fence Posts & Wooden Rails
      for (const cx of [-4.2, 4.2]) {
        for (const cz of [-3.5, 0.05, 3.5]) {
          const post = enableShadows(
            new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6), mats.timber),
          );
          post.position.set(cx, cz <= 0 ? 0.72 : 0.45, cz);
          group.add(post);
        }
        const rail = enableShadows(
          new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 7.0, 5), mats.timber),
        );
        rail.rotation.x = Math.PI / 2;
        rail.position.set(cx, 0.72, 0);
        group.add(rail);
      }

      // 5. Farmer's Thatch Ramada Shelter & Clay Irrigation Jars
      for (const sx of [-3.8, -3.0]) {
        for (const sz of [-3.2, -2.4]) {
          const post = enableShadows(
            new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.8, 5), mats.timber),
          );
          post.position.set(sx, 1.15, sz);
          group.add(post);
        }
      }
      const shadeRoof = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.14, 1.65), mats.thatch),
      );
      shadeRoof.position.set(-3.4, 2.05, -2.8);
      shadeRoof.rotation.x = 0.18;
      group.add(shadeRoof);

      addClayVessels(group, -3.2, -2.5, mats);
      break;
    }

    case 'watch_post': {
      const plinth = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, 1.5, 10), mats.masonryDark),
      );
      plinth.position.y = -0.45;
      group.add(plinth);

      const towerBase = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(1.45, 2.15, 5.2, 8), mats.masonry),
      );
      towerBase.position.y = 2.8;
      group.add(towerBase);

      // Rear wooden access ladder with rungs climbing the tower
      const ladderRungs = 7;
      for (let r = 0; r < ladderRungs; r++) {
        const rung = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.06), mats.timber),
        );
        rung.position.set(0, 1.0 + r * 0.65, -1.8 + r * 0.05);
        group.add(rung);
      }

      const deck = enableShadows(
        new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.35, 3.5), mats.timber),
      );
      deck.position.y = 5.5;
      group.add(deck);

      for (const px of [-1.45, 1.45]) {
        for (const pz of [-1.45, 1.45]) {
          const post = enableShadows(
            new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 6), mats.timber),
          );
          post.position.set(px, 6.5, pz);
          group.add(post);
        }
      }

      // Lookout railing cross-braces
      for (const [x1, z1, x2, z2] of [
        [-1.45, -1.45, -1.45, 1.45],
        [1.45, -1.45, 1.45, 1.45],
        [-1.45, 1.45, 1.45, 1.45],
      ]) {
        const rail = enableShadows(
          new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.8), mats.timber),
        );
        rail.position.set((x1 + x2) * 0.5, 6.35, (z1 + z2) * 0.5);
        if (x1 !== x2) rail.rotation.y = Math.PI / 2;
        group.add(rail);
      }

      // Signal brazier with glowing coals
      const brazierBase = enableShadows(
        new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.45, 6), mats.metalTrim),
      );
      brazierBase.position.set(0, 5.85, 0);
      group.add(brazierBase);

      const brazierEmber = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 6),
        mats.forgeEmber,
      );
      brazierEmber.position.set(0, 6.12, 0);
      group.add(brazierEmber);

      const roof = enableShadows(
        new THREE.Mesh(new THREE.ConeGeometry(2.65, 1.95, 8), mats.thatch),
      );
      roof.position.y = 8.15;
      group.add(roof);

      const finial = enableShadows(
        new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), mats.metalTrim),
      );
      finial.position.y = 9.25;
      group.add(finial);

      addBannerPole(group, 1.65, 5.55, 1.65, 2.8, mats);
      break;
    }
  }

  syncBuildingConstructionVisual(rootGroup, entity);
  return rootGroup;
}

export interface PlacementGhostVisual {
  root: THREE.Group;
  footprintRing: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  setValid: (valid: boolean) => void;
  setArchetype: (archetype: BuildingArchetype) => void;
  dispose: () => void;
}

export function createPlacementGhostVisual(): PlacementGhostVisual {
  const root = new THREE.Group();
  root.visible = false;

  const ringGeo = new THREE.RingGeometry(0.86, 1.0, 36);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#4ade80'),
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const footprintRing = new THREE.Mesh(ringGeo, ringMat);
  footprintRing.position.y = 0.08;
  footprintRing.renderOrder = 6;
  root.add(footprintRing);

  const innerRingGeo = new THREE.RingGeometry(0.45, 0.52, 24);
  innerRingGeo.rotateX(-Math.PI / 2);
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#86efac'),
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.position.y = 0.07;
  innerRing.renderOrder = 6;
  root.add(innerRing);

  const bodyGeo = new THREE.CylinderGeometry(0.78, 0.85, 2.4, 14);
  bodyGeo.translate(0, 1.2, 0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4ade80'),
    emissive: new THREE.Color('#166534'),
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.renderOrder = 5;
  root.add(bodyMesh);

  const wireGeo = new THREE.EdgesGeometry(bodyGeo);
  const wireMat = new THREE.LineBasicMaterial({
    color: new THREE.Color('#bbf7d0'),
    transparent: true,
    opacity: 0.85,
  });
  const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
  bodyMesh.add(wireMesh);

  // Direction indicator arrow on front (+Z) so entrance orientation is crystal-clear
  const arrowGeo = new THREE.ConeGeometry(0.32, 0.78, 6);
  arrowGeo.rotateX(Math.PI / 2);
  const arrowMesh = new THREE.Mesh(arrowGeo, ringMat);
  arrowMesh.position.set(0, 0.25, 1.15);
  root.add(arrowMesh);

  return {
    root,
    footprintRing,
    bodyMesh,
    setValid: (valid: boolean) => {
      if (valid) {
        ringMat.color.set('#4ade80');
        innerRingMat.color.set('#86efac');
        wireMat.color.set('#bbf7d0');
        bodyMat.color.set('#4ade80');
        bodyMat.emissive.set('#15803d');
      } else {
        ringMat.color.set('#f87171');
        innerRingMat.color.set('#fca5a5');
        wireMat.color.set('#fecaca');
        bodyMat.color.set('#ef4444');
        bodyMat.emissive.set('#991b1b');
      }
    },
    setArchetype: (archetype: BuildingArchetype) => {
      const bp = BUILDING_CATALOG[archetype];
      const r = bp.footprintRadius;
      footprintRing.scale.set(r, 1, r);
      innerRing.scale.set(r, 1, r);
      const hScale = archetype === 'cultivated_farm' ? 0.25 : archetype === 'watch_post' ? 2.4 : 1.1;
      bodyMesh.scale.set(r * 0.85, hScale, r * 0.85);
      arrowMesh.position.set(0, 0.28, r + 0.45);
    },
    dispose: () => {
      ringGeo.dispose();
      ringMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      arrowGeo.dispose();
    },
  };
}
