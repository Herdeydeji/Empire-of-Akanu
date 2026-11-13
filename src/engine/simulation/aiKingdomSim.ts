import { KINGDOM_PERSONALITIES } from '../../config/aiPersonalities';
import { BUILDING_CATALOG, ECONOMY_RULES, RESOURCE_KEYS } from '../../config/economy';
import { KINGDOMS } from '../../config/kingdoms';
import { KINGDOM_MILITARY_BONUSES, MILITARY_UNIT_CATALOG } from '../../config/military';
import { findValidNearbyPlot, findValidTerritoryCenter } from '../../config/settlement';
import {
  AIDecisionLogEntry,
  AIDifficulty,
  AIKingdomRuntime,
  BuildingArchetype,
  BuildingEntity,
  CharacterEntity,
  CivilianRole,
  KingdomId,
  KingdomIntelligenceRecord,
  MilitaryUnitClass,
  RegionConfig,
  ResourceKey,
  TerritoryZone,
  WorldEventItem,
} from '../../types/game';
import {
  addDiplomaticTreaty,
  ALL_KINGDOM_IDS,
  declareWarBetweenKingdoms,
  DiplomacyState,
  discoverKingdomRelation,
  evaluateProposalAcceptance,
  hasActiveTreaty,
  proposePeaceTreaty,
  updateDiplomaticScore,
} from './diplomacySim';
import {
  assignVillagerOccupation,
  assignVillagerToConstruction,
  EconomyWorldRuntime,
  placeNewBuilding,
  resolveKingdomLedger,
} from './economySim';
import {
  canRecruitMilitaryUnit,
  commandMilitaryAttack,
  commandMilitaryFormation,
  commandMilitaryMove,
  commandMilitaryStance,
  MilitarySimulationState,
  queueUnitRecruitment,
} from './militarySim';

interface DifficultyProfile {
  decisionIntervalSec: number;
  utilityNoise: number;
  intelAccuracy: number;
  attackCooldownSec: number;
  minAttackRatioDelta: number;
  diplomacyCooldownSec: number;
  maxActiveBuilders: number;
}

export const DIFFICULTY_PROFILES: Record<AIDifficulty, DifficultyProfile> = {
  easy: {
    decisionIntervalSec: 3.4,
    utilityNoise: 0.24,
    intelAccuracy: 0.65,
    attackCooldownSec: 65,
    minAttackRatioDelta: 0.35,
    diplomacyCooldownSec: 30,
    maxActiveBuilders: 1,
  },
  normal: {
    decisionIntervalSec: 2.2,
    utilityNoise: 0.12,
    intelAccuracy: 0.85,
    attackCooldownSec: 45,
    minAttackRatioDelta: 0.1,
    diplomacyCooldownSec: 22,
    maxActiveBuilders: 2,
  },
  hard: {
    decisionIntervalSec: 1.4,
    utilityNoise: 0.04,
    intelAccuracy: 0.95,
    attackCooldownSec: 32,
    minAttackRatioDelta: 0.0,
    diplomacyCooldownSec: 16,
    maxActiveBuilders: 2,
  },
  very_hard: {
    decisionIntervalSec: 0.85,
    utilityNoise: 0.0,
    intelAccuracy: 1.0,
    attackCooldownSec: 22,
    minAttackRatioDelta: -0.08,
    diplomacyCooldownSec: 12,
    maxActiveBuilders: 3,
  },
};

export interface AIKingdomManager {
  kingdoms: Record<KingdomId, AIKingdomRuntime>;
  difficulty: AIDifficulty;
}

function deterministicJitter(seed: number, stepTick: number, salt: number, amplitude: number): number {
  if (amplitude <= 0) return 0;
  const raw = Math.sin(seed * 12.9898 + stepTick * 78.233 + salt * 43.17) * 43758.5453;
  const frac = raw - Math.floor(raw);
  return (frac * 2 - 1) * amplitude;
}

function createEmptyIntelRecord(targetKingdomId: KingdomId): KingdomIntelligenceRecord {
  return {
    targetKingdomId,
    discovered: false,
    lastSeenSec: 0,
    estimatedMilitaryStrength: 0,
    estimatedEconomicStrength: 0,
    estimatedPopulation: 0,
    knownSettlementLocations: [],
    recentHostileActions: 0,
  };
}

function recordAIDecision(
  ai: AIKingdomRuntime,
  timestampSec: number,
  category: AIDecisionLogEntry['category'],
  summary: string,
  score: number,
): void {
  if (!ai.decisionLog) ai.decisionLog = [];
  if (ai.decisionLog[0]?.summary === summary && timestampSec - ai.decisionLog[0].timestampSec < 6) {
    return;
  }
  ai.decisionLog.unshift({
    timestampSec: Math.round(timestampSec * 10) / 10,
    category,
    summary,
    score: Math.round(score * 100) / 100,
  });
  if (ai.decisionLog.length > 25) {
    ai.decisionLog.length = 25;
  }
}

export function estimateMilitaryPower(units: CharacterEntity[]): number {
  let score = 0;
  for (const u of units) {
    if (!u.isMilitary || u.health <= 0) continue;
    const hpRatio = Math.max(0.2, u.health / Math.max(1, u.maxHealth));
    const dmg = u.attackDamage ?? 14;
    const def = u.defense ?? 5;
    const siegeFactor = u.isSiegeEngine ? 1.4 : 1.0;
    score += (dmg * 1.4 + def * 0.9 + (u.maxHealth * 0.1)) * hpRatio * siegeFactor;
  }
  return Math.round(score);
}

