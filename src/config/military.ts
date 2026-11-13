import {
  BuildingArchetype,
  KingdomId,
  MilitaryFormationType,
  MilitaryUnitClass,
  ResourceAmounts,
} from '../types/game';

export interface MilitaryUnitBlueprint {
  unitClass: MilitaryUnitClass;
  name: string;
  category: 'Infantry' | 'Cavalry' | 'Ranged' | 'Siege' | 'Commander';
  recruitingBuilding: BuildingArchetype;
  cost: ResourceAmounts;
  recruitmentDurationSec: number;
  health: number;
  attackDamage: number;
  defense: number;
  attackRange: number; // 1.25 for melee, 16.0 for archers, 24.0 for catapults
  attackSpeedSec: number; // Cooldown between strikes in seconds
  moveSpeed: number;
  populationCost: number;
  upkeepPerMinute: Partial<ResourceAmounts>;
  description: string;
  tacticalRole: string;
  strongAgainst: string[];
  weakAgainst: string[];
  propType:
    | 'sword_bronze'
    | 'spear_long'
    | 'bow_drawn'
    | 'cavalry_lance'
    | 'royal_polearm'
    | 'scout_dagger'
    | 'engineer_wrench'
    | 'siege_ram'
    | 'commander_scepter';
  isMounted?: boolean;
  isSiegeEngine?: boolean;
  isCommander?: boolean;
  requiresProgression?: 'Village' | 'Settlement' | 'Town' | 'Kingdom';
}

