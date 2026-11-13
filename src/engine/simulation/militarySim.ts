import { KINGDOMS } from '../../config/kingdoms';
import {
  calculateCombatDamageMultiplier,
  calculateFormationOffsets,
  KINGDOM_MILITARY_BONUSES,
  MILITARY_UNIT_CATALOG,
  MilitaryUnitBlueprint,
} from '../../config/military';
import { REGIONS } from '../../config/regions';
import {
  ArrowProjectile,
  BuildingEntity,
  CharacterEntity,
  KingdomId,
  MilitaryFormationType,
  MilitaryOverviewState,
  MilitaryStance,
  MilitaryStatistics,
  MilitaryUnitClass,
  RegionConfig,
  ResourceAmounts,
  ResourceKey,
  WorldEventItem,
} from '../../types/game';
import { sampleTerrainHeight, WATER_LEVEL } from '../math/noise';
import type { AIKingdomManager } from './aiKingdomSim';
import { DiplomacyState, updateDiplomaticScore } from './diplomacySim';
import {
  EconomyWorldRuntime,
  pushEconomyNotification,
  resolveKingdomLedger,
  spendResourcesValidated,
} from './economySim';

const MORALE_BASE = 100;
const MORALE_FLEE_THRESHOLD = 20;

export interface CombatHitEvent {
  targetId: string;
  damage: number;
  attackerId: string;
  isFatal: boolean;
  x: number;
  y: number;
  z: number;
}

export interface MilitarySimulationState {
  projectiles: ArrowProjectile[];
  recentHits: CombatHitEvent[];
  stats: MilitaryStatistics;
  upkeepTimer: number;
  hasUpkeepDeficit: boolean;
}

export function createInitialMilitaryState(
  existingStats?: Partial<MilitaryStatistics>,
): MilitarySimulationState {
  return {
    projectiles: [],
    recentHits: [],
    stats: {
      unitsRecruited: existingStats?.unitsRecruited ?? 0,
      enemiesDefeated: existingStats?.enemiesDefeated ?? 0,
      alliesLost: existingStats?.alliesLost ?? 0,
      structuresRazed: existingStats?.structuresRazed ?? 0,
    },
    upkeepTimer: 0,
    hasUpkeepDeficit: false,
  };
}

export function getMilitaryUnitsForBuilding(
  archetype: BuildingEntity['archetype'],
): MilitaryUnitBlueprint[] {
  return Object.values(MILITARY_UNIT_CATALOG).filter(
    (bp) => bp.recruitingBuilding === archetype,
  );
}

export function areEntitiesHostile(
  attacker: { kingdomId: KingdomId; isHostile?: boolean },
  target: { kingdomId: KingdomId; isHostile?: boolean },
  diplomacy?: DiplomacyState,
): boolean {
  if (attacker.kingdomId !== target.kingdomId) {
    if (diplomacy) {
      const state = diplomacy.relations[attacker.kingdomId]?.[target.kingdomId]?.state;
      return state === 'at_war' || state === 'hostile';
    }
    return Boolean(attacker.isHostile) !== Boolean(target.isHostile);
  }
  return Boolean(attacker.isHostile) !== Boolean(target.isHostile);
}

export function canRecruitMilitaryUnit(
  unitClass: MilitaryUnitClass,
  building: BuildingEntity,
  runtime: EconomyWorldRuntime,
): { ok: boolean; reason?: string; cost: ResourceAmounts } {
  const bp = MILITARY_UNIT_CATALOG[unitClass];
  if (!bp) {
    return {
      ok: false,
      reason: 'Unknown unit class',
      cost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
    };
  }

  if (building.archetype !== bp.recruitingBuilding) {
    return { ok: false, reason: `Must recruit at ${bp.recruitingBuilding}`, cost: bp.cost };
  }
  if (building.constructionState !== 'completed') {
    return { ok: false, reason: 'Building is under construction', cost: bp.cost };
  }
  if (building.integrity < building.maxIntegrity * 0.25) {
    return {
      ok: false,
      reason: 'Building is severely damaged and must be repaired',
      cost: bp.cost,
    };
  }

  const kId = building.kingdomId || runtime.kingdomId;
  const ledger = resolveKingdomLedger(runtime, kId);

  // Check kingdom progression requirement
  if (bp.requiresProgression) {
    const progressionRanks = [
      'Village',
      'Settlement',
      'Town',
      'Fortified City',
      'Kingdom',
      'Empire',
    ];
    const currentRank = progressionRanks.indexOf(ledger.progressionStage);
    const requiredRank = progressionRanks.indexOf(bp.requiresProgression);
    if (currentRank < requiredRank) {
      return {
        ok: false,
        reason: `Requires ${bp.requiresProgression} progression (current: ${ledger.progressionStage})`,
        cost: bp.cost,
      };
    }
  }

  // Calculate adjusted cost with kingdom bonuses
  const bonus = KINGDOM_MILITARY_BONUSES[kId];
  let costMult = bonus.militaryRecruitmentCostMult;
  if (bp.isSiegeEngine) {
    costMult *= 1 - bonus.siegeCostReduction;
  }
  const adjustedCost: ResourceAmounts = {
    food: Math.round(bp.cost.food * costMult),
    wood: Math.round(bp.cost.wood * costMult),
    stone: Math.round(bp.cost.stone * costMult),
    iron: Math.round(bp.cost.iron * costMult),
    gold: Math.round(bp.cost.gold * costMult),
  };

  // Check resource affordability against owning kingdom's treasury
  for (const k of ['food', 'wood', 'stone', 'iron', 'gold'] as ResourceKey[]) {
    if (ledger.resources[k] < adjustedCost[k]) {
      return {
        ok: false,
        reason: `Insufficient ${k} (need ${adjustedCost[k]})`,
        cost: adjustedCost,
      };
    }
  }

  // Check owning kingdom population capacity (including active queued slots across its barracks)
  const kChars = runtime.characters.filter(
    (c) => c.kingdomId === kId && c.health > 0,
  ).length;
  const currentTotal = Math.max(kChars, ledger.population.current);
  if (currentTotal + bp.populationCost > ledger.population.capacity) {
    return {
      ok: false,
      reason: `Housing limit reached (${currentTotal}/${ledger.population.capacity}). Build more dwellings.`,
      cost: adjustedCost,
    };
  }

  // Check queue length (max 5 queued units per building)
  const qLen = building.recruitmentQueue?.length ?? 0;
  if (qLen >= 5) {
    return { ok: false, reason: 'Recruitment queue is full (max 5)', cost: adjustedCost };
  }

  return { ok: true, cost: adjustedCost };
}

