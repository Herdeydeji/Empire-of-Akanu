import { BUILDING_CATALOG } from '../../config/economy';
import { KINGDOM_PERSONALITIES } from '../../config/aiPersonalities';
import { KINGDOMS } from '../../config/kingdoms';
import { MILITARY_UNIT_CATALOG } from '../../config/military';
import {
  AIDifficulty,
  AIKingdomRuntime,
  BuildingArchetype,
  BuildingEntity,
  CharacterEntity,
  CivilianRole,
  EnvironmentNodeEntity,
  KingdomId,
  MilitaryUnitClass,
  RegionConfig,
  ResourceKey,
  WorldEventItem,
} from '../../types/game';
import { sampleTerrainHeight, WATER_LEVEL } from '../math/noise';
import { createVillagerEntity } from '../../config/settlement';
import { DiplomacyState, updateDiplomaticScore } from './diplomacySim';
import { EconomyWorldRuntime } from './economySim';
import { MilitarySimulationState, canRecruitMilitaryUnit, queueUnitRecruitment, spawnMilitaryCharacterEntity } from './militarySim';

const DIFFICULTY_TICK_INTERVALS: Record<AIDifficulty, number> = {
  easy: 3.5,
  normal: 2.2,
  hard: 1.4,
  very_hard: 0.8,
};

export interface AIKingdomManager {
  kingdoms: Record<KingdomId, AIKingdomRuntime>;
  difficulty: AIDifficulty;
}

export function createInitialAIKingdomManager(
  playerKingdomId: KingdomId,
  difficulty: AIDifficulty = 'normal',
  savedData?: AIKingdomRuntime[],
): AIKingdomManager {
  const kingdoms: Record<KingdomId, AIKingdomRuntime> = {} as any;
  const allIds: KingdomId[] = ['oru', 'zambara', 'kemetra', 'aseka', 'nambara'];

  const defaultCenters: Record<KingdomId, { x: number; z: number }> = {
    oru: { x: 0, z: 0 },
    zambara: { x: -48, z: -42 },
    kemetra: { x: 48, z: -42 },
    aseka: { x: -48, z: 42 },
    nambara: { x: 48, z: 42 },
  };

  for (const id of allIds) {
    const isPlayer = id === playerKingdomId;
    const saved = savedData?.find((k) => k.id === id);

    if (saved) {
      kingdoms[id] = { ...saved };
    } else {
      const kConfig = KINGDOMS[id];
      const center = isPlayer ? { x: 0, z: 0 } : defaultCenters[id];

      kingdoms[id] = {
        id,
        name: kConfig.name,
        rulerName: kConfig.title,
        isPlayer,
        settlementCenter: center,
        territoryRadius: 28,
        resources: { food: 500, wood: 400, stone: 250, iron: 150, gold: 150 },
        capacities: { food: 1000, wood: 1000, stone: 800, iron: 500, gold: 500 },
        population: {
          current: 4,
          capacity: 16,
          availableWorkforce: 4,
          employedCount: 4,
          unemployedCount: 0,
          happiness: 85,
          foodSatisfaction: 90,
          growthProgress: 10,
        },
        progressionStage: 'Settlement',
        strategicPosture: 'consolidate',
        decisionTimerSec: (allIds.indexOf(id) * 0.4) % DIFFICULTY_TICK_INTERVALS[difficulty],
        lastDecisionSummary: isPlayer ? 'Player Sovreignty' : 'Establishing regional settlement',
      };
    }
  }

  return { kingdoms, difficulty };
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
  const tickInterval = DIFFICULTY_TICK_INTERVALS[aiManager.difficulty];

  for (const kId of Object.keys(aiManager.kingdoms) as KingdomId[]) {
    const aiKingdom = aiManager.kingdoms[kId];
    if (aiKingdom.isPlayer) continue;

    aiKingdom.decisionTimerSec += dt;
    if (aiKingdom.decisionTimerSec >= tickInterval) {
      aiKingdom.decisionTimerSec = 0;

      // 1. Evaluate & Execute Autonomous Economic Management
      evaluateAndExecuteEconomyAI(aiKingdom, runtime, region, seed);

      // 2. Evaluate & Execute Autonomous Settlement Building Construction
      evaluateAndExecuteSettlementAI(aiKingdom, runtime, region, seed, events);

      // 3. Evaluate & Execute Autonomous Military Recruitment
      evaluateAndExecuteRecruitmentAI(aiKingdom, runtime, militaryState, events);

      // 4. Evaluate & Execute Autonomous Military Strategy & Commands
      evaluateAndExecuteMilitaryStrategyAI(aiKingdom, runtime, diplomacy, events);
    }
  }

  return events;
}

