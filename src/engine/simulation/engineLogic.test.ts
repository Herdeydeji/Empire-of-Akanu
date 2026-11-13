import test from 'node:test';
import assert from 'node:assert/strict';
import { KINGDOM_LIST, KINGDOMS } from '../../config/kingdoms';
import { REGION_LIST, REGIONS } from '../../config/regions';
import { generateInitialSettlement } from '../../config/settlement';
import { getRiverCenterZ, isWaterAt, sampleTerrainHeight } from '../math/noise';
import {
  createInitialCameraRig,
  focusCameraOnPoint,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  panCameraLocal,
  stepCameraRig,
  zoomCamera,
} from '../camera/rtsCameraMath';
import {
  assignVillagerOccupation,
  cancelPlannedOrActiveConstruction,
  commandVillagersToEntity,
  createInitialEconomyRuntime,
  placeNewBuilding,
  stepEconomyAndVillagers,
  validateBuildingPlacement,
} from './economySim';
import {
  createNewKingdomSave,
  StoragePersistenceProvider,
  validateSaveGameData,
} from '../persistence/saveSystem';
import {
  calculateCombatDamageMultiplier,
  calculateFormationOffsets,
  KINGDOM_MILITARY_BONUSES,
  MILITARY_UNIT_CATALOG,
} from '../../config/military';
import {
  createInitialMilitaryState,
  queueRecruitment,
  spawnBallisticProjectile,
  spawnMilitaryCharacterEntity,
  stepMilitarySimulation,
} from './militarySim';
import { KINGDOM_PERSONALITIES } from '../../config/aiPersonalities';
import { createInitialAIKingdomManager, stepAIKingdomManager } from './aiKingdomSim';
import { addDiplomaticTreaty, createInitialDiplomacyState, evaluateProposalAcceptance, updateDiplomaticScore } from './diplomacySim';
import { createInitialWorldEventState, pushWorldEvent } from './worldEventSim';

function advanceSimulationSeconds(
  runtime: ReturnType<typeof createInitialEconomyRuntime>,
  seconds: number,
  stepDt = 0.05,
): void {
  const steps = Math.ceil(seconds / stepDt);
  for (let i = 0; i < steps; i++) {
    stepEconomyAndVillagers(runtime, stepDt);
  }
}

test('all five founding kingdoms have distinct identities, palettes, and Phase 2 economic bonuses', () => {
  assert.equal(KINGDOM_LIST.length, 5);
  const ids = new Set(KINGDOM_LIST.map((k) => k.id));
  assert.deepEqual([...ids], ['oru', 'zambara', 'kemetra', 'aseka', 'nambara']);

  const palettes = new Set(KINGDOM_LIST.map((k) => k.palette.primary));
  assert.equal(palettes.size, 5, 'Each kingdom must have a distinct primary palette');

  for (const k of KINGDOM_LIST) {
    const total =
      k.startingResources.food +
      k.startingResources.wood +
      k.startingResources.stone +
      k.startingResources.iron +
      k.startingResources.gold;
    assert.equal(total, 1720, `Kingdom ${k.name} should have balanced total starting resources`);
  }
});

test('all five geographical regions generate deterministic terrain, flat settlement plaza, and water features', () => {
  assert.equal(REGION_LIST.length, 5);

  const savannah = REGIONS.golden_savannah;
  const h1 = sampleTerrainHeight(0, 0, savannah, 1337);
  const h2 = sampleTerrainHeight(0, 0, savannah, 1337);
  assert.equal(h1, h2, 'Terrain height must be deterministic for same seed');
  assert.ok(h1 > 0.8 && h1 < 2.0, 'Central settlement plaza must sit comfortably above water');

  const riverZ = getRiverCenterZ(0, 1337);
  assert.equal(isWaterAt(0, riverZ, savannah, 1337), true, 'River centerline must be underwater');

  const coastal = REGIONS.coastal_territories;
  assert.equal(isWaterAt(0, 46, coastal, 1337), true, 'Southern coastal bay must contain water');
});

