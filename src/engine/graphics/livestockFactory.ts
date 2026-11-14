import * as THREE from 'three';
import { LivestockEntity } from '../simulation/livestockSim';
import { ProceduralTextureSet } from './proceduralTextures';

export interface LivestockVisualRig {
  entityId: string;
  kind: LivestockEntity['kind'];
  root: THREE.Group;
  bodyGroup: THREE.Group;
  neckPivot: THREE.Group;
  tailPivot: THREE.Group;
  legs: THREE.Group[];
  wings?: THREE.Group[];
  dispose: () => void;
}

const CATTLE_COATS = ['#7a4325', '#422819', '#c7b8a3'];
const GOAT_COATS = ['#d8cbb4', '#5c4636', '#8d6c4d'];
const CHICKEN_COATS = ['#efe6d5', '#a94f28', '#2c2520'];

export function createLivestockVisualRig(
  entity: LivestockEntity,
  textures: ProceduralTextureSet,
): LivestockVisualRig {
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

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadowRadius = entity.kind === 'cattle' ? 0.95 : entity.kind === 'goat' ? 0.52 : 0.24;
  const shadowDisc = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(shadowRadius, 12)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.contactShadow,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    ),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  const legs: THREE.Group[] = [];
  const neckPivot = new THREE.Group();
  const tailPivot = new THREE.Group();
  let wings: THREE.Group[] | undefined;

  if (entity.kind === 'cattle') {
    const coatHex = CATTLE_COATS[entity.variant % CATTLE_COATS.length];
    const coatMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(coatHex),
        roughness: 0.78,
        metalness: 0.04,
      }),
    );
    const patchMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(entity.variant === 2 ? '#4d2b18' : '#e6dccb'),
        roughness: 0.82,
      }),
    );
    const hornMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#dfd3be'),
        roughness: 0.44,
        metalness: 0.08,
      }),
    );
    const hoofMat = trackMat(new THREE.MeshStandardMaterial({ color: '#1b1612', roughness: 0.6 }));

    // Sculpted Ankole / Zebu bovine torso
    const torsoProfile = [
      new THREE.Vector2(0.06, -0.78),
      new THREE.Vector2(0.32, -0.64),
      new THREE.Vector2(0.36, -0.15),
      new THREE.Vector2(0.38, 0.35),
      new THREE.Vector2(0.28, 0.72),
      new THREE.Vector2(0.04, 0.84),
    ];
    const torso = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(torsoProfile, 14)), coatMat);
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(0.84, 1.0, 1.06);
    torso.position.set(0, 0.88, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    // Characteristic African Zebu shoulder hump
    const hump = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.22, 12, 10)), coatMat);
    hump.scale.set(0.72, 0.95, 1.25);
    hump.position.set(0, 1.24, 0.38);
    hump.castShadow = true;
    bodyGroup.add(hump);

    // Organic coat patch
    const bellyPatch = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.31, 10, 8)), patchMat);
    bellyPatch.scale.set(0.95, 0.85, 1.3);
    bellyPatch.position.set(0.04, 0.84, -0.05);
    bodyGroup.add(bellyPatch);

    // Neck & bovine head with sweeping lyre horns
    neckPivot.position.set(0, 1.02, 0.68);
    bodyGroup.add(neckPivot);

    const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.24, 0.56, 10)), coatMat);
    neck.position.set(0, 0.08, 0.18);
    neck.rotation.x = 0.72;
    neck.castShadow = true;
    neckPivot.add(neck);

    const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 12, 10)), coatMat);
    head.scale.set(0.82, 0.9, 1.38);
    head.position.set(0, 0.16, 0.44);
    head.rotation.x = 0.35;
    head.castShadow = true;
    neckPivot.add(head);

    const snout = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 10, 8)), patchMat);
    snout.scale.set(0.88, 0.72, 1.1);
    snout.position.set(0, 0.06, 0.65);
    neckPivot.add(snout);

    for (const side of [-1, 1]) {
      const hornCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.09, 0.27, 0.38),
        new THREE.Vector3(side * 0.28, 0.44, 0.35),
        new THREE.Vector3(side * 0.42, 0.72, 0.42),
        new THREE.Vector3(side * 0.34, 0.88, 0.52),
      ]);
      const horn = new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(hornCurve, 10, 0.036, 7, false)),
        hornMat,
      );
      horn.castShadow = true;
      neckPivot.add(horn);

      const ear = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.06, 8, 6)), coatMat);
      ear.scale.set(1.6, 0.45, 0.85);
      ear.position.set(side * 0.19, 0.20, 0.36);
      ear.rotation.z = side * -0.35;
      neckPivot.add(ear);
    }

    // Tail
    tailPivot.position.set(0, 1.02, -0.72);
    bodyGroup.add(tailPivot);
    const tail = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.015, 0.58, 6)), coatMat);
    tail.position.set(0, -0.28, -0.05);
    tail.rotation.x = 0.22;
    tailPivot.add(tail);

    // 4 Articulated legs
    for (const lx of [-0.20, 0.20]) {
      for (const lz of [-0.50, 0.50]) {
        const legPivot = new THREE.Group();
        legPivot.position.set(lx, 0.68, lz);
        const upper = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.072, 0.048, 0.42, 8)), coatMat);
        upper.position.y = -0.20;
        upper.castShadow = true;
        legPivot.add(upper);
        const lower = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.038, 0.28, 7)), coatMat);
        lower.position.y = -0.52;
        legPivot.add(lower);
        const hoof = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.044, 0.054, 0.07, 8)), hoofMat);
        hoof.position.y = -0.66;
        legPivot.add(hoof);
        bodyGroup.add(legPivot);
        legs.push(legPivot);
      }
    }
  } else if (entity.kind === 'goat') {
    const coatHex = GOAT_COATS[entity.variant % GOAT_COATS.length];
    const coatMat = trackMat(new THREE.MeshStandardMaterial({ color: coatHex, roughness: 0.84 }));
    const hornMat = trackMat(new THREE.MeshStandardMaterial({ color: '#42372e', roughness: 0.5 }));

    const body = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.18, 0.46, 6, 12)), coatMat);
    body.rotation.x = Math.PI / 2;
    body.scale.set(0.85, 1.0, 1.05);
    body.position.set(0, 0.48, 0);
    body.castShadow = true;
    bodyGroup.add(body);

    neckPivot.position.set(0, 0.54, 0.28);
    bodyGroup.add(neckPivot);

    const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.11, 0.30, 8)), coatMat);
    neck.position.set(0, 0.11, 0.08);
    neck.rotation.x = 0.52;
    neck.castShadow = true;
    neckPivot.add(neck);

    const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.095, 10, 8)), coatMat);
    head.scale.set(0.82, 0.88, 1.42);
    head.position.set(0, 0.22, 0.22);
    head.rotation.x = 0.28;
    head.castShadow = true;
    neckPivot.add(head);

    const beard = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.028, 0.10, 6)), hornMat);
    beard.position.set(0, 0.12, 0.30);
    beard.rotation.x = Math.PI;
    neckPivot.add(beard);

    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.022, 0.18, 6)), hornMat);
      horn.position.set(side * 0.045, 0.32, 0.15);
      horn.rotation.set(-0.68, 0, side * -0.18);
      neckPivot.add(horn);

      const ear = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 6, 6)), coatMat);
      ear.scale.set(1.6, 0.45, 0.7);
      ear.position.set(side * 0.095, 0.24, 0.16);
      neckPivot.add(ear);
    }

    tailPivot.position.set(0, 0.58, -0.32);
    bodyGroup.add(tailPivot);
    const tail = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.032, 0.14, 6)), coatMat);
    tail.rotation.x = -0.65;
    tail.position.set(0, 0.05, -0.04);
    tailPivot.add(tail);

    for (const lx of [-0.10, 0.10]) {
      for (const lz of [-0.22, 0.22]) {
        const legPivot = new THREE.Group();
        legPivot.position.set(lx, 0.38, lz);
        const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.022, 0.38, 7)), coatMat);
        leg.position.y = -0.19;
        leg.castShadow = true;
        legPivot.add(leg);
        bodyGroup.add(legPivot);
        legs.push(legPivot);
      }
    }
  } else {
    // Village Chicken / Rooster
    const featherHex = CHICKEN_COATS[entity.variant % CHICKEN_COATS.length];
    const featherMat = trackMat(new THREE.MeshStandardMaterial({ color: featherHex, roughness: 0.82 }));
    const combMat = trackMat(new THREE.MeshStandardMaterial({ color: '#b92b27', roughness: 0.55 }));
    const beakMat = trackMat(new THREE.MeshStandardMaterial({ color: '#e5a93b', roughness: 0.48 }));

    const body = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.135, 10, 8)), featherMat);
    body.scale.set(0.88, 0.85, 1.25);
    body.position.set(0, 0.24, 0);
    body.castShadow = true;
    bodyGroup.add(body);

    wings = [];
    for (const side of [-1, 1]) {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(side * 0.11, 0.26, 0);
      const wingMesh = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.085, 8, 6)), featherMat);
      wingMesh.scale.set(0.32, 0.72, 1.28);
      wingGroup.add(wingMesh);
      bodyGroup.add(wingGroup);
      wings.push(wingGroup);
    }

    neckPivot.position.set(0, 0.28, 0.11);
    bodyGroup.add(neckPivot);

    const head = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.068, 8, 8)), featherMat);
    head.position.set(0, 0.08, 0.04);
    head.castShadow = true;
    neckPivot.add(head);

    const comb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 6, 6)), combMat);
    comb.scale.set(0.45, 1.2, 1.45);
    comb.position.set(0, 0.14, 0.04);
    neckPivot.add(comb);

    const beak = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.022, 0.06, 5)), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.075, 0.12);
    neckPivot.add(beak);

    tailPivot.position.set(0, 0.29, -0.14);
    bodyGroup.add(tailPivot);
    const tail = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.06, 0.18, 6)), featherMat);
    tail.rotation.x = -0.65;
    tail.position.set(0, 0.06, -0.05);
    tailPivot.add(tail);

    for (const lx of [-0.05, 0.05]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(lx, 0.15, 0);
      const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.014, 0.011, 0.15, 5)), beakMat);
      leg.position.y = -0.075;
      legPivot.add(leg);
      bodyGroup.add(legPivot);
      legs.push(legPivot);
    }
  }

  return {
    entityId: entity.id,
    kind: entity.kind,
    root,
    bodyGroup,
    neckPivot,
    tailPivot,
    legs,
    wings,
    dispose: () => {
      for (const item of disposables) {
        item.dispose();
      }
    },
  };
}