function evaluateAndExecuteEconomyAI(
  ai: AIKingdomRuntime,
  runtime: EconomyWorldRuntime,
  region: RegionConfig,
  seed: number,
): void {
  const kingdomChars = runtime.characters.filter((c) => c.kingdomId === ai.id && !c.isMilitary && c.health > 0);
  if (kingdomChars.length === 0) return;

  const personality = KINGDOM_PERSONALITIES[ai.id];

  // Rebalance villager roles based on current resource shortages and personality focus
  const foodShortage = ai.resources.food < 150;
  const woodShortage = ai.resources.wood < 120;
  const stoneNeed = ai.resources.stone < 100 || personality.defensiveness > 0.8;
  const ironNeed = ai.resources.iron < 80 || personality.engineeringFocus > 0.8;

  for (let i = 0; i < kingdomChars.length; i++) {
    const char = kingdomChars[i];
    if (char.taskType === 'idle' || Math.random() < 0.2) {
      let targetRole: CivilianRole = 'Farmer';

      if (foodShortage) {
        targetRole = 'Farmer';
      } else if (woodShortage) {
        targetRole = 'Woodcutter';
      } else if (stoneNeed && i % 3 === 0) {
        targetRole = 'Miner';
        char.preferredResource = 'stone';
      } else if (ironNeed && i % 4 === 0) {
        targetRole = 'Miner';
        char.preferredResource = 'iron';
      } else if (personality.commerceFocus > 0.8 && i % 5 === 0) {
        targetRole = 'Trader';
      } else {
        const roles: CivilianRole[] = ['Farmer', 'Woodcutter', 'Miner', 'Builder'];
        targetRole = roles[i % roles.length];
      }

      char.role = targetRole;

      // Assign to closest matching resource node or building
      const suitableNode = runtime.resourceNodes.find((n) => {
        if (n.depleted || n.remainingYield <= 0) return false;
        if (targetRole === 'Farmer' && n.resourceType === 'food') return true;
        if (targetRole === 'Woodcutter' && n.resourceType === 'wood') return true;
        if (targetRole === 'Miner' && (n.resourceType === 'stone' || n.resourceType === 'iron' || n.resourceType === 'gold')) return true;
        return false;
      });

      if (suitableNode) {
        char.taskType = 'gather_node';
        char.assignedNodeId = suitableNode.id;
        char.moveTarget = { x: suitableNode.position.x, z: suitableNode.position.z };
      }
    }
  }
}