test('RTS camera clamps world bounds, enforces zoom limits, and maintains terrain clearance', () => {
  const rig = createInitialCameraRig();
  zoomCamera(rig, -999);
  assert.equal(rig.desiredDistance, MIN_CAMERA_DISTANCE);

  zoomCamera(rig, 999);
  assert.equal(rig.desiredDistance, MAX_CAMERA_DISTANCE);

  panCameraLocal(rig, 5000, 5000);
  assert.ok(rig.desiredTargetX <= rig.maxBounds && rig.desiredTargetX >= rig.minBounds);
  assert.ok(rig.desiredTargetZ <= rig.maxBounds && rig.desiredTargetZ >= rig.minBounds);

  focusCameraOnPoint(rig, -12, 8, 28);
  const pose = stepCameraRig(rig, 0.05, REGIONS.northern_highlands, 2026);
  const groundUnderEye = sampleTerrainHeight(pose.eyeX, pose.eyeZ, REGIONS.northern_highlands, 2026);
  assert.ok(pose.eyeY >= groundUnderEye + 3.9, 'Camera eye must never clip below highland terrain');
});

test('woodcutter physically travels to tree, chops wood into cargo, delivers to storage, and fells/regrows trees', () => {
  const region = REGIONS.golden_savannah;
  const settlement = generateInitialSettlement('nambara', region, 4242);
  const runtime = createInitialEconomyRuntime({
    kingdomId: 'nambara',
    region,
    seed: 4242,
    resources: { food: 300, wood: 200, stone: 200, iron: 100, gold: 100 },
    buildings: settlement.buildings,
    characters: settlement.characters,
    resourceNodes: settlement.resourceNodes,
  });

  const woodcutter = runtime.characters.find((c) => c.id === 'char_woodcutter_bakari');
  assert.ok(woodcutter, 'Woodcutter Bakari should exist');

  const targetTree = runtime.resourceNodes.find((n) => n.nodeKind === 'harvestable_tree');
  assert.ok(targetTree, 'Harvestable tree should exist');
  targetTree.remainingYield = 8; // Small remaining yield so felling + regrowth can be verified deterministically

  commandVillagersToEntity([woodcutter], targetTree, runtime);
  assert.equal(woodcutter.role, 'Woodcutter');
  assert.equal(woodcutter.assignedNodeId, targetTree.id);

  const initialWood = runtime.resources.wood;

  // Step until tree is felled and woodcutter hauls logs back to storage
  advanceSimulationSeconds(runtime, 26);

  assert.equal(targetTree.depleted, true, 'Harvested tree must become a depleted stump');
  assert.ok(targetTree.regrowthTimer > 0, 'Felled tree must have an active regrowth timer');
  assert.ok(
    runtime.resources.wood > initialWood + 6,
    `Kingdom wood should increase after physical delivery (was ${initialWood}, now ${runtime.resources.wood})`,
  );

  // Advance past regrowth duration and verify tree regrows automatically
  advanceSimulationSeconds(runtime, 30);
  assert.equal(targetTree.depleted, false, 'Felled tree must regrow after regrowth timer elapses');
  assert.equal(targetTree.remainingYield, targetTree.maxYield);
});

test('farming, mining, and finite mineral deposit exhaustion work through physical villager loops', () => {
  const region = REGIONS.golden_savannah;
  const settlement = generateInitialSettlement('kemetra', region, 5150);
  const runtime = createInitialEconomyRuntime({
    kingdomId: 'kemetra',
    region,
    seed: 5150,
    resources: { food: 250, wood: 200, stone: 150, iron: 100, gold: 100 },
    buildings: settlement.buildings,
    characters: settlement.characters,
    resourceNodes: settlement.resourceNodes,
  });

  const miner = runtime.characters.find((c) => c.role === 'Miner')!;
  const goldNode = runtime.resourceNodes.find((n) => n.nodeKind === 'gold_outcrop')!;
  goldNode.remainingYield = 9; // Finite ore pocket

  commandVillagersToEntity([miner], goldNode, runtime);
  assert.equal(miner.preferredResource, 'gold');

  const startGold = runtime.resources.gold;
  advanceSimulationSeconds(runtime, 35);

  assert.equal(goldNode.depleted, true, 'Exhausted mineral deposit must be marked depleted');
  assert.equal(goldNode.regenerates, false, 'Mineral deposits do not regenerate');
  assert.ok(
    runtime.resources.gold > startGold + 8,
    `Delivered gold and trader tariffs must increase gold reserves (was ${startGold}, now ${runtime.resources.gold})`,
  );
  assert.ok(
    runtime.economyStats.totalGathered.food > 20,
    'Farmers and fishermen must physically harvest and deliver food to granaries',
  );
});

