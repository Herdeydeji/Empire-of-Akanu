import {
  calculateCombatDamageMultiplier,
  calculateFormationOffsets,
  KINGDOM_MILITARY_BONUSES,
  MILITARY_UNIT_CATALOG,
  MilitaryUnitBlueprint,
} from '../../config/military';
import {
  ArrowProjectile,
  BuildingEntity,
  CharacterAnimationState,
  CharacterEntity,
  CombatState,
  EconomyNotification,
  KingdomId,
  MilitaryFormationType,
  MilitaryOverviewState,
  MilitaryStance,
  MilitaryStatistics,
  MilitaryUnitClass,
  RegionConfig,
  ResourceAmounts,
  ResourceKey,
} from '../../types/game';
import { sampleTerrainHeight, WATER_LEVEL } from '../math/noise';
import {
  EconomyWorldRuntime,
  pushEconomyNotification,
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

export function canRecruitMilitaryUnit(
  unitClass: MilitaryUnitClass,
  building: BuildingEntity,
  runtime: EconomyWorldRuntime,
): { ok: boolean; reason?: string; cost: ResourceAmounts } {
  const bp = MILITARY_UNIT_CATALOG[unitClass];
  if (!bp) return { ok: false, reason: 'Unknown unit class', cost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 } };

  if (building.archetype !== bp.recruitingBuilding) {
    return { ok: false, reason: `Must recruit at ${bp.recruitingBuilding}`, cost: bp.cost };
  }
  if (building.constructionState !== 'completed') {
    return { ok: false, reason: 'Building is under construction', cost: bp.cost };
  }
  if (building.integrity < building.maxIntegrity * 0.25) {
    return { ok: false, reason: 'Building is severely damaged and must be repaired', cost: bp.cost };
  }

  // Check kingdom progression requirement
  if (bp.requiresProgression) {
    const progressionRanks = ['Village', 'Settlement', 'Town', 'Fortified City', 'Kingdom', 'Empire'];
    const currentRank = progressionRanks.indexOf(runtime.progressionStage);
    const requiredRank = progressionRanks.indexOf(bp.requiresProgression);
    if (currentRank < requiredRank) {
      return {
        ok: false,
        reason: `Requires ${bp.requiresProgression} progression (current: ${runtime.progressionStage})`,
        cost: bp.cost,
      };
    }
  }

  // Calculate adjusted cost with kingdom bonuses
  const bonus = KINGDOM_MILITARY_BONUSES[runtime.kingdomId];
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

  // Check resource affordability
  for (const k of ['food', 'wood', 'stone', 'iron', 'gold'] as ResourceKey[]) {
    if (runtime.resources[k] < adjustedCost[k]) {
      return { ok: false, reason: `Insufficient ${k} (need ${adjustedCost[k]})`, cost: adjustedCost };
    }
  }

  // Check population capacity
  const militaryPop = runtime.characters.filter((c) => c.isMilitary).length;
  const currentTotal = runtime.characters.length;
  if (currentTotal + bp.populationCost > runtime.population.capacity) {
    return {
      ok: false,
      reason: `Housing limit reached (${currentTotal}/${runtime.population.capacity}). Build more dwellings.`,
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
  const check = canRecruitMilitaryUnit(unitClass, building, runtime);
  if (!check.ok) {
    pushEconomyNotification(
      runtime,
      `recruit_failed_${unitClass}`,
      'alert',
      check.reason ?? 'Cannot recruit unit',
      3,
    );
    return false;
  }

  if (!spendResourcesValidated(runtime, check.cost)) {
    return false;
  }

  const bp = MILITARY_UNIT_CATALOG[unitClass];
  if (!building.recruitmentQueue) {
    building.recruitmentQueue = [];
  }

  const item = {
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    unitClass,
    progressSec: 0,
    totalDurationSec: bp.recruitmentDurationSec,
    cost: check.cost,
  };
  building.recruitmentQueue.push(item);
  runtime.dirtyBuildingIds.add(building.id);

  pushEconomyNotification(
    runtime,
    `recruiting_${unitClass}`,
    'info',
    `Recruiting ${bp.name} at ${building.name} (${Math.round(bp.recruitmentDurationSec)}s).`,
    2,
  );
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
    // Refund 90% of recruitment cost
    for (const k of ['food', 'wood', 'stone', 'iron', 'gold'] as ResourceKey[]) {
      const refund = Math.floor(removed.cost[k] * 0.9);
      if (refund > 0) {
        runtime.resources[k] = Math.min(runtime.capacities[k], runtime.resources[k] + refund);
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
    role: 'Unemployed', // Military units don't work civil jobs
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
    tunicColor: params.isHostile ? '#78231c' : '#8f3c25',
    accentColor: params.isHostile ? '#c44536' : '#e5aa4b',
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
    // Phase 3 Military State
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
): CharacterEntity {
  const count = runtime.characters.filter((c) => c.militaryClass === unitClass).length + 1;
  const bp = MILITARY_UNIT_CATALOG[unitClass];
  const rallyX = building.rallyPoint?.x ?? (building.position.x + (Math.random() - 0.5) * 4);
  const rallyZ = building.rallyPoint?.z ?? (building.position.z + building.footprintRadius + 2.5);

  const unit = createMilitaryUnitEntity({
    id: `mil_${unitClass}_${Date.now()}_${count}`,
    name: `${bp.name} #${count}`,
    unitClass,
    kingdomId: runtime.kingdomId,
    x: rallyX,
    z: rallyZ,
    region: runtime.region,
    seed: runtime.seed,
    isHostile: false,
  });

  runtime.characters.push(unit);
  runtime.newlySpawnedCharacters.push(unit);
  militaryState.stats.unitsRecruited += 1;

  pushEconomyNotification(
    runtime,
    `recruited_${unit.id}`,
    'success',
    `${unit.name} mustered at ${building.name}.`,
    2,
  );

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
    u.moveTarget = { x: targetX + off.x, z: targetZ + off.z };
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
    // If cavalry and at distance (> 8m), activate charge!
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
  // Calculate group center of mass
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
    u.moveTarget = { x: cx + off.x, z: cz + off.z };
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
): MilitaryOverviewState {
  const milUnits = runtime.characters.filter((c) => c.isMilitary && !c.isHostile && c.health > 0);
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
    if (b.recruitmentQueue && b.recruitmentQueue.length > 0) {
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

/**
 * Steps all recruitment queues across military structures.
 */
export function stepMilitaryRecruitmentQueues(
  dt: number,
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
): void {
  for (let i = 0; i < runtime.buildings.length; i++) {
    const b = runtime.buildings[i];
    if (!b.recruitmentQueue || b.recruitmentQueue.length === 0) continue;
    if (b.constructionState !== 'completed') continue;

    const currentItem = b.recruitmentQueue[0];
    currentItem.progressSec += dt;

    if (currentItem.progressSec >= currentItem.totalDurationSec) {
      b.recruitmentQueue.shift();
      spawnCompletedRecruit(b, currentItem.unitClass, runtime, militaryState);
      runtime.dirtyBuildingIds.add(b.id);
    }
  }
}

/**
 * Steps arrow and siege ballistics, dealing damage on physical impact.
 */
export function stepProjectiles(
  dt: number,
  militaryState: MilitarySimulationState,
  runtime: EconomyWorldRuntime,
): void {
  const remaining: ArrowProjectile[] = [];

  for (let i = 0; i < militaryState.projectiles.length; i++) {
    const p = militaryState.projectiles[i];
    p.progress += dt * p.speed;

    if (p.progress >= 1.0) {
      // Impact! Find target and apply damage
      const targetChar = runtime.characters.find((c) => c.id === p.targetEntityId);
      const targetBld = !targetChar
        ? runtime.buildings.find((b) => b.id === p.targetEntityId)
        : null;

      if (targetChar && targetChar.health > 0) {
        const netDmg = Math.max(2, p.damage - (targetChar.defense ?? 0) * 0.45);
        targetChar.health = Math.max(0, targetChar.health - netDmg);
        targetChar.lastHitTimeSec = runtime.elapsedSeconds;
        targetChar.animationState = targetChar.health <= 0 ? 'dead' : 'taking_damage';

        militaryState.recentHits.push({
          targetId: targetChar.id,
          damage: netDmg,
          attackerId: p.id,
          isFatal: targetChar.health <= 0,
          x: targetChar.position.x,
          y: targetChar.position.y + 1.0,
          z: targetChar.position.z,
        });

        if (targetChar.health <= 0) {
          militaryState.stats.enemiesDefeated += targetChar.isHostile ? 1 : 0;
          militaryState.stats.alliesLost += targetChar.isHostile ? 0 : 1;
        }
      } else if (targetBld && targetBld.integrity > 0) {
        const netDmg = Math.max(1, p.damage - 5);
        targetBld.integrity = Math.max(0, targetBld.integrity - netDmg);
        runtime.dirtyBuildingIds.add(targetBld.id);
        militaryState.recentHits.push({
          targetId: targetBld.id,
          damage: netDmg,
          attackerId: p.id,
          isFatal: targetBld.integrity <= 0,
          x: targetBld.position.x,
          y: targetBld.position.y + 1.5,
          z: targetBld.position.z,
        });
      }
    } else {
      remaining.push(p);
    }
  }

  militaryState.projectiles = remaining;
}

/**
 * Steps military AI, movement, combat encounters, attacks, and morale.
 */
export function stepMilitaryUnits(
  dt: number,
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
): void {
  const chars = runtime.characters;
  const militaryUnits = chars.filter((c) => c.isMilitary && c.health > 0);

  // Clear stale hits from last frame
  if (militaryState.recentHits.length > 24) {
    militaryState.recentHits.splice(0, militaryState.recentHits.length - 24);
  }

  for (let i = 0; i < militaryUnits.length; i++) {
    const u = militaryUnits[i];

    // Decrement attack cooldown
    if (u.attackCooldownTimer && u.attackCooldownTimer > 0) {
      u.attackCooldownTimer = Math.max(0, u.attackCooldownTimer - dt);
    }

    // 1. Check for commander nearby to boost morale
    let commanderNearby = false;
    for (let j = 0; j < militaryUnits.length; j++) {
      const other = militaryUnits[j];
      if (other.isCommander && other.isHostile === u.isHostile) {
        const d = Math.hypot(other.position.x - u.position.x, other.position.z - u.position.z);
        if (d <= (other.commanderAuraRadius ?? 18.0)) {
          commanderNearby = true;
          break;
        }
      }
    }
    const targetMorale = commanderNearby ? 100 : MORALE_BASE;
    u.morale = Math.min(100, Math.max(0, (u.morale ?? 100) + (commanderNearby ? 5 : 1) * dt));

    // 2. Autonomous Target Acquisition for Idle / Aggressive / Defensive Stances
    if (!u.targetEntityId || u.targetEntityId === '') {
      if (u.stance !== 'stand_ground') {
        const scanRange = u.stance === 'aggressive' ? 24.0 : 12.0;
        let closestDist = scanRange;
        let foundTarget: CharacterEntity | null = null;

        for (let j = 0; j < chars.length; j++) {
          const candidate = chars[j];
          if (candidate.health <= 0) continue;
          if (candidate.isHostile !== u.isHostile) {
            const d = Math.hypot(
              candidate.position.x - u.position.x,
              candidate.position.z - u.position.z,
            );
            if (d < closestDist) {
              closestDist = d;
              foundTarget = candidate;
            }
          }
        }

        if (foundTarget) {
          u.targetEntityId = foundTarget.id;
          u.combatState = 'engaging';
          u.activityLabel = `Engaging ${foundTarget.name}`;
        }
      }
    }

    // 3. Combat Execution against Target
    if (u.targetEntityId) {
      const targetChar = chars.find((c) => c.id === u.targetEntityId && c.health > 0);
      const targetBld = !targetChar
        ? runtime.buildings.find(
            (b) => b.id === u.targetEntityId && b.constructionState !== 'destroyed',
          )
        : null;

      if (!targetChar && !targetBld) {
        // Target is dead or gone
        u.targetEntityId = null;
        u.combatState = 'idle';
        u.animationState = 'idle';
        u.activityLabel = 'Target eliminated · Standing by';
        u.speed = 0;
        continue;
      }

      const tx = targetChar ? targetChar.position.x : targetBld!.position.x;
      const tz = targetChar ? targetChar.position.z : targetBld!.position.z;
      const dx = tx - u.position.x;
      const dz = tz - u.position.z;
      const dist = Math.hypot(dx, dz);

      // Rotate toward target
      u.rotationY = Math.atan2(dx, dz);

      const combatRange = u.attackRange ?? 1.5;

      if (dist > combatRange) {
        // Close distance
        const isCharging = u.isCharging && u.militaryClass === 'cavalry';
        const spd = (u.moveSpeedCombat ?? 3.0) * (isCharging ? (u.chargeSpeedMultiplier ?? 1.6) : 1.0);
        u.speed = spd;
        u.animationState = isCharging ? 'charging' : 'running';
        u.gaitPhase += dt * (isCharging ? 12 : 8);

        const step = Math.min(dist, spd * dt);
        u.position.x += (dx / dist) * step;
        u.position.z += (dz / dist) * step;
        u.position.y = Math.max(
          WATER_LEVEL + 0.05,
          sampleTerrainHeight(u.position.x, u.position.z, runtime.region, runtime.seed),
        );
      } else {
        // In range! Perform attack according to cooldown
        u.speed = 0;

        if (!u.attackCooldownTimer || u.attackCooldownTimer <= 0) {
          u.attackCooldownTimer = u.attackSpeedSec ?? 1.5;

          const isRanged = u.militaryClass === 'archer' || u.militaryClass === 'catapult';

          if (isRanged) {
            u.animationState = 'shooting_bow';
            u.gaitPhase += dt * 4;

            // Launch visible projectile
            militaryState.projectiles.push({
              id: `arrow_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              sourceX: u.position.x,
              sourceY: u.position.y + 1.2,
              sourceZ: u.position.z,
              targetX: tx,
              targetY: (targetChar ? targetChar.position.y : targetBld!.position.y) + 1.0,
              targetZ: tz,
              startX: u.position.x,
              startY: u.position.y + 1.2,
              startZ: u.position.z,
              targetEntityId: targetChar ? targetChar.id : targetBld!.id,
              progress: 0,
              speed: u.militaryClass === 'catapult' ? 0.9 : 2.4,
              damage: u.attackDamage ?? 18,
              isFire: u.militaryClass === 'catapult',
            });
          } else {
            // Melee strike
            if (u.militaryClass === 'spearman') {
              u.animationState = 'attacking_spear';
            } else {
              u.animationState = 'attacking_melee';
            }
            u.gaitPhase += dt * 6;

            let dmgMult = 1.0;
            if (targetChar) {
              dmgMult = calculateCombatDamageMultiplier(
                u.militaryClass ?? 'infantry',
                targetChar.militaryClass,
                u.isCharging,
                u.kingdomId,
              );
            } else if (targetBld && (u.militaryClass === 'battering_ram' || u.militaryClass === 'catapult')) {
              dmgMult = 3.5; // Massive structure multiplier!
            }

            const rawDmg = (u.attackDamage ?? 16) * dmgMult;
            const targetDef = targetChar ? (targetChar.defense ?? 5) : 10;
            const netDmg = Math.max(3, rawDmg - targetDef * 0.45);

            if (targetChar) {
              targetChar.health = Math.max(0, targetChar.health - netDmg);
              targetChar.lastHitTimeSec = runtime.elapsedSeconds;
              targetChar.animationState = targetChar.health <= 0 ? 'dead' : 'taking_damage';

              militaryState.recentHits.push({
                targetId: targetChar.id,
                damage: netDmg,
                attackerId: u.id,
                isFatal: targetChar.health <= 0,
                x: targetChar.position.x,
                y: targetChar.position.y + 1.0,
                z: targetChar.position.z,
              });

              if (targetChar.health <= 0) {
                militaryState.stats.enemiesDefeated += targetChar.isHostile ? 1 : 0;
                militaryState.stats.alliesLost += targetChar.isHostile ? 0 : 1;
              }
            } else if (targetBld) {
              targetBld.integrity = Math.max(0, targetBld.integrity - netDmg);
              runtime.dirtyBuildingIds.add(targetBld.id);
              if (targetBld.integrity <= 0) {
                targetBld.constructionState = 'destroyed';
                militaryState.stats.structuresRazed += 1;
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
            }

            // Charge ends upon landing first strike
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

      if (dist <= 0.4) {
        u.moveTarget = null;
        u.speed = 0;
        u.animationState = 'idle';
        u.combatState = 'idle';
        u.activityLabel = `Holding ${u.formation} position`;
      } else {
        const spd = u.moveSpeedCombat ?? 2.8;
        u.speed = spd;
        u.animationState = 'running';
        u.gaitPhase += dt * 8;
        u.rotationY = Math.atan2(dx, dz);

        const step = Math.min(dist, spd * dt);
        u.position.x += (dx / dist) * step;
        u.position.z += (dz / dist) * step;
        u.position.y = Math.max(
          WATER_LEVEL + 0.05,
          sampleTerrainHeight(u.position.x, u.position.z, runtime.region, runtime.seed),
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
    if (c.health <= 0 && c.lastHitTimeSec && runtime.elapsedSeconds - c.lastHitTimeSec > 6.0) {
      return false;
    }
    return true;
  });
  runtime.characters = survivors;
}

/**
 * Steps military upkeep deductions from the kingdom economy every 10 seconds.
 */
export function stepMilitaryUpkeep(
  dt: number,
  runtime: EconomyWorldRuntime,
  militaryState: MilitarySimulationState,
): void {
  militaryState.upkeepTimer += dt;
  if (militaryState.upkeepTimer < 10.0) return;
  militaryState.upkeepTimer = 0;

  const overview = getMilitaryOverview(runtime, militaryState);
  if (overview.totalMilitaryPopulation === 0) {
    militaryState.hasUpkeepDeficit = false;
    return;
  }

  // Calculate 10-second slice of per-minute upkeep
  const factor = 10.0 / 60.0;
  const foodCost = Math.round(overview.upkeepPerMinute.food * factor);
  const goldCost = Math.round(overview.upkeepPerMinute.gold * factor);

  let deficit = false;
  if (foodCost > 0) {
    if (runtime.resources.food >= foodCost) {
      runtime.resources.food -= foodCost;
    } else {
      runtime.resources.food = 0;
      deficit = true;
    }
  }
  if (goldCost > 0) {
    if (runtime.resources.gold >= goldCost) {
      runtime.resources.gold -= goldCost;
    } else {
      runtime.resources.gold = 0;
      deficit = true;
    }
  }

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
}

/**
 * Unified military simulation step executing recruitment queues, movement/combat AI,
 * ballistic projectiles, and treasury upkeep deductions in sequence.
 */
export function stepMilitarySimulation(
  militaryState: MilitarySimulationState,
  runtime: EconomyWorldRuntime,
  dt: number,
): void {
  stepMilitaryRecruitmentQueues(dt, runtime, militaryState);
  stepMilitaryUnits(dt, runtime, militaryState);
  stepProjectiles(dt, militaryState, runtime);
  stepMilitaryUpkeep(dt, runtime, militaryState);
}

/**
 * Programmatically spawns a ballistic projectile for testing or special abilities.
 */
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

// Aliases for unified test and engine ergonomics
export const queueRecruitment = (
  building: BuildingEntity,
  unitClass: MilitaryUnitClass,
  resources: ResourceAmounts,
  population: { current: number; capacity: number },
  kingdomId: KingdomId,
): { success: boolean; reason?: string } => {
  const dummyRuntime: any = {
    resources,
    population,
    kingdomId,
    characters: [],
    progressionStage: 'Kingdom',
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

import { REGIONS } from '../../config/regions';

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