export const MILITARY_UNIT_CATALOG: Record<MilitaryUnitClass, MilitaryUnitBlueprint> = {
  infantry: {
    unitClass: 'infantry',
    name: 'Shield Infantry',
    category: 'Infantry',
    recruitingBuilding: 'barracks_compound',
    cost: { food: 40, wood: 25, stone: 0, iron: 20, gold: 0 },
    recruitmentDurationSec: 6.0,
    health: 120,
    attackDamage: 16,
    defense: 8,
    attackRange: 1.45,
    attackSpeedSec: 1.35,
    moveSpeed: 2.75,
    populationCost: 1,
    upkeepPerMinute: { food: 9 },
    description: 'Disciplined swordsmen equipped with bronze blades and hardened ox-hide shields.',
    tacticalRole: 'Frontline brawlers, settlement defense, and closing in on exposed archers.',
    strongAgainst: ['Archers in close combat', 'Scouts', 'Light encampments'],
    weakAgainst: ['Charging cavalry', 'Heavy defensive phalanxes'],
    propType: 'sword_bronze',
  },
  spearman: {
    unitClass: 'spearman',
    name: 'Phalanx Spearman',
    category: 'Infantry',
    recruitingBuilding: 'barracks_compound',
    cost: { food: 35, wood: 35, stone: 0, iron: 15, gold: 0 },
    recruitmentDurationSec: 5.5,
    health: 110,
    attackDamage: 14,
    defense: 10,
    attackRange: 1.95,
    attackSpeedSec: 1.45,
    moveSpeed: 2.65,
    populationCost: 1,
    upkeepPerMinute: { food: 8 },
    description: 'Defensive polearm infantry trained to plant spear-butts against cavalry shock charges.',
    tacticalRole: 'Anti-cavalry defense, holding chokepoints, and protecting vulnerable ranged units.',
    strongAgainst: ['Cavalry shock charges (x2.4 damage vs cavalry)', 'Scouts'],
    weakAgainst: ['Sustained ranged archery', 'Flanking attacks'],
    propType: 'spear_long',
  },
  archer: {
    unitClass: 'archer',
    name: 'Savannah Bowman',
    category: 'Ranged',
    recruitingBuilding: 'archery_grounds',
    cost: { food: 40, wood: 45, stone: 0, iron: 10, gold: 5 },
    recruitmentDurationSec: 6.5,
    health: 80,
    attackDamage: 18,
    defense: 3,
    attackRange: 16.0,
    attackSpeedSec: 1.75,
    moveSpeed: 2.85,
    populationCost: 1,
    upkeepPerMinute: { food: 8 },
    description: 'Marksmen wielding recurve wooden bows with hardwood bodkin arrows.',
    tacticalRole: 'Long-range bombardment, elevated ridge skirmishing, and softening advancing infantry.',
    strongAgainst: ['Slow heavy infantry', 'Spearmen at distance', 'Worker caravans'],
    weakAgainst: ['Fast cavalry flanks', 'Infantry that close distance'],
    propType: 'bow_drawn',
  },
  cavalry: {
    unitClass: 'cavalry',
    name: 'Horizon Lancer',
    category: 'Cavalry',
    recruitingBuilding: 'cavalry_stables',
    cost: { food: 70, wood: 30, stone: 0, iron: 35, gold: 20 },
    recruitmentDurationSec: 9.0,
    health: 160,
    attackDamage: 24,
    defense: 7,
    attackRange: 1.75,
    attackSpeedSec: 1.55,
    moveSpeed: 4.85,
    populationCost: 1,
    upkeepPerMinute: { food: 18, gold: 5 },
    description: 'Swift mounted shock troopers capable of devastating open-field flanking charges.',
    tacticalRole: 'Flanking, hunting down archers, pursuing retreating units, and hit-and-run strikes.',
    strongAgainst: ['Archers', 'Unescorted siege weapons', 'Exposed scouts'],
    weakAgainst: ['Braced spearmen', 'Defensive fortifications'],
    propType: 'cavalry_lance',
    isMounted: true,
  },
  royal_guard: {
    unitClass: 'royal_guard',
    name: 'Royal Palace Sentinel',
    category: 'Infantry',
    recruitingBuilding: 'royal_palace',
    cost: { food: 90, wood: 40, stone: 30, iron: 60, gold: 45 },
    recruitmentDurationSec: 12.0,
    health: 260,
    attackDamage: 32,
    defense: 16,
    attackRange: 1.6,
    attackSpeedSec: 1.25,
    moveSpeed: 2.85,
    populationCost: 1,
    upkeepPerMinute: { food: 22, gold: 12 },
    description: 'Elite royal retainers in full plate armor wielding heavy bronze polearms.',
    tacticalRole: 'Anchor of the royal army, fortress defense, and bodyguard to commanders.',
    strongAgainst: ['Standard infantry', 'Archers', 'Cavalry in close melee'],
    weakAgainst: ['Concentrated siege artillery', 'Outnumbered encirclement'],
    propType: 'royal_polearm',
    requiresProgression: 'Town',
  },
  scout: {
    unitClass: 'scout',
    name: 'Frontier Scout',
    category: 'Cavalry',
    recruitingBuilding: 'cavalry_stables',
    cost: { food: 35, wood: 20, stone: 0, iron: 5, gold: 5 },
    recruitmentDurationSec: 4.5,
    health: 75,
    attackDamage: 9,
    defense: 4,
    attackRange: 1.35,
    attackSpeedSec: 1.2,
    moveSpeed: 5.35,
    populationCost: 1,
    upkeepPerMinute: { food: 6 },
    description: 'Light outrider with exceptional vision radius designed for map exploration.',
    tacticalRole: 'Revealing unexplored terrain, scouting enemy garrisons, and raiding undefended camps.',
    strongAgainst: ['Unarmed gathering workers', 'Reconnaissance'],
    weakAgainst: ['All dedicated combat units', 'Defensive towers'],
    propType: 'scout_dagger',
    isMounted: true,
  },
  siege_engineer: {
    unitClass: 'siege_engineer',
    name: 'Siege Sapper',
    category: 'Siege',
    recruitingBuilding: 'weapon_workshop',
    cost: { food: 45, wood: 50, stone: 20, iron: 25, gold: 10 },
    recruitmentDurationSec: 7.0,
    health: 95,
    attackDamage: 11,
    defense: 5,
    attackRange: 1.3,
    attackSpeedSec: 1.8,
    moveSpeed: 2.5,
    populationCost: 1,
    upkeepPerMinute: { food: 10 },
    description: 'Specialist field technician trained to assemble, operate, and repair siege weapons.',
    tacticalRole: 'Crewing catapults and rams, dismantling ramparts, and repairing damaged battle engines.',
    strongAgainst: ['Constructing and operating siege weapons (+40% siege fire rate)'],
    weakAgainst: ['Direct melee and cavalry charges'],
    propType: 'engineer_wrench',
  },
  battering_ram: {
    unitClass: 'battering_ram',
    name: 'Bronze-Headed Ram',
    category: 'Siege',
    recruitingBuilding: 'weapon_workshop',
    cost: { food: 0, wood: 140, stone: 40, iron: 60, gold: 15 },
    recruitmentDurationSec: 14.0,
    health: 380,
    attackDamage: 95, // High damage against structures!
    defense: 22,
    attackRange: 3.2,
    attackSpeedSec: 2.8,
    moveSpeed: 1.95,
    populationCost: 2,
    upkeepPerMinute: { wood: 12, iron: 4 },
    description: 'Iron-capped timber ram protected by a heavy sloped leather roof.',
    tacticalRole: 'Cracking gatehouses, shattering ramparts, and absorbing enemy arrow fire.',
    strongAgainst: ['Walls, towers, and enemy buildings (x3.5 structural damage)'],
    weakAgainst: ['Melee infantry flanking, incendiary fire'],
    propType: 'siege_ram',
    isSiegeEngine: true,
  },
  catapult: {
    unitClass: 'catapult',
    name: 'Torsion Catapult',
    category: 'Siege',
    recruitingBuilding: 'weapon_workshop',
    cost: { food: 0, wood: 175, stone: 80, iron: 55, gold: 35 },
    recruitmentDurationSec: 16.0,
    health: 220,
    attackDamage: 85,
    defense: 6,
    attackRange: 24.0,
    attackSpeedSec: 3.8,
    moveSpeed: 1.8,
    populationCost: 2,
    upkeepPerMinute: { wood: 15, stone: 6 },
    description: 'Long-range torsion artillery that hurls dressed stone boulders at enemy fortifications.',
    tacticalRole: 'Out-ranging defensive watch-posts, pulverizing walls, and breaking tight formations.',
    strongAgainst: ['Static fortifications, crowded enemy clusters'],
    weakAgainst: ['Cavalry swarms and fast melee flankers'],
    propType: 'siege_ram',
    isSiegeEngine: true,
  },
  siege_tower: {
    unitClass: 'siege_tower',
    name: 'Timber Siege Tower',
    category: 'Siege',
    recruitingBuilding: 'weapon_workshop',
    cost: { food: 0, wood: 190, stone: 30, iron: 45, gold: 20 },
    recruitmentDurationSec: 15.0,
    health: 440,
    attackDamage: 25,
    defense: 24,
    attackRange: 12.0,
    attackSpeedSec: 2.0,
    moveSpeed: 1.7,
    populationCost: 2,
    upkeepPerMinute: { wood: 14 },
    description: 'Multi-story wheeled timber tower providing high vantage archer firing positions.',
    tacticalRole: 'Elevated arrow fire and breaching elevated defenses.',
    strongAgainst: ['Absorbing defensive garrison arrow volleys'],
    weakAgainst: ['Catapult boulders and incendiary counter-fire'],
    propType: 'siege_ram',
    isSiegeEngine: true,
  },
  commander: {
    unitClass: 'commander',
    name: 'Grand Warlord',
    category: 'Commander',
    recruitingBuilding: 'royal_palace',
    cost: { food: 120, wood: 50, stone: 30, iron: 70, gold: 80 },
    recruitmentDurationSec: 15.0,
    health: 320,
    attackDamage: 36,
    defense: 18,
    attackRange: 1.7,
    attackSpeedSec: 1.25,
    moveSpeed: 3.15,
    populationCost: 1,
    upkeepPerMinute: { food: 25, gold: 15 },
    description: 'Battlefield warlord whose martial presence inspires nearby soldiers.',
    tacticalRole: 'Provides +25% morale aura and +15% damage bonus to all nearby allied units.',
    strongAgainst: ['Standard units, rallying broken regiments'],
    weakAgainst: ['Being isolated and surrounded'],
    propType: 'commander_scepter',
    isCommander: true,
    requiresProgression: 'Town',
  },
};