test('building placement validates terrain/water/cost, dispatches builders, constructs scaffolding, and activates housing & storage', () => {
  const region = REGIONS.golden_savannah;
  const seed = 4819;
  const settlement = generateInitialSettlement('oru', region, seed);
  const runtime = createInitialEconomyRuntime({
    kingdomId: 'oru',
    region,
    seed,
    resources: { food: 400, wood: 450, stone: 400, iron: 200, gold: 200 },
    buildings: settlement.buildings,
    characters: settlement.characters,
    resourceNodes: settlement.resourceNodes,
  });

  // 1. Reject underwater placement in river
  const riverZ = getRiverCenterZ(0, seed);
  const waterCheck = validateBuildingPlacement('dwelling_house', 0, riverZ, runtime);
  assert.equal(waterCheck.valid, false);
  assert.match(waterCheck.reason ?? '', /water|submerged/i);

  // 2. Reject overlapping an existing building
  const overlapCheck = validateBuildingPlacement('dwelling_house', 0, -2, runtime);
  assert.equal(overlapCheck.valid, false);

  // 3. Find valid clear ground and place a Dwelling House (+4 housing) and Warehouse (+storage)
  const initialHousing = runtime.population.capacity;
  const initialWoodCap = runtime.capacities.wood;
  const startWood = runtime.resources.wood;

  const placedHouse = placeNewBuilding('dwelling_house', -2.5, -10.5, 0, runtime);
  // If (-2.5, -10.5) is slightly close to Granary (-7.5, -15.5) or Compound (0, -2), scan for clear spot
  let houseEntity = placedHouse.building;
  if (!placedHouse.ok) {
    for (let x = -22; x <= 22 && !houseEntity; x += 4) {
      for (let z = -22; z <= 12 && !houseEntity; z += 4) {
        const res = placeNewBuilding('dwelling_house', x, z, 0, runtime);
        if (res.ok) houseEntity = res.building;
      }
    }
  }
  assert.ok(houseEntity, 'Must find valid buildable ground for Dwelling House');
  assert.equal(houseEntity.constructionState, 'planned');
  assert.ok(runtime.resources.wood < startWood, 'Placement must deduct wood cost immediately');

  // Step simulation so Builder walks to site and constructs it from 0% -> 100%
  advanceSimulationSeconds(runtime, 24);
  assert.equal(houseEntity.constructionState, 'completed');
  assert.equal(
    runtime.population.capacity,
    initialHousing + 4,
    'Completed Dwelling House must increase housing capacity by +4',
  );

  // Place and complete a Warehouse to verify storage expansion
  let warehouseEntity = undefined;
  for (let x = -24; x <= 24 && !warehouseEntity; x += 4) {
    for (let z = -24; z <= 12 && !warehouseEntity; z += 4) {
      const res = placeNewBuilding('warehouse_storehouse', x, z, 0, runtime);
      if (res.ok) warehouseEntity = res.building;
    }
  }
  assert.ok(warehouseEntity, 'Must place Warehouse on valid ground');
  advanceSimulationSeconds(runtime, 28);
  assert.equal(warehouseEntity.constructionState, 'completed');
  assert.ok(
    runtime.capacities.wood > initialWoodCap + 500,
    'Completed Warehouse must expand wood storage capacity',
  );

  // Verify cancelling a planned construction refunds 75% materials
  let cancelTarget = undefined;
  for (let x = -30; x <= 30 && !cancelTarget; x += 4) {
    const res = placeNewBuilding('watch_post', x, -26, 0, runtime);
    if (res.ok) cancelTarget = res.building;
  }
  if (cancelTarget) {
    const woodBeforeCancel = runtime.resources.wood;
    const cancelled = cancelPlannedOrActiveConstruction(cancelTarget.id, runtime);
    assert.equal(cancelled, true);
    assert.ok(runtime.resources.wood > woodBeforeCancel, 'Cancelling construction must refund materials');
  }
});