export function updateLivestockRigAnimation(
  rig: LivestockVisualRig,
  entity: LivestockEntity,
): void {
  rig.root.position.set(entity.position.x, entity.position.y, entity.position.z);
  rig.root.rotation.y = entity.rotationY;

  if (entity.state === 'walking') {
    const stride = Math.sin(entity.gaitPhase);
    const amp = rig.kind === 'chicken' ? 0.55 : 0.42;
    for (let i = 0; i < rig.legs.length; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      rig.legs[i].rotation.x = stride * amp * sign;
    }
    rig.bodyGroup.position.y = Math.abs(Math.cos(entity.gaitPhase)) * (rig.kind === 'chicken' ? 0.025 : 0.02);
    rig.neckPivot.rotation.x = rig.kind === 'chicken' ? Math.sin(entity.gaitPhase * 2) * 0.18 : 0.06;
    rig.tailPivot.rotation.z = Math.sin(entity.headBobPhase) * 0.12;
  } else if (entity.state === 'grazing') {
    for (const leg of rig.legs) leg.rotation.x *= 0.8;
    rig.bodyGroup.position.y = 0;
    if (rig.kind === 'chicken') {
      // Lively pecking bob onto earth
      const peck = Math.max(0, Math.sin(entity.headBobPhase * 1.4));
      rig.neckPivot.rotation.x = 0.25 + peck * 0.72;
      if (rig.wings) {
        for (const w of rig.wings) {
          w.rotation.z = Math.sin(entity.headBobPhase * 0.7) * 0.08;
        }
      }
    } else {
      // Lower head calmly to crop pasture grass
      rig.neckPivot.rotation.x = 0.58 + Math.sin(entity.headBobPhase) * 0.12;
      rig.tailPivot.rotation.z = Math.sin(entity.headBobPhase * 1.6) * 0.22;
    }
  } else {
    // Resting / calm standing
    for (const leg of rig.legs) leg.rotation.x *= 0.8;
    rig.bodyGroup.position.y = rig.kind === 'cattle' ? -0.24 : 0;
    rig.neckPivot.rotation.x = Math.sin(entity.headBobPhase * 0.4) * 0.06;
    rig.tailPivot.rotation.z = Math.sin(entity.headBobPhase) * 0.14;
  }
}
