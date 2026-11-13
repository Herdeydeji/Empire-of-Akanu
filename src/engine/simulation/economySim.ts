import {
  BUILDING_CATALOG,
  ECONOMY_RULES,
  evaluateProgressionStage,
  getAdjustedBuildingCost,
  KINGDOM_ECONOMIC_BONUSES,
  OCCUPATION_CONFIGS,
  RESOURCE_KEYS,
} from '../../config/economy';
import { createSpawnedCitizen } from '../../config/settlement';
import {
  AIKingdomRuntime,
  BuildingArchetype,
  BuildingEntity,
  CharacterEntity,
  CivilianRole,
  EconomyNotification,
  EconomyStatistics,
  EnvironmentNodeEntity,
  KingdomId,
  PopulationState,
  ProgressionStage,
  RegionConfig,
  ResourceAmounts,
  ResourceCapacities,
  ResourceKey,
  ResourceRates,
  SelectableEntity,
} from '../../types/game';
import { sampleTerrainHeight, sampleTerrainSlope, WATER_LEVEL } from '../math/noise';

const BASE_WALK_SPEED = 2.65;
const BASE_RUN_SPEED = 4.25;
const ARRIVAL_TOLERANCE = 0.42;
const WORLD_PLACEMENT_LIMIT = 86;

export interface KingdomEconomyLedger {
  kingdomId: KingdomId;
  isPlayer: boolean;
  settlementCenter: { x: number; z: number };
  resources: ResourceAmounts;
  capacities: ResourceCapacities;
  rates: ResourceRates;
  population: PopulationState;
  progressionStage: ProgressionStage;
  economyStats: EconomyStatistics;
  recentLedger: { time: number; type: 'prod' | 'cons'; resource: ResourceKey; amount: number }[];
  tradeIncomeBonusMult: number;
}

export interface EconomyWorldRuntime {
  kingdomId: KingdomId;
  region: RegionConfig;
  seed: number;
  capacityMultiplier: number;
  resources: ResourceAmounts;
  capacities: ResourceCapacities;
  rates: ResourceRates;
  population: PopulationState;
  progressionStage: ProgressionStage;
  economyStats: EconomyStatistics;
  buildings: BuildingEntity[];
  characters: CharacterEntity[];
  resourceNodes: EnvironmentNodeEntity[];
  elapsedSeconds: number;
  economyTickAccumulator: number;
  // Rolling 20-second ledger for accurate real-time +/min and -/min display
  recentLedger: { time: number; type: 'prod' | 'cons'; resource: ResourceKey; amount: number }[];
  notificationCooldowns: Map<string, number>;
  pendingNotifications: EconomyNotification[];
  dirtyBuildingIds: Set<string>;
  dirtyNodeIds: Set<string>;
  newlySpawnedCharacters: CharacterEntity[];
  newlySpawnedBuildings: BuildingEntity[];
  capitalCenters?: Record<KingdomId, { x: number; z: number }>;
  tradeIncomeBonusMult?: number;
  kingdomLedgers?: Map<KingdomId, KingdomEconomyLedger>;
}

export function resolveKingdomLedger(
  runtime: EconomyWorldRuntime,
  kingdomId?: KingdomId,
): KingdomEconomyLedger {
  const kId = kingdomId ?? runtime.kingdomId;
  if (!runtime.kingdomLedgers) {
    runtime.kingdomLedgers = new Map<KingdomId, KingdomEconomyLedger>();
  }
  const found = runtime.kingdomLedgers.get(kId);
  if (found) return found;

  if (kId === runtime.kingdomId) {
    const playerLedger: KingdomEconomyLedger = {
      kingdomId: kId,
      isPlayer: true,
      settlementCenter: runtime.capitalCenters?.[kId] ?? { x: 0, z: 0 },
      resources: runtime.resources,
      capacities: runtime.capacities,
      rates: runtime.rates,
      population: runtime.population,
      progressionStage: runtime.progressionStage,
      economyStats: runtime.economyStats,
      recentLedger: runtime.recentLedger,
      tradeIncomeBonusMult: runtime.tradeIncomeBonusMult ?? 1.0,
    };
    runtime.kingdomLedgers.set(kId, playerLedger);
    return playerLedger;
  }

  const isolatedLedger: KingdomEconomyLedger = {
    kingdomId: kId,
    isPlayer: false,
    settlementCenter: runtime.capitalCenters?.[kId] ?? { x: 0, z: 0 },
    resources: { food: 400, wood: 400, stone: 350, iron: 220, gold: 250 },
    capacities: { food: 1200, wood: 1200, stone: 1200, iron: 900, gold: 1200 },
    rates: {
      productionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      consumptionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      netPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
    },
    population: {
      current: 5,
      capacity: 12,
      availableWorkforce: 5,
      employedCount: 5,
      unemployedCount: 0,
      happiness: 80,
      foodSatisfaction: 100,
      growthProgress: 0,
    },
    progressionStage: 'Settlement',
    economyStats: {
      totalGathered: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      totalConsumedFood: 0,
      buildingsConstructed: 0,
      villagersBorn: 0,
    },
    recentLedger: [],
    tradeIncomeBonusMult: 1.0,
  };
  runtime.kingdomLedgers.set(kId, isolatedLedger);
  return isolatedLedger;
}

export function attachAIKingdomLedgers(
  runtime: EconomyWorldRuntime,
  aiKingdoms: Record<KingdomId, AIKingdomRuntime>,
): void {
  const map = new Map<KingdomId, KingdomEconomyLedger>();

  for (const kId of Object.keys(aiKingdoms) as KingdomId[]) {
    const ai = aiKingdoms[kId];
    const isPlayer = kId === runtime.kingdomId || ai.isPlayer;

    if (isPlayer) {
      map.set(kId, {
        kingdomId: kId,
        isPlayer: true,
        settlementCenter: ai.settlementCenter,
        resources: runtime.resources,
        capacities: runtime.capacities,
        rates: runtime.rates,
        population: runtime.population,
        progressionStage: runtime.progressionStage,
        economyStats: runtime.economyStats,
        recentLedger: runtime.recentLedger,
        tradeIncomeBonusMult: 1.0,
      });
      // Mirror live player runtime references back onto AIKingdomRuntime entry
      ai.resources = runtime.resources;
      ai.capacities = runtime.capacities;
      ai.rates = runtime.rates;
      ai.population = runtime.population;
      ai.economyStats = runtime.economyStats;
      ai.progressionStage = runtime.progressionStage;
    } else {
      if (!ai.rates) {
        ai.rates = {
          productionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
          consumptionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
          netPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
        };
      }
      if (!ai.economyStats) {
        ai.economyStats = {
          totalGathered: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
          totalConsumedFood: 0,
          buildingsConstructed: 0,
          villagersBorn: 0,
        };
      }
      map.set(kId, {
        kingdomId: kId,
        isPlayer: false,
        settlementCenter: ai.settlementCenter,
        resources: ai.resources,
        capacities: ai.capacities,
        rates: ai.rates,
        population: ai.population,
        progressionStage: ai.progressionStage,
        economyStats: ai.economyStats,
        recentLedger: [],
        tradeIncomeBonusMult: 1.0,
      });
    }
  }

  runtime.kingdomLedgers = map;
  recalculateCapacitiesAndPopulation(runtime);
  for (const ledger of map.values()) {
    clampResourcesToCapacities(runtime, ledger.kingdomId);
  }
}

export function createInitialEconomyRuntime(params: {
  kingdomId: KingdomId;
  region: RegionConfig;
  seed: number;
  capacityMultiplier?: number;
  resources: ResourceAmounts;
  buildings: BuildingEntity[];
  characters: CharacterEntity[];
  resourceNodes: EnvironmentNodeEntity[];
  existingStats?: EconomyStatistics;
  existingPopulation?: Partial<PopulationState>;
  elapsedSeconds?: number;
  capitalCenters?: Record<KingdomId, { x: number; z: number }>;
}): EconomyWorldRuntime {
  const playerInitialPop = params.characters.filter(
    (c) => c.kingdomId === params.kingdomId,
  ).length;
  const runtime: EconomyWorldRuntime = {
    kingdomId: params.kingdomId,
    region: params.region,
    seed: params.seed,
    capacityMultiplier: params.capacityMultiplier ?? 1.0,
    capitalCenters: params.capitalCenters,
    resources: { ...params.resources },
    capacities: { food: 1200, wood: 1200, stone: 1200, iron: 1000, gold: 1000 },
    rates: {
      productionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      consumptionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      netPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
    },
    population: {
      current: playerInitialPop,
      capacity: 22,
      availableWorkforce: playerInitialPop,
      employedCount: 0,
      unemployedCount: 0,
      happiness: params.existingPopulation?.happiness ?? 82,
      foodSatisfaction: params.existingPopulation?.foodSatisfaction ?? 100,
      growthProgress: params.existingPopulation?.growthProgress ?? 0,
    },
    progressionStage: 'Village',
    economyStats: params.existingStats
      ? {
          ...params.existingStats,
          totalGathered: { ...params.existingStats.totalGathered },
        }
      : {
          totalGathered: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
          totalConsumedFood: 0,
          buildingsConstructed: 0,
          villagersBorn: 0,
        },
    buildings: params.buildings,
    characters: params.characters,
    resourceNodes: params.resourceNodes,
    elapsedSeconds: params.elapsedSeconds ?? 0,
    economyTickAccumulator: 0,
    recentLedger: [],
    notificationCooldowns: new Map(),
    pendingNotifications: [],
    dirtyBuildingIds: new Set(),
    dirtyNodeIds: new Set(),
    newlySpawnedCharacters: [],
    newlySpawnedBuildings: [],
  };

  recalculateCapacitiesAndPopulation(runtime);
  clampResourcesToCapacities(runtime);
  return runtime;
}

