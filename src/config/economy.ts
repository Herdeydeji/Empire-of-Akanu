import {
  BuildingArchetype,
  BuildingClass,
  CivilianRole,
  KingdomId,
  ProgressionStage,
  ResourceAmounts,
  ResourceKey,
} from '../types/game';

export const RESOURCE_KEYS: ResourceKey[] = ['food', 'wood', 'stone', 'iron', 'gold'];

export interface OccupationConfig {
  role: CivilianRole;
  label: string;
  shortDesc: string;
  primaryResource: ResourceKey | null;
  baseGatherRatePerSec: number;
  carryCapacity: number;
  defaultProp: 'basket' | 'staff' | 'mallet' | 'jar' | 'scroll' | 'bow_slung' | 'axe' | 'pickaxe';
  tunicTint: string;
}

export const OCCUPATION_CONFIGS: Record<CivilianRole, OccupationConfig> = {
  Unemployed: {
    role: 'Unemployed',
    label: 'Unemployed',
    shortDesc: 'Awaiting royal assignment near settlement plaza.',
    primaryResource: null,
    baseGatherRatePerSec: 0,
    carryCapacity: 10,
    defaultProp: 'staff',
    tunicTint: '#8a7962',
  },
  Farmer: {
    role: 'Farmer',
    label: 'Farmer',
    shortDesc: 'Cultivates sorghum, millet, and yam plots for steady food harvests.',
    primaryResource: 'food',
    baseGatherRatePerSec: 2.35,
    carryCapacity: 14,
    defaultProp: 'basket',
    tunicTint: '#c98a3c',
  },
  Woodcutter: {
    role: 'Woodcutter',
    label: 'Woodcutter',
    shortDesc: 'Fells mature timber trees and hauls hardwood logs to storage.',
    primaryResource: 'wood',
    baseGatherRatePerSec: 2.25,
    carryCapacity: 12,
    defaultProp: 'axe',
    tunicTint: '#576b35',
  },
  Miner: {
    role: 'Miner',
    label: 'Miner',
    shortDesc: 'Extracts granite stone, ironstone ore, and gold-bearing quartz.',
    primaryResource: 'stone',
    baseGatherRatePerSec: 1.9,
    carryCapacity: 12,
    defaultProp: 'pickaxe',
    tunicTint: '#6c5a49',
  },
  Builder: {
    role: 'Builder',
    label: 'Builder',
    shortDesc: 'Constructs planned structures and repairs settlement masonry.',
    primaryResource: null,
    baseGatherRatePerSec: 1.0, // 1.0 work-unit/sec per builder before kingdom bonus
    carryCapacity: 10,
    defaultProp: 'mallet',
    tunicTint: '#3c5f78',
  },
  Hunter: {
    role: 'Hunter',
    label: 'Hunter',
    shortDesc: 'Tracks game across savannah and forest hunting grounds for high-yield food.',
    primaryResource: 'food',
    baseGatherRatePerSec: 2.55,
    carryCapacity: 14,
    defaultProp: 'bow_slung',
    tunicTint: '#7a4d2b',
  },
  Fisherman: {
    role: 'Fisherman',
    label: 'Fisherman',
    shortDesc: 'Works riverbank fish-traps and coastal shallows for dependable food.',
    primaryResource: 'food',
    baseGatherRatePerSec: 2.4,
    carryCapacity: 14,
    defaultProp: 'basket',
    tunicTint: '#2d7362',
  },
  Trader: {
    role: 'Trader',
    label: 'Trader',
    shortDesc: 'Operates marketplace exchange routes between stalls and the royal compound.',
    primaryResource: 'gold',
    baseGatherRatePerSec: 1.15,
    carryCapacity: 10,
    defaultProp: 'scroll',
    tunicTint: '#7b3e68',
  },
  Craftsperson: {
    role: 'Craftsperson',
    label: 'Craftsperson',
    shortDesc: 'Forges tools and refines materials at blacksmith workshops (+iron/gold value).',
    primaryResource: 'iron',
    baseGatherRatePerSec: 1.1,
    carryCapacity: 10,
    defaultProp: 'mallet',
    tunicTint: '#a84b2b',
  },
};

export const ASSIGNABLE_OCCUPATIONS: CivilianRole[] = [
  'Farmer',
  'Woodcutter',
  'Miner',
  'Builder',
  'Hunter',
  'Fisherman',
  'Trader',
  'Craftsperson',
  'Unemployed',
];