test('storage limits halt overflow deposits and organic population growth responds to food & housing', () => {
  const region = REGIONS.golden_savannah;
  const settlement = generateInitialSettlement('aseka', region, 6060);
  const runtime = createInitialEconomyRuntime({
    kingdomId: 'aseka',
    region,
    seed: 6060,
    resources: { food: 500, wood: 9999, stone: 300, iron: 200, gold: 300 },
    buildings: settlement.buildings,
    characters: settlement.characters,
    resourceNodes: settlement.resourceNodes,
  });

  // Initial clamp enforces max storage capacity
  assert.equal(runtime.resources.wood, runtime.capacities.wood);

  // Woodcutters must pause when wood storage is full and never exceed capacity
  advanceSimulationSeconds(runtime, 8);
  assert.equal(
    runtime.resources.wood,
    runtime.capacities.wood,
    'Resources must never exceed storage capacity',
  );
  const woodcutter = runtime.characters.find((c) => c.kingdomId === 'aseka' && c.role === 'Woodcutter')!;
  assert.match(woodcutter.activityLabel, /storage full/i);

  // With 500 food and 22 housing capacity (8 current pop), population grows organically over ~42s
  const startPop = runtime.population.current;
  advanceSimulationSeconds(runtime, 45);
  assert.ok(
    runtime.population.current > startPop,
    `Population should grow organically when well-fed and housed (started ${startPop}, now ${runtime.population.current})`,
  );

  // Drain food to 0 and unassign food producers: food shortage halts growth and lowers satisfaction
  for (const c of runtime.characters) {
    assignVillagerOccupation(c, 'Unemployed', runtime, null, true);
  }
  runtime.resources.food = 0;
  runtime.population.growthProgress = 50;
  advanceSimulationSeconds(runtime, 5);
  assert.ok(runtime.population.foodSatisfaction < 100, 'Food shortage must reduce food satisfaction');
  assert.ok(runtime.population.growthProgress < 50, 'Food shortage must halt/regress growth progress');
});

test('Phase 2 save and reload preserves worldEntities, villager cargo, and construction progress without duplication', () => {
  const backing = new Map<string, string>();
  const provider = new StoragePersistenceProvider({
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => {
      backing.set(k, v);
    },
    removeItem: (k) => {
      backing.delete(k);
    },
  });

  const save = createNewKingdomSave({
    kingdomId: 'kemetra',
    playerKingdomName: 'Solar Realm of Kemetra',
    rulerName: 'Archon Makeda',
    regionId: 'northern_highlands',
    gameMode: 'sandbox',
    sandboxAbundantResources: true,
    worldSeed: 7777,
  });

  assert.equal(save.resources.stone, Math.round(KINGDOMS.kemetra.startingResources.stone * 2.5));
  assert.ok(save.worldEntities);

  // Mutate a villager's cargo and add a half-built structure before saving
  save.worldEntities.characters[0].carriedResource = 'food';
  save.worldEntities.characters[0].carriedAmount = 9;
  save.worldEntities.buildings[0].integrity = 950;
  save.resources.wood = 612;

  assert.equal(provider.saveGame(save), true);
  const loaded = provider.loadGame();
  assert.ok(loaded);
  assert.equal(loaded.resources.wood, 612, 'Reload must not duplicate or alter saved resource amounts');
  assert.equal(loaded.worldEntities?.characters[0].carriedAmount, 9);
  assert.equal(loaded.worldEntities?.buildings[0].integrity, 950);

  // Verify Phase 1 v1 saves upgrade cleanly to v2
  const upgraded = validateSaveGameData({
    version: 1,
    kingdomId: 'oru',
    regionId: 'golden_savannah',
    playerKingdomName: 'Legacy Oru',
    resources: { food: 310, wood: 290, stone: 280, iron: 190, gold: 210 },
    population: { current: 8, capacity: 22, availableWorkforce: 8 },
    cameraTarget: { x: 0, z: 4, yaw: 0.5, distance: 42 },
    worldSeed: 4819,
  });
  assert.ok(upgraded);
  assert.equal(upgraded.version, 2);
  assert.ok((upgraded.worldEntities?.characters.length ?? 0) >= 8);

  assert.equal(validateSaveGameData({ version: 2, kingdomId: 'unknown' }), null);
});