function shortestAngleDelta(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function pushEconomyNotification(
  runtime: EconomyWorldRuntime,
  dedupeKey: string,
  kind: EconomyNotification['kind'],
  message: string,
  cooldownSec = 14,
): void {
  const last = runtime.notificationCooldowns.get(dedupeKey);
  if (last !== undefined && runtime.elapsedSeconds - last < cooldownSec) {
    return;
  }
  runtime.notificationCooldowns.set(dedupeKey, runtime.elapsedSeconds);
  runtime.pendingNotifications.push({
    id: `notif_${Math.round(runtime.elapsedSeconds * 100)}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    message,
    timestampSec: runtime.elapsedSeconds,
  });
}

function recalculateLedgerForKingdom(
  runtime: EconomyWorldRuntime,
  ledger: KingdomEconomyLedger,
): void {
  const kId = ledger.kingdomId;
  const bonus = KINGDOM_ECONOMIC_BONUSES[kId];
  const capMult = ledger.isPlayer ? (runtime.capacityMultiplier || 1.0) : 1.0;
  const caps: ResourceCapacities = {
    food: Math.round(ECONOMY_RULES.minimumBaseCapacity.food * capMult),
    wood: Math.round(ECONOMY_RULES.minimumBaseCapacity.wood * capMult),
    stone: Math.round(ECONOMY_RULES.minimumBaseCapacity.stone * capMult),
    iron: Math.round(ECONOMY_RULES.minimumBaseCapacity.iron * capMult),
    gold: Math.round(ECONOMY_RULES.minimumBaseCapacity.gold * capMult),
  };
  let housingCap = 0;
  let completedCount = 0;
  let hasPalace = false;

  for (let i = 0; i < runtime.buildings.length; i++) {
    const b = runtime.buildings[i];
    if (b.kingdomId !== kId) continue;
    if (b.constructionState !== 'completed') continue;
    completedCount++;
    if (b.archetype === 'royal_palace') hasPalace = true;

    housingCap += b.housingBonus;
    for (const key of RESOURCE_KEYS) {
      const add = b.storageBonus[key];
      if (add && add > 0) {
        const mult =
          b.archetype === 'royal_compound' ? capMult : bonus.storageBonusMult;
        caps[key] += Math.round(add * mult);
      }
    }
  }

  ledger.capacities.food = caps.food;
  ledger.capacities.wood = caps.wood;
  ledger.capacities.stone = caps.stone;
  ledger.capacities.iron = caps.iron;
  ledger.capacities.gold = caps.gold;

  let employed = 0;
  let unemployed = 0;
  let popCount = 0;
  let civCount = 0;
  for (let i = 0; i < runtime.characters.length; i++) {
    const c = runtime.characters[i];
    if (c.kingdomId === kId && c.health > 0) {
      popCount++;
      if (!c.isMilitary) {
        civCount++;
        if (c.role === 'Unemployed') unemployed++;
        else employed++;
      }
    }
  }

  ledger.population.current = popCount;
  ledger.population.capacity = Math.max(4, housingCap);
  ledger.population.availableWorkforce = civCount;
  ledger.population.employedCount = employed;
  ledger.population.unemployedCount = unemployed;

  ledger.progressionStage = evaluateProgressionStage(
    ledger.population.current,
    completedCount,
    hasPalace,
  );

  if (ledger.isPlayer) {
    runtime.capacities = ledger.capacities;
    runtime.progressionStage = ledger.progressionStage;
  }
}

export function recalculateCapacitiesAndPopulation(
  runtime: EconomyWorldRuntime,
  targetKingdomId?: KingdomId,
): void {
  if (runtime.kingdomLedgers && runtime.kingdomLedgers.size > 0) {
    if (targetKingdomId) {
      const ledger = runtime.kingdomLedgers.get(targetKingdomId);
      if (ledger) recalculateLedgerForKingdom(runtime, ledger);
      return;
    }
    for (const ledger of runtime.kingdomLedgers.values()) {
      recalculateLedgerForKingdom(runtime, ledger);
    }
    return;
  }

  const playerLedger = resolveKingdomLedger(runtime, runtime.kingdomId);
  recalculateLedgerForKingdom(runtime, playerLedger);
}

export function clampResourcesToCapacities(
  runtime: EconomyWorldRuntime,
  kingdomId?: KingdomId,
): void {
  const ledger = resolveKingdomLedger(runtime, kingdomId);
  for (const key of RESOURCE_KEYS) {
    ledger.resources[key] = Math.max(
      0,
      Math.min(ledger.capacities[key], ledger.resources[key]),
    );
  }
}

export function canAffordCost(resources: ResourceAmounts, cost: ResourceAmounts): boolean {
  for (const key of RESOURCE_KEYS) {
    if (resources[key] + 1e-6 < cost[key]) return false;
  }
  return true;
}

export function spendResourcesValidated(
  runtime: EconomyWorldRuntime,
  cost: ResourceAmounts,
  kingdomId?: KingdomId,
): boolean {
  const ledger = resolveKingdomLedger(runtime, kingdomId);
  if (!canAffordCost(ledger.resources, cost)) return false;
  for (const key of RESOURCE_KEYS) {
    if (cost[key] > 0) {
      ledger.resources[key] = Math.max(0, ledger.resources[key] - cost[key]);
    }
  }
  return true;
}

export function depositResourceValidated(
  runtime: EconomyWorldRuntime,
  resource: ResourceKey,
  amount: number,
  kingdomId?: KingdomId,
): number {
  if (amount <= 0) return 0;
  const ledger = resolveKingdomLedger(runtime, kingdomId);
  const space = Math.max(0, ledger.capacities[resource] - ledger.resources[resource]);
  const accepted = Math.min(amount, space);
  if (accepted > 0) {
    ledger.resources[resource] += accepted;
    ledger.economyStats.totalGathered[resource] += accepted;
    ledger.recentLedger.push({
      time: runtime.elapsedSeconds,
      type: 'prod',
      resource,
      amount: accepted,
    });
  }
  if (ledger.isPlayer && accepted < amount - 0.01) {
    const label = resource.charAt(0).toUpperCase() + resource.slice(1);
    const storageHint =
      resource === 'food'
        ? 'Granary'
        : resource === 'gold'
          ? 'Royal Treasury or Marketplace'
          : 'Warehouse';
    pushEconomyNotification(
      runtime,
      `storage_full_${resource}`,
      'warning',
      `${label} storage capacity reached (${Math.round(ledger.capacities[resource])}). Build a ${storageHint}.`,
      18,
    );
  }
  return accepted;
}

export interface PlacementValidationResult {
  valid: boolean;
  reason?: string;
  adjustedCost: ResourceAmounts;
}

export function validateBuildingPlacement(
  archetype: BuildingArchetype,
  x: number,
  z: number,
  runtime: EconomyWorldRuntime,
  ownerKingdomId?: KingdomId,
): PlacementValidationResult {
  const kId = ownerKingdomId ?? runtime.kingdomId;
  const ledger = resolveKingdomLedger(runtime, kId);
  const bp = BUILDING_CATALOG[archetype];
  const adjustedCost = getAdjustedBuildingCost(archetype, kId);

  if (!bp.buildable) {
    return { valid: false, reason: 'Structure cannot be placed manually.', adjustedCost };
  }
  if (Math.abs(x) > WORLD_PLACEMENT_LIMIT || Math.abs(z) > WORLD_PLACEMENT_LIMIT) {
    return { valid: false, reason: 'Outside kingdom frontier bounds.', adjustedCost };
  }

  const y = sampleTerrainHeight(x, z, runtime.region, runtime.seed);
  if (y < WATER_LEVEL + 0.25) {
    return { valid: false, reason: 'Cannot construct on submerged riverbank or water.', adjustedCost };
  }

  // Check 4 footprint perimeter points too so wide buildings don't overhang into water
  const rCheck = bp.footprintRadius * 0.8;
  for (const [ox, oz] of [
    [rCheck, 0],
    [-rCheck, 0],
    [0, rCheck],
    [0, -rCheck],
  ]) {
    const py = sampleTerrainHeight(x + ox, z + oz, runtime.region, runtime.seed);
    if (py < WATER_LEVEL + 0.15) {
      return { valid: false, reason: 'Building foundation extends into water.', adjustedCost };
    }
  }

  const slope = sampleTerrainSlope(x, z, runtime.region, runtime.seed);
  if (slope > 0.52) {
    return { valid: false, reason: 'Terrain slope is too steep for masonry foundations.', adjustedCost };
  }

  for (let i = 0; i < runtime.buildings.length; i++) {
    const existing = runtime.buildings[i];
    if (existing.constructionState === 'destroyed') continue;
    const minDist = (existing.footprintRadius + bp.footprintRadius) * 0.85 + 0.4;
    if (Math.hypot(x - existing.position.x, z - existing.position.z) < minDist) {
      return { valid: false, reason: `Too close to ${existing.name}.`, adjustedCost };
    }
  }

  for (let i = 0; i < runtime.resourceNodes.length; i++) {
    const node = runtime.resourceNodes[i];
    if (node.nodeKind === 'harvestable_tree' && node.depleted) continue;
    const minDist =
      node.nodeKind === 'harvestable_tree'
        ? node.footprintRadius * 0.55 + bp.footprintRadius * 0.72
        : node.footprintRadius * 0.85 + bp.footprintRadius * 0.75;
    if (Math.hypot(x - node.position.x, z - node.position.z) < minDist) {
      return { valid: false, reason: `Obstructs ${node.name}.`, adjustedCost };
    }
  }

  if (!canAffordCost(ledger.resources, adjustedCost)) {
    return { valid: false, reason: 'Insufficient kingdom resources for construction.', adjustedCost };
  }

  return { valid: true, adjustedCost };
}

export function placeNewBuilding(
  archetype: BuildingArchetype,
  x: number,
  z: number,
  rotationY: number,
  runtime: EconomyWorldRuntime,
  ownerKingdomId?: KingdomId,
): { ok: boolean; building?: BuildingEntity; reason?: string } {
  const kId = ownerKingdomId ?? runtime.kingdomId;
  const ledger = resolveKingdomLedger(runtime, kId);
  const check = validateBuildingPlacement(archetype, x, z, runtime, kId);
  if (!check.valid) {
    if (ledger.isPlayer) {
      pushEconomyNotification(
        runtime,
        `invalid_place_${archetype}`,
        'alert',
        check.reason ?? 'Invalid placement.',
        3,
      );
    }
    return { ok: false, reason: check.reason };
  }

  if (!spendResourcesValidated(runtime, check.adjustedCost, kId)) {
    return { ok: false, reason: 'Insufficient resources.' };
  }

  const bp = BUILDING_CATALOG[archetype];
  const y = sampleTerrainHeight(x, z, runtime.region, runtime.seed);
  const countSameType =
    runtime.buildings.filter((b) => b.kingdomId === kId && b.archetype === archetype).length + 1;

  const newBuilding: BuildingEntity = {
    id: `bld_${kId}_${archetype}_${Date.now()}_${countSameType}_${Math.floor(Math.random() * 1000)}`,
    category: 'building',
    name: countSameType > 1 ? `${bp.name} #${countSameType}` : bp.name,
    archetype,
    buildingClass: bp.buildingClass,
    kingdomId: kId,
    position: { x, y, z },
    rotationY,
    footprintRadius: bp.footprintRadius,
    description: bp.description,
    statusText: 'Planned Foundation · Awaiting Builders',
    integrity: Math.max(50, Math.round(bp.maxIntegrity * 0.15)),
    maxIntegrity: bp.maxIntegrity,
    constructionState: 'planned',
    constructionProgress: 0,
    constructionWorkRequired: bp.constructionWorkRequired,
    constructionCost: { ...check.adjustedCost },
    housingBonus: bp.housingBonus,
    storageBonus: { ...bp.storageBonus },
    acceptsStorage: [...bp.acceptsStorage],
    assignedWorkerIds: [],
    maxWorkers: bp.maxWorkers,
    linkedNodeId: null,
  };

  runtime.buildings.push(newBuilding);
  if (!runtime.newlySpawnedBuildings) {
    runtime.newlySpawnedBuildings = [];
  }
  runtime.newlySpawnedBuildings.push(newBuilding);
  runtime.dirtyBuildingIds.add(newBuilding.id);

  // Automatically alert/assign idle Builders belonging strictly to the owning kingdom
  let autoAssigned = 0;
  for (const v of runtime.characters) {
    if (v.kingdomId === kId && !v.isMilitary && v.health > 0 && v.role === 'Builder' && !v.assignedBuildingId) {
      assignVillagerToConstruction(v, newBuilding, runtime);
      autoAssigned++;
    }
  }

  if (ledger.isPlayer) {
    pushEconomyNotification(
      runtime,
      `placed_${newBuilding.id}`,
      'info',
      autoAssigned > 0
        ? `Placed ${newBuilding.name}. ${autoAssigned} builder(s) dispatched.`
        : `Placed ${newBuilding.name}. Assign a Builder to begin construction.`,
      1,
    );
  }

  return { ok: true, building: newBuilding };
}

export function cancelPlannedOrActiveConstruction(
  buildingId: string,
  runtime: EconomyWorldRuntime,
): boolean {
  const idx = runtime.buildings.findIndex((b) => b.id === buildingId);
  if (idx === -1) return false;
  const bld = runtime.buildings[idx];
  if (bld.constructionState === 'completed') return false;

  const ledger = resolveKingdomLedger(runtime, bld.kingdomId);
  // Refund 75% of spent materials up to storage capacity of owning kingdom
  for (const key of RESOURCE_KEYS) {
    const refund = Math.floor(bld.constructionCost[key] * ECONOMY_RULES.constructionCancelRefundRatio);
    if (refund > 0) {
      ledger.resources[key] = Math.min(ledger.capacities[key], ledger.resources[key] + refund);
    }
  }

  // Unassign any builders targeting this site
  for (const c of runtime.characters) {
    if (c.assignedBuildingId === bld.id) {
      c.assignedBuildingId = null;
      c.taskType = 'idle';
      c.activityLabel = 'Construction cancelled · Awaiting next site';
    }
  }

  bld.constructionState = 'destroyed';
  runtime.buildings.splice(idx, 1);
  runtime.dirtyBuildingIds.add(buildingId);
  if (ledger.isPlayer) {
    pushEconomyNotification(
      runtime,
      `cancel_${buildingId}`,
      'info',
      `Cancelled ${bld.name} (75% materials refunded).`,
      1,
    );
  }
  return true;
}

function detachVillagerReservations(v: CharacterEntity, runtime: EconomyWorldRuntime): void {
  if (v.assignedNodeId) {
    const node = runtime.resourceNodes.find((n) => n.id === v.assignedNodeId);
    if (node) {
      node.activeHarvesterIds = node.activeHarvesterIds.filter((id) => id !== v.id);
    }
    v.assignedNodeId = null;
  }
  if (v.assignedBuildingId) {
    const bld = runtime.buildings.find((b) => b.id === v.assignedBuildingId);
    if (bld) {
      bld.assignedWorkerIds = bld.assignedWorkerIds.filter((id) => id !== v.id);
    }
    v.assignedBuildingId = null;
  }
  v.deliveryBuildingId = null;
  v.moveTarget = null;
  v.workProgress = 0;
}

export function assignVillagerOccupation(
  villager: CharacterEntity,
  newRole: CivilianRole,
  runtime: EconomyWorldRuntime,
  preferredResource?: ResourceKey | null,
  silent = false,
): void {
  detachVillagerReservations(villager, runtime);

  const occ = OCCUPATION_CONFIGS[newRole];
  const bonus = KINGDOM_ECONOMIC_BONUSES[villager.kingdomId];
  const ledger = resolveKingdomLedger(runtime, villager.kingdomId);
  villager.role = newRole;
  villager.propType = occ.defaultProp;
  villager.carryCapacity = occ.carryCapacity;
  villager.preferredResource =
    preferredResource !== undefined ? preferredResource : occ.primaryResource;
  villager.tunicColor =
    newRole === 'Unemployed' ? '#8a7962' : occ.tunicTint;

  // Compute role productivity multiplier from kingdom identity
  let prod = 1.0;
  if (newRole === 'Woodcutter') prod = bonus.woodGatherMult;
  else if (newRole === 'Miner') prod = bonus.miningGatherMult;
  else if (newRole === 'Farmer') prod = bonus.farmingGatherMult;
  else if (newRole === 'Hunter' || newRole === 'Fisherman') prod = bonus.huntingFishingMult;
  else if (newRole === 'Builder') prod = bonus.constructionSpeedMult;
  else if (newRole === 'Trader') prod = bonus.traderGoldMult;
  villager.productivity = prod;

  // If carrying a resource from previous role, deliver it first if any; otherwise start fresh task
  if (villager.carriedAmount > 0 && villager.carriedResource) {
    villager.taskType = 'deliver_resource';
  } else {
    villager.taskType = 'idle';
  }

  villager.activityLabel =
    newRole === 'Unemployed'
      ? 'Unemployed · Standing by'
      : `Assigned as ${newRole}`;

  recalculateCapacitiesAndPopulation(runtime, villager.kingdomId);

  if (!silent && ledger.isPlayer) {
    pushEconomyNotification(
      runtime,
      `assign_${villager.id}_${newRole}`,
      'info',
      `${villager.name} assigned as ${newRole}.`,
      2,
    );
  }
}

export function assignVillagerToConstruction(
  villager: CharacterEntity,
  building: BuildingEntity,
  runtime: EconomyWorldRuntime,
): void {
  if (villager.role !== 'Builder') {
    assignVillagerOccupation(villager, 'Builder', runtime, null, true);
  } else {
    detachVillagerReservations(villager, runtime);
  }
  villager.assignedBuildingId = building.id;
  if (!building.assignedWorkerIds.includes(villager.id)) {
    building.assignedWorkerIds.push(villager.id);
  }
  villager.taskType = 'construct_building';
  villager.activityLabel = `Heading to construct ${building.name}`;
}

export function commandVillagerMove(
  villager: CharacterEntity,
  x: number,
  z: number,
  runtime: EconomyWorldRuntime,
): void {
  detachVillagerReservations(villager, runtime);
  const clampedX = Math.max(-WORLD_PLACEMENT_LIMIT, Math.min(WORLD_PLACEMENT_LIMIT, x));
  const clampedZ = Math.max(-WORLD_PLACEMENT_LIMIT, Math.min(WORLD_PLACEMENT_LIMIT, z));
  villager.moveTarget = { x: clampedX, z: clampedZ };
  villager.taskType = 'move_to';
  villager.activityLabel = `Moving to (${Math.round(clampedX)}, ${Math.round(clampedZ)})`;
}

export function cancelVillagerTask(
  villager: CharacterEntity,
  runtime: EconomyWorldRuntime,
): void {
  detachVillagerReservations(villager, runtime);
  villager.role = 'Unemployed';
  villager.propType = OCCUPATION_CONFIGS.Unemployed.defaultProp;
  villager.productivity = 1.0;
  villager.taskType = 'idle';
  villager.animationState = 'idle';
  villager.speed = 0;
  villager.activityLabel = 'Task cancelled · Unemployed';
  recalculateCapacitiesAndPopulation(runtime, villager.kingdomId);
}

export function commandVillagersToEntity(
  villagers: CharacterEntity[],
  target: SelectableEntity,
  runtime: EconomyWorldRuntime,
): string | null {
  if (villagers.length === 0) return null;

  if (target.category === 'resource_node') {
    let role: CivilianRole = 'Miner';
    if (target.nodeKind === 'harvestable_tree' || target.nodeKind === 'timber_grove') {
      role = 'Woodcutter';
    } else if (target.nodeKind === 'fertile_fishery') {
      role = 'Fisherman';
    } else if (target.nodeKind === 'hunting_ground') {
      role = 'Hunter';
    } else {
      role = 'Miner';
    }

    for (const v of villagers) {
      assignVillagerOccupation(v, role, runtime, target.resourceType, true);
      if (!target.depleted && target.remainingYield > 0) {
        v.assignedNodeId = target.id;
        if (!target.activeHarvesterIds.includes(v.id)) {
          target.activeHarvesterIds.push(v.id);
        }
        v.taskType = 'gather_node';
        v.activityLabel = `Harvesting ${target.name}`;
      }
    }
    return `Assigned ${villagers.length} villager(s) to ${target.name} (${role}).`;
  }

  if (target.category === 'building') {
    if (target.constructionState !== 'completed') {
      for (const v of villagers) {
        assignVillagerToConstruction(v, target, runtime);
      }
      return `Dispatched ${villagers.length} builder(s) to construct ${target.name}.`;
    }

    if (target.archetype === 'cultivated_farm') {
      for (const v of villagers) {
        assignVillagerOccupation(v, 'Farmer', runtime, 'food', true);
        v.assignedBuildingId = target.id;
        if (!target.assignedWorkerIds.includes(v.id)) {
          target.assignedWorkerIds.push(v.id);
        }
        v.taskType = 'work_farm';
        v.activityLabel = `Cultivating ${target.name}`;
      }
      return `Assigned ${villagers.length} farmer(s) to ${target.name}.`;
    }

    if (target.archetype === 'market_courtyard') {
      for (const v of villagers) {
        assignVillagerOccupation(v, 'Trader', runtime, 'gold', true);
        v.assignedBuildingId = target.id;
        if (!target.assignedWorkerIds.includes(v.id)) {
          target.assignedWorkerIds.push(v.id);
        }
        v.taskType = 'trade_exchange';
      }
      return `Assigned ${villagers.length} trader(s) to ${target.name}.`;
    }

    if (
      target.archetype === 'blacksmith_workshop' ||
      target.archetype === 'weapon_workshop'
    ) {
      for (const v of villagers) {
        assignVillagerOccupation(v, 'Craftsperson', runtime, 'iron', true);
        v.assignedBuildingId = target.id;
        if (!target.assignedWorkerIds.includes(v.id)) {
          target.assignedWorkerIds.push(v.id);
        }
        v.taskType = 'craft_workshop';
      }
      return `Assigned ${villagers.length} craftsperson(s) to ${target.name}.`;
    }

    if (target.archetype === 'mine_pit') {
      for (const v of villagers) {
        assignVillagerOccupation(v, 'Miner', runtime, null, true);
      }
      return `Assigned ${villagers.length} miner(s) near ${target.name}.`;
    }

    // If villager is carrying goods and clicks a valid storage building, deliver immediately
    let deliveredCount = 0;
    for (const v of villagers) {
      if (
        v.carriedAmount > 0 &&
        v.carriedResource &&
        target.acceptsStorage.includes(v.carriedResource)
      ) {
        v.deliveryBuildingId = target.id;
        v.taskType = 'deliver_resource';
        deliveredCount++;
      }
    }
    if (deliveredCount > 0) {
      return `Delivering carried resources to ${target.name}.`;
    }
  }

  return null;
}

function findNearestStorageBuilding(
  villager: CharacterEntity,
  resource: ResourceKey,
  runtime: EconomyWorldRuntime,
): BuildingEntity | null {
  let best: BuildingEntity | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < runtime.buildings.length; i++) {
    const b = runtime.buildings[i];
    if (b.kingdomId !== villager.kingdomId) continue;
    if (b.constructionState !== 'completed') continue;
    if (!b.acceptsStorage.includes(resource)) continue;
    // Prefer dedicated storage buildings slightly over the universal compound when nearby
    const rawDist = Math.hypot(
      b.position.x - villager.position.x,
      b.position.z - villager.position.z,
    );
    const score = b.archetype === 'royal_compound' ? rawDist + 3.5 : rawDist;
    if (score < bestDist) {
      bestDist = score;
      best = b;
    }
  }
  return best;
}

function findBestNodeForVillager(
  villager: CharacterEntity,
  runtime: EconomyWorldRuntime,
): EnvironmentNodeEntity | null {
  let allowedKinds: EnvironmentNodeEntity['nodeKind'][] = [];
  if (villager.role === 'Woodcutter') {
    allowedKinds = ['harvestable_tree', 'timber_grove'];
  } else if (villager.role === 'Miner') {
    if (villager.preferredResource === 'gold') allowedKinds = ['gold_outcrop', 'iron_deposit', 'stone_quarry'];
    else if (villager.preferredResource === 'iron') allowedKinds = ['iron_deposit', 'stone_quarry', 'gold_outcrop'];
    else allowedKinds = ['stone_quarry', 'iron_deposit', 'gold_outcrop'];
  } else if (villager.role === 'Hunter') {
    allowedKinds = ['hunting_ground'];
  } else if (villager.role === 'Fisherman') {
    allowedKinds = ['fertile_fishery'];
  } else {
    return null;
  }

  const ledger = resolveKingdomLedger(runtime, villager.kingdomId);
  let bestNode: EnvironmentNodeEntity | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < runtime.resourceNodes.length; i++) {
    const n = runtime.resourceNodes[i];
    if (!allowedKinds.includes(n.nodeKind)) continue;
    if (n.depleted || n.remainingYield <= 0.05) continue;
    if (n.ownerKingdomId && n.ownerKingdomId !== villager.kingdomId) continue;

    // Skip if storage for this node's resource is completely full (unless miner can switch mineral!)
    if (ledger.resources[n.resourceType] >= ledger.capacities[n.resourceType] - 0.01) {
      continue;
    }

    const activeOther = n.activeHarvesterIds.filter((id) => id !== villager.id).length;
    if (activeOther >= n.maxHarvesters) continue;

    const dist = Math.hypot(
      n.position.x - villager.position.x,
      n.position.z - villager.position.z,
    );
    const prefPenalty =
      villager.role === 'Miner' &&
      villager.preferredResource &&
      n.resourceType !== villager.preferredResource
        ? 35
        : 0;
    const crowdPenalty = activeOther * 6.5;
    // Prefer individual fellable trees slightly so player sees active tree felling near town
    const treePreference = n.nodeKind === 'harvestable_tree' ? -4.0 : 0;

    const score = dist + prefPenalty + crowdPenalty + treePreference;
    if (score < bestScore) {
      bestScore = score;
      bestNode = n;
    }
  }

  return bestNode;
}