export function createInitialAIKingdomManager(
  playerKingdomId: KingdomId,
  difficulty: AIDifficulty = 'normal',
  savedData?: AIKingdomRuntime[],
  capitalCenters?: Record<KingdomId, { x: number; z: number }>,
): AIKingdomManager {
  const kingdoms: Record<KingdomId, AIKingdomRuntime> = {} as any;

  const fallbackCenters: Record<KingdomId, { x: number; z: number }> = {
    oru: { x: 0, z: 0 },
    zambara: { x: -46, z: -38 },
    kemetra: { x: 46, z: -38 },
    aseka: { x: -46, z: 38 },
    nambara: { x: 46, z: 38 },
  };

  for (let i = 0; i < ALL_KINGDOM_IDS.length; i++) {
    const id = ALL_KINGDOM_IDS[i];
    const isPlayer = id === playerKingdomId;
    const saved = savedData?.find((k) => k.id === id);
    const kConfig = KINGDOMS[id];

    const center = capitalCenters?.[id] ?? saved?.settlementCenter ?? (isPlayer ? { x: 0, z: 0 } : fallbackCenters[id]);

    const defaultIntel: Record<KingdomId, KingdomIntelligenceRecord> = {} as any;
    for (const otherId of ALL_KINGDOM_IDS) {
      if (otherId === id) continue;
      defaultIntel[otherId] =
        saved?.knownIntelligence?.[otherId]
          ? {
              ...saved.knownIntelligence[otherId],
              knownSettlementLocations: [...saved.knownIntelligence[otherId].knownSettlementLocations],
            }
          : createEmptyIntelRecord(otherId);
    }

    const defaultTerritories: TerritoryZone[] =
      saved?.territories && saved.territories.length > 0
        ? saved.territories.map((t) => ({ ...t }))
        : [
            {
              id: `terr_${id}_capital`,
              name: `${kConfig.name} Heartland`,
              x: center.x,
              z: center.z,
              radius: 28,
              isCapital: true,
            },
          ];

    if (saved) {
      kingdoms[id] = {
        ...saved,
        isPlayer,
        settlementCenter: center,
        territories: defaultTerritories,
        knownIntelligence: defaultIntel,
        strategicObjectives: saved.strategicObjectives ? [...saved.strategicObjectives] : ['Consolidate borders'],
        decisionLog: saved.decisionLog ? [...saved.decisionLog] : [],
        discoveredResourceNodes: saved.discoveredResourceNodes ? [...saved.discoveredResourceNodes] : [],
        stability: saved.stability ?? 84,
        militaryStats: saved.militaryStats ?? {
          unitsRecruited: 0,
          enemiesDefeated: 0,
          alliesLost: 0,
          structuresRazed: 0,
        },
        lastDiplomacyTimeSec: saved.lastDiplomacyTimeSec ?? 0,
        lastAttackTimeSec: saved.lastAttackTimeSec ?? 0,
        lastExpansionSec: saved.lastExpansionSec ?? 0,
        defeatCount: saved.defeatCount ?? 0,
      };
    } else {
      kingdoms[id] = {
        id,
        name: kConfig.name,
        rulerName: kConfig.title,
        isPlayer,
        settlementCenter: center,
        territoryRadius: 28,
        territories: defaultTerritories,
        resources: { ...kConfig.startingResources },
        capacities: { food: 1200, wood: 1200, stone: 1200, iron: 1000, gold: 1000 },
        rates: {
          productionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
          consumptionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
          netPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
        },
        economyStats: {
          totalGathered: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
          totalConsumedFood: 0,
          buildingsConstructed: 0,
          villagersBorn: 0,
        },
        militaryStats: {
          unitsRecruited: 0,
          enemiesDefeated: 0,
          alliesLost: 0,
          structuresRazed: 0,
        },
        hasUpkeepDeficit: false,
        stability: 86,
        population: {
          current: 5,
          capacity: 22,
          availableWorkforce: 5,
          employedCount: 5,
          unemployedCount: 0,
          happiness: 85,
          foodSatisfaction: 100,
          growthProgress: 0,
        },
        progressionStage: 'Village',
        strategicPosture: 'consolidate',
        strategicObjectives: isPlayer
          ? ['Sovereign Command']
          : [
              `Develop ${KINGDOM_PERSONALITIES[id].archetypeTitle} economy`,
              'Survey neighboring borders',
            ],
        decisionTimerSec: (i * 0.35) % DIFFICULTY_PROFILES[difficulty].decisionIntervalSec,
        lastDecisionSummary: isPlayer
          ? 'Player Sovereignty'
          : 'Organizing founding settlement',
        decisionLog: [],
        knownIntelligence: defaultIntel,
        discoveredResourceNodes: [],
        lastDiplomacyTimeSec: 0,
        lastAttackTimeSec: 0,
        lastExpansionSec: 0,
        defeatCount: 0,
      };
    }
  }

  return { kingdoms, difficulty };
}

/**
 * Updates Fog-of-Knowledge discovery & local intelligence estimates for EVERY kingdom
 * (both AI and Player) strictly from line-of-sight of living units and standing buildings.
 */
export function updateAllKingdomIntelligence(
  aiManager: AIKingdomManager,
  runtime: EconomyWorldRuntime,
  diplomacy: DiplomacyState,
  events: WorldEventItem[],
): void {
  const profile = DIFFICULTY_PROFILES[aiManager.difficulty];
  const now = runtime.elapsedSeconds;

  for (const observerId of ALL_KINGDOM_IDS) {
    const observer = aiManager.kingdoms[observerId];
    if (!observer) continue;
    if (!observer.knownIntelligence) {
      observer.knownIntelligence = {} as Record<KingdomId, KingdomIntelligenceRecord>;
    }

    const visionSources: { x: number; z: number; radius: number }[] = [];
    const scoutBonus = KINGDOMS[observerId].modifiers.archerReconMultiplier ?? 1.0;

    for (const c of runtime.characters) {
      if (c.kingdomId !== observerId || c.health <= 0) continue;
      const baseR =
        c.militaryClass === 'scout'
          ? 34 * scoutBonus
          : c.isMilitary
            ? 22 * Math.max(1, scoutBonus * 0.95)
            : 15;
      visionSources.push({ x: c.position.x, z: c.position.z, radius: baseR });
    }
    for (const b of runtime.buildings) {
      if (b.kingdomId !== observerId || b.constructionState === 'destroyed') continue;
      const baseR = b.archetype === 'watch_post' ? 30 * scoutBonus : 20;
      visionSources.push({ x: b.position.x, z: b.position.z, radius: baseR });
    }

    if (visionSources.length === 0) continue;

    // Track newly visible neutral/foreign resource nodes for this kingdom
    if (!observer.discoveredResourceNodes) observer.discoveredResourceNodes = [];
    for (const node of runtime.resourceNodes) {
      if (node.depleted) continue;
      if (observer.discoveredResourceNodes.includes(node.id)) continue;
      for (const src of visionSources) {
        if (Math.hypot(node.position.x - src.x, node.position.z - src.z) <= src.radius) {
          observer.discoveredResourceNodes.push(node.id);
          break;
        }
      }
    }

    // Observe rival kingdoms
    for (const targetId of ALL_KINGDOM_IDS) {
      if (targetId === observerId) continue;
      if (!observer.knownIntelligence[targetId]) {
        observer.knownIntelligence[targetId] = createEmptyIntelRecord(targetId);
      }
      const intel = observer.knownIntelligence[targetId];

      const visibleSoldiers: CharacterEntity[] = [];
      const visibleCivilians: CharacterEntity[] = [];
      const visibleBuildings: BuildingEntity[] = [];

      for (const c of runtime.characters) {
        if (c.kingdomId !== targetId || c.health <= 0) continue;
        for (const src of visionSources) {
          if (Math.hypot(c.position.x - src.x, c.position.z - src.z) <= src.radius) {
            if (c.isMilitary) visibleSoldiers.push(c);
            else visibleCivilians.push(c);
            break;
          }
        }
      }

      for (const b of runtime.buildings) {
        if (b.kingdomId !== targetId || b.constructionState === 'destroyed') continue;
        for (const src of visionSources) {
          if (Math.hypot(b.position.x - src.x, b.position.z - src.z) <= src.radius) {
            visibleBuildings.push(b);
            break;
          }
        }
      }

      if (
        visibleSoldiers.length > 0 ||
        visibleCivilians.length > 0 ||
        visibleBuildings.length > 0
      ) {
        const newlyDiscovered = !intel.discovered;
        intel.discovered = true;
        intel.lastSeenSec = now;
        discoverKingdomRelation(diplomacy, observerId, targetId);

        const observedMil = estimateMilitaryPower(visibleSoldiers);
        const accuracyError =
          1 +
          deterministicJitter(
            runtime.seed,
            Math.floor(now / 10),
            observerId.length + targetId.length,
            1 - profile.intelAccuracy,
          );
        intel.estimatedMilitaryStrength = Math.max(
          observedMil > 0 ? observedMil : intel.estimatedMilitaryStrength * 0.85,
          Math.round(observedMil * accuracyError),
        );
        intel.estimatedEconomicStrength = Math.round(
          (visibleBuildings.length * 60 + visibleCivilians.length * 25) * accuracyError,
        );
        intel.estimatedPopulation = Math.max(
          intel.estimatedPopulation,
          visibleSoldiers.length + visibleCivilians.length,
        );

        for (const b of visibleBuildings) {
          if (
            !intel.knownSettlementLocations.some(
              (loc) => Math.hypot(loc.x - b.position.x, loc.z - b.position.z) < 8,
            )
          ) {
            intel.knownSettlementLocations.push({
              x: Math.round(b.position.x * 10) / 10,
              z: Math.round(b.position.z * 10) / 10,
              name: b.name,
            });
            if (intel.knownSettlementLocations.length > 6) {
              intel.knownSettlementLocations.shift();
            }
          }
        }

        if (newlyDiscovered && observer.isPlayer) {
          events.push({
            id: `evt_disc_${observerId}_${targetId}_${Math.round(now)}`,
            timestampSec: now,
            title: `Discovered ${KINGDOMS[targetId].name}`,
            description: `Scouts established visual contact with ${KINGDOMS[targetId].name} (${KINGDOM_PERSONALITIES[targetId].archetypeTitle}).`,
            sourceKingdomId: observerId,
            targetKingdomId: targetId,
            kind: 'territory',
          });
        }
      }
    }
  }
}