export function getMilitaryUnitsForBuilding(
  archetype: BuildingArchetype,
): MilitaryUnitBlueprint[] {
  return Object.values(MILITARY_UNIT_CATALOG).filter(
    (bp) => bp.recruitingBuilding === archetype,
  );
}

/**
 * Kingdom military modifiers - applied to base stats cleanly and configurably.
 */
export interface KingdomMilitaryBonus {
  name: string;
  summary: string;
  infantryDamageMult: number;
  infantryDefenseMult: number;
  spearmanAntiCavalryMult: number;
  cavalrySpeedMult: number;
  cavalryChargeMult: number;
  archerDamageMult: number;
  archerRangeMult: number;
  siegeDamageMult: number;
  siegeCostReduction: number;
  militaryRecruitmentCostMult: number;
  wildernessMoraleBonus: number;
}

export const KINGDOM_MILITARY_BONUSES: Record<KingdomId, KingdomMilitaryBonus> = {
  oru: {
    name: 'Oru Bastion Mastery',
    summary: '+20% Infantry & Royal Guard defense, +15% melee damage, improved shield-walls.',
    infantryDamageMult: 1.15,
    infantryDefenseMult: 1.2,
    spearmanAntiCavalryMult: 2.6,
    cavalrySpeedMult: 1.0,
    cavalryChargeMult: 1.0,
    archerDamageMult: 1.0,
    archerRangeMult: 1.0,
    siegeDamageMult: 1.0,
    siegeCostReduction: 0,
    militaryRecruitmentCostMult: 1.0,
    wildernessMoraleBonus: 5,
  },
  zambara: {
    name: 'Zambara Horizon Equitation',
    summary: '+20% Cavalry move speed, +35% cavalry shock charge damage, faster scouts.',
    infantryDamageMult: 1.0,
    infantryDefenseMult: 1.0,
    spearmanAntiCavalryMult: 2.2,
    cavalrySpeedMult: 1.2,
    cavalryChargeMult: 1.35,
    archerDamageMult: 1.0,
    archerRangeMult: 1.05,
    siegeDamageMult: 1.0,
    siegeCostReduction: 0,
    militaryRecruitmentCostMult: 1.0,
    wildernessMoraleBonus: 5,
  },
  kemetra: {
    name: 'Kemetra Siege Engineering',
    summary: '+30% Siege engine damage, -20% siege weapon cost, +15% fortification HP.',
    infantryDamageMult: 1.0,
    infantryDefenseMult: 1.05,
    spearmanAntiCavalryMult: 2.2,
    cavalrySpeedMult: 1.0,
    cavalryChargeMult: 1.0,
    archerDamageMult: 1.0,
    archerRangeMult: 1.0,
    siegeDamageMult: 1.3,
    siegeCostReduction: 0.2,
    militaryRecruitmentCostMult: 1.0,
    wildernessMoraleBonus: 0,
  },
  aseka: {
    name: 'Aseka Mercantile Supply',
    summary: '-15% Military recruitment resource cost, -20% military upkeep deficit impact.',
    infantryDamageMult: 1.05,
    infantryDefenseMult: 1.05,
    spearmanAntiCavalryMult: 2.2,
    cavalrySpeedMult: 1.05,
    cavalryChargeMult: 1.05,
    archerDamageMult: 1.05,
    archerRangeMult: 1.0,
    siegeDamageMult: 1.05,
    siegeCostReduction: 0.15,
    militaryRecruitmentCostMult: 0.85,
    wildernessMoraleBonus: 5,
  },
  nambara: {
    name: 'Nambara Wilderness Archery',
    summary: '+25% Archer damage, +2.5m range, +15 morale when fighting in forest & highlands.',
    infantryDamageMult: 1.0,
    infantryDefenseMult: 1.0,
    spearmanAntiCavalryMult: 2.2,
    cavalrySpeedMult: 1.05,
    cavalryChargeMult: 1.0,
    archerDamageMult: 1.25,
    archerRangeMult: 1.15,
    siegeDamageMult: 1.0,
    siegeCostReduction: 0,
    militaryRecruitmentCostMult: 1.0,
    wildernessMoraleBonus: 15,
  },
};