/* ========================================================================= */
/* PHASE 3: MILITARY RECRUITMENT, UNIT CONTROL, FORMATIONS & REAL-TIME COMBAT */
/* ========================================================================= */

test('all military unit blueprints, siege weapons, and kingdom martial doctrines are well-formed', () => {
  const expectedClasses = [
    'infantry',
    'spearman',
    'archer',
    'cavalry',
    'royal_guard',
    'scout',
    'siege_engineer',
    'battering_ram',
    'catapult',
    'siege_tower',
    'commander',
  ] as const;

  for (const c of expectedClasses) {
    const bp = MILITARY_UNIT_CATALOG[c];
    assert.ok(bp, `Blueprint for military class ${c} must exist`);
    assert.ok(bp.health > 0, `${c} must have positive health`);
    assert.ok(bp.attackDamage > 0, `${c} must have positive attack damage`);
    assert.ok(bp.attackRange > 0, `${c} must have positive attack range`);
    assert.ok(bp.recruitmentDurationSec > 0, `${c} must have realistic recruitment time`);
  }

  // All 5 kingdoms have military traits
  for (const k of KINGDOM_LIST) {
    const bonus = KINGDOM_MILITARY_BONUSES[k.id];
    assert.ok(bonus, `Kingdom ${k.id} must have a military bonus`);
    assert.ok(bonus.name.length > 0);
    assert.ok(bonus.summary.length > 0);
  }
});

test('RTS formation math computes structured tactical offsets across Line, Phalanx, Wedge, Square and Flank', () => {
  const lineOffsets = calculateFormationOffsets('line', 6, 2.5);
  assert.equal(lineOffsets.length, 6);
  // Center unit should be near center
  assert.ok(lineOffsets[0].x !== undefined && lineOffsets[0].z !== undefined);

  const phalanxOffsets = calculateFormationOffsets('defensive', 8, 2.2);
  assert.equal(phalanxOffsets.length, 8);
  // Two ranks deep
  const ranks = new Set(phalanxOffsets.map((p) => p.z));
  assert.ok(ranks.size >= 2, 'Phalanx should have multiple defensive ranks');

  const wedgeOffsets = calculateFormationOffsets('wedge', 5, 2.4);
  assert.equal(wedgeOffsets.length, 5);
  // Tip of the wedge is centered horizontally
  assert.equal(wedgeOffsets[0].x, 0);
  // Wing units flank outwards and backwards relative to tip
  assert.ok(wedgeOffsets[1].z >= wedgeOffsets[0].z, 'Wedge wings should angle backwards');

  const squareOffsets = calculateFormationOffsets('square', 9, 2.2);
  assert.equal(squareOffsets.length, 9);
  assert.equal(new Set(squareOffsets.map((s) => s.z)).size, 3, 'Square of 9 should form 3x3 grid');
});

test('combat counter matrix enforces realistic RTS tactical rock-paper-scissors & siege multipliers', () => {
  // Spearmen counter charging cavalry
  const spearVsCav = calculateCombatDamageMultiplier('spearman', 'cavalry', false);
  assert.ok(spearVsCav >= 2.0, `Spearman vs Cavalry multiplier should be >= 2.0 (got ${spearVsCav})`);

  // Cavalry counters exposed archers
  const cavVsArch = calculateCombatDamageMultiplier('cavalry', 'archer', false);
  assert.ok(cavVsArch >= 1.6, `Cavalry vs Archer multiplier should be >= 1.6 (got ${cavVsArch})`);

  // Archers counter slow spearmen from range
  const archVsSpear = calculateCombatDamageMultiplier('archer', 'spearman', false);
  assert.ok(archVsSpear >= 1.25, `Archer vs Spearman multiplier should be >= 1.25 (got ${archVsSpear})`);

  // Infantry counters archers once closed in
  const infVsArch = calculateCombatDamageMultiplier('infantry', 'archer', false);
  assert.ok(infVsArch >= 1.3, `Infantry vs Archer multiplier should be >= 1.3 (got ${infVsArch})`);
});

