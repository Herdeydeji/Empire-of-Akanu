import * as THREE from 'three';
import { CharacterEntity, ResourceKey } from '../../types/game';
import { ProceduralTextureSet } from './proceduralTextures';

export interface CharacterVisualRig {
  entityId: string;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  spinePivot: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightKneePivot: THREE.Group;
  tunicMaterial: THREE.MeshStandardMaterial;
  carriedBundleMesh: THREE.Mesh;
  carriedBundleMaterial: THREE.MeshStandardMaterial;
  waterJarGroup: THREE.Group;
  waterStreamMesh: THREE.Mesh;
  toolMeshes: Record<string, THREE.Object3D>;
  horseLegs: THREE.Group[];
  activePropType: string;
  collider: THREE.Mesh;
  dispose: () => void;
}

function hashEntityId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const RESOURCE_BUNDLE_COLORS: Record<ResourceKey, { color: string; metalness: number; roughness: number }> = {
  food: { color: '#dfb44b', metalness: 0.05, roughness: 0.82 },
  wood: { color: '#6b4423', metalness: 0.03, roughness: 0.86 },
  stone: { color: '#8d877f', metalness: 0.08, roughness: 0.88 },
  iron: { color: '#6e3a2c', metalness: 0.55, roughness: 0.48 },
  gold: { color: '#f2c138', metalness: 0.85, roughness: 0.25 },
};