export interface KingdomEconomicBonus {
  summary: string;
  constructionSpeedMult: number;
  stoneCostMult: number;
  woodGatherMult: number;
  miningGatherMult: number;
  farmingGatherMult: number;
  huntingFishingMult: number;
  traderGoldMult: number;
  villagerMoveSpeedMult: number;
  storageBonusMult: number;
  treeRegrowthTimeMult: number;
}

export const KINGDOM_ECONOMIC_BONUSES: Record<KingdomId, KingdomEconomicBonus> = {
  oru: {
    summary: '+15% masonry construction speed · -10% stone building cost',
    constructionSpeedMult: 1.15,
    stoneCostMult: 0.9,
    woodGatherMult: 1.0,
    miningGatherMult: 1.05,
    farmingGatherMult: 1.0,
    huntingFishingMult: 1.0,
    traderGoldMult: 1.0,
    villagerMoveSpeedMult: 1.0,
    storageBonusMult: 1.05,
    treeRegrowthTimeMult: 1.0,
  },
  zambara: {
    summary: '+12% villager travel speed · +15% hunting & pastoral food yield',
    constructionSpeedMult: 1.0,
    stoneCostMult: 1.0,
    woodGatherMult: 1.0,
    miningGatherMult: 1.0,
    farmingGatherMult: 1.05,
    huntingFishingMult: 1.15,
    traderGoldMult: 1.05,
    villagerMoveSpeedMult: 1.12,
    storageBonusMult: 1.0,
    treeRegrowthTimeMult: 1.0,
  },
  kemetra: {
    summary: '+20% engineering build rate · +18% stone, iron & gold mining rate',
    constructionSpeedMult: 1.2,
    stoneCostMult: 0.95,
    woodGatherMult: 1.0,
    miningGatherMult: 1.18,
    farmingGatherMult: 1.05,
    huntingFishingMult: 1.0,
    traderGoldMult: 1.0,
    villagerMoveSpeedMult: 1.0,
    storageBonusMult: 1.05,
    treeRegrowthTimeMult: 1.0,
  },
  aseka: {
    summary: '+25% marketplace trader gold yield · +15% warehouse & treasury capacity',
    constructionSpeedMult: 1.04,
    stoneCostMult: 1.0,
    woodGatherMult: 1.0,
    miningGatherMult: 1.0,
    farmingGatherMult: 1.04,
    huntingFishingMult: 1.0,
    traderGoldMult: 1.25,
    villagerMoveSpeedMult: 1.03,
    storageBonusMult: 1.15,
    treeRegrowthTimeMult: 1.0,
  },
  nambara: {
    summary: '+20% woodcutting & hunting/fishing yield · 25% faster forest regrowth',
    constructionSpeedMult: 1.02,
    stoneCostMult: 1.0,
    woodGatherMult: 1.2,
    miningGatherMult: 1.0,
    farmingGatherMult: 1.0,
    huntingFishingMult: 1.2,
    traderGoldMult: 1.0,
    villagerMoveSpeedMult: 1.06,
    storageBonusMult: 1.0,
    treeRegrowthTimeMult: 0.75,
  },
};

export interface BuildingBlueprint {
  archetype: BuildingArchetype;
  name: string;
  buildingClass: BuildingClass;
  buildable: boolean;
  footprintRadius: number;
  cost: ResourceAmounts;
  constructionWorkRequired: number; // builder work-seconds
  maxIntegrity: number;
  housingBonus: number;
  storageBonus: Partial<ResourceAmounts>;
  acceptsStorage: ResourceKey[];
  maxWorkers: number;
  description: string;
  economicRoleSummary: string;
  phaseNote?: string;
}