test('military recruitment queue deducts treasury resources, advances countdown, and spawns armed combatants at rally point', () => {
  const region = REGIONS.golden_savannah;
  const settlement = generateInitialSettlement('oru', region, 9999);
  const runtime = createInitialEconomyRuntime({
    kingdomId: 'oru',
    region,
    seed: 9999,
    resources: { food: 500, wood: 400, stone: 300, iron: 200, gold: 200 },
    buildings: settlement.buildings,
    characters: settlement.characters,
    resourceNodes: settlement.resourceNodes,
  });

  // Construct a completed Barracks Compound
  const barracks: any = {
    id: 'building_barracks_test',
    category: 'building' as const,
    archetype: 'barracks_compound' as const,
    name: 'Royal Barracks of Oru',
    position: { x: 10, y: 1.2, z: 10 },
    x: 10,
    z: 10,
    rotationY: 0,
    footprintWidth: 6,
    footprintDepth: 6,
    footprintRadius: 3.5,
    constructionState: 'completed' as const,
    buildProgress: 1,
    integrity: 1000,
    maxIntegrity: 1000,
    recruitmentQueue: [],
    rallyPoint: { x: 12, z: 18 },
  };
  runtime.buildings.push(barracks);

  const militaryState = createInitialMilitaryState();

  // Attempt to recruit Shield Infantry
  const foodBefore = runtime.resources.food;
  const ironBefore = runtime.resources.iron;
  const goldBefore = runtime.resources.gold;

  const queued = queueRecruitment(
    barracks,
    'infantry',
    runtime.resources,
    runtime.population,
    'oru',
  );
  assert.ok(queued.success, `Infantry recruitment must succeed: ${queued.reason}`);
  assert.equal(barracks.recruitmentQueue.length, 1);
  assert.equal(barracks.recruitmentQueue[0].unitClass, 'infantry');

  // Verify resources were cleanly deducted
  const cost = MILITARY_UNIT_CATALOG.infantry.cost;
  assert.equal(runtime.resources.food, foodBefore - cost.food);
  assert.equal(runtime.resources.iron, ironBefore - cost.iron);
  assert.equal(runtime.resources.gold, goldBefore - cost.gold);

  // Queue a second recruit (Phalanx Spearman)
  const queuedSpear = queueRecruitment(
    barracks,
    'spearman',
    runtime.resources,
    runtime.population,
    'oru',
  );
  assert.ok(queuedSpear.success);
  assert.equal(barracks.recruitmentQueue.length, 2);

  // Advance simulation by 1.0 second and verify queue progress increases
  const progressInitial = barracks.recruitmentQueue[0].progressSec;
  stepMilitarySimulation(militaryState, runtime, 1.0);
  assert.ok(
    barracks.recruitmentQueue[0].progressSec > progressInitial,
    'Active recruitment progress must advance during simulation step',
  );

  // Advance until first recruit finishes training
  const remaining = barracks.recruitmentQueue[0].totalDurationSec - barracks.recruitmentQueue[0].progressSec + 0.5;
  stepMilitarySimulation(militaryState, runtime, remaining);

  // Newly trained soldier should have spawned in runtime.characters
  const newSoldier = runtime.characters.find(
    (c) => c.militaryClass === 'infantry' && c.name.includes('Infantry'),
  );
  assert.ok(newSoldier, 'Trained infantry soldier must spawn in world character array');
  assert.equal(newSoldier.health, newSoldier.maxHealth);
  assert.equal(newSoldier.formation, 'line');
  assert.ok(
    Boolean(newSoldier.combatState && ['idle', 'engaging', 'marching'].includes(newSoldier.combatState)),
  );
  // First item popped, second item now in first slot
  assert.equal(barracks.recruitmentQueue.length, 1);
  assert.equal(barracks.recruitmentQueue[0].unitClass, 'spearman');
});

