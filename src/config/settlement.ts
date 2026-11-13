import {
  BUILDING_CATALOG,
  KINGDOM_ECONOMIC_BONUSES,
  OCCUPATION_CONFIGS,
} from './economy';
import { KINGDOMS } from './kingdoms';
import { sampleTerrainHeight, sampleTerrainSlope, WATER_LEVEL } from '../engine/math/noise';
import {
  BuildingEntity,
  CharacterEntity,
  CivilianRole,
  EnvironmentNodeEntity,
  KingdomId,
  RegionConfig,
} from '../types/game';

const SKIN_TONES = ['#4a2c18', '#5c3820', '#3b2213', '#6b4226', '#4f301c', '#331c0f'];

const VILLAGER_NAMES = [
  'Kofi',
  'Zuri',
  'Bakari',
  'Amara',
  'Tariq',
  'Nia',
  'Sanaa',
  'Jengo',
  'Tunde',
  'Duma',
  'Imani',
  'Kwame',
  'Amina',
  'Zuberi',
  'Makena',
  'Jabari',
  'Nala',
  'Chidi',
  'Sefu',
  'Lulu',
];

export interface SettlementWorldData {
  buildings: BuildingEntity[];
  characters: CharacterEntity[];
  resourceNodes: EnvironmentNodeEntity[];
  roads: { from: [number, number]; to: [number, number]; width: number }[];
}

export function createVillagerEntity(params: {
  id: string;
  name: string;
  role: CivilianRole;
  kingdomId: KingdomId;
  x: number;
  z: number;
  region: RegionConfig;
  seed: number;
  indexSeed: number;
}): CharacterEntity {
  const kingdom = KINGDOMS[params.kingdomId];
  const occ = OCCUPATION_CONFIGS[params.role];
  const y = Math.max(
    WATER_LEVEL + 0.05,
    sampleTerrainHeight(params.x, params.z, params.region, params.seed),
  );

  return {
    id: params.id,
    category: 'character',
    name: params.name,
    role: params.role,
    kingdomId: params.kingdomId,
    position: { x: params.x, y, z: params.z },
    rotationY: (params.indexSeed * 0.95) % (Math.PI * 2),
    speed: 0,
    animationState: 'idle',
    activityLabel:
      params.role === 'Unemployed'
        ? 'Awaiting assignment at plaza'
        : `Preparing ${params.role.toLowerCase()} tools`,
    gaitPhase: params.indexSeed * 1.15,
    waypoints: [],
    currentWaypointIndex: 0,
    waitTimer: 0.25 + (params.indexSeed % 3) * 0.2,
    health: 100,
    maxHealth: 100,
    tunicColor:
      params.role === 'Trader' || params.role === 'Unemployed'
        ? kingdom.palette.primary
        : occ.tunicTint,
    accentColor: kingdom.palette.accent,
    skinTone: SKIN_TONES[params.indexSeed % SKIN_TONES.length],
    propType: occ.defaultProp,
    taskType: 'idle',
    carriedResource: null,
    carriedAmount: 0,
    carryCapacity: occ.carryCapacity,
    assignedNodeId: null,
    assignedBuildingId: null,
    deliveryBuildingId: null,
    moveTarget: null,
    workProgress: 0,
    productivity: 1.0,
    preferredResource: occ.primaryResource,
  };
}

export function createSpawnedCitizen(
  existingCount: number,
  kingdomId: KingdomId,
  region: RegionConfig,
  seed: number,
): CharacterEntity {
  const baseName = VILLAGER_NAMES[existingCount % VILLAGER_NAMES.length];
  const angle = (existingCount * 1.37) % (Math.PI * 2);
  const spawnX = Math.cos(angle) * 5.2;
  const spawnZ = 4.2 + Math.sin(angle) * 2.6;
  return createVillagerEntity({
    id: `char_citizen_${existingCount + 1}_${Math.floor(Math.abs(spawnX * 100))}`,
    name: `Citizen ${baseName}`,
    role: 'Unemployed',
    kingdomId,
    x: spawnX,
    z: spawnZ,
    region,
    seed,
    indexSeed: existingCount + 3,
  });
}