export function queueUnitRecruitment(
  unitClass: MilitaryUnitClass,
  building: BuildingEntity,
  runtime: EconomyWorldRuntime,
): boolean {
  const kId = building.kingdomId || runtime.kingdomId;
  const ledger = resolveKingdomLedger(runtime, kId);
  const check = canRecruitMilitaryUnit(unitClass, building, runtime);
  if (!check.ok) {
    if (ledger.isPlayer) {
      pushEconomyNotification(
        runtime,
        `recruit_failed_${unitClass}`,
        'alert',
        check.reason ?? 'Cannot recruit unit',
        3,
      );
    }
    return false;
  }

  if (!spendResourcesValidated(runtime, check.cost, kId)) {
    return false;
  }

  const bp = MILITARY_UNIT_CATALOG[unitClass];
  if (!building.recruitmentQueue) {
    building.recruitmentQueue = [];
  }

  const item = {
    id: `queue_${Math.round(runtime.elapsedSeconds * 100)}_${Math.random().toString(36).slice(2, 6)}`,
    unitClass,
    progressSec: 0,
    totalDurationSec: bp.recruitmentDurationSec,
    cost: check.cost,
  };
  building.recruitmentQueue.push(item);
  runtime.dirtyBuildingIds.add(building.id);

  if (ledger.isPlayer) {
    pushEconomyNotification(
      runtime,
      `recruiting_${unitClass}`,
      'info',
      `Recruiting ${bp.name} at ${building.name} (${Math.round(bp.recruitmentDurationSec)}s).`,
      2,
    );
  }
  return true;
}

export function cancelQueuedUnitRecruitment(
  building: BuildingEntity,
  index: number,
  runtime: EconomyWorldRuntime,
): boolean {
  if (!building.recruitmentQueue || index < 0 || index >= building.recruitmentQueue.length) {
    return false;
  }
  const [removed] = building.recruitmentQueue.splice(index, 1);
  if (removed) {
    const kId = building.kingdomId || runtime.kingdomId;
    const ledger = resolveKingdomLedger(runtime, kId);
    // Refund 90% of recruitment cost to owning kingdom
    for (const k of ['food', 'wood', 'stone', 'iron', 'gold'] as ResourceKey[]) {
      const refund = Math.floor(removed.cost[k] * 0.9);
      if (refund > 0) {
        ledger.resources[k] = Math.min(ledger.capacities[k], ledger.resources[k] + refund);
      }
    }
    runtime.dirtyBuildingIds.add(building.id);
    return true;
  }
  return false;
}

export function createMilitaryUnitEntity(params: {
  id: string;
  name: string;
  unitClass: MilitaryUnitClass;
  kingdomId: KingdomId;
  x: number;
  z: number;
  region: RegionConfig;
  seed: number;
  isHostile?: boolean;
}): CharacterEntity {
  const bp = MILITARY_UNIT_CATALOG[params.unitClass];
  const bonus = KINGDOM_MILITARY_BONUSES[params.kingdomId];
  const palette = KINGDOMS[params.kingdomId]?.palette;
  const y = Math.max(
    WATER_LEVEL + 0.05,
    sampleTerrainHeight(params.x, params.z, params.region, params.seed),
  );

  let dmg = bp.attackDamage;
  let def = bp.defense;
  let spd = bp.moveSpeed;
  let rng = bp.attackRange;

  if (bp.category === 'Infantry') {
    dmg = Math.round(dmg * bonus.infantryDamageMult);
    def = Math.round(def * bonus.infantryDefenseMult);
  } else if (bp.category === 'Cavalry') {
    spd = Number((spd * bonus.cavalrySpeedMult).toFixed(2));
  } else if (bp.category === 'Ranged') {
    dmg = Math.round(dmg * bonus.archerDamageMult);
    rng = Number((rng * bonus.archerRangeMult).toFixed(1));
  } else if (bp.category === 'Siege') {
    dmg = Math.round(dmg * bonus.siegeDamageMult);
  }

  const skinTones = ['#4a2c18', '#5c3820', '#3b2213', '#6b4226', '#4f301c'];
  const hash = Math.abs(Math.floor(params.x * 137 + params.z * 311));

  return {
    id: params.id,
    category: 'character',
    name: params.name,
    role: 'Unemployed',
    kingdomId: params.kingdomId,
    position: { x: params.x, y, z: params.z },
    rotationY: 0,
    speed: 0,
    animationState: 'idle',
    activityLabel: `${bp.name} · Standing by`,
    gaitPhase: (hash % 100) * 0.1,
    waypoints: [],
    currentWaypointIndex: 0,
    waitTimer: 0,
    health: bp.health,
    maxHealth: bp.health,
    tunicColor: params.isHostile ? '#78231c' : (palette?.primary ?? '#8f3c25'),
    accentColor: params.isHostile ? '#c44536' : (palette?.accent ?? '#e5aa4b'),
    skinTone: skinTones[hash % skinTones.length],
    propType: bp.propType,
    taskType: 'idle',
    carriedResource: null,
    carriedAmount: 0,
    carryCapacity: 0,
    assignedNodeId: null,
    assignedBuildingId: null,
    deliveryBuildingId: null,
    moveTarget: null,
    workProgress: 0,
    productivity: 1.0,
    preferredResource: null,
    isMilitary: true,
    militaryClass: params.unitClass,
    isHostile: params.isHostile ?? false,
    formation: 'line',
    stance: 'defensive',
    combatState: 'idle',
    targetEntityId: null,
    attackCooldownTimer: 0,
    attackSpeedSec: bp.attackSpeedSec,
    attackRange: rng,
    attackDamage: dmg,
    defense: def,
    moveSpeedCombat: spd,
    morale: MORALE_BASE,
    experience: 0,
    veterancyLevel: 1,
    isMounted: bp.isMounted ?? false,
    isSiegeEngine: bp.isSiegeEngine ?? false,
    isCommander: bp.isCommander ?? false,
    commanderAuraRadius: bp.isCommander ? 18.0 : undefined,
    assignedCommanderId: null,
    formationOffset: { x: 0, z: 0 },
    chargeSpeedMultiplier: bp.category === 'Cavalry' ? 1.6 : 1.0,
    isCharging: false,
    lastHitTimeSec: 0,
  };
}