export const BUILDING_CATALOG: Record<BuildingArchetype, BuildingBlueprint> = {
  royal_compound: {
    archetype: 'royal_compound',
    name: "Chieftain's Compound",
    buildingClass: 'Royal',
    buildable: false,
    footprintRadius: 7.2,
    cost: { food: 0, wood: 400, stone: 400, iron: 100, gold: 200 },
    constructionWorkRequired: 45,
    maxIntegrity: 1200,
    housingBonus: 6,
    storageBonus: { food: 500, wood: 500, stone: 500, iron: 400, gold: 450 },
    acceptsStorage: ['food', 'wood', 'stone', 'iron', 'gold'],
    maxWorkers: 2,
    description: 'Founding administrative hearth, central storehouse, and seat of governance.',
    economicRoleSummary: '+6 Housing · Universal Base Storage · Villager Arrival Hearth',
  },
  dwelling_house: {
    archetype: 'dwelling_house',
    name: 'Dwelling House',
    buildingClass: 'Residential',
    buildable: true,
    footprintRadius: 3.1,
    cost: { food: 0, wood: 75, stone: 30, iron: 0, gold: 0 },
    constructionWorkRequired: 10,
    maxIntegrity: 420,
    housingBonus: 4,
    storageBonus: {},
    acceptsStorage: [],
    maxWorkers: 0,
    description: 'Traditional earthen dwelling with shaded eaves and domestic hearth.',
    economicRoleSummary: '+4 Housing Capacity',
  },
  residential_compound: {
    archetype: 'residential_compound',
    name: 'Family Compound',
    buildingClass: 'Residential',
    buildable: true,
    footprintRadius: 4.8,
    cost: { food: 25, wood: 140, stone: 85, iron: 0, gold: 0 },
    constructionWorkRequired: 18,
    maxIntegrity: 680,
    housingBonus: 8,
    storageBonus: { food: 80 },
    acceptsStorage: [],
    maxWorkers: 0,
    description: 'Walled extended-kinship courtyard housing multiple artisan families.',
    economicRoleSummary: '+8 Housing Capacity · +80 Food Reserve',
  },
  cultivated_farm: {
    archetype: 'cultivated_farm',
    name: 'Cultivated Farm',
    buildingClass: 'Economic',
    buildable: true,
    footprintRadius: 5.3,
    cost: { food: 0, wood: 65, stone: 10, iron: 0, gold: 0 },
    constructionWorkRequired: 9,
    maxIntegrity: 350,
    housingBonus: 0,
    storageBonus: {},
    acceptsStorage: [],
    maxWorkers: 3,
    description: 'Irrigated dark-loam furrows producing renewable sorghum, millet, and yams.',
    economicRoleSummary: 'Renewable Food Production (Up to 3 Farmers)',
  },
  granary_storehouse: {
    archetype: 'granary_storehouse',
    name: 'Granary',
    buildingClass: 'Economic',
    buildable: true,
    footprintRadius: 3.6,
    cost: { food: 0, wood: 95, stone: 55, iron: 0, gold: 0 },
    constructionWorkRequired: 12,
    maxIntegrity: 520,
    housingBonus: 0,
    storageBonus: { food: 550 },
    acceptsStorage: ['food'],
    maxWorkers: 0,
    description: 'Raised clay-and-timber grain cylinders protecting harvests from moisture.',
    economicRoleSummary: '+550 Food Storage · Food Drop-Off Point',
  },
  warehouse_storehouse: {
    archetype: 'warehouse_storehouse',
    name: 'Warehouse',
    buildingClass: 'Economic',
    buildable: true,
    footprintRadius: 4.4,
    cost: { food: 0, wood: 120, stone: 75, iron: 0, gold: 0 },
    constructionWorkRequired: 14,
    maxIntegrity: 600,
    housingBonus: 0,
    storageBonus: { wood: 550, stone: 550, iron: 400 },
    acceptsStorage: ['wood', 'stone', 'iron'],
    maxWorkers: 0,
    description: 'Heavy timber-beamed depot storing lumber stacks, stone blocks, and ore.',
    economicRoleSummary: '+550 Wood/Stone, +400 Iron Storage · Material Drop-Off',
  },
  market_courtyard: {
    archetype: 'market_courtyard',
    name: 'Marketplace',
    buildingClass: 'Economic',
    buildable: true,
    footprintRadius: 4.5,
    cost: { food: 0, wood: 130, stone: 70, iron: 0, gold: 35 },
    constructionWorkRequired: 15,
    maxIntegrity: 580,
    housingBonus: 0,
    storageBonus: { food: 150, gold: 250 },
    acceptsStorage: ['gold', 'food'],
    maxWorkers: 3,
    description: 'Shaded merchant pavilion enabling local exchange tariffs and gold drop-off.',
    economicRoleSummary: 'Employs Traders (+Gold Tariffs) · +250 Gold, +150 Food Storage',
  },
  mine_pit: {
    archetype: 'mine_pit',
    name: 'Mining Camp',
    buildingClass: 'Economic',
    buildable: true,
    footprintRadius: 3.9,
    cost: { food: 0, wood: 110, stone: 65, iron: 15, gold: 0 },
    constructionWorkRequired: 14,
    maxIntegrity: 560,
    housingBonus: 0,
    storageBonus: { stone: 300, iron: 300, gold: 200 },
    acceptsStorage: ['stone', 'iron', 'gold'],
    maxWorkers: 4,
    description: 'Timber-shored extraction camp serving nearby stone, iron, and gold seams.',
    economicRoleSummary: 'Mineral Drop-Off Point · +300 Stone/Iron, +200 Gold Storage',
  },
  blacksmith_workshop: {
    archetype: 'blacksmith_workshop',
    name: 'Blacksmith Workshop',
    buildingClass: 'Economic',
    buildable: true,
    footprintRadius: 4.0,
    cost: { food: 0, wood: 125, stone: 95, iron: 45, gold: 0 },
    constructionWorkRequired: 16,
    maxIntegrity: 620,
    housingBonus: 0,
    storageBonus: { iron: 200 },
    acceptsStorage: ['iron'],
    maxWorkers: 2,
    description: 'Bloomery furnace and anvil yard where craftspeople forge tools and metalwork.',
    economicRoleSummary: 'Employs Craftspeople (+Refined Iron/Gold) · +200 Iron Storage',
  },
  barracks_compound: {
    archetype: 'barracks_compound',
    name: 'Barracks',
    buildingClass: 'Military',
    buildable: true,
    footprintRadius: 4.8,
    cost: { food: 0, wood: 150, stone: 130, iron: 40, gold: 0 },
    constructionWorkRequired: 18,
    maxIntegrity: 820,
    housingBonus: 2,
    storageBonus: {},
    acceptsStorage: [],
    maxWorkers: 0,
    description: 'Walled infantry muster yard with weapon racks and drill courtyard.',
    economicRoleSummary: '+2 Garrison Quarters · Prepares Infantry Muster',
    phaseNote: 'Unit recruitment unlocks in Phase 3',
  },
  archery_grounds: {
    archetype: 'archery_grounds',
    name: 'Archery Grounds',
    buildingClass: 'Military',
    buildable: true,
    footprintRadius: 4.6,
    cost: { food: 0, wood: 160, stone: 75, iron: 25, gold: 0 },
    constructionWorkRequired: 16,
    maxIntegrity: 700,
    housingBonus: 0,
    storageBonus: {},
    acceptsStorage: [],
    maxWorkers: 0,
    description: 'Bowyer pavilion and ranged target butts for marksmen preparation.',
    economicRoleSummary: 'Ranged Military Infrastructure',
    phaseNote: 'Archer training unlocks in Phase 3',
  },
  cavalry_stables: {
    archetype: 'cavalry_stables',
    name: 'Cavalry Stables',
    buildingClass: 'Military',
    buildable: true,
    footprintRadius: 5.0,
    cost: { food: 60, wood: 175, stone: 90, iron: 30, gold: 25 },
    constructionWorkRequired: 19,
    maxIntegrity: 760,
    housingBonus: 0,
    storageBonus: {},
    acceptsStorage: [],
    maxWorkers: 0,
    description: 'Shaded horse paddocks, fodder troughs, and tack room for mounted lancers.',
    economicRoleSummary: 'Equestrian Military Infrastructure',
    phaseNote: 'Cavalry training unlocks in Phase 3',
  },
  weapon_workshop: {
    archetype: 'weapon_workshop',
    name: 'Weapon Workshop',
    buildingClass: 'Military',
    buildable: true,
    footprintRadius: 4.2,
    cost: { food: 0, wood: 145, stone: 110, iron: 65, gold: 30 },
    constructionWorkRequired: 18,
    maxIntegrity: 680,
    housingBonus: 0,
    storageBonus: { iron: 150 },
    acceptsStorage: ['iron'],
    maxWorkers: 2,
    description: 'Armourer and siege-carpentry yard preparing military armaments.',
    economicRoleSummary: 'Employs Craftspeople · +150 Iron Storage',
    phaseNote: 'Siege & weapon upgrades unlock in Phase 3',
  },
  royal_palace: {
    archetype: 'royal_palace',
    name: 'Royal Palace',
    buildingClass: 'Royal',
    buildable: true,
    footprintRadius: 6.6,
    cost: { food: 100, wood: 280, stone: 320, iron: 90, gold: 160 },
    constructionWorkRequired: 30,
    maxIntegrity: 1500,
    housingBonus: 8,
    storageBonus: { food: 350, wood: 350, stone: 350, iron: 300, gold: 500 },
    acceptsStorage: ['food', 'wood', 'stone', 'iron', 'gold'],
    maxWorkers: 2,
    description: 'Sovereign monumental court elevating kingdom prestige, governance, and reserves.',
    economicRoleSummary: '+8 Housing · +500 Gold & Universal Storage · +8 Happiness',
  },
  council_chambers: {
    archetype: 'council_chambers',
    name: 'Council Chambers',
    buildingClass: 'Royal',
    buildable: true,
    footprintRadius: 4.7,
    cost: { food: 0, wood: 180, stone: 210, iron: 40, gold: 95 },
    constructionWorkRequired: 22,
    maxIntegrity: 960,
    housingBonus: 2,
    storageBonus: { gold: 250 },
    acceptsStorage: ['gold'],
    maxWorkers: 1,
    description: 'Deliberative hall of elders, scribes, and provincial stewards.',
    economicRoleSummary: '+2 Housing · +250 Gold Storage · +5 Happiness',
  },
  royal_treasury: {
    archetype: 'royal_treasury',
    name: 'Royal Treasury',
    buildingClass: 'Royal',
    buildable: true,
    footprintRadius: 4.3,
    cost: { food: 0, wood: 140, stone: 220, iron: 60, gold: 80 },
    constructionWorkRequired: 20,
    maxIntegrity: 1050,
    housingBonus: 0,
    storageBonus: { iron: 450, gold: 850 },
    acceptsStorage: ['gold', 'iron'],
    maxWorkers: 0,
    description: 'Fortified stone vault safeguarding bullion, goldweights, and iron ingots.',
    economicRoleSummary: '+850 Gold, +450 Iron Storage · Precious Metal Vault',
  },
  watch_post: {
    archetype: 'watch_post',
    name: 'Frontier Watch-Post',
    buildingClass: 'Defensive',
    buildable: true,
    footprintRadius: 3.4,
    cost: { food: 0, wood: 90, stone: 85, iron: 15, gold: 0 },
    constructionWorkRequired: 13,
    maxIntegrity: 780,
    housingBonus: 0,
    storageBonus: {},
    acceptsStorage: [],
    maxWorkers: 0,
    description: 'Elevated lookout tower scanning surrounding ridges and approaches.',
    economicRoleSummary: 'Frontier Surveillance Landmark',
  },
};