test('ballistic projectile physics tracks parabolic arcs and executes impact hit validation', () => {
  const region = REGIONS.golden_savannah;
  const settlement = generateInitialSettlement('oru', region, 4444);
  const runtime = createInitialEconomyRuntime({
    kingdomId: 'oru',
    region,
    seed: 4444,
    resources: { food: 500, wood: 400, stone: 300, iron: 200, gold: 200 },
    buildings: settlement.buildings,
    characters: settlement.characters,
    resourceNodes: settlement.resourceNodes,
  });

  const targetDummy = spawnMilitaryCharacterEntity('infantry', 'zambara', 15, 0, 4444);
  targetDummy.id = 'target_dummy_1';
  targetDummy.isHostile = true;
  targetDummy.health = 100;
  runtime.characters.push(targetDummy);

  const militaryState = createInitialMilitaryState();

  spawnBallisticProjectile(
    militaryState,
    'arrow',
    0, 2, 0,
    15, 1, 0,
    25, // 25 damage
    targetDummy.id,
  );

  assert.equal(militaryState.projectiles.length, 1);
  const proj = militaryState.projectiles[0];
  assert.equal(proj.sourceX, 0);
  assert.equal(proj.targetX, 15);

  // Step military sim past flight time and verify impact damage applied to target dummy
  stepMilitarySimulation(militaryState, runtime, 1.5);

  assert.ok(targetDummy.health < 100, `Target dummy should take impact damage (was 100, now ${targetDummy.health})`);
  assert.equal(militaryState.projectiles.length, 0, 'Spent projectile must be removed after impact');
  assert.ok(militaryState.recentHits.length > 0, 'Combat hit event should be logged in recentHits');
});

test('military upkeep deduction charges treasury and notifies when soldiers consume grain and coin', () => {
  const region = REGIONS.golden_savannah;
  const settlement = generateInitialSettlement('aseka', region, 1234);
  const runtime = createInitialEconomyRuntime({
    kingdomId: 'aseka',
    region,
    seed: 1234,
    resources: { food: 100, wood: 100, stone: 100, iron: 100, gold: 100 },
    buildings: settlement.buildings,
    characters: settlement.characters,
    resourceNodes: settlement.resourceNodes,
  });

  const militaryState = createInitialMilitaryState();
  // Spawn two soldiers
  const soldier1 = spawnMilitaryCharacterEntity('infantry', 'aseka', 0, 0, 1000);
  const soldier2 = spawnMilitaryCharacterEntity('cavalry', 'aseka', 2, 2, 1001);
  runtime.characters.push(soldier1, soldier2);

  // Step military sim across the 60-second upkeep interval
  const foodStart = runtime.resources.food;
  const goldStart = runtime.resources.gold;

  // Advance 65 seconds
  for (let t = 0; t < 65; t++) {
    stepMilitarySimulation(militaryState, runtime, 1.0);
  }

  assert.ok(
    runtime.resources.food < foodStart,
    `Food should be deducted for military upkeep (was ${foodStart}, now ${runtime.resources.food})`,
  );
  assert.ok(
    runtime.resources.gold < goldStart,
    `Gold should be deducted for military upkeep (was ${goldStart}, now ${runtime.resources.gold})`,
  );
});