export function spawnCompletedRecruit(
  building: BuildingEntity,
  unitClass: MilitaryUnitClass,
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
  aiManager?: AIKingdomManager,
): CharacterEntity {
  const kId = building.kingdomId || runtime.kingdomId;
  const ledger = resolveKingdomLedger(runtime, kId);
  const count =
    runtime.characters.filter((c) => c.kingdomId === kId && c.militaryClass === unitClass)
      .length + 1;
  const bp = MILITARY_UNIT_CATALOG[unitClass];
  const rallyX =
    building.rallyPoint?.x ?? building.position.x + (Math.random() - 0.5) * 4;
  const rallyZ =
    building.rallyPoint?.z ?? building.position.z + building.footprintRadius + 2.5;

  const unit = createMilitaryUnitEntity({
    id: `mil_${kId}_${unitClass}_${Math.round(runtime.elapsedSeconds * 100)}_${count}_${Math.random().toString(36).slice(2, 5)}`,
    name: `${bp.name} #${count}`,
    unitClass,
    kingdomId: kId,
    x: rallyX,
    z: rallyZ,
    region: runtime.region,
    seed: runtime.seed,
    isHostile: false,
  });

  runtime.characters.push(unit);
  runtime.newlySpawnedCharacters.push(unit);

  if (ledger.isPlayer) {
    militaryState.stats.unitsRecruited += 1;
    pushEconomyNotification(
      runtime,
      `recruited_${unit.id}`,
      'success',
      `${unit.name} mustered at ${building.name}.`,
      2,
    );
  } else if (aiManager?.kingdoms[kId]) {
    const ai = aiManager.kingdoms[kId];
    if (!ai.militaryStats) {
      ai.militaryStats = {
        unitsRecruited: 0,
        enemiesDefeated: 0,
        alliesLost: 0,
        structuresRazed: 0,
      };
    }
    ai.militaryStats.unitsRecruited += 1;
  }

  return unit;
}

export function commandMilitaryMove(
  units: CharacterEntity[],
  targetX: number,
  targetZ: number,
  formation: MilitaryFormationType = 'line',
): void {
  const militaryOnly = units.filter((u) => u.isMilitary);
  if (militaryOnly.length === 0) return;

  const offsets = calculateFormationOffsets(formation, militaryOnly.length, 2.2);

  for (let i = 0; i < militaryOnly.length; i++) {
    const u = militaryOnly[i];
    const off = offsets[i] ?? { x: 0, z: 0 };
    u.formation = formation;
    u.formationOffset = off;
    u.moveTarget = {
      x: Math.max(-90, Math.min(90, targetX + off.x)),
      z: Math.max(-90, Math.min(90, targetZ + off.z)),
    };
    u.targetEntityId = null;
    u.combatState = 'marching';
    u.taskType = 'military_march';
    u.activityLabel = `Marching in ${formation} formation`;
  }
}

export function commandMilitaryAttack(
  units: CharacterEntity[],
  targetEntity: CharacterEntity | BuildingEntity,
): void {
  const militaryOnly = units.filter((u) => u.isMilitary);
  if (militaryOnly.length === 0) return;

  for (let i = 0; i < militaryOnly.length; i++) {
    const u = militaryOnly[i];
    u.targetEntityId = targetEntity.id;
    u.combatState = 'engaging';
    u.taskType = 'military_attack';
    u.activityLabel = `Attacking ${targetEntity.name}`;
    const dist = Math.hypot(
      targetEntity.position.x - u.position.x,
      targetEntity.position.z - u.position.z,
    );
    if (u.militaryClass === 'cavalry' && dist > 8.0) {
      u.isCharging = true;
      u.combatState = 'charging';
      u.activityLabel = `Charging at ${targetEntity.name}`;
    }
  }
}

export function commandMilitaryFormation(
  units: CharacterEntity[],
  formation: MilitaryFormationType,
): void {
  const militaryOnly = units.filter((u) => u.isMilitary);
  if (militaryOnly.length === 0) return;

  const offsets = calculateFormationOffsets(formation, militaryOnly.length, 2.2);
  let cx = 0;
  let cz = 0;
  for (const u of militaryOnly) {
    cx += u.position.x;
    cz += u.position.z;
  }
  cx /= militaryOnly.length;
  cz /= militaryOnly.length;

  for (let i = 0; i < militaryOnly.length; i++) {
    const u = militaryOnly[i];
    u.formation = formation;
    const off = offsets[i] ?? { x: 0, z: 0 };
    u.formationOffset = off;
    u.moveTarget = {
      x: Math.max(-90, Math.min(90, cx + off.x)),
      z: Math.max(-90, Math.min(90, cz + off.z)),
    };
    u.combatState = 'marching';
    u.taskType = 'military_march';
    u.activityLabel = `Adopting ${formation} formation`;
  }
}