function findBestBuildingWorkplace(
  villager: CharacterEntity,
  archetypes: BuildingArchetype[],
  requireCompleted: boolean,
  runtime: EconomyWorldRuntime,
): BuildingEntity | null {
  let best: BuildingEntity | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < runtime.buildings.length; i++) {
    const b = runtime.buildings[i];
    if (b.kingdomId !== villager.kingdomId) continue;
    if (!archetypes.includes(b.archetype)) continue;
    if (requireCompleted && b.constructionState !== 'completed') continue;
    if (!requireCompleted && b.constructionState === 'completed') continue;

    const activeOther = b.assignedWorkerIds.filter((id) => id !== villager.id).length;
    if (requireCompleted && b.maxWorkers > 0 && activeOther >= b.maxWorkers) continue;

    const dist = Math.hypot(
      b.position.x - villager.position.x,
      b.position.z - villager.position.z,
    );
    const score = dist + activeOther * 7;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

/**
 * Obstacle-aware movement step preventing villagers from walking through solid structures
 * or submerging into deep river/harbour water, plus gentle neighbor separation.
 */
function moveVillagerToward(
  v: CharacterEntity,
  goalX: number,
  goalZ: number,
  stopRadius: number,
  dt: number,
  runtime: EconomyWorldRuntime,
  ignoreBuildingId?: string | null,
  run = false,
): boolean {
  const dx = goalX - v.position.x;
  const dz = goalZ - v.position.z;
  const dist = Math.hypot(dx, dz);

  if (dist <= Math.max(ARRIVAL_TOLERANCE, stopRadius)) {
    v.speed = 0;
    const faceAngle = Math.atan2(dx, dz);
    if (dist > 0.02) {
      v.rotationY = faceAngle;
    }
    return true;
  }

  const moveMult = KINGDOM_ECONOMIC_BONUSES[v.kingdomId].villagerMoveSpeedMult;
  const desiredSpeed = (run ? BASE_RUN_SPEED : BASE_WALK_SPEED) * moveMult;

  let dirX = dx / dist;
  let dirZ = dz / dist;

  // Building collision avoidance (cultivated farms are walkable fields)
  for (let i = 0; i < runtime.buildings.length; i++) {
    const b = runtime.buildings[i];
    if (b.archetype === 'cultivated_farm') continue;
    if (ignoreBuildingId && b.id === ignoreBuildingId) continue;

    const avoidRadius = b.footprintRadius + 0.62;
    const vx = v.position.x - b.position.x;
    const vz = v.position.z - b.position.z;
    const bDist = Math.hypot(vx, vz);

    if (bDist < avoidRadius + 1.35 && bDist > 0.001) {
      const nx = vx / bDist;
      const nz = vz / bDist;
      // Dot product: only deflect if heading into the building
      const into = dirX * -nx + dirZ * -nz;
      if (into > -0.15) {
        // Choose tangent direction closer to goal
        const tan1X = -nz;
        const tan1Z = nx;
        const tan2X = nz;
        const tan2Z = -nx;
        const dot1 = tan1X * dirX + tan1Z * dirZ;
        const tx = dot1 >= 0 ? tan1X : tan2X;
        const tz = dot1 >= 0 ? tan1Z : tan2Z;
        const push = Math.max(0, (avoidRadius + 1.35 - bDist) / 1.35);
        dirX = dirX * (1 - push * 0.8) + (tx * 0.85 + nx * 0.45) * push;
        dirZ = dirZ * (1 - push * 0.8) + (tz * 0.85 + nz * 0.45) * push;
      }
    }
  }

  // Light villager separation so multiple workers don't stack on exact same coordinate
  for (let i = 0; i < runtime.characters.length; i++) {
    const other = runtime.characters[i];
    if (other.id === v.id) continue;
    const sx = v.position.x - other.position.x;
    const sz = v.position.z - other.position.z;
    const sDist = Math.hypot(sx, sz);
    if (sDist > 0.001 && sDist < 0.85) {
      const repel = (0.85 - sDist) * 0.55;
      dirX += (sx / sDist) * repel;
      dirZ += (sz / sDist) * repel;
    }
  }

  const len = Math.hypot(dirX, dirZ) || 1;
  dirX /= len;
  dirZ /= len;

  const stepDist = Math.min(dist - stopRadius * 0.85, desiredSpeed * dt);
  const actualStep = Math.max(0.01, Math.min(desiredSpeed * dt, stepDist > 0 ? stepDist : desiredSpeed * dt));

  let nextX = v.position.x + dirX * actualStep;
  let nextZ = v.position.z + dirZ * actualStep;
  let nextY = sampleTerrainHeight(nextX, nextZ, runtime.region, runtime.seed);

  // Prevent walking into deep river water; slide along bank if needed
  if (nextY < WATER_LEVEL - 0.08) {
    const altX = v.position.x + dirX * actualStep;
    const altY1 = sampleTerrainHeight(altX, v.position.z, runtime.region, runtime.seed);
    const altZ = v.position.z + dirZ * actualStep;
    const altY2 = sampleTerrainHeight(v.position.x, altZ, runtime.region, runtime.seed);
    if (altY1 >= WATER_LEVEL - 0.08) {
      nextZ = v.position.z;
      nextY = altY1;
    } else if (altY2 >= WATER_LEVEL - 0.08) {
      nextX = v.position.x;
      nextY = altY2;
    } else {
      // Pull slightly upslope toward owning kingdom's settlement center
      const center = resolveKingdomLedger(runtime, v.kingdomId).settlementCenter;
      const toCenterX = center.x - v.position.x;
      const toCenterZ = center.z - v.position.z;
      const toCenterLen = Math.hypot(toCenterX, toCenterZ) || 1;
      nextX = v.position.x + (toCenterX / toCenterLen) * actualStep;
      nextZ = v.position.z + (toCenterZ / toCenterLen) * actualStep;
      nextY = sampleTerrainHeight(nextX, nextZ, runtime.region, runtime.seed);
    }
  }

  // Final hard push-out from solid building footprints
  for (let i = 0; i < runtime.buildings.length; i++) {
    const b = runtime.buildings[i];
    if (b.archetype === 'cultivated_farm') continue;
    if (ignoreBuildingId && b.id === ignoreBuildingId) continue;
    const minR = b.footprintRadius + 0.42;
    const bx = nextX - b.position.x;
    const bz = nextZ - b.position.z;
    const bd = Math.hypot(bx, bz);
    if (bd < minR && bd > 0.0001) {
      nextX = b.position.x + (bx / bd) * minR;
      nextZ = b.position.z + (bz / bd) * minR;
      nextY = sampleTerrainHeight(nextX, nextZ, runtime.region, runtime.seed);
    }
  }

  const moved = Math.hypot(nextX - v.position.x, nextZ - v.position.z);
  v.position.x = nextX;
  v.position.z = nextZ;
  v.position.y = Math.max(WATER_LEVEL + 0.04, nextY);

  const desiredYaw = Math.atan2(dirX, dirZ);
  const turnAlpha = 1 - Math.exp(-11 * dt);
  v.rotationY += shortestAngleDelta(v.rotationY, desiredYaw) * turnAlpha;

  v.speed = moved / dt;
  v.animationState = run ? 'running' : 'walking';
  v.gaitPhase += moved * (run ? 2.55 : 3.15);

  return Math.hypot(goalX - v.position.x, goalZ - v.position.z) <= Math.max(ARRIVAL_TOLERANCE, stopRadius);
}

function stepSingleVillager(v: CharacterEntity, dt: number, runtime: EconomyWorldRuntime): void {
  if (v.isMilitary || v.health <= 0) return;

  const ledger = resolveKingdomLedger(runtime, v.kingdomId);

  // 1. Direct player/kingdom move command takes top priority until arrival
  if (v.taskType === 'move_to' && v.moveTarget) {
    const arrived = moveVillagerToward(
      v,
      v.moveTarget.x,
      v.moveTarget.z,
      0.45,
      dt,
      runtime,
      null,
      false,
    );
    if (arrived) {
      v.moveTarget = null;
      v.taskType = 'idle';
      v.animationState = 'idle';
      v.speed = 0;
      v.activityLabel =
        v.role === 'Unemployed'
          ? 'Arrived · Awaiting orders'
          : `Arrived · Resuming ${v.role.toLowerCase()} duties`;
      v.waitTimer = 0.6;
    }
    return;
  }

  // Brief natural pause between state transitions
  if (v.waitTimer > 0) {
    v.waitTimer = Math.max(0, v.waitTimer - dt);
    v.animationState = 'idle';
    v.speed = 0;
    v.gaitPhase += dt * 1.7;
    return;
  }

  // 2. Delivering carried resources to valid storage building
  if (v.taskType === 'deliver_resource') {
    if (!v.carriedResource || v.carriedAmount <= 0.01) {
      v.carriedResource = null;
      v.carriedAmount = 0;
      v.deliveryBuildingId = null;
      v.taskType = 'idle';
      return;
    }

    let storage = v.deliveryBuildingId
      ? runtime.buildings.find(
          (b) =>
            b.id === v.deliveryBuildingId &&
            b.kingdomId === v.kingdomId &&
            b.constructionState === 'completed',
        ) ?? null
      : null;

    if (!storage) {
      storage = findNearestStorageBuilding(v, v.carriedResource, runtime);
      v.deliveryBuildingId = storage?.id ?? null;
    }

    if (!storage) {
      v.animationState = 'idle';
      v.speed = 0;
      v.gaitPhase += dt * 1.5;
      v.activityLabel = `No storage building available for ${v.carriedResource}`;
      return;
    }

    // Check if storage is completely full before or upon arrival
    if (ledger.resources[v.carriedResource] >= ledger.capacities[v.carriedResource] - 0.01) {
      v.animationState = 'idle';
      v.speed = 0;
      v.gaitPhase += dt * 1.5;
      const rName = v.carriedResource.charAt(0).toUpperCase() + v.carriedResource.slice(1);
      v.activityLabel = `Paused — ${rName} storage full`;
      depositResourceValidated(runtime, v.carriedResource, v.carriedAmount, v.kingdomId);
      return;
    }

    v.activityLabel = `Hauling ${Math.round(v.carriedAmount)} ${v.carriedResource} to ${storage.name}`;
    const arrived = moveVillagerToward(
      v,
      storage.position.x,
      storage.position.z,
      storage.footprintRadius + 0.95,
      dt,
      runtime,
      storage.id,
      false,
    );

    if (arrived) {
      const deposited = depositResourceValidated(
        runtime,
        v.carriedResource,
        v.carriedAmount,
        v.kingdomId,
      );
      v.carriedAmount = Math.max(0, v.carriedAmount - deposited);
      if (v.carriedAmount <= 0.05) {
        v.carriedAmount = 0;
        v.carriedResource = null;
        v.deliveryBuildingId = null;
        v.taskType = 'idle';
        v.waitTimer = 0.45;
        v.animationState = 'idle';
        v.activityLabel = `Delivered goods to ${storage.name}`;
      }
    }
    return;
  }

  // 3. Unemployed villagers stroll gently near settlement plaza or stand ready
  if (v.role === 'Unemployed') {
    v.animationState = 'idle';
    v.speed = 0;
    v.gaitPhase += dt * 1.6;
    v.activityLabel = 'Unemployed · Select to assign occupation';
    return;
  }

  // 4. Builder logic: construct planned/under_construction buildings, or repair damaged structures
  if (v.role === 'Builder') {
    let site = v.assignedBuildingId
      ? runtime.buildings.find((b) => b.id === v.assignedBuildingId) ?? null
      : null;

    if (!site || site.constructionState === 'completed' || site.constructionState === 'destroyed') {
      if (v.assignedBuildingId) {
        v.assignedBuildingId = null;
      }
      site = findBestBuildingWorkplace(
        v,
        Object.keys(BUILDING_CATALOG) as BuildingArchetype[],
        false,
        runtime,
      );
      if (site) {
        v.assignedBuildingId = site.id;
        if (!site.assignedWorkerIds.includes(v.id)) {
          site.assignedWorkerIds.push(v.id);
        }
      }
    }

    if (site && site.constructionState !== 'completed') {
      v.taskType = 'construct_building';
      const arrived = moveVillagerToward(
        v,
        site.position.x,
        site.position.z,
        site.footprintRadius + 0.85,
        dt,
        runtime,
        site.id,
        false,
      );

      if (!arrived) {
        v.activityLabel = `Walking to build ${site.name}`;
        return;
      }

      if (site.constructionState === 'planned') {
        site.constructionState = 'under_construction';
        runtime.dirtyBuildingIds.add(site.id);
      }

      v.animationState = 'building';
      v.speed = 0;
      v.gaitPhase += dt * 6.5;

      const workDelta = dt * OCCUPATION_CONFIGS.Builder.baseGatherRatePerSec * v.productivity;
      const prevBucket = Math.floor(site.constructionProgress * 20);
      site.constructionProgress = Math.min(
        1,
        site.constructionProgress + workDelta / Math.max(1, site.constructionWorkRequired),
      );
      site.integrity = Math.min(
        site.maxIntegrity,
        Math.round(site.maxIntegrity * (0.15 + 0.85 * site.constructionProgress)),
      );
      const pct = Math.round(site.constructionProgress * 100);
      site.statusText = `Under Construction · ${pct}% (${site.assignedWorkerIds.length} Builder${site.assignedWorkerIds.length === 1 ? '' : 's'})`;
      v.activityLabel = `Constructing ${site.name} (${pct}%)`;

      if (Math.floor(site.constructionProgress * 20) !== prevBucket) {
        runtime.dirtyBuildingIds.add(site.id);
      }

      if (site.constructionProgress >= 1) {
        site.constructionState = 'completed';
        site.constructionProgress = 1;
        site.integrity = site.maxIntegrity;
        site.assignedWorkerIds = [];
        site.statusText = `${BUILDING_CATALOG[site.archetype].economicRoleSummary}`;
        runtime.dirtyBuildingIds.add(site.id);
        ledger.economyStats.buildingsConstructed += 1;
        v.assignedBuildingId = null;
        v.taskType = 'idle';
        v.waitTimer = 0.6;
        v.animationState = 'idle';
        recalculateCapacitiesAndPopulation(runtime, site.kingdomId);
        if (ledger.isPlayer) {
          pushEconomyNotification(
            runtime,
            `completed_${site.id}`,
            'success',
            `Construction completed: ${site.name}!`,
            1,
          );
        }
      }
      return;
    }

    // Check if any completed building owned by this kingdom needs repair
    const damaged = runtime.buildings.find(
      (b) =>
        b.kingdomId === v.kingdomId &&
        b.constructionState === 'completed' &&
        b.integrity < b.maxIntegrity,
    );
    if (damaged) {
      const arrived = moveVillagerToward(
        v,
        damaged.position.x,
        damaged.position.z,
        damaged.footprintRadius + 0.85,
        dt,
        runtime,
        damaged.id,
        false,
      );
      if (arrived) {
        v.animationState = 'building';
        v.gaitPhase += dt * 6.0;
        damaged.integrity = Math.min(damaged.maxIntegrity, damaged.integrity + dt * 18);
        v.activityLabel = `Repairing ${damaged.name}`;
      } else {
        v.activityLabel = `Heading to repair ${damaged.name}`;
      }
      return;
    }

    v.taskType = 'idle';
    v.animationState = 'idle';
    v.speed = 0;
    v.gaitPhase += dt * 1.6;
    v.activityLabel = 'Standing by for construction orders';
    return;
  }

  // 5. Farmer logic: cultivate completed Farm buildings -> haul food to Granary/Compound
  if (v.role === 'Farmer') {
    if (ledger.resources.food >= ledger.capacities.food - 0.01) {
      v.animationState = 'idle';
      v.speed = 0;
      v.gaitPhase += dt * 1.5;
      v.activityLabel = 'Paused — Food storage full';
      if (ledger.isPlayer) {
        pushEconomyNotification(
          runtime,
          'storage_full_food',
          'warning',
          'Food storage full! Construct a Granary to expand capacity.',
          18,
        );
      }
      return;
    }

    let farm = v.assignedBuildingId
      ? runtime.buildings.find(
          (b) =>
            b.id === v.assignedBuildingId &&
            b.archetype === 'cultivated_farm' &&
            b.constructionState === 'completed',
        ) ?? null
      : null;

    if (!farm) {
      farm = findBestBuildingWorkplace(v, ['cultivated_farm'], true, runtime);
      if (farm) {
        v.assignedBuildingId = farm.id;
        if (!farm.assignedWorkerIds.includes(v.id)) {
          farm.assignedWorkerIds.push(v.id);
        }
      }
    }

    if (!farm) {
      v.animationState = 'idle';
      v.speed = 0;
      v.gaitPhase += dt * 1.5;
      v.activityLabel = 'No available Cultivated Farm — build a Farm';
      return;
    }

    v.taskType = 'work_farm';
    // Offset farmer position inside the farm plot based on worker slot so multiple farmers spread across furrows
    const slotIdx = Math.max(0, farm.assignedWorkerIds.indexOf(v.id));
    const offsetAngle = slotIdx * 2.1 + 0.5;
    const workX = farm.position.x + Math.cos(offsetAngle) * 1.8;
    const workZ = farm.position.z + Math.sin(offsetAngle) * 1.5;

    const arrived = moveVillagerToward(v, workX, workZ, 0.55, dt, runtime, farm.id, false);
    if (!arrived) {
      v.activityLabel = `Walking to ${farm.name}`;
      return;
    }

    v.animationState = 'farming';
    v.speed = 0;
    v.gaitPhase += dt * 4.8;
    const rate = OCCUPATION_CONFIGS.Farmer.baseGatherRatePerSec * v.productivity;
    v.carriedResource = 'food';
    v.carriedAmount = Math.min(v.carryCapacity, v.carriedAmount + rate * dt);
    v.activityLabel = `Tending crops at ${farm.name} (${Math.floor(v.carriedAmount)}/${v.carryCapacity} Food)`;

    if (v.carriedAmount >= v.carryCapacity) {
      v.taskType = 'deliver_resource';
      v.deliveryBuildingId = null;
    }
    return;
  }

  // 6. Trader logic: exchange shuttle between Marketplace and Royal Compound / Palace
  if (v.role === 'Trader') {
    if (ledger.resources.gold >= ledger.capacities.gold - 0.01) {
      v.animationState = 'idle';
      v.speed = 0;
      v.gaitPhase += dt * 1.5;
      v.activityLabel = 'Paused — Gold treasury full';
      return;
    }

    let market = v.assignedBuildingId
      ? runtime.buildings.find(
          (b) =>
            b.id === v.assignedBuildingId &&
            b.kingdomId === v.kingdomId &&
            b.archetype === 'market_courtyard' &&
            b.constructionState === 'completed',
        ) ?? null
      : null;

    if (!market) {
      market = findBestBuildingWorkplace(v, ['market_courtyard'], true, runtime);
      if (market) {
        v.assignedBuildingId = market.id;
        if (!market.assignedWorkerIds.includes(v.id)) {
          market.assignedWorkerIds.push(v.id);
        }
      }
    }

    if (!market) {
      v.animationState = 'idle';
      v.speed = 0;
      v.gaitPhase += dt * 1.5;
      v.activityLabel = 'Requires a completed Marketplace';
      return;
    }

    v.taskType = 'trade_exchange';
    const arrived = moveVillagerToward(
      v,
      market.position.x,
      market.position.z,
      market.footprintRadius * 0.75,
      dt,
      runtime,
      market.id,
      false,
    );

    if (!arrived) {
      v.activityLabel = `Travelling to ${market.name}`;
      return;
    }

    v.animationState = 'crafting';
    v.speed = 0;
    v.gaitPhase += dt * 3.8;
    const rate =
      OCCUPATION_CONFIGS.Trader.baseGatherRatePerSec *
      v.productivity *
      (ledger.tradeIncomeBonusMult || 1.0);
    v.carriedResource = 'gold';
    v.carriedAmount = Math.min(v.carryCapacity, v.carriedAmount + rate * dt);
    v.activityLabel = `Bartering goods at ${market.name} (${Math.floor(v.carriedAmount)}/${v.carryCapacity} Gold)`;

    if (v.carriedAmount >= v.carryCapacity) {
      // Deliver tariff gold to owning kingdom's Compound / Palace / Treasury
      const royalDrop =
        runtime.buildings.find(
          (b) =>
            b.kingdomId === v.kingdomId &&
            b.constructionState === 'completed' &&
            (b.archetype === 'royal_treasury' ||
              b.archetype === 'royal_palace' ||
              b.archetype === 'royal_compound'),
        ) ?? null;
      v.deliveryBuildingId = royalDrop?.id ?? null;
      v.taskType = 'deliver_resource';
    }
    return;
  }

  // 7. Craftsperson logic: forge work at Blacksmith / Weapon Workshop (or Compound hearth)
  if (v.role === 'Craftsperson') {
    const outRes: ResourceKey =
      ledger.resources.iron < ledger.capacities.iron - 1 ? 'iron' : 'gold';
    if (ledger.resources[outRes] >= ledger.capacities[outRes] - 0.01) {
      v.animationState = 'idle';
      v.speed = 0;
      v.gaitPhase += dt * 1.5;
      v.activityLabel = `Paused — ${outRes} storage full`;
      return;
    }

    let workshop = v.assignedBuildingId
      ? runtime.buildings.find(
          (b) =>
            b.id === v.assignedBuildingId &&
            b.kingdomId === v.kingdomId &&
            b.constructionState === 'completed',
        ) ?? null
      : null;

    if (!workshop) {
      workshop =
        findBestBuildingWorkplace(
          v,
          ['blacksmith_workshop', 'weapon_workshop'],
          true,
          runtime,
        ) ??
        findBestBuildingWorkplace(v, ['royal_compound'], true, runtime);
      if (workshop) {
        v.assignedBuildingId = workshop.id;
        if (!workshop.assignedWorkerIds.includes(v.id)) {
          workshop.assignedWorkerIds.push(v.id);
        }
      }
    }

    if (!workshop) {
      v.animationState = 'idle';
      v.activityLabel = 'Requires a Blacksmith Workshop';
      return;
    }

    v.taskType = 'craft_workshop';
    const isDedicatedForge = workshop.archetype !== 'royal_compound';
    const arrived = moveVillagerToward(
      v,
      workshop.position.x,
      workshop.position.z,
      workshop.footprintRadius + 0.65,
      dt,
      runtime,
      workshop.id,
      false,
    );

    if (!arrived) {
      v.activityLabel = `Walking to ${workshop.name}`;
      return;
    }

    v.animationState = 'crafting';
    v.speed = 0;
    v.gaitPhase += dt * 5.6;
    const forgeMult = isDedicatedForge ? 1.35 : 0.75;
    const rate = OCCUPATION_CONFIGS.Craftsperson.baseGatherRatePerSec * forgeMult * v.productivity;
    v.carriedResource = outRes;
    v.carriedAmount = Math.min(v.carryCapacity, v.carriedAmount + rate * dt);
    v.activityLabel = `Forging metalwork at ${workshop.name} (${Math.floor(v.carriedAmount)}/${v.carryCapacity})`;

    if (v.carriedAmount >= v.carryCapacity) {
      v.taskType = 'deliver_resource';
      v.deliveryBuildingId = null;
    }
    return;
  }

  // 8. Node Gatherers: Woodcutter, Miner, Hunter, Fisherman
  let node = v.assignedNodeId
    ? runtime.resourceNodes.find((n) => n.id === v.assignedNodeId) ?? null
    : null;

  if (!node || node.depleted || node.remainingYield <= 0.05) {
    if (node) {
      node.activeHarvesterIds = node.activeHarvesterIds.filter((id) => id !== v.id);
    }
    v.assignedNodeId = null;

    // If already carrying meaningful load when node depleted, haul it in first!
    if (v.carriedAmount >= 1 && v.carriedResource) {
      v.taskType = 'deliver_resource';
      return;
    }

    node = findBestNodeForVillager(v, runtime);
    if (node) {
      v.assignedNodeId = node.id;
      if (!node.activeHarvesterIds.includes(v.id)) {
        node.activeHarvesterIds.push(v.id);
      }
    }
  }

  if (!node) {
    v.animationState = 'idle';
    v.speed = 0;
    v.gaitPhase += dt * 1.5;
    const targetRes = v.preferredResource ?? OCCUPATION_CONFIGS[v.role].primaryResource;
    if (targetRes && ledger.resources[targetRes] >= ledger.capacities[targetRes] - 0.01) {
      const rName = targetRes.charAt(0).toUpperCase() + targetRes.slice(1);
      v.activityLabel = `Paused — ${rName} storage full`;
    } else {
      v.activityLabel = `No available ${v.role.toLowerCase()} resource site`;
    }
    return;
  }

  // Stop gathering if kingdom storage for this node's resource is full
  if (ledger.resources[node.resourceType] >= ledger.capacities[node.resourceType] - 0.01) {
    v.animationState = 'idle';
    v.speed = 0;
    v.gaitPhase += dt * 1.5;
    const rName = node.resourceType.charAt(0).toUpperCase() + node.resourceType.slice(1);
    v.activityLabel = `Paused — ${rName} storage full`;
    return;
  }

  // If carrying a DIFFERENT resource from an earlier task, deliver it first
  if (v.carriedResource && v.carriedResource !== node.resourceType && v.carriedAmount > 0.05) {
    v.taskType = 'deliver_resource';
    return;
  }

  v.taskType = 'gather_node';
  const arrived = moveVillagerToward(
    v,
    node.position.x,
    node.position.z,
    node.interactionRadius,
    dt,
    runtime,
    null,
    v.role === 'Hunter', // Hunters jog swiftly to hunting grounds!
  );

  if (!arrived) {
    v.activityLabel = `Travelling to ${node.name}`;
    return;
  }

  // Perform occupation-specific physical gathering animation
  v.speed = 0;
  if (v.role === 'Woodcutter') {
    v.animationState = 'chopping';
    v.gaitPhase += dt * 6.2;
  } else if (v.role === 'Miner') {
    v.animationState = 'mining';
    v.gaitPhase += dt * 5.8;
  } else if (v.role === 'Hunter') {
    v.animationState = 'hunting';
    v.gaitPhase += dt * 4.2;
  } else {
    v.animationState = 'fishing';
    v.gaitPhase += dt * 3.6;
  }

  // Nearby completed Mine Pit owned by this kingdom boosts mineral extraction speed by +25%
  let localMineBoost = 1.0;
  if (v.role === 'Miner') {
    const hasNearbyMine = runtime.buildings.some(
      (b) =>
        b.kingdomId === v.kingdomId &&
        b.archetype === 'mine_pit' &&
        b.constructionState === 'completed' &&
        Math.hypot(b.position.x - node.position.x, b.position.z - node.position.z) < 18,
    );
    if (hasNearbyMine) localMineBoost = 1.25;
  }

  const gatherRate = node.collectionRate * v.productivity * localMineBoost;
  const spaceInBag = Math.max(0, v.carryCapacity - v.carriedAmount);
  const harvested = Math.min(spaceInBag, node.remainingYield, gatherRate * dt);

  v.carriedResource = node.resourceType;
  v.carriedAmount += harvested;
  node.remainingYield = Math.max(0, node.remainingYield - harvested);

  const verb =
    v.role === 'Woodcutter'
      ? 'Chopping'
      : v.role === 'Miner'
        ? 'Mining'
        : v.role === 'Hunter'
          ? 'Hunting at'
          : 'Fishing at';
  v.activityLabel = `${verb} ${node.name} (${Math.floor(v.carriedAmount)}/${v.carryCapacity} ${node.resourceType})`;

  // Handle node depletion / tree felling & regrowth
  if (node.remainingYield <= 0.1) {
    node.remainingYield = 0;
    node.depleted = true;
    node.activeHarvesterIds = [];
    runtime.dirtyNodeIds.add(node.id);
    v.assignedNodeId = null;

    if (node.regenerates) {
      node.regrowthTimer = node.regrowthDuration;
      node.richnessLabel = `Regrowing (${Math.ceil(node.regrowthTimer)}s)`;
    } else {
      node.richnessLabel = 'Deposit Exhausted';
      if (ledger.isPlayer) {
        pushEconomyNotification(
          runtime,
          `exhausted_${node.id}`,
          'warning',
          `Resource deposit exhausted: ${node.name}.`,
          5,
        );
      }
    }

    if (v.carriedAmount > 0.1) {
      v.taskType = 'deliver_resource';
      v.deliveryBuildingId = null;
    } else {
      v.taskType = 'idle';
    }
    return;
  } else {
    node.richnessLabel = node.regenerates
      ? `${Math.ceil(node.remainingYield)} ${node.resourceType} · Renewable`
      : `${Math.ceil(node.remainingYield)} ${node.resourceType} Remaining`;
  }

  if (v.carriedAmount >= v.carryCapacity - 0.01) {
    v.carriedAmount = v.carryCapacity;
    v.taskType = 'deliver_resource';
    v.deliveryBuildingId = null;
  }
}

/**
 * Periodic macro-economic tick per kingdom (runs every 0.5s, decoupled from 60fps render frames)
 */
function runMacroTickForKingdom(
  tickDt: number,
  runtime: EconomyWorldRuntime,
  ledger: KingdomEconomyLedger,
): void {
  const kId = ledger.kingdomId;
  recalculateCapacitiesAndPopulation(runtime, kId);

  // 2. Population food consumption
  const popCount = ledger.population.current;
  const foodNeeded = popCount * ECONOMY_RULES.foodConsumptionPerVillagerPerSec * tickDt;
  const actualConsumed = Math.min(ledger.resources.food, foodNeeded);

  if (actualConsumed > 0) {
    ledger.resources.food = Math.max(0, ledger.resources.food - actualConsumed);
    ledger.economyStats.totalConsumedFood += actualConsumed;
    ledger.recentLedger.push({
      time: runtime.elapsedSeconds,
      type: 'cons',
      resource: 'food',
      amount: actualConsumed,
    });
  }

  // 3. Food satisfaction, Happiness & Population Growth
  const hasFoodShortage = ledger.resources.food < 1.0 && foodNeeded > 0;
  if (hasFoodShortage) {
    ledger.population.foodSatisfaction = Math.max(
      0,
      ledger.population.foodSatisfaction - tickDt * 12,
    );
    if (ledger.isPlayer) {
      pushEconomyNotification(
        runtime,
        'food_shortage',
        'alert',
        'Food shortage! Assign Farmers, Hunters, or Fishermen to feed your population.',
        20,
      );
    }
  } else if (ledger.resources.food < ECONOMY_RULES.minFoodForPopulationGrowth) {
    ledger.population.foodSatisfaction = Math.max(
      45,
      Math.min(75, ledger.population.foodSatisfaction + (60 - ledger.population.foodSatisfaction) * 0.2),
    );
  } else {
    ledger.population.foodSatisfaction = Math.min(
      100,
      ledger.population.foodSatisfaction + tickDt * 10,
    );
  }

  const housingHeadroom = ledger.population.capacity - ledger.population.current;
  let targetHappiness = 55 + ledger.population.foodSatisfaction * 0.3;
  if (housingHeadroom >= 4) targetHappiness += 8;
  else if (housingHeadroom <= 0) targetHappiness -= 10;

  if (runtime.buildings.some((b) => b.kingdomId === kId && b.archetype === 'royal_palace' && b.constructionState === 'completed')) {
    targetHappiness += 8;
  }
  if (runtime.buildings.some((b) => b.kingdomId === kId && b.archetype === 'council_chambers' && b.constructionState === 'completed')) {
    targetHappiness += 5;
  }
  if (runtime.buildings.some((b) => b.kingdomId === kId && b.archetype === 'market_courtyard' && b.constructionState === 'completed')) {
    targetHappiness += 4;
  }

  ledger.population.happiness = Math.round(
    Math.max(10, Math.min(100, ledger.population.happiness + (targetHappiness - ledger.population.happiness) * 0.25)),
  );

  // Population grows ONLY when housing is available AND food reserves exceed threshold
  if (
    ledger.population.current < ledger.population.capacity &&
    ledger.resources.food >= ECONOMY_RULES.minFoodForPopulationGrowth &&
    ledger.population.happiness >= 50
  ) {
    const happinessFactor = 0.65 + (ledger.population.happiness / 100) * 0.65;
    ledger.population.growthProgress +=
      ECONOMY_RULES.basePopulationGrowthRatePerSec * happinessFactor * tickDt;

    if (ledger.population.growthProgress >= 100) {
      ledger.population.growthProgress = 0;
      // Consume a small food welcome ration for the new citizen arrival
      ledger.resources.food = Math.max(0, ledger.resources.food - 18);
      const newCitizen = createSpawnedCitizen(
        runtime.characters.length,
        kId,
        runtime.region,
        runtime.seed,
        ledger.settlementCenter,
      );
      runtime.characters.push(newCitizen);
      runtime.newlySpawnedCharacters.push(newCitizen);
      ledger.economyStats.villagersBorn += 1;
      recalculateCapacitiesAndPopulation(runtime, kId);
      if (ledger.isPlayer) {
        pushEconomyNotification(
          runtime,
          `citizen_born_${newCitizen.id}`,
          'success',
          `${newCitizen.name} joined the settlement (Population ${ledger.population.current}/${ledger.population.capacity}).`,
          2,
        );
      }
    }
  } else if (hasFoodShortage) {
    ledger.population.growthProgress = Math.max(0, ledger.population.growthProgress - tickDt * 3);
  }

  // 4. Rolling 30-second production & continuous consumption rates per minute
  const windowSec = 30;
  const cutoff = runtime.elapsedSeconds - windowSec;
  while (ledger.recentLedger.length > 0 && ledger.recentLedger[0].time < cutoff) {
    ledger.recentLedger.shift();
  }

  const effectiveWindow = Math.max(10, Math.min(windowSec, runtime.elapsedSeconds));
  const scaleToMinute = 60 / effectiveWindow;

  // Estimate live in-field gathering rate for active non-paused workers of this kingdom
  const activeFieldPerMin: ResourceAmounts = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
  for (const v of runtime.characters) {
    if (v.kingdomId !== kId || v.isMilitary || v.health <= 0) continue;
    if (v.role === 'Unemployed' || v.role === 'Builder') continue;
    const res =
      v.carriedResource ?? v.preferredResource ?? OCCUPATION_CONFIGS[v.role].primaryResource;
    if (!res) continue;
    if (ledger.resources[res] >= ledger.capacities[res] - 0.05) continue;
    const tradeBonus = v.role === 'Trader' ? ledger.tradeIncomeBonusMult || 1.0 : 1.0;
    const estPerMin = OCCUPATION_CONFIGS[v.role].baseGatherRatePerSec * v.productivity * tradeBonus * 0.58 * 60;
    activeFieldPerMin[res] += estPerMin;
  }

  const warmupBlend = Math.max(0, Math.min(1, (runtime.elapsedSeconds - 6) / 24));

  for (const key of RESOURCE_KEYS) {
    let prodSum = 0;
    let consSum = 0;
    for (let i = 0; i < ledger.recentLedger.length; i++) {
      const entry = ledger.recentLedger[i];
      if (entry.resource !== key) continue;
      if (entry.type === 'prod') prodSum += entry.amount;
      else consSum += entry.amount;
    }

    const deliveredPerMin = prodSum * scaleToMinute;
    const blendedProd =
      deliveredPerMin > 0
        ? deliveredPerMin * warmupBlend + activeFieldPerMin[key] * (1 - warmupBlend)
        : activeFieldPerMin[key] * (1 - warmupBlend * 0.65);

    const prodPerMin = Math.round(blendedProd * 10) / 10;
    const consPerMin =
      key === 'food'
        ? Math.round(
            Math.max(
              consSum * scaleToMinute,
              ledger.population.current * ECONOMY_RULES.foodConsumptionPerVillagerPerSec * 60,
            ) * 10,
          ) / 10
        : Math.round(consSum * scaleToMinute * 10) / 10;

    ledger.rates.productionPerMinute[key] = prodPerMin;
    ledger.rates.consumptionPerMinute[key] = consPerMin;
    ledger.rates.netPerMinute[key] = Math.round((prodPerMin - consPerMin) * 10) / 10;
  }
}

function runPeriodicEconomyTick(tickDt: number, runtime: EconomyWorldRuntime): void {
  // 1. Regrow renewable felled trees, fisheries, and hunting grounds
  for (let i = 0; i < runtime.resourceNodes.length; i++) {
    const node = runtime.resourceNodes[i];
    if (node.depleted && node.regenerates && node.regrowthTimer > 0) {
      node.regrowthTimer = Math.max(0, node.regrowthTimer - tickDt);
      node.richnessLabel = `Regrowing (${Math.ceil(node.regrowthTimer)}s)`;
      if (node.regrowthTimer <= 0) {
        node.depleted = false;
        node.remainingYield = node.maxYield;
        node.richnessLabel = `${node.maxYield} ${node.resourceType} · Regrown`;
        runtime.dirtyNodeIds.add(node.id);
      }
    }
  }

  if (runtime.kingdomLedgers && runtime.kingdomLedgers.size > 0) {
    for (const ledger of runtime.kingdomLedgers.values()) {
      runMacroTickForKingdom(tickDt, runtime, ledger);
    }
  } else {
    runMacroTickForKingdom(tickDt, runtime, resolveKingdomLedger(runtime, runtime.kingdomId));
  }
}

/**
 * Main simulation step called each frame:
 * - Movement & active task state transitions run smoothly with clamped `dt`
 * - Macro-economy, regrowth, food consumption, and population growth run on fixed 0.5s intervals
 */
export function stepEconomyAndVillagers(
  runtime: EconomyWorldRuntime,
  rawDt: number,
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return;

  runtime.elapsedSeconds += dt;

  for (let i = 0; i < runtime.characters.length; i++) {
    stepSingleVillager(runtime.characters[i], dt, runtime);
  }

  runtime.economyTickAccumulator += dt;
  if (runtime.economyTickAccumulator >= ECONOMY_RULES.economyTickIntervalSec) {
    const tickDt = runtime.economyTickAccumulator;
    runtime.economyTickAccumulator = 0;
    runPeriodicEconomyTick(tickDt, runtime);
  }
}