function evaluateAndExecuteSettlementAI(
  ai: AIKingdomRuntime,
  runtime: EconomyWorldRuntime,
  region: RegionConfig,
  seed: number,
  events: WorldEventItem[],
): void {
  const personality = KINGDOM_PERSONALITIES[ai.id];
  const blds = runtime.buildings.filter((b) => b.kingdomId === ai.id);

  // Check if AI needs more housing
  const currentPop = runtime.characters.filter((c) => c.kingdomId === ai.id).length;
  const needHousing = currentPop >= ai.population.capacity - 2;

  let archetypeToBuild: BuildingArchetype | null = null;

  if (needHousing && ai.resources.wood >= 80) {
    archetypeToBuild = 'dwelling_house';
  } else if (ai.resources.food > ai.capacities.food * 0.8 && ai.resources.wood >= 100) {
    archetypeToBuild = 'granary_storehouse';
  } else if (!blds.some((b) => b.archetype === 'barracks_compound') && ai.resources.wood >= 140 && ai.resources.stone >= 80) {
    archetypeToBuild = 'barracks_compound';
  } else if (!blds.some((b) => b.archetype === 'cultivated_farm') && ai.resources.wood >= 60) {
    archetypeToBuild = 'cultivated_farm';
  } else if (personality.defensiveness > 0.7 && !blds.some((b) => b.archetype === 'watch_post') && ai.resources.wood >= 70 && ai.resources.stone >= 50) {
    archetypeToBuild = 'watch_post';
  } else if (personality.engineeringFocus > 0.8 && !blds.some((b) => b.archetype === 'blacksmith_workshop') && ai.resources.wood >= 120 && ai.resources.iron >= 60) {
    archetypeToBuild = 'blacksmith_workshop';
  } else if (personality.expansionism > 0.8 && !blds.some((b) => b.archetype === 'cavalry_stables') && ai.resources.wood >= 160 && ai.resources.stone >= 100) {
    archetypeToBuild = 'cavalry_stables';
  }

  if (!archetypeToBuild) return;

  const catalog = BUILDING_CATALOG[archetypeToBuild];
  if (!catalog) return;

  // Check affordability
  for (const res of ['food', 'wood', 'stone', 'iron', 'gold'] as ResourceKey[]) {
    if (ai.resources[res] < catalog.cost[res]) return;
  }

  // Find valid position near settlement center
  const angle = Math.random() * Math.PI * 2;
  const dist = 10 + Math.random() * 16;
  const buildX = ai.settlementCenter.x + Math.cos(angle) * dist;
  const buildZ = ai.settlementCenter.z + Math.sin(angle) * dist;
  const buildY = sampleTerrainHeight(buildX, buildZ, region, seed);

  if (buildY < WATER_LEVEL + 0.3) return;

  // Deduct AI resources
  for (const res of ['food', 'wood', 'stone', 'iron', 'gold'] as ResourceKey[]) {
    ai.resources[res] -= catalog.cost[res];
  }

  const newBld: BuildingEntity = {
    id: `bld_ai_${ai.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    category: 'building',
    name: `${KINGDOMS[ai.id].name} ${catalog.name}`,
    archetype: archetypeToBuild,
    buildingClass: catalog.buildingClass,
    kingdomId: ai.id,
    position: { x: buildX, y: buildY, z: buildZ },
    rotationY: Math.random() * Math.PI * 2,
    footprintRadius: catalog.footprintRadius,
    description: catalog.description,
    statusText: 'Under Construction',
    integrity: 10,
    maxIntegrity: catalog.maxIntegrity,
    constructionState: 'under_construction',
    constructionProgress: 0.1,
    constructionWorkRequired: catalog.constructionWorkRequired,
    constructionCost: { ...catalog.cost },
    housingBonus: catalog.housingBonus,
    storageBonus: { ...catalog.storageBonus },
    acceptsStorage: [...catalog.acceptsStorage],
    assignedWorkerIds: [],
    maxWorkers: catalog.maxWorkers,
  };

  runtime.buildings.push(newBld);
  runtime.dirtyBuildingIds.add(newBld.id);

  ai.lastDecisionSummary = `Constructed ${catalog.name}`;
  events.push({
    id: `evt_bld_${Date.now()}`,
    timestampSec: runtime.elapsedSeconds,
    title: `${KINGDOMS[ai.id].name} Construction`,
    description: `${KINGDOMS[ai.id].name} initiated construction of a new ${catalog.name}.`,
    sourceKingdomId: ai.id,
    kind: 'economy',
  });
}

function evaluateAndExecuteRecruitmentAI(
  ai: AIKingdomRuntime,
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
  events: WorldEventItem[],
): void {
  const personality = KINGDOM_PERSONALITIES[ai.id];
  const aiMilitaryCount = runtime.characters.filter((c) => c.kingdomId === ai.id && c.isMilitary && c.health > 0).length;

  if (aiMilitaryCount >= 16) return; // Cap AI peacetime army

  // Find AI military structure
  const barracks = runtime.buildings.find(
    (b) => b.kingdomId === ai.id && (b.archetype === 'barracks_compound' || b.archetype === 'cavalry_stables' || b.archetype === 'archery_grounds') && b.constructionState === 'completed',
  );

  if (!barracks) return;

  // Choose unit class based on kingdom personality
  const chosenClass: MilitaryUnitClass = personality.preferredUnits[Math.floor(Math.random() * personality.preferredUnits.length)];
  const bp = MILITARY_UNIT_CATALOG[chosenClass];
  if (!bp) return;

  const check = canRecruitMilitaryUnit(chosenClass, barracks, runtime);
  if (check.ok) {
    // Spawn soldier at rally point or barracks
    const rallyX = barracks.position.x + (Math.random() - 0.5) * 6;
    const rallyZ = barracks.position.z + (Math.random() - 0.5) * 6;

    const newSoldier = spawnMilitaryCharacterEntity(
      chosenClass,
      ai.id,
      rallyX,
      rallyZ,
      runtime.seed,
    );

    newSoldier.isHostile = false; // Set hostility based on diplomatic relation dynamically in step
    runtime.characters.push(newSoldier);

    ai.lastDecisionSummary = `Recruited ${bp.name}`;
  }
}

function evaluateAndExecuteMilitaryStrategyAI(
  ai: AIKingdomRuntime,
  runtime: EconomyWorldRuntime,
  diplomacy: DiplomacyState,
  events: WorldEventItem[],
): void {
  const aiArmy = runtime.characters.filter((c) => c.kingdomId === ai.id && c.isMilitary && c.health > 0);
  if (aiArmy.length === 0) return;

  // Check diplomatic relations with other kingdoms
  for (const targetId of Object.keys(diplomacy.relations[ai.id] || {}) as KingdomId[]) {
    const rel = diplomacy.relations[ai.id][targetId];
    if (!rel) continue;

    // Dynamically mark unit hostility
    const targetUnits = runtime.characters.filter((c) => c.kingdomId === targetId && c.health > 0);
    const isAtWar = rel.state === 'at_war' || rel.state === 'hostile';

    // Patrol or march toward target if hostile
    if (isAtWar && aiArmy.length >= 4) {
      const targetSettlement = targetUnits[0]?.position || { x: 0, z: 0 };
      for (const unit of aiArmy) {
        if (!unit.targetEntityId) {
          unit.moveTarget = {
            x: targetSettlement.x + (Math.random() - 0.5) * 8,
            z: targetSettlement.z + (Math.random() - 0.5) * 8,
          };
          unit.taskType = 'military_march';
          unit.activityLabel = `Marching against ${KINGDOMS[targetId].name}`;
        }
      }
      ai.strategicPosture = 'attack';
      ai.lastDecisionSummary = `Campaign against ${KINGDOMS[targetId].name}`;
      break;
    } else {
      // Defensive patrol around settlement
      ai.strategicPosture = 'fortify';
      for (const unit of aiArmy) {
        if (unit.taskType === 'idle' || Math.random() < 0.15) {
          const pAngle = Math.random() * Math.PI * 2;
          const pDist = 8 + Math.random() * 12;
          unit.moveTarget = {
            x: ai.settlementCenter.x + Math.cos(pAngle) * pDist,
            z: ai.settlementCenter.z + Math.sin(pAngle) * pDist,
          };
          unit.taskType = 'military_patrol';
          unit.activityLabel = 'Patrolling border perimeter';
        }
      }
    }
  }
}