export function commandMilitaryStance(
  units: CharacterEntity[],
  stance: MilitaryStance,
): void {
  for (const u of units) {
    if (!u.isMilitary) continue;
    u.stance = stance;
    u.activityLabel = `Stance set to ${stance}`;
  }
}

export function getMilitaryOverview(
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
  targetKingdomId?: KingdomId,
): MilitaryOverviewState {
  const kId = targetKingdomId ?? runtime.kingdomId;
  const milUnits = runtime.characters.filter(
    (c) => c.kingdomId === kId && c.isMilitary && !c.isHostile && c.health > 0,
  );
  const unitsByClass: Record<MilitaryUnitClass, number> = {
    infantry: 0,
    spearman: 0,
    archer: 0,
    cavalry: 0,
    royal_guard: 0,
    scout: 0,
    siege_engineer: 0,
    battering_ram: 0,
    catapult: 0,
    siege_tower: 0,
    commander: 0,
  };

  const upkeep: ResourceAmounts = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 };
  let commandersCount = 0;

  for (const u of milUnits) {
    if (u.militaryClass) {
      unitsByClass[u.militaryClass] = (unitsByClass[u.militaryClass] ?? 0) + 1;
      const bp = MILITARY_UNIT_CATALOG[u.militaryClass];
      if (bp?.upkeepPerMinute) {
        for (const [k, v] of Object.entries(bp.upkeepPerMinute)) {
          upkeep[k as ResourceKey] += v ?? 0;
        }
      }
      if (bp?.isCommander) commandersCount++;
    }
  }

  let activeQueues = 0;
  for (const b of runtime.buildings) {
    if (b.kingdomId === kId && b.recruitmentQueue && b.recruitmentQueue.length > 0) {
      activeQueues += b.recruitmentQueue.length;
    }
  }

  return {
    totalMilitaryPopulation: milUnits.length,
    upkeepPerMinute: upkeep,
    hasUpkeepDeficit: militaryState.hasUpkeepDeficit,
    activeRecruitmentCount: activeQueues,
    commandersCount,
    unitsByClass,
  };
}

function recordCombatHostilityAndCasualties(params: {
  attackerKingdomId?: KingdomId;
  victimKingdomId: KingdomId;
  isBuilding: boolean;
  isFatal: boolean;
  runtime: EconomyWorldRuntime;
  militaryState: MilitarySimulationState;
  diplomacy?: DiplomacyState;
  aiManager?: AIKingdomManager;
  events?: WorldEventItem[];
}): void {
  const {
    attackerKingdomId,
    victimKingdomId,
    isBuilding,
    isFatal,
    runtime,
    militaryState,
    diplomacy,
    aiManager,
    events,
  } = params;

  if (
    diplomacy &&
    attackerKingdomId &&
    attackerKingdomId !== victimKingdomId
  ) {
    const rel = diplomacy.relations[attackerKingdomId]?.[victimKingdomId];
    if (rel && rel.state !== 'at_war') {
      const res = updateDiplomaticScore(
        diplomacy,
        attackerKingdomId,
        victimKingdomId,
        -25,
        'armed aggression',
        runtime.elapsedSeconds,
      );
      if (res.event && events) {
        events.push(res.event);
      }
    }
    const aiAttacker = aiManager?.kingdoms[attackerKingdomId];
    const aiVictim = aiManager?.kingdoms[victimKingdomId];
    if (aiVictim?.knownIntelligence?.[attackerKingdomId]) {
      aiVictim.knownIntelligence[attackerKingdomId].recentHostileActions += 1;
      aiVictim.knownIntelligence[attackerKingdomId].discovered = true;
    }
    if (aiAttacker?.knownIntelligence?.[victimKingdomId]) {
      aiAttacker.knownIntelligence[victimKingdomId].discovered = true;
    }
  }

  if (!isFatal) return;

  if (isBuilding) {
    if (attackerKingdomId === runtime.kingdomId || victimKingdomId !== runtime.kingdomId) {
      militaryState.stats.structuresRazed += 1;
    }
    if (attackerKingdomId && aiManager?.kingdoms[attackerKingdomId]?.militaryStats) {
      aiManager.kingdoms[attackerKingdomId].militaryStats!.structuresRazed += 1;
    }
  } else {
    if (victimKingdomId === runtime.kingdomId) {
      militaryState.stats.alliesLost += 1;
    } else if (!attackerKingdomId || attackerKingdomId === runtime.kingdomId) {
      militaryState.stats.enemiesDefeated += 1;
    }

    if (attackerKingdomId && aiManager?.kingdoms[attackerKingdomId]?.militaryStats) {
      aiManager.kingdoms[attackerKingdomId].militaryStats!.enemiesDefeated += 1;
    }
    if (aiManager?.kingdoms[victimKingdomId]?.militaryStats) {
      aiManager.kingdoms[victimKingdomId].militaryStats!.alliesLost += 1;
    }
  }
}

export function stepMilitaryRecruitmentQueues(
  dt: number,
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
  aiManager?: AIKingdomManager,
): void {
  for (let i = 0; i < runtime.buildings.length; i++) {
    const b = runtime.buildings[i];
    if (!b.recruitmentQueue || b.recruitmentQueue.length === 0) continue;
    if (b.constructionState !== 'completed') continue;

    const currentItem = b.recruitmentQueue[0];
    currentItem.progressSec += dt;

    if (currentItem.progressSec >= currentItem.totalDurationSec) {
      b.recruitmentQueue.shift();
      spawnCompletedRecruit(b, currentItem.unitClass, runtime, militaryState, aiManager);
      runtime.dirtyBuildingIds.add(b.id);
    }
  }
}