/**
 * Formation offset generators: calculates local (offsetX, offsetZ) for unit at index i in group of size n.
 */
export function calculateFormationOffsets(
  formation: MilitaryFormationType,
  unitCount: number,
  spacing = 2.0,
): { x: number; z: number }[] {
  const offsets: { x: number; z: number }[] = [];
  if (unitCount <= 0) return offsets;

  switch (formation) {
    case 'line': {
      // Horizontal line centered on 0, facing -Z
      const half = (unitCount - 1) * 0.5;
      for (let i = 0; i < unitCount; i++) {
        offsets.push({ x: (i - half) * spacing, z: 0 });
      }
      break;
    }

    case 'defensive': {
      // Compact staggered 2-rank phalanx
      const cols = Math.max(2, Math.ceil(unitCount / 2));
      for (let i = 0; i < unitCount; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = (col - (cols - 1) * 0.5) * spacing;
        const z = row * spacing * 1.15;
        offsets.push({ x, z });
      }
      break;
    }

    case 'wedge': {
      // Arrowhead pointing forward (-Z)
      offsets.push({ x: 0, z: -spacing * 1.2 });
      let currentDepth = 1;
      let placed = 1;
      while (placed < unitCount) {
        const span = currentDepth * 0.5;
        // Left flank of wedge
        offsets.push({ x: -span * spacing, z: currentDepth * spacing * 0.85 });
        placed++;
        if (placed < unitCount) {
          // Right flank of wedge
          offsets.push({ x: span * spacing, z: currentDepth * spacing * 0.85 });
          placed++;
        }
        currentDepth++;
      }
      break;
    }

    case 'square': {
      // Hollow or filled compact square
      const side = Math.max(2, Math.ceil(Math.sqrt(unitCount)));
      const half = (side - 1) * 0.5;
      for (let i = 0; i < unitCount; i++) {
        const row = Math.floor(i / side);
        const col = i % side;
        offsets.push({
          x: (col - half) * spacing,
          z: (row - half) * spacing,
        });
      }
      break;
    }

    case 'flanking': {
      // Split into two pincers on left and right flanks
      const halfCount = Math.ceil(unitCount / 2);
      for (let i = 0; i < unitCount; i++) {
        const isLeft = i < halfCount;
        const rankIdx = isLeft ? i : i - halfCount;
        const flankSign = isLeft ? -1 : 1;
        offsets.push({
          x: flankSign * (spacing * 2.8 + rankIdx * 0.4),
          z: (rankIdx - 1) * spacing * 1.25,
        });
      }
      break;
    }
  }

  return offsets;
}