function syncAIStabilityAndTradeBonuses(
  ai: AIKingdomRuntime,
  runtime: EconomyWorldRuntime,
  diplomacy: DiplomacyState,
): void {
  const ledger = resolveKingdomLedger(runtime, ai.id);
  ledger.tradeIncomeBonusMult = 1.0;

  let activeTradePacts = 0;
  let activeWars = 0;
  for (const otherId of ALL_KINGDOM_IDS) {
    if (otherId === ai.id) continue;
    const rel = diplomacy.relations[ai.id]?.[otherId];
    if (!rel) continue;
    if (rel.state === 'at_war') activeWars++;
    if (hasActiveTreaty(diplomacy, ai.id, otherId, 'trade_pact')) {
      activeTradePacts++;
    }
  }

  ledger.tradeIncomeBonusMult = Math.min(1.45, 1.0 + activeTradePacts * 0.15);

  const hasCompound = runtime.buildings.some(
    (b) =>
      b.kingdomId === ai.id &&
      (b.archetype === 'royal_compound' || b.archetype === 'royal_palace') &&
      b.constructionState === 'completed',
  );

  const foodFactor = ledger.population.foodSatisfaction * 0.42;
  const happyFactor = ledger.population.happiness * 0.35;
  const upkeepPenalty = ai.hasUpkeepDeficit ? 16 : 0;
  const warPenalty = activeWars * 7;
  const capitalBonus = hasCompound ? 23 : 5;

  ai.stability = Math.round(
    Math.max(10, Math.min(100, foodFactor + happyFactor + capitalBonus - upkeepPenalty - warPenalty)),
  );
}

export function stepAIKingdomManager(
  dt: number,
  aiManager: AIKingdomManager,
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
  diplomacy: DiplomacyState,
  region: RegionConfig,
  seed: number,
): WorldEventItem[] {
  const events: WorldEventItem[] = [];
  const profile = DIFFICULTY_PROFILES[aiManager.difficulty];
  const tickInterval = profile.decisionIntervalSec;

  // Update player's own trade pact bonus cleanly as well
  const playerLedger = resolveKingdomLedger(runtime, runtime.kingdomId);
  let playerTradePacts = 0;
  for (const otherId of ALL_KINGDOM_IDS) {
    if (otherId !== runtime.kingdomId && hasActiveTreaty(diplomacy, runtime.kingdomId, otherId, 'trade_pact')) {
      playerTradePacts++;
    }
  }
  playerLedger.tradeIncomeBonusMult = Math.min(1.45, 1.0 + playerTradePacts * 0.15);

  // Sync Fog-of-Knowledge discovery across all kingdoms periodically
  const playerObj = aiManager.kingdoms[runtime.kingdomId];
  if (playerObj) {
    playerObj.decisionTimerSec += dt;
    if (playerObj.decisionTimerSec >= 1.2) {
      playerObj.decisionTimerSec = 0;
      updateAllKingdomIntelligence(aiManager, runtime, diplomacy, events);
    }
  }

  for (const kId of ALL_KINGDOM_IDS) {
    const aiKingdom = aiManager.kingdoms[kId];
    if (!aiKingdom || aiKingdom.isPlayer) continue;

    aiKingdom.decisionTimerSec += dt;
    if (aiKingdom.decisionTimerSec >= tickInterval) {
      aiKingdom.decisionTimerSec = 0;

      syncAIStabilityAndTradeBonuses(aiKingdom, runtime, diplomacy);

      // 1. Autonomous Economic Management
      evaluateAndExecuteEconomyAI(aiKingdom, aiManager, runtime);

      // 2. Autonomous Settlement Building Construction
      evaluateAndExecuteSettlementAI(aiKingdom, aiManager, runtime, region, seed, events);

      // 3. Territorial Expansion via Frontier Outposts
      evaluateAndExecuteTerritoryExpansionAI(aiKingdom, aiManager, runtime, region, seed, events);

      // 4. Autonomous Military Recruitment (using real queues & real resources)
      evaluateAndExecuteRecruitmentAI(aiKingdom, aiManager, runtime, diplomacy, events);

      // 5. Tactical Military Strategy & Alliances
      evaluateAndExecuteMilitaryStrategyAI(aiKingdom, aiManager, runtime, diplomacy, events);

      // 6. Autonomous AI-to-AI Diplomacy
      evaluateAndExecuteAIDiplomacyAI(aiKingdom, aiManager, runtime, diplomacy, events);

      updateStrategicObjectivesSummary(aiKingdom, runtime, diplomacy);
    }
  }

  return events;
}