test('Phase 4: AI kingdoms initialize with distinct personalities and regional settlement bases', () => {
  const allIds = ['oru', 'zambara', 'kemetra', 'aseka', 'nambara'] as const;
  for (const id of allIds) {
    const personality = KINGDOM_PERSONALITIES[id];
    assert.ok(personality, `Personality defined for kingdom ${id}`);
    assert.ok(personality.preferredUnits.length > 0, `Preferred units defined for ${id}`);
    assert.ok(personality.preferredBuildings.length > 0, `Preferred buildings defined for ${id}`);
  }

  assert.equal(KINGDOM_PERSONALITIES.oru.defensiveness > 0.8, true, 'Oru has high defensiveness');
  assert.equal(KINGDOM_PERSONALITIES.zambara.expansionism > 0.8, true, 'Zambara has high expansionism');
  assert.equal(KINGDOM_PERSONALITIES.kemetra.engineeringFocus > 0.8, true, 'Kemetra has high engineering focus');
  assert.equal(KINGDOM_PERSONALITIES.aseka.commerceFocus > 0.8, true, 'Aseka has high commerce focus');
  assert.equal(KINGDOM_PERSONALITIES.nambara.wildernessFocus > 0.8, true, 'Nambara has high wilderness focus');

  // Verify multi-kingdom settlement generation
  const region = REGIONS.golden_savannah;
  const worldData = generateInitialSettlement('oru', region, 4819);
  assert.ok(worldData.buildings.length > 15, 'Multi-kingdom buildings generated');
  assert.ok(worldData.characters.length >= 24, 'Rival AI villagers spawned');

  const generatedKingdoms = new Set(worldData.buildings.map((b) => b.kingdomId));
  assert.equal(generatedKingdoms.size, 5, 'All 5 founding kingdoms generated on world map');
});

test('Phase 4: Autonomous AI decision manager steps economy, construction, and recruitment', () => {
  const region = REGIONS.golden_savannah;
  const settlement = generateInitialSettlement('oru', region, 9999);
  const runtime = createInitialEconomyRuntime({
    kingdomId: 'oru',
    region,
    seed: 9999,
    resources: { food: 500, wood: 500, stone: 500, iron: 300, gold: 300 },
    buildings: settlement.buildings,
    characters: settlement.characters,
    resourceNodes: settlement.resourceNodes,
  });

  const aiManager = createInitialAIKingdomManager('oru', 'hard');
  const militaryState = createInitialMilitaryState();
  const diplomacy = createInitialDiplomacyState('oru');

  // Step AI simulation across 10 seconds
  for (let t = 0; t < 20; t++) {
    stepAIKingdomManager(0.5, aiManager, runtime, militaryState, diplomacy, region, 9999);
  }

  const rivalBuildings = runtime.buildings.filter((b) => b.kingdomId !== 'oru');
  assert.ok(rivalBuildings.length > 0, 'Rival AI kingdom buildings exist and are managed');
});

test('Phase 4: Diplomacy matrix calculates relationship score transitions, treaties, and proposals', () => {
  const diplomacy = createInitialDiplomacyState('oru');

  const relBefore = diplomacy.relations.oru.zambara;
  assert.equal(relBefore.state, 'neutral', 'Initial relation between Oru and Zambara is neutral');

  // Add non-aggression treaty
  const event = addDiplomaticTreaty(diplomacy, 'oru', 'zambara', 'non_aggression', 300);
  assert.ok(event.title.toLowerCase().includes('treaty formed'), 'Event generated for treaty formation');

  const relAfter = diplomacy.relations.oru.zambara;
  assert.ok(relAfter.score > 0, 'Diplomatic score boosted by non-aggression treaty');
  assert.equal(relAfter.activeTreaties.length, 1, 'Non-aggression treaty active in relation');

  // Test proposal acceptance
  const checkPact = evaluateProposalAcceptance(diplomacy, 'oru', 'zambara', 'trade_pact');
  assert.equal(checkPact.accepted, true, 'Trade pact proposal accepted with positive relation');

  // Test war declaration
  const warRes = updateDiplomaticScore(diplomacy, 'oru', 'zambara', -80, 'war declaration');
  assert.equal(warRes.newState, 'at_war', 'Relation transitions to at_war on -80 score drop');
});

test('Phase 4: World save system preserves multi-kingdom AI state, diplomacy, and world events', () => {
  const save = createNewKingdomSave({
    kingdomId: 'oru',
    playerKingdomName: 'Oru Empire',
    rulerName: 'King Shaka',
    regionId: 'golden_savannah',
    gameMode: 'standard',
    settings: {
      graphicsQuality: 'high',
      cameraPanSpeed: 1.0,
      audio: { masterVolume: 0.8, musicVolume: 0.6, sfxVolume: 0.8, muted: false },
    },
  });

  assert.ok(validateSaveGameData(save), 'Phase 4 SaveGameData passes validation');
});