export function createProceduralCharacterRig(
  entity: CharacterEntity,
  textures: ProceduralTextureSet,
): CharacterVisualRig {
  const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const root = new THREE.Group();
  root.position.set(entity.position.x, entity.position.y, entity.position.z);
  root.rotation.y = entity.rotationY;

  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  const shadowDisc = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.62, 16)), shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.025;
  root.add(shadowDisc);

  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(entity.skinTone),
      roughness: 0.62,
      metalness: 0.04,
    }),
  );
  const tunicMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(entity.tunicColor),
      roughness: 0.80,
      metalness: 0.04,
      normalMap: textures.fabricNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
    }),
  );
  const sashMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(entity.accentColor),
      roughness: 0.45,
      metalness: 0.38,
      normalMap: textures.fabricNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
    }),
  );
  const hairMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a120d'),
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  const woodPropMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#704b2b'),
      roughness: 0.76,
      metalness: 0.05,
    }),
  );
  const ironToolMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#9ea4ab'),
      roughness: 0.36,
      metalness: 0.75,
    }),
  );

  const idSeed = hashEntityId(entity.id);
  const idSeed2 = hashEntityId(entity.id + '_b');
  const heightScale = entity.isMilitary ? 1.0 + (idSeed - 0.5) * 0.08 : 0.96 + idSeed * 0.1;
  const shoulderScale = entity.isMilitary ? 1.04 + idSeed2 * 0.08 : 0.94 + idSeed2 * 0.12;

  const bodyPivot = new THREE.Group();
  bodyPivot.scale.set(shoulderScale, heightScale, 0.97 + idSeed2 * 0.08);
  root.add(bodyPivot);

  const skirtProfile = [
    new THREE.Vector2(0.23, 0.34),
    new THREE.Vector2(0.21, 0.56),
    new THREE.Vector2(0.18, 0.78),
    new THREE.Vector2(0.155, 0.94),
  ];
  const skirtMesh = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(skirtProfile, 16)), tunicMat);
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  bodyPivot.add(skirtMesh);

  // Natural multi-joint spine pivot anchored at waist level
  const spinePivot = new THREE.Group();
  spinePivot.position.set(0, 0.92, 0);
  bodyPivot.add(spinePivot);

  // Sculpted organic human torso (tapered waist -> ribcage -> rounded shoulders)
  const torsoProfile = [
    new THREE.Vector2(0.148, 0.0),
    new THREE.Vector2(0.158, 0.11),
    new THREE.Vector2(0.195, 0.25),
    new THREE.Vector2(0.212, 0.38),
    new THREE.Vector2(0.165, 0.47),
    new THREE.Vector2(0.085, 0.50),
  ];
  const torsoMesh = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry(torsoProfile, 16)),
    tunicMat,
  );
  torsoMesh.scale.set(1.06, 1.0, 0.78);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  spinePivot.add(torsoMesh);

  const beltMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.168, 0.178, 0.10, 14)),
    sashMat,
  );
  beltMesh.scale.set(1.05, 1.0, 0.82);
  beltMesh.position.y = 0.02;
  beltMesh.castShadow = true;
  spinePivot.add(beltMesh);

  const shoulderDrape = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.172, 0.042, 8, 16)),
    sashMat,
  );
  shoulderDrape.position.set(0, 0.34, 0);
  shoulderDrape.rotation.set(Math.PI / 2.35, 0.30, 0);
  spinePivot.add(shoulderDrape);

  // Flowing cloak / mantle for royal guards, commanders, and seasoned traders
  if (
    entity.militaryClass === 'commander' ||
    entity.militaryClass === 'royal_guard' ||
    entity.role === 'Trader'
  ) {
    const cloak = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.18, 0.31, 0.86, 12, 1, true, Math.PI * 0.65, Math.PI * 0.7)),
      sashMat,
    );
    cloak.position.set(0, 0.02, -0.04);
    cloak.castShadow = true;
    spinePivot.add(cloak);
  }

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.50, 0);
  spinePivot.add(headPivot);

  // Sculpted tapered neck
  const neck = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.062, 0.076, 0.14, 10)),
    skinMat,
  );
  neck.position.y = 0.05;
  neck.castShadow = true;
  headPivot.add(neck);

  // Anatomically contoured cranium + cheekbone fullness + chin/jaw
  const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.142, 16, 14)), skinMat);
  head.scale.set(0.90, 1.08, 0.94);
  head.position.y = 0.21;
  head.castShadow = true;
  headPivot.add(head);

  const chinJaw = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.095, 12, 10)), skinMat);
  chinJaw.scale.set(0.86, 0.92, 0.95);
  chinJaw.position.set(0, 0.14, 0.048);
  headPivot.add(chinJaw);

  // Sculpted nose bridge & soft tip
  const noseBridge = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.016, 0.042, 4, 8)), skinMat);
  noseBridge.position.set(0, 0.195, 0.132);
  noseBridge.rotation.x = -0.22;
  headPivot.add(noseBridge);

  // Expressive eyes, eyelids/brows & curved ears
  const eyeWhiteMat = trackMat(new THREE.MeshBasicMaterial({ color: '#f3ede2' }));
  const eyePupilMat = trackMat(new THREE.MeshBasicMaterial({ color: '#160e0a' }));
  for (const side of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.022, 8, 8)), eyeWhiteMat);
    eyeWhite.scale.set(1.1, 0.62, 0.45);
    eyeWhite.position.set(side * 0.048, 0.22, 0.126);
    headPivot.add(eyeWhite);

    const pupil = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.012, 8, 8)), eyePupilMat);
    pupil.scale.set(0.95, 0.95, 0.5);
    pupil.position.set(side * 0.048, 0.22, 0.134);
    headPivot.add(pupil);

    const brow = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.008, 0.032, 3, 6)), hairMat);
    brow.rotation.z = Math.PI / 2 + side * -0.08;
    brow.position.set(side * 0.048, 0.244, 0.132);
    headPivot.add(brow);

    const ear = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.026, 8, 8)), skinMat);
    ear.scale.set(0.48, 1.15, 0.72);
    ear.position.set(side * 0.128, 0.20, -0.008);
    headPivot.add(ear);
  }

  // Softly contoured lips
  const lipMat = trackMat(new THREE.MeshStandardMaterial({ color: '#4c261b', roughness: 0.55 }));
  const lips = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.010, 0.028, 4, 8)), lipMat);
  lips.rotation.z = Math.PI / 2;
  lips.position.set(0, 0.145, 0.134);
  headPivot.add(lips);

  // Distinct hairstyle / headwear based on role & military status
  if (entity.isMilitary) {
    if (entity.militaryClass === 'commander' || entity.militaryClass === 'royal_guard') {
      // Royal crested bronze helmet with side cheek pieces & horsehair plume
      const helmMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(entity.accentColor),
          roughness: 0.25,
          metalness: 0.85,
        }),
      );
      const helm = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.155, 0.165, 0.18, 12)), helmMat);
      helm.position.set(0, 0.27, -0.01);
      headPivot.add(helm);

      const crestPlume = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.035, 0.16, 0.32)), tunicMat);
      crestPlume.position.set(0, 0.40, -0.02);
      headPivot.add(crestPlume);
    } else {
      // Warrior leather & bronze headband with feather ornament
      const band = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.155, 0.152, 0.05, 12)), sashMat);
      band.position.set(0, 0.24, 0);
      headPivot.add(band);

      const feather = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.025, 0.18, 4)), tunicMat);
      feather.position.set(0.12, 0.35, -0.05);
      feather.rotation.z = -0.35;
      headPivot.add(feather);
    }
  } else if (entity.role === 'Trader') {
    const headwrap = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.165, 0.145, 0.17, 12)),
      sashMat,
    );
    headwrap.position.set(0, 0.27, -0.01);
    headwrap.rotation.x = -0.14;
    headwrap.castShadow = true;
    headPivot.add(headwrap);
  } else if (entity.role === 'Farmer') {
    // Wide woven straw sun hat for field cultivators
    const strawMat = trackMat(
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#c89d54'), roughness: 0.88 }),
    );
    const brim = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.28, 0.09, 14)), strawMat);
    brim.position.set(0, 0.32, 0);
    brim.castShadow = true;
    headPivot.add(brim);
  } else if (entity.role === 'Builder' || entity.role === 'Miner') {
    // Protective artisan headcloth wrap
    const wrap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.154, 0.15, 0.09, 12)), sashMat);
    wrap.position.set(0, 0.26, 0);
    headPivot.add(wrap);
  } else if (entity.role === 'Hunter') {
    // Braided crown + feathered tracker plume
    const hairCrown = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.152, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6)),
      hairMat,
    );
    hairCrown.position.y = 0.21;
    headPivot.add(hairCrown);
    const plume = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.022, 0.16, 4)), sashMat);
    plume.position.set(-0.11, 0.32, -0.04);
    plume.rotation.z = 0.35;
    headPivot.add(plume);
  } else {
    // Textured braided cornrows across cranium
    const hairCrown = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.152, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6)),
      hairMat,
    );
    hairCrown.position.y = 0.21;
    headPivot.add(hairCrown);
  }

  // Chest pectoral armor plate for military units
  if (entity.isMilitary) {
    const breastplateMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(entity.accentColor),
        roughness: 0.28,
        metalness: 0.82,
      }),
    );
    const chestPlate = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.22, 0.20, 0.34, 10)),
      breastplateMat,
    );
    chestPlate.position.set(0, 0.26, 0.02);
    chestPlate.castShadow = true;
    spinePivot.add(chestPlate);

    // Bronze central sunburst medallion
    const medallion = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 8)), breastplateMat);
    medallion.rotation.x = Math.PI / 2;
    medallion.position.set(0, 0.28, 0.135);
    spinePivot.add(medallion);
  }

  // Anatomically tapered legs (muscular thigh, calf bulge, slim ankle, rounded foot)
  const thighProfile = [
    new THREE.Vector2(0.048, -0.28),
    new THREE.Vector2(0.058, -0.14),
    new THREE.Vector2(0.068, 0.0),
  ];
  const calfProfile = [
    new THREE.Vector2(0.035, -0.28),
    new THREE.Vector2(0.050, -0.11),
    new THREE.Vector2(0.046, 0.0),
  ];
  const thighGeo = trackGeo(new THREE.LatheGeometry(thighProfile, 10));
  const calfGeo = trackGeo(new THREE.LatheGeometry(calfProfile, 10));
  const footGeo = trackGeo(new THREE.SphereGeometry(0.062, 10, 8));

  // Left Leg: Hip -> Thigh -> Knee -> Calf -> Foot
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.095, 0.62, 0);
  bodyPivot.add(leftLegPivot);

  const leftThigh = new THREE.Mesh(thighGeo, skinMat);
  leftThigh.castShadow = true;
  leftLegPivot.add(leftThigh);

  const leftKneePivot = new THREE.Group();
  leftKneePivot.position.set(0, -0.28, 0);
  leftLegPivot.add(leftKneePivot);

  const leftCalf = new THREE.Mesh(calfGeo, skinMat);
  leftCalf.castShadow = true;
  leftKneePivot.add(leftCalf);

  if (entity.isMilitary) {
    const greave = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.058, 0.048, 0.24, 10)), sashMat);
    greave.position.set(0, -0.12, 0.01);
    leftKneePivot.add(greave);
  }

  const leftSandals = new THREE.Mesh(footGeo, woodPropMat);
  leftSandals.scale.set(0.78, 0.45, 1.55);
  leftSandals.position.set(0, -0.285, 0.045);
  leftSandals.castShadow = true;
  leftKneePivot.add(leftSandals);

  // Right Leg: Hip -> Thigh -> Knee -> Calf -> Foot
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.095, 0.62, 0);
  bodyPivot.add(rightLegPivot);

  const rightThigh = new THREE.Mesh(thighGeo, skinMat);
  rightThigh.castShadow = true;
  rightLegPivot.add(rightThigh);

  const rightKneePivot = new THREE.Group();
  rightKneePivot.position.set(0, -0.28, 0);
  rightLegPivot.add(rightKneePivot);

  const rightCalf = new THREE.Mesh(calfGeo, skinMat);
  rightCalf.castShadow = true;
  rightKneePivot.add(rightCalf);

  if (entity.isMilitary) {
    const greave = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.058, 0.048, 0.24, 10)), sashMat);
    greave.position.set(0, -0.12, 0.01);
    rightKneePivot.add(greave);
  }

  const rightSandals = new THREE.Mesh(footGeo, woodPropMat);
  rightSandals.scale.set(0.78, 0.45, 1.55);
  rightSandals.position.set(0, -0.285, 0.045);
  rightSandals.castShadow = true;
  rightKneePivot.add(rightSandals);

  const upperArmProfile = [
    new THREE.Vector2(0.042, -0.24),
    new THREE.Vector2(0.052, -0.10),
    new THREE.Vector2(0.058, 0.0),
  ];
  const forearmProfile = [
    new THREE.Vector2(0.032, -0.22),
    new THREE.Vector2(0.044, -0.08),
    new THREE.Vector2(0.044, 0.0),
  ];
  const upperArmGeo = trackGeo(new THREE.LatheGeometry(upperArmProfile, 10));
  const forearmGeo = trackGeo(new THREE.LatheGeometry(forearmProfile, 10));
  const sleeveGeo = trackGeo(new THREE.CylinderGeometry(0.072, 0.064, 0.16, 10));
  const handGeo = trackGeo(new THREE.SphereGeometry(0.038, 8, 8));

  // Left Arm: Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand (mounted to spinePivot)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.23, 0.39, 0);
  spinePivot.add(leftArmPivot);

  const leftSleeve = new THREE.Mesh(sleeveGeo, tunicMat);
  leftSleeve.position.y = -0.06;
  leftArmPivot.add(leftSleeve);

  const leftUpperArm = new THREE.Mesh(upperArmGeo, skinMat);
  leftUpperArm.castShadow = true;
  leftArmPivot.add(leftUpperArm);

  const leftElbowPivot = new THREE.Group();
  leftElbowPivot.position.set(0, -0.24, 0);
  leftArmPivot.add(leftElbowPivot);

  const leftForearm = new THREE.Mesh(forearmGeo, skinMat);
  leftForearm.castShadow = true;
  leftElbowPivot.add(leftForearm);

  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.scale.set(0.75, 1.15, 0.92);
  leftHand.position.set(0, -0.235, 0.01);
  leftElbowPivot.add(leftHand);

  // Right Arm: Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand (mounted to spinePivot)
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.23, 0.39, 0);
  spinePivot.add(rightArmPivot);

  const rightSleeve = new THREE.Mesh(sleeveGeo, tunicMat);
  rightSleeve.position.y = -0.06;
  rightArmPivot.add(rightSleeve);

  const rightUpperArm = new THREE.Mesh(upperArmGeo, skinMat);
  rightUpperArm.castShadow = true;
  rightArmPivot.add(rightUpperArm);

  const rightElbowPivot = new THREE.Group();
  rightElbowPivot.position.set(0, -0.24, 0);
  rightArmPivot.add(rightElbowPivot);

  const rightForearm = new THREE.Mesh(forearmGeo, skinMat);
  rightForearm.castShadow = true;
  rightElbowPivot.add(rightForearm);

  const rightHand = new THREE.Mesh(handGeo, skinMat);
  rightHand.scale.set(0.75, 1.15, 0.92);
  rightHand.position.set(0, -0.235, 0.01);
  rightElbowPivot.add(rightHand);

  // Build switchable occupation tool meshes so reassigning occupations updates tools live!
  const toolMeshes: Record<string, THREE.Object3D> = {};

  // Staff
  const staff = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.022, 0.018, 1.55, 6)),
    woodPropMat,
  );
  staff.position.set(0, -0.11, 0.14);
  staff.rotation.x = 0.18;
  rightElbowPivot.add(staff);
  toolMeshes.staff = staff;

  // Basket (Farmer / Fisherman)
  const basket = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.17, 0.11, 0.21, 10)),
    sashMat,
  );
  basket.position.set(-0.06, -0.20, 0.12);
  leftElbowPivot.add(basket);
  toolMeshes.basket = basket;

  // Mallet (Builder / Craftsperson)
  const malletGroup = new THREE.Group();
  const mHandle = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6)),
    woodPropMat,
  );
  mHandle.position.set(0, -0.46, 0.12);
  mHandle.rotation.x = Math.PI / 2.2;
  malletGroup.add(mHandle);
  const mHead = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.12, 0.1, 0.2)),
    woodPropMat,
  );
  mHead.position.set(0, -0.48, 0.28);
  malletGroup.add(mHead);
  rightArmPivot.add(malletGroup);
  toolMeshes.mallet = malletGroup;

  // Axe (Woodcutter)
  const axeGroup = new THREE.Group();
  const aHandle = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6)),
    woodPropMat,
  );
  aHandle.position.set(0, -0.46, 0.15);
  aHandle.rotation.x = Math.PI / 2.1;
  axeGroup.add(aHandle);
  const aBlade = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.04, 0.16, 0.14)),
    ironToolMat,
  );
  aBlade.position.set(0, -0.52, 0.34);
  axeGroup.add(aBlade);
  rightArmPivot.add(axeGroup);
  toolMeshes.axe = axeGroup;

  // Pickaxe (Miner)
  const pickGroup = new THREE.Group();
  const pHandle = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 6)),
    woodPropMat,
  );
  pHandle.position.set(0, -0.46, 0.15);
  pHandle.rotation.x = Math.PI / 2.1;
  pickGroup.add(pHandle);
  const pSpike = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.045, 0.32, 6)),
    ironToolMat,
  );
  pSpike.rotation.z = Math.PI / 2;
  pSpike.position.set(0, -0.5, 0.34);
  pickGroup.add(pSpike);
  rightArmPivot.add(pickGroup);
  toolMeshes.pickaxe = pickGroup;

  // Slung Bow (Hunter)
  const bowArc = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.28, 0.022, 6, 12, Math.PI * 1.1)),
    woodPropMat,
  );
  bowArc.position.set(0.04, -0.38, 0.16);
  bowArc.rotation.y = Math.PI / 2;
  rightArmPivot.add(bowArc);
  toolMeshes.bow_slung = bowArc;

  // Scroll / Ledger (Trader)
  const scrollMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 8)),
    sashMat,
  );
  scrollMesh.rotation.z = Math.PI / 2;
  scrollMesh.position.set(-0.04, -0.44, 0.12);
  leftArmPivot.add(scrollMesh);
  toolMeshes.scroll = scrollMesh;

  // Carried resource bundle (visible on back/shoulder when hauling goods!)
  const carriedBundleMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#dfb44b'),
      roughness: 0.78,
      metalness: 0.1,
    }),
  );
  const carriedBundleMesh = new THREE.Mesh(
    trackGeo(new THREE.DodecahedronGeometry(0.18, 1)),
    carriedBundleMaterial,
  );
  carriedBundleMesh.scale.set(1.05, 0.9, 1.0);
  carriedBundleMesh.position.set(0, 1.18, -0.22);
  carriedBundleMesh.castShadow = true;
  carriedBundleMesh.visible = false;
  bodyPivot.add(carriedBundleMesh);

  // Sculpted Terracotta Clay Water Vessel + Pouring Stream Cone for Farmer Irrigation
  const waterJarGroup = new THREE.Group();
  const clayMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#a45332'),
      roughness: 0.72,
      metalness: 0.05,
    }),
  );
  const jarProfile = [
    new THREE.Vector2(0.05, 0.0),
    new THREE.Vector2(0.135, 0.11),
    new THREE.Vector2(0.145, 0.21),
    new THREE.Vector2(0.075, 0.29),
    new THREE.Vector2(0.095, 0.34),
  ];
  const clayJarMesh = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(jarProfile, 14)), clayMat);
  clayJarMesh.castShadow = true;
  waterJarGroup.add(clayJarMesh);

  const waterSurfaceDisc = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(0.075, 12)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#3ca2b8'),
        roughness: 0.12,
        metalness: 0.25,
      }),
    ),
  );
  waterSurfaceDisc.rotation.x = -Math.PI / 2;
  waterSurfaceDisc.position.y = 0.31;
  waterJarGroup.add(waterSurfaceDisc);

  const waterStreamMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.025, 0.095, 0.95, 8, 1, true)),
    trackMat(
      new THREE.MeshBasicMaterial({
        color: '#88e5f7',
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  waterStreamMesh.position.set(0, 0.65, 0.38);
  waterStreamMesh.rotation.x = 0.55;
  waterStreamMesh.visible = false;
  waterJarGroup.add(waterStreamMesh);

  waterJarGroup.visible = false;
  spinePivot.add(waterJarGroup);

  // ==========================================
  // PHASE 3 MILITARY WEAPONS, SHIELDS & EQUIPMENT
  // ==========================================

  // Bronze Sword (Infantry)
  const swordGroup = new THREE.Group();
  const sHilt = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.02, 0.28, 6)), woodPropMat);
  sHilt.position.set(0, -0.42, 0.08);
  sHilt.rotation.x = Math.PI / 2.2;
  swordGroup.add(sHilt);
  const sPommel = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 6, 6)), ironToolMat);
  sPommel.position.set(0, -0.42, -0.05);
  swordGroup.add(sPommel);
  const sGuard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.20, 0.045, 0.05)), ironToolMat);
  sGuard.position.set(0, -0.42, 0.22);
  swordGroup.add(sGuard);
  const sBlade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.075, 0.02, 0.85)), ironToolMat);
  sBlade.position.set(0, -0.42, 0.65);
  sBlade.castShadow = true;
  swordGroup.add(sBlade);
  rightArmPivot.add(swordGroup);
  toolMeshes.sword_bronze = swordGroup;

  // Realistic African Ox-Hide War Shield on Left Arm
  const shieldGroup = new THREE.Group();
  shieldGroup.position.set(-0.16, -0.32, 0.16);
  shieldGroup.rotation.set(0.1, 0.25, -0.15);

  const shieldMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.shieldHideMap,
      roughness: 0.72,
      metalness: 0.1,
    }),
  );
  // Curved oval shield body (traditional Nguni / Sahelian war shield silhouette)
  const shieldMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.32, 0.28, 0.82, 12, 1, false, -Math.PI * 0.38, Math.PI * 0.76)),
    shieldMat,
  );
  shieldMesh.rotation.z = Math.PI / 2;
  shieldMesh.rotation.y = Math.PI / 2;
  shieldMesh.scale.set(1.1, 0.85, 0.35);
  shieldMesh.castShadow = true;
  shieldGroup.add(shieldMesh);

  // Central wooden reinforcing spine
  const shieldSpine = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.018, 0.016, 0.88, 6)),
    woodPropMat,
  );
  shieldSpine.position.set(0, 0, 0.08);
  shieldGroup.add(shieldSpine);

  // Raised central bronze boss
  const shieldBoss = new THREE.Mesh(
    trackGeo(new THREE.ConeGeometry(0.065, 0.09, 8)),
    ironToolMat,
  );
  shieldBoss.rotation.x = Math.PI / 2;
  shieldBoss.position.set(0, 0, 0.11);
  shieldGroup.add(shieldBoss);

  leftArmPivot.add(shieldGroup);
  toolMeshes.infantry_shield = shieldGroup;

  // Long Spear (Spearman) with Barbed Blade & Horsehair Tassel
  const spearGroup = new THREE.Group();
  const spShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.024, 0.018, 2.35, 6)), woodPropMat);
  spShaft.position.set(0, -0.15, 0.38);
  spShaft.rotation.x = 0.22;
  spearGroup.add(spShaft);
  const spTip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.068, 0.45, 6)), ironToolMat);
  spTip.rotation.x = Math.PI / 2;
  spTip.position.set(0, 0.98, 0.72);
  spTip.castShadow = true;
  spearGroup.add(spTip);
  const spTassel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.02, 0.18, 6)), sashMat);
  spTassel.rotation.x = Math.PI / 2;
  spTassel.position.set(0, 0.78, 0.65);
  spearGroup.add(spTassel);
  rightArmPivot.add(spearGroup);
  toolMeshes.spear_long = spearGroup;

  // Drawn Bow with Arrow & Slung Back Quiver (Archer)
  const drawnBowGroup = new THREE.Group();
  const bowCurve = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.38, 0.024, 6, 14, Math.PI * 1.15)),
    woodPropMat,
  );
  bowCurve.rotation.y = Math.PI / 2;
  bowCurve.position.set(-0.05, -0.36, 0.28);
  drawnBowGroup.add(bowCurve);
  // Bowstring
  const bowString = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.76, 4)),
    trackMat(new THREE.MeshBasicMaterial({ color: '#eee4d0' })),
  );
  bowString.position.set(-0.05, -0.36, 0.12);
  drawnBowGroup.add(bowString);
  // Nocked arrow with feather fletchings
  const nockedArrow = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.82, 5)),
    woodPropMat,
  );
  nockedArrow.rotation.x = Math.PI / 2;
  nockedArrow.position.set(0, -0.36, 0.38);
  drawnBowGroup.add(nockedArrow);
  const arrowFletch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.04, 0.14)), sashMat);
  arrowFletch.position.set(0, -0.36, -0.02);
  drawnBowGroup.add(arrowFletch);
  rightArmPivot.add(drawnBowGroup);
  toolMeshes.bow_drawn = drawnBowGroup;

  // Slung quiver on back for archer
  const quiver = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.058, 0.52, 8)), woodPropMat);
  quiver.position.set(0.12, 1.25, -0.22);
  quiver.rotation.set(-0.35, 0, 0.35);
  quiver.castShadow = true;
  bodyPivot.add(quiver);

  // Cavalry Heavy Lance with Fluttering Pennant
  const lanceGroup = new THREE.Group();
  const lShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.02, 2.7, 6)), woodPropMat);
  lShaft.position.set(0, -0.15, 0.52);
  lShaft.rotation.x = 0.2;
  lanceGroup.add(lShaft);
  const lTip = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.075, 0.48, 6)), ironToolMat);
  lTip.rotation.x = Math.PI / 2;
  lTip.position.set(0, 1.15, 0.95);
  lTip.castShadow = true;
  lanceGroup.add(lTip);
  const lPennon = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.24, 0.55)), sashMat);
  lPennon.position.set(0.12, 0.95, 0.85);
  lPennon.rotation.y = Math.PI / 2;
  lanceGroup.add(lPennon);
  rightArmPivot.add(lanceGroup);
  toolMeshes.cavalry_lance = lanceGroup;

  // Royal Polearm (Royal Guard)
  const polearmGroup = new THREE.Group();
  const polShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.028, 0.022, 2.3, 6)), ironToolMat);
  polShaft.position.set(0, -0.2, 0.35);
  polearmGroup.add(polShaft);
  const polAxe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.42, 0.28)), ironToolMat);
  polAxe.position.set(0, 0.92, 0.48);
  polAxe.castShadow = true;
  polearmGroup.add(polAxe);
  rightArmPivot.add(polearmGroup);
  toolMeshes.royal_polearm = polearmGroup;

  // Scout Dagger
  const daggerGroup = new THREE.Group();
  const dBlade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, 0.08, 0.42)), ironToolMat);
  dBlade.position.set(0, -0.42, 0.24);
  daggerGroup.add(dBlade);
  rightArmPivot.add(daggerGroup);
  toolMeshes.scout_dagger = daggerGroup;

  // Engineer Wrench / Hammer
  const wrenchGroup = new THREE.Group();
  const wHandle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.52, 6)), ironToolMat);
  wHandle.position.set(0, -0.42, 0.18);
  wHandle.rotation.x = Math.PI / 2.2;
  wrenchGroup.add(wHandle);
  const wHead = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.08, 0.16)), ironToolMat);
  wHead.position.set(0, -0.44, 0.38);
  wrenchGroup.add(wHead);
  rightArmPivot.add(wrenchGroup);
  toolMeshes.engineer_wrench = wrenchGroup;

  // Commander Scepter
  const scepterGroup = new THREE.Group();
  const scShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.028, 0.022, 0.92, 6)), ironToolMat);
  scShaft.position.set(0, -0.32, 0.20);
  scShaft.rotation.x = 0.25;
  scepterGroup.add(scShaft);
  const scOrb = new THREE.Mesh(trackGeo(new THREE.OctahedronGeometry(0.14, 0)), sashMat);
  scOrb.position.set(0, 0.22, 0.32);
  scepterGroup.add(scOrb);
  rightArmPivot.add(scepterGroup);
  toolMeshes.commander_scepter = scepterGroup;

  // Heavy Wheeled Ram with Protective Timber & Hide Roof (Rendered under Siege Units)
  const siegeRamGroup = new THREE.Group();
  const ramChassis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.45, 2.6)), woodPropMat);
  ramChassis.position.set(0, 0.42, 0);
  ramChassis.castShadow = true;
  siegeRamGroup.add(ramChassis);

  // A-frame roof canopy covering crew
  const roofCanopy = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.2, 0.95, 4)), woodPropMat);
  roofCanopy.rotation.y = Math.PI / 4;
  roofCanopy.position.set(0, 1.35, 0);
  roofCanopy.castShadow = true;
  siegeRamGroup.add(roofCanopy);

  // Massive suspended tree-trunk battering ram with carved iron ram head
  const ramLog = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 2.8, 8)), woodPropMat);
  ramLog.rotation.x = Math.PI / 2;
  ramLog.position.set(0, 0.72, 0.3);
  ramLog.castShadow = true;
  siegeRamGroup.add(ramLog);

  const ramHead = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.32, 0.7, 8)), ironToolMat);
  ramHead.rotation.x = -Math.PI / 2;
  ramHead.position.set(0, 0.72, 1.85);
  ramHead.castShadow = true;
  siegeRamGroup.add(ramHead);

  // 4 Heavy Spoked Wheels with Iron Rims
  for (const wx of [-0.88, 0.88]) {
    for (const wz of [-0.95, 0.95]) {
      const wheelRim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12)), ironToolMat);
      wheelRim.rotation.z = Math.PI / 2;
      wheelRim.position.set(wx, 0.34, wz);
      wheelRim.castShadow = true;
      siegeRamGroup.add(wheelRim);

      const wheelHub = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 8)), woodPropMat);
      wheelHub.rotation.z = Math.PI / 2;
      wheelHub.position.set(wx, 0.34, wz);
      siegeRamGroup.add(wheelHub);
    }
  }
  root.add(siegeRamGroup);
  toolMeshes.siege_ram = siegeRamGroup;

  // Realistic Procedural Cavalry Horse Mount with Flared Nostrils, Saddle Blanket & Reins
  const horseGroup = new THREE.Group();
  const horseMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#3b2012'), // Dark warm bay stallion
      roughness: 0.68,
      metalness: 0.08,
    }),
  );
  // Muscular barrel chest & flank
  const horseBarrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.38, 0.35, 1.65, 10)), horseMat);
  horseBarrel.rotation.x = Math.PI / 2;
  horseBarrel.position.set(0, 0.95, 0);
  horseBarrel.castShadow = true;
  horseGroup.add(horseBarrel);

  // Arched powerful neck
  const horseNeck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.32, 0.85, 8)), horseMat);
  horseNeck.position.set(0, 1.48, 0.72);
  horseNeck.rotation.x = -0.55;
  horseNeck.castShadow = true;
  horseGroup.add(horseNeck);

  // Sculpted equine head & tapered muzzle
  const horseHead = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.28, 0.38)), horseMat);
  horseHead.position.set(0, 1.84, 1.0);
  horseHead.rotation.x = 0.28;
  horseHead.castShadow = true;
  horseGroup.add(horseHead);

  const horseMuzzle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.17, 0.18, 0.28)), horseMat);
  horseMuzzle.position.set(0, 1.72, 1.24);
  horseMuzzle.rotation.x = 0.35;
  horseGroup.add(horseMuzzle);

  // Flowing horse mane along arched neck
  const horseMane = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.72, 0.16)), hairMat);
  horseMane.position.set(0, 1.56, 0.63);
  horseMane.rotation.x = -0.55;
  horseGroup.add(horseMane);

  // Pricked ears
  for (const eside of [-1, 1]) {
    const ear = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.045, 0.14, 4)), horseMat);
    ear.position.set(eside * 0.1, 2.05, 0.92);
    ear.rotation.x = -0.2;
    horseGroup.add(ear);
  }

  // Kingdom-heralded saddle blanket
  const saddleBlanket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.82, 0.12, 0.95)), sashMat);
  saddleBlanket.position.set(0, 1.25, -0.05);
  saddleBlanket.castShadow = true;
  horseGroup.add(saddleBlanket);

  // 4 Articulated legs with muscular thighs, hocks and hooves
  const hoofMat = trackMat(new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.5 }));
  const horseLegs: THREE.Group[] = [];
  for (const lx of [-0.28, 0.28]) {
    for (const lz of [-0.58, 0.58]) {
      const legGroup = new THREE.Group();
      legGroup.position.set(lx, 0.92, lz);

      const upperLeg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.065, 0.55, 6)), horseMat);
      upperLeg.position.y = -0.26;
      upperLeg.castShadow = true;
      legGroup.add(upperLeg);

      const lowerLeg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.045, 0.45, 6)), horseMat);
      lowerLeg.position.y = -0.65;
      lowerLeg.castShadow = true;
      legGroup.add(lowerLeg);

      const hoof = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 0.1, 8)), hoofMat);
      hoof.position.y = -0.88;
      legGroup.add(hoof);

      horseGroup.add(legGroup);
      horseLegs.push(legGroup);
    }
  }

  // Flowing tail
  const tail = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.08, 0.72, 6)), hairMat);
  tail.position.set(0, 0.85, -0.92);
  tail.rotation.x = 0.35;
  horseGroup.add(tail);

  root.add(horseGroup);
  toolMeshes.horse_mount = horseGroup;

  for (const key of Object.keys(toolMeshes)) {
    if (key === 'infantry_shield') {
      toolMeshes[key].visible = entity.militaryClass === 'infantry' || entity.militaryClass === 'spearman';
    } else if (key === 'horse_mount') {
      toolMeshes[key].visible = Boolean(entity.isMounted);
    } else if (key === 'siege_ram') {
      toolMeshes[key].visible = Boolean(entity.isSiegeEngine);
    } else {
      toolMeshes[key].visible = key === entity.propType;
    }
  }

  const collider = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.62, 0.62, 2.05, 8)),
    trackMat(new THREE.MeshBasicMaterial({ visible: false })),
  );
  collider.position.y = 1.0;
  collider.userData.entityId = entity.id;
  root.add(collider);

  root.scale.setScalar(1.12);

  return {
    entityId: entity.id,
    root,
    bodyPivot,
    spinePivot,
    headPivot,
    leftArmPivot,
    rightArmPivot,
    leftElbowPivot,
    rightElbowPivot,
    leftLegPivot,
    rightLegPivot,
    leftKneePivot,
    rightKneePivot,
    tunicMaterial: tunicMat,
    carriedBundleMesh,
    carriedBundleMaterial,
    waterJarGroup,
    waterStreamMesh,
    toolMeshes,
    horseLegs,
    activePropType: entity.propType,
    collider,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}