export function generateInitialSettlement(
  kingdomId: KingdomId,
  region: RegionConfig,
  seed: number,
): SettlementWorldData {
  const kingdom = KINGDOMS[kingdomId];
  const bonus = KINGDOM_ECONOMIC_BONUSES[kingdomId];

  const initialStructures: {
    id: string;
    name: string;
    archetype: BuildingEntity['archetype'];
    x: number;
    z: number;
    rotY: number;
    description: string;
    statusText: string;
  }[] = [
    {
      id: 'bld_royal_compound',
      name: `${kingdom.name} Chieftain's Compound`,
      archetype: 'royal_compound',
      x: 0,
      z: -2,
      rotY: 0.18,
      description: `Central administrative hearth and universal storehouse of ${kingdom.name}.`,
      statusText: 'Seat of Governance · Universal Storage Active',
    },
    {
      id: 'bld_compound_west',
      name: 'Lineage Courtyard Compound',
      archetype: 'residential_compound',
      x: -14.5,
      z: -4.5,
      rotY: 0.72,
      description: 'Walled extended-family residential compound housing kinship elders and artisans.',
      statusText: 'Completed · +8 Housing Capacity',
    },
    {
      id: 'bld_market_plaza',
      name: 'Barter & Weaver Marketplace',
      archetype: 'market_courtyard',
      x: 13.5,
      z: -5.5,
      rotY: -0.55,
      description: 'Shaded exchange pavilion supporting local traders and gold tariff collection.',
      statusText: 'Completed · Local Exchange & Gold Drop-Off',
    },
    {
      id: 'bld_granary_north',
      name: 'Elevated Millet Granary',
      archetype: 'granary_storehouse',
      x: -7.5,
      z: -15.5,
      rotY: -0.25,
      description: 'Raised timber-and-clay storage cylinders keeping harvested grain cool and dry.',
      statusText: 'Completed · +550 Food Storage',
    },
    {
      id: 'bld_house_east_1',
      name: 'Craftspeople Dwelling',
      archetype: 'dwelling_house',
      x: 9.5,
      z: -15.0,
      rotY: -1.1,
      description: 'Traditional earthen dwelling with shaded eaves and domestic hearth.',
      statusText: 'Completed · +4 Housing Capacity',
    },
    {
      id: 'bld_house_south_2',
      name: 'River-Ward Homestead',
      archetype: 'dwelling_house',
      x: -11.5,
      z: 8.5,
      rotY: 2.15,
      description: 'Homestead overlooking the southern approach path toward the water crossing.',
      statusText: 'Completed · +4 Housing Capacity',
    },
    {
      id: 'bld_farm_east',
      name: 'Sorghum & Millet Terrace',
      archetype: 'cultivated_farm',
      x: 20.5,
      z: 7.5,
      rotY: 0.12,
      description: 'Furrowed dark-loam agricultural plots irrigated by shallow earthen channels.',
      statusText: 'Cultivated Cropland · Active Food Production',
    },
    {
      id: 'bld_farm_southeast',
      name: 'Alluvial Yam & Grain Plot',
      archetype: 'cultivated_farm',
      x: 9.5,
      z: 13.5,
      rotY: -0.32,
      description: 'Secondary fertile plot positioned near the lower water basin.',
      statusText: 'Cultivated Cropland · Active Food Production',
    },
    {
      id: 'bld_watch_post',
      name: `${kingdom.name} Frontier Watch-Post`,
      archetype: 'watch_post',
      x: -19.5,
      z: -16.5,
      rotY: 0.4,
      description: 'Elevated lookout tower scanning surrounding ridges, trails, and approaches.',
      statusText: 'Garrison Lookout · Operational',
    },
  ];

  const buildings: BuildingEntity[] = initialStructures.map((spec) => {
    const bp = BUILDING_CATALOG[spec.archetype];
    const y = sampleTerrainHeight(spec.x, spec.z, region, seed);
    return {
      id: spec.id,
      category: 'building',
      name: spec.name,
      archetype: spec.archetype,
      buildingClass: bp.buildingClass,
      kingdomId,
      position: { x: spec.x, y, z: spec.z },
      rotationY: spec.rotY,
      footprintRadius: bp.footprintRadius,
      description: spec.description,
      statusText: spec.statusText,
      integrity: bp.maxIntegrity,
      maxIntegrity: bp.maxIntegrity,
      constructionState: 'completed',
      constructionProgress: 1,
      constructionWorkRequired: bp.constructionWorkRequired,
      constructionCost: { ...bp.cost },
      housingBonus: bp.housingBonus,
      storageBonus: { ...bp.storageBonus },
      acceptsStorage: [...bp.acceptsStorage],
      assignedWorkerIds: [],
      maxWorkers: bp.maxWorkers,
      linkedNodeId: null,
    };
  });

  const roads: { from: [number, number]; to: [number, number]; width: number }[] = [
    { from: [0, -2], to: [0, 17.5], width: 3.2 },
    { from: [0, 4], to: [-14.5, -4.5], width: 2.6 },
    { from: [0, 3], to: [13.5, -5.5], width: 2.6 },
    { from: [0, -2], to: [-7.5, -15.5], width: 2.4 },
    { from: [0, -2], to: [9.5, -15.0], width: 2.4 },
    { from: [-7.5, -15.5], to: [-19.5, -16.5], width: 2.2 },
    { from: [13.5, -5.5], to: [20.5, 7.5], width: 2.4 },
    { from: [0, 10], to: [9.5, 13.5], width: 2.3 },
    { from: [0, 8], to: [-11.5, 8.5], width: 2.2 },
  ];

  // Primary strategic deposits + fisheries + hunting grounds
  const nodeSpecs: {
    id: string;
    name: string;
    nodeKind: EnvironmentNodeEntity['nodeKind'];
    resourceType: EnvironmentNodeEntity['resourceType'];
    richnessLabel: string;
    x: number;
    z: number;
    radius: number;
    yieldAmount: number;
    collectionRate: number;
    regenerates: boolean;
    regrowthDuration: number;
    maxHarvesters: number;
    description: string;
  }[] = [
    {
      id: 'res_gold_kopje',
      name: 'Auriferous Quartz Outcrop',
      nodeKind: 'gold_outcrop',
      resourceType: 'gold',
      richnessLabel: 'Rich Vein · 1,600 Gold',
      x: -29,
      z: -22,
      radius: 4.1,
      yieldAmount: 1600,
      collectionRate: 1.65,
      regenerates: false,
      regrowthDuration: 0,
      maxHarvesters: 4,
      description: 'Sun-glinting gold-bearing quartz seam embedded within weathered red granite.',
    },
    {
      id: 'res_iron_ridge',
      name: 'Laterite Ironstone Deposit',
      nodeKind: 'iron_deposit',
      resourceType: 'iron',
      richnessLabel: 'High Grade · 2,200 Iron',
      x: 29,
      z: -20,
      radius: 4.0,
      yieldAmount: 2200,
      collectionRate: 1.85,
      regenerates: false,
      regrowthDuration: 0,
      maxHarvesters: 4,
      description: 'Dense rust-red ironstone ore suitable for smelting into tools and ingots.',
    },
    {
      id: 'res_stone_quarry',
      name: 'Granite Escarpment Quarry',
      nodeKind: 'stone_quarry',
      resourceType: 'stone',
      richnessLabel: 'Abundant · 3,200 Stone',
      x: -28,
      z: 11,
      radius: 4.5,
      yieldAmount: 3200,
      collectionRate: 2.15,
      regenerates: false,
      regrowthDuration: 0,
      maxHarvesters: 5,
      description: 'Layered monolithic granite blocks prized by masons for foundations and walls.',
    },
    {
      id: 'res_timber_grove',
      name: 'Elder Hardwood Stand',
      nodeKind: 'timber_grove',
      resourceType: 'wood',
      richnessLabel: 'Dense Stand · 900 Wood (Regrows)',
      x: 27.5,
      z: -3.5,
      radius: 4.4,
      yieldAmount: 900,
      collectionRate: 2.35,
      regenerates: true,
      regrowthDuration: Math.round(48 * bonus.treeRegrowthTimeMult),
      maxHarvesters: 4,
      description: 'Mature stand of dense African hardwood that regenerates from rootstock.',
    },
    {
      id: 'res_river_fishery',
      name: 'Fertile Riverbank Shallows',
      nodeKind: 'fertile_fishery',
      resourceType: 'food',
      richnessLabel: 'Thriving Waters · Renewable Fish',
      x: -2,
      z: 19.2,
      radius: 4.0,
      yieldAmount: 1800,
      collectionRate: 2.45,
      regenerates: true,
      regrowthDuration: 35,
      maxHarvesters: 4,
      description: 'Calm reed-lined river bend teeming with Nile perch and tilapia.',
    },
    {
      id: 'res_river_fishery_east',
      name: 'Eastern Reed Fishery',
      nodeKind: 'fertile_fishery',
      resourceType: 'food',
      richnessLabel: 'Active Shallows · Renewable Fish',
      x: 16.5,
      z: 20.0,
      radius: 3.6,
      yieldAmount: 1500,
      collectionRate: 2.35,
      regenerates: true,
      regrowthDuration: 35,
      maxHarvesters: 3,
      description: 'Woven basket fish-traps anchored along the eastern river bend.',
    },
    {
      id: 'res_hunting_savannah_north',
      name: 'Acacia Game Clearing',
      nodeKind: 'hunting_ground',
      resourceType: 'food',
      richnessLabel: 'Wild Herd · Renewable Game',
      x: -4.5,
      z: -28.5,
      radius: 4.5,
      yieldAmount: 950,
      collectionRate: 2.6,
      regenerates: true,
      regrowthDuration: 42,
      maxHarvesters: 3,
      description: 'Open savannah grazing ground frequented by antelope and guinea fowl.',
    },
    {
      id: 'res_hunting_ridge_east',
      name: 'Eastern Grassland Run',
      nodeKind: 'hunting_ground',
      resourceType: 'food',
      richnessLabel: 'Wild Herd · Renewable Game',
      x: 34.0,
      z: 12.5,
      radius: 4.4,
      yieldAmount: 950,
      collectionRate: 2.6,
      regenerates: true,
      regrowthDuration: 42,
      maxHarvesters: 3,
      description: 'Tall-grass hunting ground along the eastern settlement perimeter.',
    },
  ];

  // Add 12 individual harvestable woodland trees near the settlement so Woodcutters
  // physically fell individual trees into stumps and trigger visible regrowth!
  const candidateTreeCoords: [number, number][] = [
    [22.5, -11.5],
    [25.5, -9.5],
    [21.0, -16.5],
    [17.5, -19.5],
    [-23.5, -8.5],
    [-26.0, -3.0],
    [-22.5, 2.5],
    [-16.5, -23.5],
    [5.0, -24.0],
    [13.0, -22.5],
    [-21.5, 16.0],
    [28.5, 2.5],
  ];

  candidateTreeCoords.forEach(([tx, tz], idx) => {
    const ty = sampleTerrainHeight(tx, tz, region, seed);
    const slope = sampleTerrainSlope(tx, tz, region, seed);
    if (ty > WATER_LEVEL + 0.3 && slope < 0.5) {
      nodeSpecs.push({
        id: `res_tree_${idx + 1}`,
        name: `Mature Acacia Timber #${idx + 1}`,
        nodeKind: 'harvestable_tree',
        resourceType: 'wood',
        richnessLabel: '90 Wood · Regrows After Felling',
        x: tx,
        z: tz,
        radius: 2.1,
        yieldAmount: 90,
        collectionRate: 2.3,
        regenerates: true,
        regrowthDuration: Math.round(32 * bonus.treeRegrowthTimeMult),
        maxHarvesters: 2,
        description: 'Fellable timber tree; turns into a stump when harvested and regrows naturally.',
      });
    }
  });

  const resourceNodes: EnvironmentNodeEntity[] = nodeSpecs.map((n) => ({
    id: n.id,
    category: 'resource_node',
    name: n.name,
    nodeKind: n.nodeKind,
    resourceType: n.resourceType,
    richnessLabel: n.richnessLabel,
    position: {
      x: n.x,
      y: sampleTerrainHeight(n.x, n.z, region, seed),
      z: n.z,
    },
    rotationY: ((Math.abs(n.x) * 13 + Math.abs(n.z) * 7) % 360) * (Math.PI / 180),
    footprintRadius: n.radius,
    description: n.description,
    remainingYield: n.yieldAmount,
    maxYield: n.yieldAmount,
    collectionRate: n.collectionRate,
    interactionRadius: n.radius + 0.9,
    regenerates: n.regenerates,
    regrowthDuration: n.regrowthDuration,
    regrowthTimer: 0,
    depleted: false,
    activeHarvesterIds: [],
    maxHarvesters: n.maxHarvesters,
    ownerKingdomId: kingdomId,
  }));

  // Founding 8 economic villagers actively sustaining and expanding the kingdom
  const foundingVillagers: {
    id: string;
    name: string;
    role: CivilianRole;
    x: number;
    z: number;
  }[] = [
    {
      id: 'char_farmer_kofi',
      name: 'Cultivator Kofi',
      role: 'Farmer',
      x: 16.5,
      z: 6.2,
    },
    {
      id: 'char_farmer_zuri',
      name: 'Harvester Zuri',
      role: 'Farmer',
      x: 8.5,
      z: 11.2,
    },
    {
      id: 'char_woodcutter_bakari',
      name: 'Forester Bakari',
      role: 'Woodcutter',
      x: 19.5,
      z: -9.5,
    },
    {
      id: 'char_woodcutter_tunde',
      name: 'Woodsman Tunde',
      role: 'Woodcutter',
      x: -18.5,
      z: -7.5,
    },
    {
      id: 'char_miner_duma',
      name: 'Quarryman Duma',
      role: 'Miner',
      x: -21.0,
      z: 8.5,
    },
    {
      id: 'char_builder_tariq',
      name: 'Master Mason Tariq',
      role: 'Builder',
      x: -4.5,
      z: 3.5,
    },
    {
      id: 'char_fisher_nia',
      name: 'Fisher Nia',
      role: 'Fisherman',
      x: -1.5,
      z: 15.0,
    },
    {
      id: 'char_trader_sanaa',
      name: 'Merchant Sanaa',
      role: 'Trader',
      x: 10.5,
      z: -3.2,
    },
  ];

  const characters: CharacterEntity[] = foundingVillagers.map((v, idx) =>
    createVillagerEntity({
      id: v.id,
      name: v.name,
      role: v.role,
      kingdomId,
      x: v.x,
      z: v.z,
      region,
      seed,
      indexSeed: idx,
    }),
  );

  // Generate rival AI kingdom settlements across outer map territories
  const allKingdomIds: KingdomId[] = ['oru', 'zambara', 'kemetra', 'aseka', 'nambara'];
  const rivalKingdomIds = allKingdomIds.filter((k) => k !== kingdomId);
  const rivalPositions: [number, number][] = [
    [-48, -42],
    [48, -42],
    [-48, 42],
    [48, 42],
  ];

  rivalKingdomIds.forEach((rId, rIndex) => {
    const rKingdom = KINGDOMS[rId];
    const [cx, cz] = rivalPositions[rIndex];

    // Main Chieftain Compound
    const compoundY = sampleTerrainHeight(cx, cz, region, seed);
    buildings.push({
      id: `bld_royal_${rId}`,
      category: 'building',
      name: `${rKingdom.name} Regional Capital`,
      archetype: 'royal_compound',
      buildingClass: 'Royal',
      kingdomId: rId,
      position: { x: cx, y: compoundY, z: cz },
      rotationY: 0.1,
      footprintRadius: 4.8,
      description: `Seat of ${rKingdom.name} sovereign power and governance.`,
      statusText: 'Active Governance · Universal Storage',
      integrity: 600,
      maxIntegrity: 600,
      constructionState: 'completed',
      constructionProgress: 1,
      constructionWorkRequired: 180,
      constructionCost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      housingBonus: 12,
      storageBonus: { food: 500, wood: 500, stone: 500, iron: 300, gold: 300 },
      acceptsStorage: ['food', 'wood', 'stone', 'iron', 'gold'],
      assignedWorkerIds: [],
      maxWorkers: 6,
    });

    // Granary
    const granaryX = cx + 8;
    const granaryZ = cz - 4;
    buildings.push({
      id: `bld_granary_${rId}`,
      category: 'building',
      name: `${rKingdom.name} Granary`,
      archetype: 'granary_storehouse',
      buildingClass: 'Economic',
      kingdomId: rId,
      position: { x: granaryX, y: sampleTerrainHeight(granaryX, granaryZ, region, seed), z: granaryZ },
      rotationY: -0.4,
      footprintRadius: 3.2,
      description: 'Grain storage for regional population.',
      statusText: 'Completed · Granary Storage',
      integrity: 350,
      maxIntegrity: 350,
      constructionState: 'completed',
      constructionProgress: 1,
      constructionWorkRequired: 90,
      constructionCost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      housingBonus: 0,
      storageBonus: { food: 600 },
      acceptsStorage: ['food'],
      assignedWorkerIds: [],
      maxWorkers: 4,
    });

    // Farm Terrace
    const farmX = cx + 10;
    const farmZ = cz + 8;
    buildings.push({
      id: `bld_farm_${rId}`,
      category: 'building',
      name: `${rKingdom.name} Cropland`,
      archetype: 'cultivated_farm',
      buildingClass: 'Economic',
      kingdomId: rId,
      position: { x: farmX, y: sampleTerrainHeight(farmX, farmZ, region, seed), z: farmZ },
      rotationY: 0.2,
      footprintRadius: 4.2,
      description: 'Cultivated farm plot feeding the regional capital.',
      statusText: 'Active Cropland',
      integrity: 250,
      maxIntegrity: 250,
      constructionState: 'completed',
      constructionProgress: 1,
      constructionWorkRequired: 80,
      constructionCost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      housingBonus: 0,
      storageBonus: {},
      acceptsStorage: [],
      assignedWorkerIds: [],
      maxWorkers: 4,
    });

    // Watch Post
    const watchX = cx - 10;
    const watchZ = cz - 8;
    buildings.push({
      id: `bld_watch_${rId}`,
      category: 'building',
      name: `${rKingdom.name} Watch-Tower`,
      archetype: 'watch_post',
      buildingClass: 'Defensive',
      kingdomId: rId,
      position: { x: watchX, y: sampleTerrainHeight(watchX, watchZ, region, seed), z: watchZ },
      rotationY: 0.5,
      footprintRadius: 2.8,
      description: 'Frontier lookout post scanning border approaches.',
      statusText: 'Operational Sentinel',
      integrity: 450,
      maxIntegrity: 450,
      constructionState: 'completed',
      constructionProgress: 1,
      constructionWorkRequired: 100,
      constructionCost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      housingBonus: 0,
      storageBonus: {},
      acceptsStorage: [],
      assignedWorkerIds: [],
      maxWorkers: 2,
    });

    // 4 Initial AI Villagers per rival kingdom
    const rivalRoles: CivilianRole[] = ['Farmer', 'Woodcutter', 'Miner', 'Builder'];
    rivalRoles.forEach((role, idx) => {
      const vx = cx + (idx % 2 === 0 ? 5 : -5);
      const vz = cz + (idx < 2 ? 5 : -5);
      const villager = createVillagerEntity({
        id: `char_${rId}_v_${idx + 1}`,
        name: `${rKingdom.name} ${role} ${idx + 1}`,
        role,
        kingdomId: rId,
        x: vx,
        z: vz,
        region,
        seed,
        indexSeed: rIndex * 10 + idx + 50,
      });
      characters.push(villager);
    });
  });

  return { buildings, characters, resourceNodes, roads };
}