function evaluateAndExecuteEconomyAI(
  ai: AIKingdomRuntime,
  aiManager: AIKingdomManager,
  runtime: EconomyWorldRuntime,
): void {
  const ledger = resolveKingdomLedger(runtime, ai.id);
  const personality = KINGDOM_PERSONALITIES[ai.id];
  const profile = DIFFICULTY_PROFILES[aiManager.difficulty];
  const civilians = runtime.characters.filter(
    (c) => c.kingdomId === ai.id && !c.isMilitary && c.health > 0,
  );
  if (civilians.length === 0) return;

  const myBuildings = runtime.buildings.filter(
    (b) => b.kingdomId === ai.id && b.constructionState !== 'destroyed',
  );
  const unfinishedSites = myBuildings.filter((b) => b.constructionState !== 'completed');
  const completedFarms = myBuildings.filter(
    (b) => b.archetype === 'cultivated_farm' && b.constructionState === 'completed',
  );
  const completedMarkets = myBuildings.filter(
    (b) => b.archetype === 'market_courtyard' && b.constructionState === 'completed',
  );
  const completedWorkshops = myBuildings.filter(
    (b) =>
      (b.archetype === 'blacksmith_workshop' || b.archetype === 'weapon_workshop') &&
      b.constructionState === 'completed',
  );

  // Dispatch idle builders straight to unfinished construction sites
  if (unfinishedSites.length > 0) {
    const buildersAssigned = civilians.filter(
      (c) => c.role === 'Builder' && c.assignedBuildingId,
    ).length;
    const neededBuilders = Math.min(profile.maxActiveBuilders, unfinishedSites.length + 1);
    if (buildersAssigned < neededBuilders) {
      const candidate =
        civilians.find((c) => c.role === 'Builder' && !c.assignedBuildingId) ??
        civilians.find((c) => c.role === 'Unemployed') ??
        civilians.find((c) => c.role !== 'Farmer' || ledger.resources.food > 180);
      if (candidate) {
        assignVillagerToConstruction(candidate, unfinishedSites[0], runtime);
      }
    }
  }

  // Evaluate dynamic resource urgencies
  const foodLow = ledger.resources.food < 160 || ledger.rates.netPerMinute.food < -2;
  const woodLow = ledger.resources.wood < 140;
  const stoneLow = ledger.resources.stone < 110;
  const ironLow = ledger.resources.iron < 85;
  const goldLow = ledger.resources.gold < 95 || ai.hasUpkeepDeficit;

  // Build desired worker counts by personality + dynamic deficits
  const totalCiv = civilians.length;
  const weights = { ...personality.economyRatios };
  if (foodLow) weights.farmer += 0.32;
  if (woodLow) weights.woodcutter += 0.18;
  if (stoneLow || ironLow) weights.miner += 0.16;
  if (goldLow && completedMarkets.length > 0) weights.trader += 0.16;
  if (unfinishedSites.length > 0) weights.builder = Math.max(weights.builder, 0.2);

  // Determine highest priority role for idle / unemployed / rebalancing villagers
  const roleCounts: Record<CivilianRole, number> = {
    Unemployed: 0,
    Farmer: 0,
    Woodcutter: 0,
    Miner: 0,
    Builder: 0,
    Trader: 0,
    Craftsperson: 0,
    Hunter: 0,
    Fisherman: 0,
  };
  for (const c of civilians) {
    roleCounts[c.role] = (roleCounts[c.role] ?? 0) + 1;
  }

  const maxFarmSlots = completedFarms.reduce((sum, b) => sum + b.maxWorkers, 0);
  const maxMarketSlots = completedMarkets.reduce((sum, b) => sum + b.maxWorkers, 0);
  const maxWorkshopSlots = completedWorkshops.reduce((sum, b) => sum + b.maxWorkers, 0);

  let reassigned = 0;
  for (let i = 0; i < civilians.length; i++) {
    const v = civilians[i];
    if (v.assignedBuildingId && v.role === 'Builder') continue;
    if (v.carriedAmount > 1) continue; // Let them finish hauling cargo cleanly

    const isStalled = v.role === 'Unemployed' || v.taskType === 'idle';
    const allowRebalance =
      isStalled ||
      (v.role === 'Builder' && unfinishedSites.length === 0) ||
      (foodLow && v.role !== 'Farmer' && v.role !== 'Hunter' && reassigned === 0);

    if (!allowRebalance) continue;

    // Utility score each occupation
    const scores: { role: CivilianRole; pref: ResourceKey | null; score: number }[] = [];

    const farmRatio = (roleCounts.Farmer + roleCounts.Hunter) / Math.max(1, totalCiv);
    if (roleCounts.Farmer < maxFarmSlots) {
      scores.push({
        role: 'Farmer',
        pref: 'food',
        score: (weights.farmer - farmRatio) * 100 + (foodLow ? 42 : 0),
      });
    } else {
      const hasFish = runtime.resourceNodes.some(
        (n) =>
          !n.depleted &&
          n.nodeKind === 'fertile_fishery' &&
          Math.hypot(n.position.x - ai.settlementCenter.x, n.position.z - ai.settlementCenter.z) < 42,
      );
      scores.push({
        role: hasFish ? 'Fisherman' : 'Hunter',
        pref: 'food',
        score: (weights.farmer - farmRatio) * 95 + (foodLow ? 40 : 0),
      });
    }

    const woodRatio = roleCounts.Woodcutter / Math.max(1, totalCiv);
    scores.push({
      role: 'Woodcutter',
      pref: 'wood',
      score: (weights.woodcutter - woodRatio) * 100 + (woodLow ? 28 : 0),
    });

    const minerRatio = roleCounts.Miner / Math.max(1, totalCiv);
    const preferredMineral: ResourceKey =
      ledger.resources.stone < ledger.resources.iron * 1.1 || stoneLow
        ? 'stone'
        : ledger.resources.iron < 110 || personality.engineeringFocus > 0.75
          ? 'iron'
          : 'gold';
    scores.push({
      role: 'Miner',
      pref: preferredMineral,
      score: (weights.miner - minerRatio) * 100 + (stoneLow || ironLow ? 25 : 0),
    });

    if (roleCounts.Trader < maxMarketSlots) {
      const traderRatio = roleCounts.Trader / Math.max(1, totalCiv);
      scores.push({
        role: 'Trader',
        pref: 'gold',
        score: (weights.trader - traderRatio) * 100 + (goldLow ? 26 : 0),
      });
    }

    if (roleCounts.Craftsperson < maxWorkshopSlots) {
      const craftRatio = roleCounts.Craftsperson / Math.max(1, totalCiv);
      scores.push({
        role: 'Craftsperson',
        pref: 'iron',
        score: (weights.craftsperson - craftRatio) * 90 + (personality.engineeringFocus * 15),
      });
    }

    if (unfinishedSites.length > 0 && roleCounts.Builder < profile.maxActiveBuilders) {
      scores.push({
        role: 'Builder',
        pref: null,
        score: 75,
      });
    }

    scores.sort((a, b) => b.score - a.score);
    const chosen = scores[0];
    if (chosen && (chosen.role !== v.role || chosen.pref !== v.preferredResource)) {
      roleCounts[v.role] = Math.max(0, (roleCounts[v.role] ?? 1) - 1);
      roleCounts[chosen.role] = (roleCounts[chosen.role] ?? 0) + 1;
      assignVillagerOccupation(v, chosen.role, runtime, chosen.pref, true);
      reassigned++;
      if (chosen.role === 'Builder' && unfinishedSites[0]) {
        assignVillagerToConstruction(v, unfinishedSites[0], runtime);
      }
    }
  }

  if (reassigned > 0) {
    recordAIDecision(
      ai,
      runtime.elapsedSeconds,
      'economy',
      `Reallocated ${reassigned} worker(s) (Food ${Math.round(ledger.resources.food)}, Wood ${Math.round(ledger.resources.wood)})`,
      foodLow ? 0.95 : 0.72,
    );
  }
}