export function stepProjectiles(
  dt: number,
  militaryState: MilitarySimulationState,
  runtime: EconomyWorldRuntime,
  diplomacy?: DiplomacyState,
  aiManager?: AIKingdomManager,
  events?: WorldEventItem[],
): void {
  const remaining: ArrowProjectile[] = [];

  for (let i = 0; i < militaryState.projectiles.length; i++) {
    const p = militaryState.projectiles[i];
    p.progress += dt * p.speed;

    if (p.progress >= 1.0) {
      const targetChar = runtime.characters.find((c) => c.id === p.targetEntityId);
      const targetBld = !targetChar
        ? runtime.buildings.find((b) => b.id === p.targetEntityId)
        : null;

      if (targetChar && targetChar.health > 0) {
        const netDmg = Math.max(2, p.damage - (targetChar.defense ?? 0) * 0.45);
        targetChar.health = Math.max(0, targetChar.health - netDmg);
        targetChar.morale = Math.max(0, (targetChar.morale ?? 100) - netDmg * 0.55);
        targetChar.lastHitTimeSec = runtime.elapsedSeconds;
        targetChar.animationState = targetChar.health <= 0 ? 'dead' : 'taking_damage';

        p.onImpact?.(netDmg, targetChar.id);

        militaryState.recentHits.push({
          targetId: targetChar.id,
          damage: netDmg,
          attackerId: p.id,
          isFatal: targetChar.health <= 0,
          x: targetChar.position.x,
          y: targetChar.position.y + 1.0,
          z: targetChar.position.z,
        });

        recordCombatHostilityAndCasualties({
          attackerKingdomId: p.attackerKingdomId,
          victimKingdomId: targetChar.kingdomId,
          isBuilding: false,
          isFatal: targetChar.health <= 0,
          runtime,
          militaryState,
          diplomacy,
          aiManager,
          events,
        });
      } else if (targetBld && targetBld.integrity > 0) {
        const siegeMult = p.isSiege ? 3.5 : 1.0;
        const netDmg = Math.max(1, p.damage * siegeMult - 5);
        targetBld.integrity = Math.max(0, targetBld.integrity - netDmg);
        runtime.dirtyBuildingIds.add(targetBld.id);
        if (targetBld.integrity <= 0) {
          targetBld.constructionState = 'destroyed';
        }

        p.onImpact?.(netDmg, targetBld.id);

        militaryState.recentHits.push({
          targetId: targetBld.id,
          damage: netDmg,
          attackerId: p.id,
          isFatal: targetBld.integrity <= 0,
          x: targetBld.position.x,
          y: targetBld.position.y + 1.5,
          z: targetBld.position.z,
        });

        recordCombatHostilityAndCasualties({
          attackerKingdomId: p.attackerKingdomId,
          victimKingdomId: targetBld.kingdomId,
          isBuilding: true,
          isFatal: targetBld.integrity <= 0,
          runtime,
          militaryState,
          diplomacy,
          aiManager,
          events,
        });
      }
    } else {
      remaining.push(p);
    }
  }

  militaryState.projectiles = remaining;
}

function advanceMilitaryUnitStep(
  u: CharacterEntity,
  dirX: number,
  dirZ: number,
  stepDist: number,
  speedValue: number,
  anim: CharacterEntity['animationState'],
  gaitRate: number,
  dt: number,
  runtime: EconomyWorldRuntime,
): void {
  let nextX = Math.max(-92, Math.min(92, u.position.x + dirX * stepDist));
  let nextZ = Math.max(-92, Math.min(92, u.position.z + dirZ * stepDist));
  let nextY = sampleTerrainHeight(nextX, nextZ, runtime.region, runtime.seed);

  if (nextY < WATER_LEVEL - 0.08) {
    const altY1 = sampleTerrainHeight(nextX, u.position.z, runtime.region, runtime.seed);
    const altY2 = sampleTerrainHeight(u.position.x, nextZ, runtime.region, runtime.seed);
    if (altY1 >= WATER_LEVEL - 0.08) {
      nextZ = u.position.z;
      nextY = altY1;
    } else if (altY2 >= WATER_LEVEL - 0.08) {
      nextX = u.position.x;
      nextY = altY2;
    } else {
      const center = resolveKingdomLedger(runtime, u.kingdomId).settlementCenter;
      const cx = center.x - u.position.x;
      const cz = center.z - u.position.z;
      const cLen = Math.hypot(cx, cz) || 1;
      nextX = u.position.x + (cx / cLen) * stepDist;
      nextZ = u.position.z + (cz / cLen) * stepDist;
      nextY = sampleTerrainHeight(nextX, nextZ, runtime.region, runtime.seed);
    }
  }

  u.position.x = nextX;
  u.position.z = nextZ;
  u.position.y = Math.max(WATER_LEVEL + 0.05, nextY);
  u.speed = speedValue;
  u.animationState = anim;
  u.gaitPhase += dt * gaitRate;
}