/**
 * Updates articulated procedural character joints, occupation tools, and carried cargo bundle.
 */
export function updateProceduralCharacterAnimation(
  rig: CharacterVisualRig,
  entity: CharacterEntity,
): void {
  rig.root.position.set(entity.position.x, entity.position.y, entity.position.z);
  rig.root.rotation.y = entity.rotationY;

  // Sync occupation tunic & tool prop if player reassigned role
  if (rig.activePropType !== entity.propType) {
    for (const key of Object.keys(rig.toolMeshes)) {
      rig.toolMeshes[key].visible = key === entity.propType;
    }
    rig.activePropType = entity.propType;
    rig.tunicMaterial.color.set(entity.tunicColor);
  }

  // Sync carried resource pack visibility & resource tint
  if (entity.carriedAmount >= 1 && entity.carriedResource) {
    rig.carriedBundleMesh.visible = true;
    const style = RESOURCE_BUNDLE_COLORS[entity.carriedResource];
    rig.carriedBundleMaterial.color.set(style.color);
    rig.carriedBundleMaterial.metalness = style.metalness;
    rig.carriedBundleMaterial.roughness = style.roughness;
    const fillRatio = Math.min(1, entity.carriedAmount / Math.max(1, entity.carryCapacity));
    const s = 0.72 + fillRatio * 0.45;
    rig.carriedBundleMesh.scale.set(s, s, s);
  } else {
    rig.carriedBundleMesh.visible = false;
  }

  const phase = entity.gaitPhase;
  const state = entity.animationState;
  const hydroPhase = entity.hydroPhase;

  // Position & animate clay water vessel during river fetching, carrying, and crop watering
  const showWaterJar =
    state === 'drawing_water' ||
    state === 'watering_crops' ||
    hydroPhase === 'heading_to_water' ||
    hydroPhase === 'carrying_water' ||
    (entity.carriedWater ?? 0) > 0.05;

  rig.waterJarGroup.visible = showWaterJar;
  rig.waterStreamMesh.visible = false;
  if (showWaterJar) {
    if (state === 'drawing_water') {
      rig.waterJarGroup.position.set(0, -0.26, 0.42);
      rig.waterJarGroup.rotation.set(0.65 + Math.sin(phase) * 0.25, 0, 0);
    } else if (state === 'watering_crops') {
      rig.waterJarGroup.position.set(0.06, 0.05, 0.44);
      rig.waterJarGroup.rotation.set(1.18 + Math.sin(phase * 1.4) * 0.14, 0, -0.15);
      rig.waterStreamMesh.visible = true;
      rig.waterStreamMesh.position.set(0, 0.48, 0.26);
      rig.waterStreamMesh.rotation.set(-0.55, 0, 0);
    } else if (hydroPhase === 'carrying_water' || (entity.carriedWater ?? 0) > 0.05) {
      // Carried gracefully on left shoulder/hip while walking back from river
      rig.waterJarGroup.position.set(-0.24, 0.34, 0.06);
      rig.waterJarGroup.rotation.set(0.06, 0, 0.18);
    } else {
      // Empty clay jar carried at side while walking to the river
      rig.waterJarGroup.position.set(-0.22, -0.12, 0.16);
      rig.waterJarGroup.rotation.set(0.35, 0, 0.1);
    }
  }

  // Animate horse legs when mounted
  if (entity.isMounted && rig.horseLegs.length === 4) {
    const isMoving = state === 'walking' || state === 'running' || state === 'charging' || state === 'retreating';
    const gallopAmp = state === 'charging' || state === 'running' ? 0.58 : isMoving ? 0.34 : 0.03;
    rig.horseLegs[0].rotation.x = Math.sin(phase) * gallopAmp;
    rig.horseLegs[1].rotation.x = Math.sin(phase + 0.55) * gallopAmp;
    rig.horseLegs[2].rotation.x = -Math.sin(phase + 0.2) * gallopAmp;
    rig.horseLegs[3].rotation.x = -Math.sin(phase + 0.75) * gallopAmp;
  }

  if (state === 'idle') {
    const breath = Math.sin(phase * 1.35) * 0.018;
    rig.bodyPivot.position.y = breath;
    rig.bodyPivot.rotation.set(0, 0, Math.sin(phase * 0.7) * 0.02);
    rig.spinePivot.rotation.set(Math.sin(phase * 1.35) * 0.02, 0, 0);
    rig.headPivot.rotation.set(Math.cos(phase * 0.9) * 0.04, Math.sin(phase * 0.65) * 0.22, 0);
    rig.leftLegPivot.rotation.x *= 0.82;
    rig.rightLegPivot.rotation.x *= 0.82;
    rig.leftKneePivot.rotation.x = 0.04;
    rig.rightKneePivot.rotation.x = 0.04;
    rig.leftArmPivot.rotation.x = Math.sin(phase * 1.1) * 0.05;
    rig.leftElbowPivot.rotation.x = -0.16 + Math.sin(phase * 1.1) * 0.04;
    rig.rightArmPivot.rotation.x = -Math.sin(phase * 1.1) * 0.05;
    rig.rightElbowPivot.rotation.x = -0.16 - Math.sin(phase * 1.1) * 0.04;
  } else if (state === 'walking') {
    const stride = Math.sin(phase);
    const bob = Math.abs(Math.cos(phase)) * 0.045;
    rig.bodyPivot.position.y = bob;
    rig.bodyPivot.rotation.set(0, 0, stride * 0.025);
    rig.spinePivot.rotation.set(entity.carriedAmount >= 1 ? 0.12 : 0.04, 0, stride * 0.02);
    rig.headPivot.rotation.set(0, -stride * 0.05, 0);

    // Dynamic multi-joint leg stride with knee bend during swing phase
    rig.leftLegPivot.rotation.x = stride * 0.52;
    rig.leftKneePivot.rotation.x = Math.max(0, stride) * 0.62;
    rig.rightLegPivot.rotation.x = -stride * 0.52;
    rig.rightKneePivot.rotation.x = Math.max(0, -stride) * 0.62;

    // Fluid arm swing with natural elbow flex (steady left arm if carrying water jar)
    if (hydroPhase === 'carrying_water' || (entity.carriedWater ?? 0) > 0.05) {
      rig.leftArmPivot.rotation.x = -0.82;
      rig.leftElbowPivot.rotation.x = -1.22;
    } else {
      rig.leftArmPivot.rotation.x = -stride * 0.44;
      rig.leftElbowPivot.rotation.x = -0.22 - Math.max(0, -stride) * 0.38;
    }
    rig.rightArmPivot.rotation.x = stride * 0.44;
    rig.rightElbowPivot.rotation.x = -0.22 - Math.max(0, stride) * 0.38;
  } else if (state === 'running') {
    const stride = Math.sin(phase);
    const bob = Math.abs(Math.cos(phase)) * 0.085;
    rig.bodyPivot.position.y = bob;
    rig.bodyPivot.rotation.set(0, 0, stride * 0.05);
    rig.spinePivot.rotation.set(0.18, 0, stride * 0.04);
    rig.headPivot.rotation.set(-0.06, -stride * 0.08, 0);

    rig.leftLegPivot.rotation.x = stride * 0.86;
    rig.leftKneePivot.rotation.x = Math.max(0, stride) * 0.85;
    rig.rightLegPivot.rotation.x = -stride * 0.86;
    rig.rightKneePivot.rotation.x = Math.max(0, -stride) * 0.85;

    rig.leftArmPivot.rotation.x = -stride * 0.75;
    rig.leftElbowPivot.rotation.x = -0.45 - Math.max(0, -stride) * 0.65;
    rig.rightArmPivot.rotation.x = stride * 0.75;
    rig.rightElbowPivot.rotation.x = -0.45 - Math.max(0, stride) * 0.65;
  } else if (state === 'chopping' || state === 'mining' || state === 'building') {
    // Rhythmic overhead/diagonal tool swing with torso and elbow follow-through
    const swing = Math.sin(phase);
    const strike = swing > 0 ? Math.pow(swing, 0.6) : swing * 0.5;
    rig.bodyPivot.position.y = -Math.max(0, strike) * 0.04;
    rig.spinePivot.rotation.set(0.12 + strike * 0.22, -strike * 0.18, 0);
    rig.headPivot.rotation.set(0.12, 0, 0);
    rig.leftLegPivot.rotation.x = -0.18;
    rig.leftKneePivot.rotation.x = 0.15;
    rig.rightLegPivot.rotation.x = 0.22;
    rig.rightKneePivot.rotation.x = 0.25;

    // Coordinated two-arm overhead arc & downward impact
    rig.rightArmPivot.rotation.x = -1.15 + strike * 1.35;
    rig.rightElbowPivot.rotation.x = -0.65 + strike * 0.75;
    rig.leftArmPivot.rotation.x = -0.75 + strike * 0.65;
    rig.leftElbowPivot.rotation.x = -0.55 + strike * 0.55;
  } else if (state === 'drawing_water') {
    // Crouch at riverbank dipping clay water jar cleanly into the current
    const dip = Math.sin(phase);
    rig.bodyPivot.position.y = -0.26 + Math.abs(dip) * 0.025;
    rig.spinePivot.rotation.set(0.58 + dip * 0.08, 0, 0);
    rig.headPivot.rotation.set(0.24, 0, 0);
    rig.leftLegPivot.rotation.x = -0.58;
    rig.leftKneePivot.rotation.x = 0.92;
    rig.rightLegPivot.rotation.x = 0.22;
    rig.rightKneePivot.rotation.x = 0.56;
    rig.leftArmPivot.rotation.x = -0.85 + dip * 0.16;
    rig.leftElbowPivot.rotation.x = -0.28;
    rig.rightArmPivot.rotation.x = -0.88 + dip * 0.18;
    rig.rightElbowPivot.rotation.x = -0.25;
  } else if (state === 'watering_crops') {
    // Lean forward holding clay jar and pouring arched water stream across furrows
    const pour = Math.sin(phase * 1.3);
    rig.bodyPivot.position.y = -0.04;
    rig.spinePivot.rotation.set(0.28 + pour * 0.04, pour * 0.12, 0);
    rig.headPivot.rotation.set(0.20, 0, 0);
    rig.leftLegPivot.rotation.x = -0.14;
    rig.leftKneePivot.rotation.x = 0.20;
    rig.rightLegPivot.rotation.x = 0.16;
    rig.rightKneePivot.rotation.x = 0.18;
    rig.leftArmPivot.rotation.x = -0.95;
    rig.leftElbowPivot.rotation.x = -0.52;
    rig.rightArmPivot.rotation.x = -1.08 + pour * 0.10;
    rig.rightElbowPivot.rotation.x = -0.45;
  } else if (state === 'farming' || state === 'fishing') {
    // Stooping waist bend into furrow & rhythmic hoe tending motion
    const cycle = Math.sin(phase);
    rig.bodyPivot.position.y = -0.06 + Math.abs(cycle) * 0.03;
    rig.spinePivot.rotation.set(0.42 + cycle * 0.12, cycle * 0.08, 0);
    rig.headPivot.rotation.set(0.18, 0, 0);
    rig.leftLegPivot.rotation.x = -0.16;
    rig.leftKneePivot.rotation.x = 0.28;
    rig.rightLegPivot.rotation.x = 0.16;
    rig.rightKneePivot.rotation.x = 0.28;
    rig.rightArmPivot.rotation.x = -0.85 + cycle * 0.52;
    rig.rightElbowPivot.rotation.x = -0.72 + cycle * 0.45;
    rig.leftArmPivot.rotation.x = -0.65 + cycle * 0.38;
    rig.leftElbowPivot.rotation.x = -0.52 + cycle * 0.32;
  } else if (state === 'attacking_melee') {
    // Fast weapon strike downward/forward with shield guard
    const swing = Math.sin(phase);
    const strike = swing > 0 ? Math.pow(swing, 0.5) : swing * 0.4;
    rig.bodyPivot.position.y = -Math.max(0, strike) * 0.05;
    rig.spinePivot.rotation.set(0.16 + strike * 0.22, -strike * 0.25, 0);
    rig.headPivot.rotation.set(0.1, 0, 0);
    rig.leftLegPivot.rotation.x = -0.25;
    rig.leftKneePivot.rotation.x = 0.28;
    rig.rightLegPivot.rotation.x = 0.28;
    rig.rightKneePivot.rotation.x = 0.24;
    rig.rightArmPivot.rotation.x = -1.45 + strike * 1.85;
    rig.rightElbowPivot.rotation.x = -0.55 + strike * 0.65;
    rig.leftArmPivot.rotation.x = -0.85;
    rig.leftElbowPivot.rotation.x = -0.75;
  } else if (state === 'attacking_spear') {
    // Sharp forward spear thrust and retract with locked shield
    const thrust = Math.sin(phase);
    rig.bodyPivot.position.y = 0;
    rig.spinePivot.rotation.set(0.14, -0.12, 0);
    rig.headPivot.rotation.set(0.08, 0.1, 0);
    rig.leftLegPivot.rotation.x = -0.32;
    rig.leftKneePivot.rotation.x = 0.35;
    rig.rightLegPivot.rotation.x = 0.32;
    rig.rightKneePivot.rotation.x = 0.22;
    rig.leftArmPivot.rotation.x = -0.92;
    rig.leftElbowPivot.rotation.x = -0.75;
    rig.rightArmPivot.rotation.x = -1.15 + thrust * 0.65;
    rig.rightElbowPivot.rotation.x = -0.35 + thrust * 0.35;
  } else if (state === 'shooting_bow') {
    // Steady archery draw
    rig.bodyPivot.position.y = 0;
    rig.spinePivot.rotation.set(0.05, 0.48, 0);
    rig.headPivot.rotation.set(0, -0.48, 0);
    rig.leftLegPivot.rotation.x = -0.22;
    rig.leftKneePivot.rotation.x = 0.18;
    rig.rightLegPivot.rotation.x = 0.22;
    rig.rightKneePivot.rotation.x = 0.18;
    rig.leftArmPivot.rotation.x = -1.45;
    rig.leftElbowPivot.rotation.x = -0.05;
    rig.rightArmPivot.rotation.x = -1.35;
    rig.rightElbowPivot.rotation.x = -1.38;
  } else if (state === 'charging') {
    // Aggressive forward lean for cavalry charge
    const stride = Math.sin(phase);
    const bob = Math.abs(Math.cos(phase)) * 0.1;
    rig.bodyPivot.position.y = bob;
    rig.spinePivot.rotation.set(0.32, 0, stride * 0.05);
    rig.headPivot.rotation.set(-0.15, 0, 0);
    rig.leftLegPivot.rotation.x = stride * 0.95;
    rig.leftKneePivot.rotation.x = Math.max(0, stride) * 0.85;
    rig.rightLegPivot.rotation.x = -stride * 0.95;
    rig.rightKneePivot.rotation.x = Math.max(0, -stride) * 0.85;
    rig.rightArmPivot.rotation.x = -1.25;
    rig.rightElbowPivot.rotation.x = -0.25;
    rig.leftArmPivot.rotation.x = -0.85;
    rig.leftElbowPivot.rotation.x = -0.65;
  } else if (state === 'defending') {
    // Braced stance behind shield
    rig.bodyPivot.position.y = -0.07;
    rig.spinePivot.rotation.set(0.18, 0, 0);
    rig.leftLegPivot.rotation.x = -0.28;
    rig.leftKneePivot.rotation.x = 0.32;
    rig.rightLegPivot.rotation.x = 0.28;
    rig.rightKneePivot.rotation.x = 0.32;
    rig.leftArmPivot.rotation.x = -1.25;
    rig.leftElbowPivot.rotation.x = -0.85;
    rig.rightArmPivot.rotation.x = -0.72;
    rig.rightElbowPivot.rotation.x = -0.65;
  } else if (state === 'taking_damage') {
    // Recoil backward
    rig.bodyPivot.position.y = 0.04;
    rig.spinePivot.rotation.set(-0.25, 0.15, 0);
    rig.headPivot.rotation.set(-0.2, 0, 0);
    rig.leftArmPivot.rotation.x = -0.3;
    rig.leftElbowPivot.rotation.x = -0.4;
    rig.rightArmPivot.rotation.x = -0.3;
    rig.rightElbowPivot.rotation.x = -0.4;
    rig.leftKneePivot.rotation.x = 0.25;
    rig.rightKneePivot.rotation.x = 0.15;
  } else if (state === 'dead') {
    // Fallen flat on terrain
    rig.bodyPivot.position.y = -0.75;
    rig.bodyPivot.rotation.set(Math.PI / 2.05, 0, 0.4);
    rig.spinePivot.rotation.set(0, 0, 0);
    rig.headPivot.rotation.set(0, 0.3, 0);
    rig.leftLegPivot.rotation.x = 0;
    rig.leftKneePivot.rotation.x = 0.1;
    rig.rightLegPivot.rotation.x = 0.2;
    rig.rightKneePivot.rotation.x = 0.2;
    rig.leftArmPivot.rotation.x = 0.5;
    rig.leftElbowPivot.rotation.x = 0.3;
    rig.rightArmPivot.rotation.x = 0.5;
    rig.rightElbowPivot.rotation.x = 0.3;
  } else {
    // 'hunting' | 'crafting' | 'operating_siege' | 'victory' | 'retreating'
    const cycle = Math.sin(phase);
    rig.bodyPivot.position.y = Math.abs(cycle) * 0.02;
    rig.spinePivot.rotation.set(0.08, cycle * 0.12, 0);
    rig.headPivot.rotation.set(0, cycle * 0.15, 0);
    rig.leftLegPivot.rotation.x = -0.1;
    rig.leftKneePivot.rotation.x = 0.12;
    rig.rightLegPivot.rotation.x = 0.1;
    rig.rightKneePivot.rotation.x = 0.12;
    rig.leftArmPivot.rotation.x = -0.85;
    rig.leftElbowPivot.rotation.x = -0.55;
    rig.rightArmPivot.rotation.x = -0.65 + cycle * 0.55;
    rig.rightElbowPivot.rotation.x = -0.45 + cycle * 0.35;
  }
}