/**
 * Calculates rock-paper-scissors unit counter damage multiplier.
 */
export function calculateCombatDamageMultiplier(
  attackerClass: MilitaryUnitClass,
  defenderClass?: MilitaryUnitClass,
  isCharging = false,
  kingdomId: KingdomId = 'oru',
): number {
  if (!defenderClass) return 1.0;
  const bonus = KINGDOM_MILITARY_BONUSES[kingdomId];
  let mult = 1.0;

  // Spearmen vs Cavalry
  if (attackerClass === 'spearman' && (defenderClass === 'cavalry' || defenderClass === 'scout')) {
    mult = bonus.spearmanAntiCavalryMult;
  }
  // Cavalry charge vs vulnerable units
  else if (attackerClass === 'cavalry') {
    if (defenderClass === 'archer' || defenderClass === 'scout') {
      mult = isCharging ? 2.5 * bonus.cavalryChargeMult : 1.7;
    } else if (defenderClass === 'infantry') {
      mult = isCharging ? 1.6 * bonus.cavalryChargeMult : 1.15;
    } else if (defenderClass === 'spearman') {
      // Spearmen heavily punish incoming cavalry
      mult = 0.55;
    }
  }
  // Infantry vs Archers in close quarters
  else if (attackerClass === 'infantry' && defenderClass === 'archer') {
    mult = 1.75;
  }
  // Archers vs slow exposed infantry
  else if (attackerClass === 'archer' && (defenderClass === 'infantry' || defenderClass === 'spearman')) {
    mult = 1.45;
  }
  // Archers vs charging cavalry (less effective at stopping charges)
  else if (attackerClass === 'archer' && defenderClass === 'cavalry') {
    mult = 0.85;
  }
  // Siege Engines vs Fortifications/Structures
  else if (
    (attackerClass === 'battering_ram' || attackerClass === 'catapult') &&
    defenderClass === 'infantry'
  ) {
    mult = 0.7; // Lower against agile single infantry
  }

  return mult;
}