export function stepMilitaryUnits(
  dt: number,
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
  diplomacy?: DiplomacyState,
  aiManager?: AIKingdomManager,
  events?: WorldEventItem[],
): void {
  const chars = runtime.characters;
  const militaryUnits = chars.filter((c) => c.isMilitary && c.health > 0);

  if (militaryState.recentHits.length > 24) {
    militaryState.recentHits.splice(0, militaryState.recentHits.length - 24);
  }

  for (let i = 0; i < militaryUnits.length; i++) {
    const u = militaryUnits[i];

    if (u.attackCooldownTimer && u.attackCooldownTimer > 0) {
      u.attackCooldownTimer = Math.max(0, u.attackCooldownTimer - dt);
    }

    // 1. Check commander aura & upkeep morale effect
    let commanderNearby = false;
    for (let j = 0; j < militaryUnits.length; j++) {
      const other = militaryUnits[j];
      if (
        other.isCommander &&
        other.kingdomId === u.kingdomId &&
        Boolean(other.isHostile) === Boolean(u.isHostile)
      ) {
        const d = Math.hypot(
          other.position.x - u.position.x,
          other.position.z - u.position.z,
        );
        if (d <= (other.commanderAuraRadius ?? 18.0)) {
          commanderNearby = true;
          break;
        }
      }
    }

    const aiDeficit =
      u.kingdomId === runtime.kingdomId
        ? militaryState.hasUpkeepDeficit
        : Boolean(aiManager?.kingdoms[u.kingdomId]?.hasUpkeepDeficit);
    const moraleRecovery = aiDeficit ? -0.6 : commanderNearby ? 6 : 1.5;
    u.morale = Math.min(100, Math.max(0, (u.morale ?? MORALE_BASE) + moraleRecovery * dt));

    // Check morale routing back to home compound
    if (
      u.combatState === 'routing' ||
      ((u.morale ?? 100) <= MORALE_FLEE_THRESHOLD &&
        u.health < u.maxHealth * 0.45 &&
        u.stance !== 'stand_ground')
    ) {
      const home = resolveKingdomLedger(runtime, u.kingdomId).settlementCenter;
      const hDx = home.x - u.position.x;
      const hDz = home.z - u.position.z;
      const hDist = Math.hypot(hDx, hDz);
      if (hDist > 5 && (u.morale ?? 100) < 48) {
        u.combatState = 'routing';
        u.targetEntityId = null;
        u.activityLabel = 'Morale broken · Retreating to settlement';
        u.rotationY = Math.atan2(hDx, hDz);
        const spd = (u.moveSpeedCombat ?? 3.0) * 1.15;
        advanceMilitaryUnitStep(
          u,
          hDx / hDist,
          hDz / hDist,
          Math.min(hDist, spd * dt),
          spd,
          'running',
          10,
          dt,
          runtime,
        );
        continue;
      } else if ((u.morale ?? 100) >= 42 || hDist <= 5) {
        u.combatState = 'idle';
      }
    }

    // 2. Autonomous Target Acquisition (Characters first, then enemy structures)
    if (!u.targetEntityId || u.targetEntityId === '') {
      if (u.stance !== 'stand_ground') {
        const scanRange =
          u.stance === 'aggressive' || u.taskType === 'military_march' ? 25.0 : 13.0;
        let closestDist = scanRange;
        let foundChar: CharacterEntity | null = null;

        for (let j = 0; j < chars.length; j++) {
          const candidate = chars[j];
          if (candidate.health <= 0) continue;
          if (!areEntitiesHostile(u, candidate, diplomacy)) continue;
          const d = Math.hypot(
            candidate.position.x - u.position.x,
            candidate.position.z - u.position.z,
          );
          // Slightly prioritize enemy soldiers over non-combatant civilians
          const scoreDist = candidate.isMilitary ? d : d + 5.0;
          if (scoreDist < closestDist) {
            closestDist = scoreDist;
            foundChar = candidate;
          }
        }

        if (foundChar) {
          u.targetEntityId = foundChar.id;
          u.combatState = 'engaging';
          u.activityLabel = `Engaging ${foundChar.name}`;
        } else if (u.stance === 'aggressive' || u.taskType === 'military_march') {
          let bestBldDist = scanRange * 1.25;
          let foundBld: BuildingEntity | null = null;
          for (let j = 0; j < runtime.buildings.length; j++) {
            const b = runtime.buildings[j];
            if (b.constructionState === 'destroyed' || b.integrity <= 0) continue;
            if (!areEntitiesHostile(u, b, diplomacy)) continue;
            const d = Math.hypot(
              b.position.x - u.position.x,
              b.position.z - u.position.z,
            );
            if (d < bestBldDist) {
              bestBldDist = d;
              foundBld = b;
            }
          }
          if (foundBld) {
            u.targetEntityId = foundBld.id;
            u.combatState = 'engaging';
            u.activityLabel = `Besieging ${foundBld.name}`;
          }
        }
      }
    }

    // 3. Combat Execution against Target
    if (u.targetEntityId) {
      const targetChar = chars.find((c) => c.id === u.targetEntityId && c.health > 0);
      const targetBld = !targetChar
        ? runtime.buildings.find(
            (b) =>
              b.id === u.targetEntityId &&
              b.constructionState !== 'destroyed' &&
              b.integrity > 0,
          )
        : null;

      if (!targetChar && !targetBld) {
        u.targetEntityId = null;
        u.combatState = u.moveTarget ? 'marching' : 'idle';
        u.animationState = 'idle';
        u.activityLabel = u.moveTarget
          ? 'Target eliminated · Resuming march'
          : 'Target eliminated · Standing by';
        u.speed = 0;
        continue;
      }

      // Drop target if diplomacy switched to peace
      const activeTargetKingdom = targetChar
        ? targetChar.kingdomId
        : targetBld!.kingdomId;
      const activeTargetHostile = targetChar
        ? areEntitiesHostile(u, targetChar, diplomacy)
        : areEntitiesHostile(u, targetBld!, diplomacy);
      if (!activeTargetHostile && activeTargetKingdom !== u.kingdomId) {
        u.targetEntityId = null;
        u.combatState = 'idle';
        u.animationState = 'idle';
        u.speed = 0;
        u.activityLabel = 'Ceasefire · Standing down';
        continue;
      }

      const tx = targetChar ? targetChar.position.x : targetBld!.position.x;
      const tz = targetChar ? targetChar.position.z : targetBld!.position.z;
      const dx = tx - u.position.x;
      const dz = tz - u.position.z;
      const centerDist = Math.hypot(dx, dz);
      const edgeDist = targetBld
        ? Math.max(0.2, centerDist - targetBld.footprintRadius * 0.7)
        : centerDist;

      u.rotationY = Math.atan2(dx, dz);
      const combatRange = u.attackRange ?? 1.5;

      if (edgeDist > combatRange && centerDist > 0.01) {
        const isCharging = u.isCharging && u.militaryClass === 'cavalry';
        const spd =
          (u.moveSpeedCombat ?? 3.0) *
          (isCharging ? u.chargeSpeedMultiplier ?? 1.6 : 1.0);
        const step = Math.min(edgeDist, spd * dt);
        advanceMilitaryUnitStep(
          u,
          dx / centerDist,
          dz / centerDist,
          step,
          spd,
          isCharging ? 'charging' : 'running',
          isCharging ? 12 : 8,
          dt,
          runtime,
        );
      } else {
        u.speed = 0;

        if (!u.attackCooldownTimer || u.attackCooldownTimer <= 0) {
          u.attackCooldownTimer = u.attackSpeedSec ?? 1.5;
          const isRanged =
            u.militaryClass === 'archer' || u.militaryClass === 'catapult';

          if (isRanged) {
            u.animationState = 'shooting_bow';
            u.gaitPhase += dt * 4;

            militaryState.projectiles.push({
              id: `arrow_${Math.round(runtime.elapsedSeconds * 100)}_${Math.random().toString(36).slice(2, 6)}`,
              sourceX: u.position.x,
              sourceY: u.position.y + 1.2,
              sourceZ: u.position.z,
              targetX: tx,
              targetY:
                (targetChar ? targetChar.position.y : targetBld!.position.y) + 1.0,
              targetZ: tz,
              startX: u.position.x,
              startY: u.position.y + 1.2,
              startZ: u.position.z,
              targetEntityId: targetChar ? targetChar.id : targetBld!.id,
              attackerKingdomId: u.kingdomId,
              isSiege: u.militaryClass === 'catapult',
              progress: 0,
              speed: u.militaryClass === 'catapult' ? 0.9 : 2.4,
              damage: u.attackDamage ?? 18,
              isFire: u.militaryClass === 'catapult',
            });
          } else {
            u.animationState =
              u.militaryClass === 'spearman' ? 'attacking_spear' : 'attacking_melee';
            u.gaitPhase += dt * 6;

            let dmgMult = 1.0;
            if (targetChar) {
              dmgMult = calculateCombatDamageMultiplier(
                u.militaryClass ?? 'infantry',
                targetChar.militaryClass,
                u.isCharging,
                u.kingdomId,
              );
            } else if (
              targetBld &&
              (u.militaryClass === 'battering_ram' ||
                u.militaryClass === 'catapult' ||
                u.militaryClass === 'siege_engineer' ||
                u.militaryClass === 'siege_tower')
            ) {
              dmgMult = 3.5;
            }

            const rawDmg =
              (u.attackDamage ?? 16) * dmgMult * (aiDeficit ? 0.8 : 1.0);
            const targetDef = targetChar ? targetChar.defense ?? 5 : 10;
            const netDmg = Math.max(3, rawDmg - targetDef * 0.45);

            if (targetChar) {
              targetChar.health = Math.max(0, targetChar.health - netDmg);
              targetChar.morale = Math.max(
                0,
                (targetChar.morale ?? 100) - netDmg * 0.6,
              );
              targetChar.lastHitTimeSec = runtime.elapsedSeconds;
              targetChar.animationState =
                targetChar.health <= 0 ? 'dead' : 'taking_damage';

              militaryState.recentHits.push({
                targetId: targetChar.id,
                damage: netDmg,
                attackerId: u.id,
                isFatal: targetChar.health <= 0,
                x: targetChar.position.x,
                y: targetChar.position.y + 1.0,
                z: targetChar.position.z,
              });

              recordCombatHostilityAndCasualties({
                attackerKingdomId: u.kingdomId,
                victimKingdomId: targetChar.kingdomId,
                isBuilding: false,
                isFatal: targetChar.health <= 0,
                runtime,
                militaryState,
                diplomacy,
                aiManager,
                events,
              });
            } else if (targetBld) {
              targetBld.integrity = Math.max(0, targetBld.integrity - netDmg);
              runtime.dirtyBuildingIds.add(targetBld.id);
              if (targetBld.integrity <= 0) {
                targetBld.constructionState = 'destroyed';
              }
              militaryState.recentHits.push({
                targetId: targetBld.id,
                damage: netDmg,
                attackerId: u.id,
                isFatal: targetBld.integrity <= 0,
                x: targetBld.position.x,
                y: targetBld.position.y + 1.5,
                z: targetBld.position.z,
              });

              recordCombatHostilityAndCasualties({
                attackerKingdomId: u.kingdomId,
                victimKingdomId: targetBld.kingdomId,
                isBuilding: true,
                isFatal: targetBld.integrity <= 0,
                runtime,
                militaryState,
                diplomacy,
                aiManager,
                events,
              });
            }

            u.isCharging = false;
          }
        }
      }
      continue;
    }

    // 4. Moving to Waypoint / Target
    if (u.moveTarget) {
      const dx = u.moveTarget.x - u.position.x;
      const dz = u.moveTarget.z - u.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist <= 0.65) {
        u.moveTarget = null;
        u.speed = 0;
        u.animationState = 'idle';
        u.combatState = 'idle';
        if (u.taskType === 'military_march' || u.taskType === 'military_patrol') {
          u.taskType = 'idle';
        }
        u.activityLabel = `Holding ${u.formation} position`;
      } else {
        const spd = u.moveSpeedCombat ?? 2.8;
        u.rotationY = Math.atan2(dx, dz);
        const step = Math.min(dist, spd * dt);
        advanceMilitaryUnitStep(
          u,
          dx / dist,
          dz / dist,
          step,
          spd,
          'running',
          8,
          dt,
          runtime,
        );
      }
    } else {
      u.animationState = 'idle';
      u.speed = 0;
      u.gaitPhase += dt * 1.5;
    }
  }

  // Remove units that have stayed dead for > 6 seconds
  const survivors = runtime.characters.filter((c) => {
    if (
      c.health <= 0 &&
      c.lastHitTimeSec &&
      runtime.elapsedSeconds - c.lastHitTimeSec > 6.0
    ) {
      return false;
    }
    return true;
  });
  runtime.characters = survivors;
}