export const BUILDABLE_ARCHETYPES: BuildingArchetype[] = (
  Object.keys(BUILDING_CATALOG) as BuildingArchetype[]
).filter((key) => BUILDING_CATALOG[key].buildable);

export const ECONOMY_RULES = {
  // Base kingdom reserves even before additional warehouses (supplemented by buildings)
  minimumBaseCapacity: {
    food: 250,
    wood: 250,
    stone: 250,
    iron: 200,
    gold: 200,
  } as ResourceAmounts,
  // Food consumed per villager per second (~3.6 food/min per villager => 8 villagers consume ~28.8 food/min, easily sustained by 2 farmers producing ~55-70 food/min)
  foodConsumptionPerVillagerPerSec: 0.06,
  // Minimum food buffer required for positive population growth
  minFoodForPopulationGrowth: 60,
  // Growth points per second when well-fed & housed (reaches 100 in ~38s with surplus food)
  basePopulationGrowthRatePerSec: 2.6,
  // Economy simulation step interval (seconds) decoupled from 60fps render loop
  economyTickIntervalSec: 0.5,
  // Refund ratio when cancelling planned/unfinished construction
  constructionCancelRefundRatio: 0.75,
};

export function getAdjustedBuildingCost(
  archetype: BuildingArchetype,
  kingdomId: KingdomId,
): ResourceAmounts {
  const base = BUILDING_CATALOG[archetype].cost;
  const bonus = KINGDOM_ECONOMIC_BONUSES[kingdomId];
  return {
    food: base.food,
    wood: base.wood,
    stone: Math.max(0, Math.round(base.stone * bonus.stoneCostMult)),
    iron: base.iron,
    gold: base.gold,
  };
}

export function evaluateProgressionStage(
  populationCurrent: number,
  completedBuildingCount: number,
  hasRoyalPalace: boolean,
): ProgressionStage {
  if (hasRoyalPalace && populationCurrent >= 26 && completedBuildingCount >= 16) {
    return 'Empire';
  }
  if (hasRoyalPalace && populationCurrent >= 20 && completedBuildingCount >= 14) {
    return 'Kingdom';
  }
  if (populationCurrent >= 16 && completedBuildingCount >= 12) {
    return 'Fortified City';
  }
  if (populationCurrent >= 12 && completedBuildingCount >= 11) {
    return 'Town';
  }
  if (populationCurrent >= 10 || completedBuildingCount >= 10) {
    return 'Settlement';
  }
  return 'Village';
}