function evaluateAndExecuteSettlementAI(
  ai: AIKingdomRuntime,
  aiManager: AIKingdomManager,
  runtime: EconomyWorldRuntime,
  region: RegionConfig,
  seed: number,
  events: WorldEventItem[],
): void {
  const ledger = resolveKingdomLedger(runtime, ai.id);
  const personality = KINGDOM_PERSONALITIES[ai.id];
  const profile = DIFFICULTY_PROFILES[aiManager.difficulty];

  const myBuildings = runtime.buildings.filter(
    (b) => b.kingdomId === ai.id && b.constructionState !== 'destroyed',
  );
  const activeSites = myBuildings.filter((b) => b.constructionState !== 'completed');
  if (activeSites.length >= 2) return;

  const countOf = (arch: BuildingArchetype) =>
    myBuildings.filter((b) => b.archetype === arch).length;
  const hasCompound = countOf('royal_compound') > 0;

  // Rebuild administrative compound first if lost during war
  const candidates: { archetype: BuildingArchetype; score: number; reason: string }[] = [];
  if (!hasCompound) {
    candidates.push({
      archetype: 'royal_compound',
      score: 120,
      reason: 'Restore Chieftain Compound after siege loss',
    });
  }

  const popPressure = ledger.population.capacity - ledger.population.current;
  if (popPressure <= 3) {
    candidates.push({
      archetype: countOf('residential_compound') < 2 && ledger.resources.stone >= 100 ? 'residential_compound' : 'dwelling_house',
      score: popPressure <= 1 ? 92 : 68,
      reason: `Expand housing (${ledger.population.current}/${ledger.population.capacity})`,
    });
  }

  const farmCount = countOf('cultivated_farm');
  if (farmCount < 3 && (ledger.resources.food < 220 || ledger.rates.netPerMinute.food < 5)) {
    candidates.push({
      archetype: 'cultivated_farm',
      score: 84 - farmCount * 15,
      reason: 'Secure agrarian food supply',
    });
  }

  if (ledger.resources.food > ledger.capacities.food * 0.75 && countOf('granary_storehouse') < 2) {
    candidates.push({
      archetype: 'granary_storehouse',
      score: 74,
      reason: 'Prevent food storage overflow',
    });
  }

  if (
    (ledger.resources.wood > ledger.capacities.wood * 0.75 ||
      ledger.resources.stone > ledger.capacities.stone * 0.75) &&
    countOf('warehouse_storehouse') < 2
  ) {
    candidates.push({
      archetype: 'warehouse_storehouse',
      score: 70,
      reason: 'Expand timber and mineral storage',
    });
  }

  if (countOf('barracks_compound') === 0) {
    candidates.push({
      archetype: 'barracks_compound',
      score: 76 + personality.aggressionBias * 14,
      reason: 'Establish core military barracks',
    });
  }

  if (countOf('market_courtyard') === 0) {
    candidates.push({
      archetype: 'market_courtyard',
      score: 48 + personality.commerceFocus * 35,
      reason: 'Open marketplace for gold trade',
    });
  }

  if (countOf('mine_pit') === 0) {
    candidates.push({
      archetype: 'mine_pit',
      score: 45 + personality.engineeringFocus * 34,
      reason: 'Boost stone and iron mining',
    });
  }

  if (countOf('blacksmith_workshop') === 0) {
    candidates.push({
      archetype: 'blacksmith_workshop',
      score: 42 + personality.engineeringFocus * 36,
      reason: 'Forge iron arms and tools',
    });
  }

  if (countOf('watch_post') < Math.round(1 + personality.defensiveness * 2)) {
    candidates.push({
      archetype: 'watch_post',
      score: 40 + personality.defensiveness * 35,
      reason: 'Fortify perimeter watchtower',
    });
  }

  if (countOf('archery_grounds') === 0 && personality.preferredBuildings.includes('archery_grounds')) {
    candidates.push({
      archetype: 'archery_grounds',
      score: 52 + personality.wildernessFocus * 26,
      reason: 'Train long-range archer companies',
    });
  }

  if (countOf('cavalry_stables') === 0 && personality.preferredBuildings.includes('cavalry_stables')) {
    candidates.push({
      archetype: 'cavalry_stables',
      score: 52 + personality.expansionism * 28,
      reason: 'Raise fast cavalry raiders',
    });
  }

  if (countOf('weapon_workshop') === 0 && personality.engineeringFocus > 0.72) {
    candidates.push({
      archetype: 'weapon_workshop',
      score: 48 + personality.engineeringFocus * 28,
      reason: 'Construct siege engineering workshop',
    });
  }

  if (
    myBuildings.length >= 6 &&
    countOf('council_chambers') === 0 &&
    ledger.resources.gold >= 160
  ) {
    candidates.push({
      archetype: 'council_chambers',
      score: 44 + personality.diplomaticBias * 24,
      reason: 'Establish Royal Council governance',
    });
  }

  if (
    myBuildings.length >= 8 &&
    countOf('royal_palace') === 0 &&
    ledger.population.current >= 9
  ) {
    candidates.push({
      archetype: 'royal_palace',
      score: 62,
      reason: 'Elevate settlement to Royal Palace',
    });
  }

  // Filter affordable & apply personality preference + difficulty utility noise
  const scoredAffordable = candidates
    .filter((c) => {
      const cat = BUILDING_CATALOG[c.archetype];
      if (!cat) return false;
      for (const k of RESOURCE_KEYS) {
        if (ledger.resources[k] < cat.cost[k]) return false;
      }
      return true;
    })
    .map((c, idx) => {
      const prefBoost = personality.preferredBuildings.includes(c.archetype) ? 10 : 0;
      const noise = deterministicJitter(
        seed,
        Math.floor(runtime.elapsedSeconds),
        idx + ai.id.length,
        profile.utilityNoise * 30,
      );
      return { ...c, finalScore: c.score + prefBoost + noise };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  if (scoredAffordable.length === 0) return;

  const top = scoredAffordable[0];
  const footprint = BUILDING_CATALOG[top.archetype].footprintRadius;
  const existingPts = [
    ...runtime.buildings
      .filter((b) => b.constructionState !== 'destroyed')
      .map((b) => ({ x: b.position.x, z: b.position.z, r: b.footprintRadius })),
    ...runtime.resourceNodes
      .filter((n) => !n.depleted)
      .map((n) => ({ x: n.position.x, z: n.position.z, r: n.footprintRadius })),
  ];
  const offsetSeed = (ai.id.length * 7 + Math.floor(runtime.elapsedSeconds)) % 8;
  const ox = [10, -10, 12, -12, 8, -8, 14, -14][offsetSeed];
  const oz = [12, 12, -10, -10, 16, -14, 6, -6][offsetSeed];
  const plot = findValidNearbyPlot(
    ai.settlementCenter.x,
    ai.settlementCenter.z,
    ox,
    oz,
    region,
    seed,
    existingPts,
    footprint,
  );
  if (!plot) return;

  const placed = placeNewBuilding(
    top.archetype,
    plot.x,
    plot.z,
    ((Math.floor(runtime.elapsedSeconds) % 4) * Math.PI) / 2,
    runtime,
    ai.id,
  );

  if (placed.ok && placed.building) {
    // Immediately assign a nearby builder if available
    const builder =
      runtime.characters.find(
        (c) =>
          c.kingdomId === ai.id &&
          !c.isMilitary &&
          c.health > 0 &&
          c.role === 'Builder' &&
          !c.assignedBuildingId,
      ) ??
      runtime.characters.find(
        (c) =>
          c.kingdomId === ai.id &&
          !c.isMilitary &&
          c.health > 0 &&
          (c.role === 'Unemployed' || c.role === 'Woodcutter'),
      );
    if (builder) {
      assignVillagerToConstruction(builder, placed.building, runtime);
    }

    ai.lastDecisionSummary = top.reason;
    recordAIDecision(ai, runtime.elapsedSeconds, 'settlement', `Planned ${placed.building.name}: ${top.reason}`, top.finalScore);
    events.push({
      id: `evt_bld_${ai.id}_${top.archetype}_${Math.round(runtime.elapsedSeconds)}`,
      timestampSec: runtime.elapsedSeconds,
      title: `${KINGDOMS[ai.id].name} Expansion`,
      description: `${KINGDOMS[ai.id].name} began constructing a ${BUILDING_CATALOG[top.archetype].name}.`,
      sourceKingdomId: ai.id,
      kind: 'economy',
    });
  }
}

function evaluateAndExecuteTerritoryExpansionAI(
  ai: AIKingdomRuntime,
  aiManager: AIKingdomManager,
  runtime: EconomyWorldRuntime,
  region: RegionConfig,
  seed: number,
  events: WorldEventItem[],
): void {
  const personality = KINGDOM_PERSONALITIES[ai.id];
  const ledger = resolveKingdomLedger(runtime, ai.id);
  const now = runtime.elapsedSeconds;

  if (!ai.territories) {
    ai.territories = [
      {
        id: `terr_${ai.id}_capital`,
        name: `${ai.name} Heartland`,
        x: ai.settlementCenter.x,
        z: ai.settlementCenter.z,
        radius: ai.territoryRadius || 28,
        isCapital: true,
      },
    ];
  }

  // Cooldown + stability + resource checks
  const cooldown = aiManager.difficulty === 'easy' ? 75 : 48;
  if (now - (ai.lastExpansionSec ?? 0) < cooldown) return;
  if ((ai.stability ?? 80) < 52 || ai.territories.length >= 3) return;
  if (ledger.population.current < 8) return;
  if (ledger.resources.wood < 120 || ledger.resources.stone < 100) return;

  const expansionChance = personality.expansionism * 0.6 + personality.wildernessFocus * 0.25;
  if (expansionChance < 0.35) return;

  // Target unclaimed frontier deposit or dry clearing 24..40m away from capital toward center/flank
  const neutralNodes = runtime.resourceNodes.filter(
    (n) =>
      !n.depleted &&
      !n.ownerKingdomId &&
      Math.hypot(n.position.x - ai.settlementCenter.x, n.position.z - ai.settlementCenter.z) < 45,
  );

  const dirAngle =
    neutralNodes.length > 0
      ? Math.atan2(
          neutralNodes[0].position.z - ai.settlementCenter.z,
          neutralNodes[0].position.x - ai.settlementCenter.x,
        )
      : Math.atan2(-ai.settlementCenter.z, -ai.settlementCenter.x);

  const candidateX = Math.max(-72, Math.min(72, ai.settlementCenter.x + Math.cos(dirAngle) * 28));
  const candidateZ = Math.max(-72, Math.min(72, ai.settlementCenter.z + Math.sin(dirAngle) * 28));

  const validCenter = findValidTerritoryCenter(
    candidateX,
    candidateZ,
    region,
    seed,
    runtime.buildings.map((b) => b.position),
    12,
  );
  if (!validCenter) return;

  // Ensure not encroaching right onto another kingdom's capital plaza
  for (const otherId of ALL_KINGDOM_IDS) {
    if (otherId === ai.id) continue;
    const other = aiManager.kingdoms[otherId];
    if (
      other &&
      Math.hypot(validCenter.x - other.settlementCenter.x, validCenter.z - other.settlementCenter.z) < 22
    ) {
      return;
    }
  }

  const placed = placeNewBuilding('watch_post', validCenter.x, validCenter.z, dirAngle, runtime, ai.id);
  if (placed.ok && placed.building) {
    ai.lastExpansionSec = now;
    const zoneName = `${ai.name} Frontier Outpost #${ai.territories.length}`;
    ai.territories.push({
      id: `terr_${ai.id}_${ai.territories.length}`,
      name: zoneName,
      x: validCenter.x,
      z: validCenter.z,
      radius: 18,
      isCapital: false,
    });
    ai.territoryRadius = Math.min(38, ai.territoryRadius + 3);
    ai.lastDecisionSummary = `Expanded frontier to ${zoneName}`;
    recordAIDecision(ai, now, 'territory', `Claimed frontier territory: ${zoneName}`, 0.85);
    events.push({
      id: `evt_terr_${ai.id}_${Math.round(now)}`,
      timestampSec: now,
      title: `Territorial Expansion: ${ai.name}`,
      description: `${ai.name} established a frontier watchpost expanding its regional claim.`,
      sourceKingdomId: ai.id,
      kind: 'territory',
    });
  }
}

function evaluateAndExecuteRecruitmentAI(
  ai: AIKingdomRuntime,
  aiManager: AIKingdomManager,
  runtime: EconomyWorldRuntime,
  diplomacy: DiplomacyState,
  events: WorldEventItem[],
): void {
  const ledger = resolveKingdomLedger(runtime, ai.id);
  const personality = KINGDOM_PERSONALITIES[ai.id];
  const profile = DIFFICULTY_PROFILES[aiManager.difficulty];

  // Respect food & upkeep sustainability — AI must NOT suicide its economy with upkeep debt
  if (ai.hasUpkeepDeficit || ledger.resources.food < 110) {
    recordAIDecision(ai, runtime.elapsedSeconds, 'military', 'Paused recruitment to stabilize upkeep/food', 0.45);
    return;
  }

  const myMilitary = runtime.characters.filter(
    (c) => c.kingdomId === ai.id && c.isMilitary && c.health > 0,
  );
  const myBuildings = runtime.buildings.filter(
    (b) => b.kingdomId === ai.id && b.constructionState === 'completed',
  );
  const queuedCount = myBuildings.reduce(
    (sum, b) => sum + (b.recruitmentQueue?.length ?? 0),
    0,
  );
  if (queuedCount >= 2) return;

  const isAtWar = ALL_KINGDOM_IDS.some(
    (otherId) => otherId !== ai.id && diplomacy.relations[ai.id]?.[otherId]?.state === 'at_war',
  );

  const desiredArmyCap = Math.min(
    18,
    Math.max(
      4,
      Math.round(
        ledger.population.capacity *
          personality.targetArmyRatio *
          (isAtWar ? 1.3 : 1.0) *
          (aiManager.difficulty === 'easy' ? 0.8 : aiManager.difficulty === 'very_hard' ? 1.15 : 1.0),
      ),
    ),
  );

  if (myMilitary.length + queuedCount >= desiredArmyCap) return;

  const recruitingBlds = myBuildings.filter(
    (b) =>
      b.archetype === 'barracks_compound' ||
      b.archetype === 'archery_grounds' ||
      b.archetype === 'cavalry_stables' ||
      b.archetype === 'weapon_workshop',
  );
  if (recruitingBlds.length === 0) return;

  // Pick unit class using personality + discovered enemy intelligence (counter-unit choice)
  const candidateUnits: { unitClass: MilitaryUnitClass; building: BuildingEntity; score: number }[] = [];
  const hasScout = myMilitary.some((u) => u.militaryClass === 'scout');

  for (const b of recruitingBlds) {
    if ((b.recruitmentQueue?.length ?? 0) >= 3) continue;
    const blueprintMatches = Object.values(MILITARY_UNIT_CATALOG).filter(
      (bp) => bp.recruitingBuilding === b.archetype,
    );
    for (const bp of blueprintMatches) {
      const check = canRecruitMilitaryUnit(bp.unitClass, b, runtime);
      if (!check.ok) continue;

      let score = 40;
      if (personality.preferredUnits.includes(bp.unitClass)) score += 26;
      if (bp.unitClass === 'scout' && !hasScout) score += 34;
      if (isAtWar && bp.isSiegeEngine) score += 28;
      if (bp.unitClass === 'commander' && !myMilitary.some((u) => u.isCommander) && myMilitary.length >= 4) {
        score += 32;
      }

      // Check observed hostile cavalry/archers to prioritize counters
      for (const otherId of ALL_KINGDOM_IDS) {
        if (otherId === ai.id) continue;
        const rel = diplomacy.relations[ai.id]?.[otherId];
        if (rel?.state === 'at_war' || rel?.state === 'hostile') {
          if (bp.unitClass === 'spearman' && KINGDOM_PERSONALITIES[otherId].preferredUnits.includes('cavalry')) {
            score += 18;
          }
          if (bp.unitClass === 'cavalry' && KINGDOM_PERSONALITIES[otherId].preferredUnits.includes('archer')) {
            score += 16;
          }
        }
      }

      score += deterministicJitter(
        runtime.seed,
        Math.floor(runtime.elapsedSeconds),
        bp.unitClass.length + ai.id.length,
        profile.utilityNoise * 25,
      );

      candidateUnits.push({ unitClass: bp.unitClass, building: b, score });
    }
  }

  candidateUnits.sort((a, b) => b.score - a.score);
  if (candidateUnits.length === 0) return;

  const pick = candidateUnits[0];
  if (queueUnitRecruitment(pick.unitClass, pick.building, runtime)) {
    const uName = MILITARY_UNIT_CATALOG[pick.unitClass].name;
    ai.lastDecisionSummary = `Training ${uName}`;
    recordAIDecision(ai, runtime.elapsedSeconds, 'military', `Queued ${uName} at ${pick.building.name}`, pick.score);
    void events;
  }
}

function evaluateAndExecuteMilitaryStrategyAI(
  ai: AIKingdomRuntime,
  aiManager: AIKingdomManager,
  runtime: EconomyWorldRuntime,
  diplomacy: DiplomacyState,
  events: WorldEventItem[],
): void {
  const personality = KINGDOM_PERSONALITIES[ai.id];
  const profile = DIFFICULTY_PROFILES[aiManager.difficulty];
  const now = runtime.elapsedSeconds;

  const myArmy = runtime.characters.filter(
    (c) => c.kingdomId === ai.id && c.isMilitary && c.health > 0,
  );
  if (myArmy.length === 0) {
    const hasHomeCompound = runtime.buildings.some(
      (b) =>
        b.kingdomId === ai.id &&
        b.archetype === 'royal_compound' &&
        b.constructionState !== 'destroyed',
    );
    ai.strategicPosture = hasHomeCompound ? 'consolidate' : 'rebuild';
    return;
  }

  const myBuildings = runtime.buildings.filter(
    (b) => b.kingdomId === ai.id && b.constructionState !== 'destroyed',
  );

  // 1. Check for enemies attacking our settlements/territories -> DEFEND!
  const nearbyThreat = runtime.characters.find((c) => {
    if (c.health <= 0 || c.kingdomId === ai.id) return false;
    const rel = diplomacy.relations[ai.id]?.[c.kingdomId];
    const isHostile = rel?.state === 'at_war' || rel?.state === 'hostile';
    if (!isHostile) return false;
    return myBuildings.some(
      (b) => Math.hypot(c.position.x - b.position.x, c.position.z - b.position.z) < 28,
    );
  });

  if (nearbyThreat) {
    ai.strategicPosture = 'defend';
    const defenders = myArmy.filter((u) => u.combatState !== 'routing');
    commandMilitaryStance(defenders, 'aggressive');
    commandMilitaryAttack(defenders, nearbyThreat);
    ai.lastDecisionSummary = `Defending borders against ${KINGDOMS[nearbyThreat.kingdomId].name}`;
    recordAIDecision(ai, now, 'military', `Rallied ${defenders.length} troops to defend against ${KINGDOMS[nearbyThreat.kingdomId].name}`, 1.0);
    return;
  }

  // 2. Check if an ALLY is under siege -> reinforce ally if stable!
  for (const allyId of ALL_KINGDOM_IDS) {
    if (allyId === ai.id) continue;
    if (!hasActiveTreaty(diplomacy, ai.id, allyId, 'defensive_alliance')) continue;
    const allyCenter = aiManager.kingdoms[allyId]?.settlementCenter;
    if (!allyCenter) continue;
    const invader = runtime.characters.find((c) => {
      if (c.health <= 0 || c.kingdomId === ai.id || c.kingdomId === allyId) return false;
      const relAlly = diplomacy.relations[allyId]?.[c.kingdomId];
      if (relAlly?.state !== 'at_war' && relAlly?.state !== 'hostile') return false;
      return Math.hypot(c.position.x - allyCenter.x, c.position.z - allyCenter.z) < 26;
    });
    if (invader && myArmy.length >= 4) {
      const expedition = myArmy.filter((u) => u.militaryClass !== 'scout').slice(0, Math.ceil(myArmy.length * 0.6));
      commandMilitaryStance(expedition, 'aggressive');
      commandMilitaryMove(expedition, allyCenter.x, allyCenter.z, personality.preferredFormation);
      ai.strategicPosture = 'attack';
      ai.lastDecisionSummary = `Reinforcing ally ${KINGDOMS[allyId].name}`;
      recordAIDecision(ai, now, 'military', `Dispatched ${expedition.length} allied reinforcements to ${KINGDOMS[allyId].name}`, 0.9);
      return;
    }
  }

  // 3. Evaluate Offensive Expedition against active war target
  const warTargets = ALL_KINGDOM_IDS.filter(
    (otherId) =>
      otherId !== ai.id &&
      (diplomacy.relations[ai.id]?.[otherId]?.state === 'at_war' ||
        diplomacy.relations[ai.id]?.[otherId]?.state === 'hostile'),
  );

  const combatSquad = myArmy.filter(
    (u) => u.militaryClass !== 'scout' && u.combatState !== 'routing',
  );
  const myPower = estimateMilitaryPower(combatSquad);

  if (warTargets.length > 0 && combatSquad.length >= 3) {
    // Choose closest discovered war target with known settlement location
    let bestTarget: { id: KingdomId; x: number; z: number; estStrength: number } | null = null;
    let bestScore = -Infinity;

    for (const tid of warTargets) {
      const intel = ai.knownIntelligence?.[tid];
      if (!intel?.discovered) continue;
      const targetLoc =
        intel.knownSettlementLocations[0] ?? aiManager.kingdoms[tid]?.settlementCenter;
      if (!targetLoc) continue;

      const dist = Math.hypot(
        targetLoc.x - ai.settlementCenter.x,
        targetLoc.z - ai.settlementCenter.z,
      );
      const estStr = Math.max(40, intel.estimatedMilitaryStrength);
      const ratio = myPower / estStr;
      const reqRatio = personality.attackStrengthRatio + profile.minAttackRatioDelta;

      if (ratio >= reqRatio) {
        const score = ratio * 50 - dist * 0.3;
        if (score > bestScore) {
          bestScore = score;
          bestTarget = { id: tid, x: targetLoc.x, z: targetLoc.z, estStrength: estStr };
        }
      }
    }

    if (bestTarget && now - (ai.lastAttackTimeSec ?? 0) >= profile.attackCooldownSec) {
      ai.lastAttackTimeSec = now;
      ai.strategicPosture = 'attack';
      const strikeForce = combatSquad.slice(0, Math.max(3, Math.ceil(combatSquad.length * 0.78)));
      commandMilitaryFormation(strikeForce, personality.preferredFormation);
      commandMilitaryStance(strikeForce, 'aggressive');
      commandMilitaryMove(strikeForce, bestTarget.x, bestTarget.z, personality.preferredFormation);
      ai.lastDecisionSummary = `Campaign against ${KINGDOMS[bestTarget.id].name}`;
      recordAIDecision(
        ai,
        now,
        'military',
        `Launched ${personality.preferredFormation} campaign (${strikeForce.length} units) vs ${KINGDOMS[bestTarget.id].name}`,
        bestScore,
      );
      events.push({
        id: `evt_camp_${ai.id}_${bestTarget.id}_${Math.round(now)}`,
        timestampSec: now,
        title: `${KINGDOMS[ai.id].name} Launches Offensive`,
        description: `Forces of ${KINGDOMS[ai.id].name} are marching in ${personality.preferredFormation} formation toward ${KINGDOMS[bestTarget.id].name}.`,
        sourceKingdomId: ai.id,
        targetKingdomId: bestTarget.id,
        kind: 'military',
      });
      return;
    }

    // Check retreat condition for units already deep in enemy land when outmatched
    const retreatHealthLimit = 1 - personality.retreatThreshold;
    const avgHpFrac =
      combatSquad.reduce((s, u) => s + u.health / Math.max(1, u.maxHealth), 0) /
      combatSquad.length;
    if (avgHpFrac < retreatHealthLimit * 0.55) {
      ai.strategicPosture = 'defend';
      commandMilitaryStance(combatSquad, 'defensive');
      commandMilitaryMove(combatSquad, ai.settlementCenter.x, ai.settlementCenter.z, 'defensive');
      ai.lastDecisionSummary = 'Ordering tactical retreat to regroup';
      recordAIDecision(ai, now, 'military', 'Retreating battered forces to home settlement', 0.88);
      return;
    }
  }

  // 4. Peacetime / Consolidation: send Scouts to explore frontier & Garrison patrols
  ai.strategicPosture = personality.defensiveness > 0.75 ? 'fortify' : 'consolidate';
  const scouts = myArmy.filter((u) => u.militaryClass === 'scout');
  for (let sIdx = 0; sIdx < scouts.length; sIdx++) {
    const scout = scouts[sIdx];
    if (!scout.moveTarget && !scout.targetEntityId) {
      // Sweep toward an undiscovered kingdom or neutral frontier
      const undiscovered = ALL_KINGDOM_IDS.find(
        (id) => id !== ai.id && !ai.knownIntelligence?.[id]?.discovered,
      );
      let destX = ai.settlementCenter.x;
      let destZ = ai.settlementCenter.z;
      if (undiscovered) {
        const approx = aiManager.kingdoms[undiscovered].settlementCenter;
        const dir = Math.atan2(approx.z - ai.settlementCenter.z, approx.x - ai.settlementCenter.x);
        destX = ai.settlementCenter.x + Math.cos(dir) * 34;
        destZ = ai.settlementCenter.z + Math.sin(dir) * 34;
      } else {
        const patrolAng = ((Math.floor(now) + sIdx * 2) % 6) * (Math.PI / 3);
        destX = Math.max(-75, Math.min(75, ai.settlementCenter.x + Math.cos(patrolAng) * 30));
        destZ = Math.max(-75, Math.min(75, ai.settlementCenter.z + Math.sin(patrolAng) * 30));
      }
      scout.stance = 'defensive';
      scout.moveTarget = { x: destX, z: destZ };
      scout.taskType = 'military_patrol';
      scout.activityLabel = 'Scouting frontier approaches';
    }
  }

  const garrison = combatSquad;
  for (let i = 0; i < garrison.length; i++) {
    const unit = garrison[i];
    if (!unit.moveTarget && !unit.targetEntityId && unit.taskType === 'idle') {
      const angle = ((i / Math.max(1, garrison.length)) * Math.PI * 2) + (Math.floor(now / 15) * 0.4);
      const dist = 10 + (i % 3) * 3;
      unit.stance = personality.preferredStance === 'aggressive' ? 'defensive' : personality.preferredStance;
      unit.formation = personality.preferredFormation;
      unit.moveTarget = {
        x: Math.max(-85, Math.min(85, ai.settlementCenter.x + Math.cos(angle) * dist)),
        z: Math.max(-85, Math.min(85, ai.settlementCenter.z + Math.sin(angle) * dist)),
      };
      unit.taskType = 'military_patrol';
      unit.activityLabel = 'Patrolling kingdom perimeter';
    }
  }
}

function evaluateAndExecuteAIDiplomacyAI(
  ai: AIKingdomRuntime,
  aiManager: AIKingdomManager,
  runtime: EconomyWorldRuntime,
  diplomacy: DiplomacyState,
  events: WorldEventItem[],
): void {
  const now = runtime.elapsedSeconds;
  const profile = DIFFICULTY_PROFILES[aiManager.difficulty];
  if (now - (ai.lastDiplomacyTimeSec ?? 0) < profile.diplomacyCooldownSec) return;

  const personality = KINGDOM_PERSONALITIES[ai.id];
  const myArmy = runtime.characters.filter(
    (c) => c.kingdomId === ai.id && c.isMilitary && c.health > 0,
  );
  const myPower = estimateMilitaryPower(myArmy);

  for (const targetId of ALL_KINGDOM_IDS) {
    if (targetId === ai.id) continue;
    const intel = ai.knownIntelligence?.[targetId];
    if (!intel?.discovered) continue;

    const rel = diplomacy.relations[ai.id]?.[targetId];
    if (!rel) continue;

    // Prioritize AI-to-AI autonomous diplomacy cleanly without harassing player excessively
    const targetAI = aiManager.kingdoms[targetId];
    if (!targetAI) continue;

    // 1. Peace overture if war is dragging on or stability/army is collapsing
    if (rel.state === 'at_war') {
      const warTime = now - rel.lastInteractionTimeSec;
      const shouldSeekPeace =
        (warTime > 50 && ((ai.stability ?? 80) < 55 || myPower < intel.estimatedMilitaryStrength * 0.7)) ||
        (warTime > 95 && personality.diplomaticBias >= 0.55);
      if (shouldSeekPeace && !targetAI.isPlayer) {
        const res = proposePeaceTreaty(
          diplomacy,
          ai.id,
          targetId,
          myPower,
          Math.max(40, intel.estimatedMilitaryStrength),
          now,
        );
        ai.lastDiplomacyTimeSec = now;
        if (res.accepted && res.event) {
          events.push(res.event);
          recordAIDecision(ai, now, 'diplomacy', `Concluded Peace Accord with ${KINGDOMS[targetId].name}`, 0.88);
          return;
        }
      }
      continue;
    }

    // 2. Trade Pact with discovered friendly/neutral neighbors
    if (
      !targetAI.isPlayer &&
      !hasActiveTreaty(diplomacy, ai.id, targetId, 'trade_pact') &&
      rel.score >= 0 &&
      personality.commerceFocus >= 0.58
    ) {
      const evalRes = evaluateProposalAcceptance(diplomacy, ai.id, targetId, 'trade_pact');
      if (evalRes.accepted) {
        const evt = addDiplomaticTreaty(diplomacy, ai.id, targetId, 'trade_pact', 260, undefined, now);
        events.push(evt);
        ai.lastDiplomacyTimeSec = now;
        ai.lastDecisionSummary = `Signed Trade Pact with ${KINGDOMS[targetId].name}`;
        recordAIDecision(ai, now, 'diplomacy', `Agreed Trade Pact with ${KINGDOMS[targetId].name}`, 0.82);
        return;
      }
    }

    // 3. Defensive Alliance when relation >= 40
    if (
      !targetAI.isPlayer &&
      !hasActiveTreaty(diplomacy, ai.id, targetId, 'defensive_alliance') &&
      rel.score >= 40 &&
      personality.diplomaticBias >= 0.6
    ) {
      const evalRes = evaluateProposalAcceptance(diplomacy, ai.id, targetId, 'defensive_alliance');
      if (evalRes.accepted) {
        const evt = addDiplomaticTreaty(
          diplomacy,
          ai.id,
          targetId,
          'defensive_alliance',
          300,
          undefined,
          now,
        );
        events.push(evt);
        ai.lastDiplomacyTimeSec = now;
        ai.lastDecisionSummary = `Allied with ${KINGDOMS[targetId].name}`;
        recordAIDecision(ai, now, 'diplomacy', `Forged Defensive Alliance with ${KINGDOMS[targetId].name}`, 0.9);
        return;
      }
    }

    // 4. Opportunistic border war if aggressive & clearly stronger & no non-aggression pact
    if (
      !hasActiveTreaty(diplomacy, ai.id, targetId, 'non_aggression') &&
      !hasActiveTreaty(diplomacy, ai.id, targetId, 'defensive_alliance') &&
      personality.aggressionBias >= 0.65 &&
      myArmy.length >= 5 &&
      now > 60 &&
      rel.score <= -5 &&
      myPower > Math.max(60, intel.estimatedMilitaryStrength) * personality.attackStrengthRatio
    ) {
      const warEvt = declareWarBetweenKingdoms(
        diplomacy,
        ai.id,
        targetId,
        'territorial ambition',
        now,
      );
      if (warEvt) {
        events.push(warEvt);
        ai.lastDiplomacyTimeSec = now;
        ai.lastDecisionSummary = `Declared war on ${KINGDOMS[targetId].name}`;
        recordAIDecision(ai, now, 'diplomacy', `Declared war on ${KINGDOMS[targetId].name}`, 0.94);
        return;
      }
    } else if (
      rel.state === 'hostile' &&
      rel.score > -60 &&
      personality.aggressionBias >= 0.55 &&
      now > 40
    ) {
      const shift = updateDiplomaticScore(
        diplomacy,
        ai.id,
        targetId,
        -12,
        'border friction',
        now,
      );
      ai.lastDiplomacyTimeSec = now;
      if (shift.event) events.push(shift.event);
      return;
    }
  }
}

function updateStrategicObjectivesSummary(
  ai: AIKingdomRuntime,
  runtime: EconomyWorldRuntime,
  diplomacy: DiplomacyState,
): void {
  const ledger = resolveKingdomLedger(runtime, ai.id);
  const personality = KINGDOM_PERSONALITIES[ai.id];
  const objs: string[] = [];

  if (ledger.resources.food < 160) {
    objs.push('Stabilize food reserves');
  } else {
    objs.push(`Grow ${personality.archetypeTitle} economy`);
  }

  const warNames = ALL_KINGDOM_IDS.filter(
    (id) => id !== ai.id && diplomacy.relations[ai.id]?.[id]?.state === 'at_war',
  ).map((id) => KINGDOMS[id].name);

  if (warNames.length > 0) {
    objs.push(`Prosecute war vs ${warNames[0]}`);
  } else if ((ai.territories?.length ?? 1) < 2 && personality.expansionism >= 0.6) {
    objs.push('Expand frontier territories');
  } else {
    objs.push('Maintain border deterrence');
  }

  const discoveredCount = Object.values(ai.knownIntelligence ?? {}).filter((i) => i.discovered).length;
  if (discoveredCount < 3) {
    objs.push(`Reconnoitre unknown realms (${discoveredCount}/4)`);
  }

  ai.strategicObjectives = objs.slice(0, 3);
}