export function stepMilitaryUpkeep(
  dt: number,
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
  aiManager?: AIKingdomManager,
): void {
  militaryState.upkeepTimer += dt;
  if (militaryState.upkeepTimer < 10.0) return;
  militaryState.upkeepTimer = 0;

  const ledgers =
    runtime.kingdomLedgers && runtime.kingdomLedgers.size > 0
      ? Array.from(runtime.kingdomLedgers.values())
      : [resolveKingdomLedger(runtime, runtime.kingdomId)];

  const factor = 10.0 / 60.0;

  for (const ledger of ledgers) {
    const overview = getMilitaryOverview(runtime, militaryState, ledger.kingdomId);
    if (overview.totalMilitaryPopulation === 0) {
      if (ledger.isPlayer) {
        militaryState.hasUpkeepDeficit = false;
      } else if (aiManager?.kingdoms[ledger.kingdomId]) {
        aiManager.kingdoms[ledger.kingdomId].hasUpkeepDeficit = false;
      }
      continue;
    }

    const foodCost = Math.round(overview.upkeepPerMinute.food * factor);
    const goldCost = Math.round(overview.upkeepPerMinute.gold * factor);

    let deficit = false;
    if (foodCost > 0) {
      if (ledger.resources.food >= foodCost) {
        ledger.resources.food -= foodCost;
      } else {
        ledger.resources.food = 0;
        deficit = true;
      }
    }
    if (goldCost > 0) {
      if (ledger.resources.gold >= goldCost) {
        ledger.resources.gold -= goldCost;
      } else {
        ledger.resources.gold = 0;
        deficit = true;
      }
    }

    if (ledger.isPlayer) {
      militaryState.hasUpkeepDeficit = deficit;
      if (deficit) {
        pushEconomyNotification(
          runtime,
          'military_upkeep_deficit',
          'warning',
          `Military upkeep deficit! Low food/gold stores reduce soldier morale and combat strength.`,
          18,
        );
      }
    } else if (aiManager?.kingdoms[ledger.kingdomId]) {
      aiManager.kingdoms[ledger.kingdomId].hasUpkeepDeficit = deficit;
    }
  }
}

export function stepMilitarySimulation(
  militaryState: MilitarySimulationState,
  runtime: EconomyWorldRuntime,
  dt: number,
  diplomacy?: DiplomacyState,
  aiManager?: AIKingdomManager,
  events?: WorldEventItem[],
): void {
  stepMilitaryRecruitmentQueues(dt, runtime, militaryState, aiManager);
  stepMilitaryUnits(dt, runtime, militaryState, diplomacy, aiManager, events);
  stepProjectiles(dt, militaryState, runtime, diplomacy, aiManager, events);
  stepMilitaryUpkeep(dt, runtime, militaryState, aiManager);
}

export function spawnBallisticProjectile(
  militaryState: MilitarySimulationState,
  kind: 'arrow' | 'catapult_fire',
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
  damage: number,
  targetEntityId: string,
  onImpact?: (dmg: number, targetId: string) => void,
  attackerId?: string,
  isFire?: boolean,
): ArrowProjectile {
  void attackerId;
  const proj: ArrowProjectile = {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sourceX: fromX,
    sourceY: fromY,
    sourceZ: fromZ,
    startX: fromX,
    startY: fromY,
    startZ: fromZ,
    targetX: toX,
    targetY: toY,
    targetZ: toZ,
    targetEntityId,
    progress: 0,
    speed: kind === 'catapult_fire' ? 1.0 : 2.4,
    damage,
    isFire: isFire ?? kind === 'catapult_fire',
    flightDuration: 1.0 / (kind === 'catapult_fire' ? 1.0 : 2.4),
    onImpact: onImpact ?? (() => {}),
  };
  militaryState.projectiles.push(proj);
  return proj;
}

export const queueRecruitment = (
  building: BuildingEntity,
  unitClass: MilitaryUnitClass,
  resources: ResourceAmounts,
  population: { current: number; capacity: number },
  kingdomId: KingdomId,
): { success: boolean; reason?: string } => {
  const dummyRuntime: any = {
    resources,
    capacities: { food: 99999, wood: 99999, stone: 99999, iron: 99999, gold: 99999 },
    rates: {
      productionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      consumptionPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      netPerMinute: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
    },
    population,
    kingdomId,
    characters: [],
    buildings: [building],
    progressionStage: 'Kingdom',
    economyStats: {
      totalGathered: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      totalConsumedFood: 0,
      buildingsConstructed: 0,
      villagersBorn: 0,
    },
    recentLedger: [],
    elapsedSeconds: 0,
    dirtyBuildingIds: new Set(),
    pendingNotifications: [],
    notificationCooldowns: new Map(),
  };
  const check = canRecruitMilitaryUnit(unitClass, building, dummyRuntime);
  if (!check.ok) return { success: false, reason: check.reason };
  const ok = queueUnitRecruitment(unitClass, building, dummyRuntime);
  return { success: ok, reason: ok ? undefined : 'Failed to queue' };
};

export const cancelRecruitmentSlot = cancelQueuedUnitRecruitment;

export function spawnMilitaryCharacterEntity(
  unitClass: MilitaryUnitClass,
  kingdomId: KingdomId,
  x: number,
  z: number,
  seed = 42,
): CharacterEntity {
  return createMilitaryUnitEntity({
    id: `mil_test_${unitClass}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${MILITARY_UNIT_CATALOG[unitClass]?.name ?? unitClass}`,
    unitClass,
    kingdomId,
    x,
    z,
    region: REGIONS.golden_savannah,
    seed,
  });
}
