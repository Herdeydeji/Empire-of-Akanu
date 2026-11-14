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
  capitalCenters: Record<KingdomId, { x: number; z: number }>;
}

function isFlatDryPatch(
  x: number,
  z: number,
  radius: number,
  region: RegionConfig,
  seed: number,
): boolean {
  if (Math.abs(x) > 80 || Math.abs(z) > 80) return false;
  const centerY = sampleTerrainHeight(x, z, region, seed);
  if (centerY < WATER_LEVEL + 0.48) return false;
  if (sampleTerrainSlope(x, z, region, seed) > 0.46) return false;
  for (const [ox, oz] of [
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
  ]) {
    const py = sampleTerrainHeight(x + ox, z + oz, region, seed);
    if (py < WATER_LEVEL + 0.25) return false;
    if (sampleTerrainSlope(x + ox, z + oz, region, seed) > 0.54) return false;
  }
  return true;
}

export function findValidTerritoryCenter(
  preferredX: number,
  preferredZ: number,
  region: RegionConfig,
  seed: number,
  avoidCenters: { x: number; z: number }[],
  minSpacing = 34,
): { x: number; z: number } {
  const candidates: [number, number][] = [[preferredX, preferredZ]];
  for (let ring = 4; ring <= 48; ring += 5) {
    for (let a = 0; a < 12; a++) {
      const theta = (a / 12) * Math.PI * 2;
      candidates.push([
        Math.round(preferredX + Math.cos(theta) * ring),
        Math.round(preferredZ + Math.sin(theta) * ring),
      ]);
    }
  }
  // Safe inland & highland fallbacks for coastal or river-heavy maps
  const fallbacks: [number, number][] = [
    [-54, -46],
    [54, -46],
    [-64, -14],
    [64, -14],
    [-50, -64],
    [50, -64],
    [-52, 42],
    [52, 42],
    [0, -58],
  ];
  candidates.push(...fallbacks);

  for (const [cx, cz] of candidates) {
    if (!isFlatDryPatch(cx, cz, 7.5, region, seed)) continue;
    const clear = avoidCenters.every(
      (ac) => Math.hypot(cx - ac.x, cz - ac.z) >= minSpacing,
    );
    if (clear) {
      return { x: cx, z: cz };
    }
  }

  return { x: preferredX, z: -Math.abs(preferredZ) };
}

export function findValidNearbyPlot(
  centerX: number,
  centerZ: number,
  offsetX: number,
  offsetZ: number,
  region: RegionConfig,
  seed: number,
  existingPts: { x: number; z: number; r: number }[],
  minRadius: number,
): { x: number; z: number } {
  const tryPts: [number, number][] = [[centerX + offsetX, centerZ + offsetZ]];
  const baseAngle = Math.atan2(offsetZ, offsetX);
  const baseDist = Math.max(6, Math.hypot(offsetX, offsetZ));
  for (let d = baseDist; d <= baseDist + 16; d += 3.5) {
    for (let step = 0; step < 12; step++) {
      const ang = baseAngle + step * ((Math.PI * 2) / 12);
      tryPts.push([
        Math.round((centerX + Math.cos(ang) * d) * 10) / 10,
        Math.round((centerZ + Math.sin(ang) * d) * 10) / 10,
      ]);
    }
  }

  for (const [px, pz] of tryPts) {
    if (Math.abs(px) > 84 || Math.abs(pz) > 84) continue;
    const py = sampleTerrainHeight(px, pz, region, seed);
    const slope = sampleTerrainSlope(px, pz, region, seed);
    if (py < WATER_LEVEL + 0.3 || slope > 0.5) continue;
    const collides = existingPts.some(
      (ep) => Math.hypot(px - ep.x, pz - ep.z) < ep.r + minRadius + 1.2,
    );
    if (!collides) return { x: px, z: pz };
  }
  return { x: centerX + offsetX, z: centerZ + offsetZ };
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
  settlementCenter: { x: number; z: number } = { x: 0, z: 0 },
): CharacterEntity {
  const baseName = VILLAGER_NAMES[existingCount % VILLAGER_NAMES.length];
  const angle = (existingCount * 1.37) % (Math.PI * 2);
  const spawnX = settlementCenter.x + Math.cos(angle) * 5.2;
  const spawnZ = settlementCenter.z + 4.2 + Math.sin(angle) * 2.6;
  return createVillagerEntity({
    id: `char_citizen_${kingdomId}_${existingCount + 1}_${Math.floor(Math.abs(spawnX * 100))}`,
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
    const isEastFarm = spec.id === 'bld_farm_east';
    const isSouthFarm = spec.id === 'bld_farm_southeast';
    const isFarm = spec.archetype === 'cultivated_farm';
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
      ...(isFarm
        ? {
            soilMoisture: isEastFarm ? 0.24 : isSouthFarm ? 0.62 : 0.45,
            cropGrowthProgress: isEastFarm ? 0.28 : isSouthFarm ? 0.58 : 0.35,
            cropGrowthStage: (isEastFarm ? 1 : isSouthFarm ? 2 : 1) as 0 | 1 | 2 | 3 | 4,
            lastWateredSec: 0,
          }
        : {}),
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

  // Generate rival AI kingdom settlements across outer map territories (validated dry/flat ground)
  const allKingdomIds: KingdomId[] = ['oru', 'zambara', 'kemetra', 'aseka', 'nambara'];
  const rivalKingdomIds = allKingdomIds.filter((k) => k !== kingdomId);
  const capitalCenters: Record<KingdomId, { x: number; z: number }> = {
    oru: { x: 0, z: 0 },
    zambara: { x: 0, z: 0 },
    kemetra: { x: 0, z: 0 },
    aseka: { x: 0, z: 0 },
    nambara: { x: 0, z: 0 },
  };
  capitalCenters[kingdomId] = { x: 0, z: 0 };

  const preferredRivalPositions: [number, number][] = region.terrain.hasCoastline
    ? [
        [-54, -44],
        [54, -44],
        [-64, -10],
        [64, -10],
      ]
    : [
        [-50, -44],
        [50, -44],
        [-50, 46],
        [50, 46],
      ];

  const occupiedCenters: { x: number; z: number }[] = [{ x: 0, z: 0 }];

  rivalKingdomIds.forEach((rId, rIndex) => {
    const rKingdom = KINGDOMS[rId];
    const rBonus = KINGDOM_ECONOMIC_BONUSES[rId];
    const [prefX, prefZ] = preferredRivalPositions[rIndex];
    const center = findValidTerritoryCenter(
      prefX,
      prefZ,
      region,
      seed,
      occupiedCenters,
      36,
    );
    occupiedCenters.push(center);
    capitalCenters[rId] = center;
    const { x: cx, z: cz } = center;
    const placedPts: { x: number; z: number; r: number }[] = [{ x: cx, z: cz, r: 4.8 }];

    // Main Chieftain Compound
    const compoundY = sampleTerrainHeight(cx, cz, region, seed);
    const compoundBp = BUILDING_CATALOG.royal_compound;
    buildings.push({
      id: `bld_royal_${rId}`,
      category: 'building',
      name: `${rKingdom.name} Regional Capital`,
      archetype: 'royal_compound',
      buildingClass: 'Royal',
      kingdomId: rId,
      position: { x: cx, y: compoundY, z: cz },
      rotationY: 0.1,
      footprintRadius: compoundBp.footprintRadius,
      description: `Seat of ${rKingdom.name} sovereign power and governance.`,
      statusText: 'Active Governance · Universal Storage',
      integrity: compoundBp.maxIntegrity,
      maxIntegrity: compoundBp.maxIntegrity,
      constructionState: 'completed',
      constructionProgress: 1,
      constructionWorkRequired: compoundBp.constructionWorkRequired,
      constructionCost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      housingBonus: compoundBp.housingBonus,
      storageBonus: { ...compoundBp.storageBonus },
      acceptsStorage: [...compoundBp.acceptsStorage],
      assignedWorkerIds: [],
      maxWorkers: compoundBp.maxWorkers,
      linkedNodeId: null,
    });

    // Granary
    const granaryBp = BUILDING_CATALOG.granary_storehouse;
    const granaryPos = findValidNearbyPlot(cx, cz, 9, -5, region, seed, placedPts, granaryBp.footprintRadius);
    placedPts.push({ ...granaryPos, r: granaryBp.footprintRadius });
    buildings.push({
      id: `bld_granary_${rId}`,
      category: 'building',
      name: `${rKingdom.name} Granary`,
      archetype: 'granary_storehouse',
      buildingClass: 'Economic',
      kingdomId: rId,
      position: { x: granaryPos.x, y: sampleTerrainHeight(granaryPos.x, granaryPos.z, region, seed), z: granaryPos.z },
      rotationY: -0.4,
      footprintRadius: granaryBp.footprintRadius,
      description: 'Grain storage for regional population.',
      statusText: 'Completed · Granary Storage',
      integrity: granaryBp.maxIntegrity,
      maxIntegrity: granaryBp.maxIntegrity,
      constructionState: 'completed',
      constructionProgress: 1,
      constructionWorkRequired: granaryBp.constructionWorkRequired,
      constructionCost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      housingBonus: granaryBp.housingBonus,
      storageBonus: { ...granaryBp.storageBonus },
      acceptsStorage: [...granaryBp.acceptsStorage],
      assignedWorkerIds: [],
      maxWorkers: granaryBp.maxWorkers,
      linkedNodeId: null,
    });

    // Farm Terrace
    const farmBp = BUILDING_CATALOG.cultivated_farm;
    const farmPos = findValidNearbyPlot(cx, cz, 10, 9, region, seed, placedPts, farmBp.footprintRadius);
    placedPts.push({ ...farmPos, r: farmBp.footprintRadius });
    buildings.push({
      id: `bld_farm_${rId}`,
      category: 'building',
      name: `${rKingdom.name} Cropland`,
      archetype: 'cultivated_farm',
      buildingClass: 'Economic',
      kingdomId: rId,
      position: { x: farmPos.x, y: sampleTerrainHeight(farmPos.x, farmPos.z, region, seed), z: farmPos.z },
      rotationY: 0.2,
      footprintRadius: farmBp.footprintRadius,
      description: 'Cultivated farm plot feeding the regional capital.',
      statusText: 'Active Cropland',
      integrity: farmBp.maxIntegrity,
      maxIntegrity: farmBp.maxIntegrity,
      constructionState: 'completed',
      constructionProgress: 1,
      constructionWorkRequired: farmBp.constructionWorkRequired,
      constructionCost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      housingBonus: farmBp.housingBonus,
      storageBonus: { ...farmBp.storageBonus },
      acceptsStorage: [...farmBp.acceptsStorage],
      assignedWorkerIds: [],
      maxWorkers: farmBp.maxWorkers,
      linkedNodeId: null,
      soilMoisture: 0.56,
      cropGrowthProgress: 0.42,
      cropGrowthStage: 2,
      lastWateredSec: 0,
    });

    // Watch Post
    const watchBp = BUILDING_CATALOG.watch_post;
    const watchPos = findValidNearbyPlot(cx, cz, -10, -8, region, seed, placedPts, watchBp.footprintRadius);
    placedPts.push({ ...watchPos, r: watchBp.footprintRadius });
    buildings.push({
      id: `bld_watch_${rId}`,
      category: 'building',
      name: `${rKingdom.name} Watch-Tower`,
      archetype: 'watch_post',
      buildingClass: 'Defensive',
      kingdomId: rId,
      position: { x: watchPos.x, y: sampleTerrainHeight(watchPos.x, watchPos.z, region, seed), z: watchPos.z },
      rotationY: 0.5,
      footprintRadius: watchBp.footprintRadius,
      description: 'Frontier lookout post scanning border approaches.',
      statusText: 'Operational Sentinel',
      integrity: watchBp.maxIntegrity,
      maxIntegrity: watchBp.maxIntegrity,
      constructionState: 'completed',
      constructionProgress: 1,
      constructionWorkRequired: watchBp.constructionWorkRequired,
      constructionCost: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 },
      housingBonus: watchBp.housingBonus,
      storageBonus: { ...watchBp.storageBonus },
      acceptsStorage: [...watchBp.acceptsStorage],
      assignedWorkerIds: [],
      maxWorkers: watchBp.maxWorkers,
      linkedNodeId: null,
    });

    // Local resource cluster so every AI kingdom follows fair Phase 2 gathering rules
    const localNodeTemplates: {
      suffix: string;
      name: string;
      nodeKind: EnvironmentNodeEntity['nodeKind'];
      resourceType: EnvironmentNodeEntity['resourceType'];
      ox: number;
      oz: number;
      radius: number;
      yieldAmount: number;
      rate: number;
      regenerates: boolean;
      regrowth: number;
      maxHarvesters: number;
    }[] = [
      {
        suffix: 'timber',
        name: `${rKingdom.name} Hardwood Stand`,
        nodeKind: 'timber_grove',
        resourceType: 'wood',
        ox: -15,
        oz: 5,
        radius: 3.6,
        yieldAmount: 950,
        rate: 2.3,
        regenerates: true,
        regrowth: Math.round(45 * rBonus.treeRegrowthTimeMult),
        maxHarvesters: 4,
      },
      {
        suffix: 'tree_1',
        name: `${rKingdom.name} Acacia Timber #1`,
        nodeKind: 'harvestable_tree',
        resourceType: 'wood',
        ox: -12,
        oz: 12,
        radius: 2.0,
        yieldAmount: 110,
        rate: 2.3,
        regenerates: true,
        regrowth: Math.round(32 * rBonus.treeRegrowthTimeMult),
        maxHarvesters: 2,
      },
      {
        suffix: 'tree_2',
        name: `${rKingdom.name} Acacia Timber #2`,
        nodeKind: 'harvestable_tree',
        resourceType: 'wood',
        ox: 15,
        oz: -9,
        radius: 2.0,
        yieldAmount: 110,
        rate: 2.3,
        regenerates: true,
        regrowth: Math.round(32 * rBonus.treeRegrowthTimeMult),
        maxHarvesters: 2,
      },
      {
        suffix: 'stone',
        name: `${rKingdom.name} Granite Quarry`,
        nodeKind: 'stone_quarry',
        resourceType: 'stone',
        ox: -15,
        oz: -15,
        radius: 3.8,
        yieldAmount: 2400,
        rate: 2.1,
        regenerates: false,
        regrowth: 0,
        maxHarvesters: 4,
      },
      {
        suffix: 'iron',
        name: `${rKingdom.name} Ironstone Seam`,
        nodeKind: 'iron_deposit',
        resourceType: 'iron',
        ox: 16,
        oz: -14,
        radius: 3.6,
        yieldAmount: 1800,
        rate: 1.85,
        regenerates: false,
        regrowth: 0,
        maxHarvesters: 4,
      },
      {
        suffix: 'gold',
        name: `${rKingdom.name} Gold Outcrop`,
        nodeKind: 'gold_outcrop',
        resourceType: 'gold',
        ox: 18,
        oz: 2,
        radius: 3.5,
        yieldAmount: 1400,
        rate: 1.65,
        regenerates: false,
        regrowth: 0,
        maxHarvesters: 3,
      },
      {
        suffix: 'game',
        name: `${rKingdom.name} Savannah Herd`,
        nodeKind: 'hunting_ground',
        resourceType: 'food',
        ox: 0,
        oz: -17,
        radius: 3.8,
        yieldAmount: 1000,
        rate: 2.5,
        regenerates: true,
        regrowth: 40,
        maxHarvesters: 3,
      },
    ];

    for (const tpl of localNodeTemplates) {
      const pos = findValidNearbyPlot(cx, cz, tpl.ox, tpl.oz, region, seed, placedPts, tpl.radius);
      placedPts.push({ ...pos, r: tpl.radius });
      resourceNodes.push({
        id: `res_${rId}_${tpl.suffix}`,
        category: 'resource_node',
        name: tpl.name,
        nodeKind: tpl.nodeKind,
        resourceType: tpl.resourceType,
        richnessLabel: tpl.regenerates
          ? `${tpl.yieldAmount} ${tpl.resourceType} · Renewable`
          : `${tpl.yieldAmount} ${tpl.resourceType} Remaining`,
        position: {
          x: pos.x,
          y: sampleTerrainHeight(pos.x, pos.z, region, seed),
          z: pos.z,
        },
        rotationY: ((Math.abs(pos.x) * 11 + Math.abs(pos.z) * 5) % 360) * (Math.PI / 180),
        footprintRadius: tpl.radius,
        description: `Regional ${tpl.resourceType} resource deposit near ${rKingdom.name}.`,
        remainingYield: tpl.yieldAmount,
        maxYield: tpl.yieldAmount,
        collectionRate: tpl.rate,
        interactionRadius: tpl.radius + 0.9,
        regenerates: tpl.regenerates,
        regrowthDuration: tpl.regrowth,
        regrowthTimer: 0,
        depleted: false,
        activeHarvesterIds: [],
        maxHarvesters: tpl.maxHarvesters,
        ownerKingdomId: rId,
      });
    }

    // 5 Initial AI Villagers per rival kingdom so every AI starts with full worker coverage
    const rivalRoles: CivilianRole[] = ['Farmer', 'Woodcutter', 'Miner', 'Miner', 'Builder'];
    rivalRoles.forEach((role, idx) => {
      const angle = (idx / rivalRoles.length) * Math.PI * 2;
      const vx = cx + Math.cos(angle) * 5.2;
      const vz = cz + Math.sin(angle) * 5.2;
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
      if (role === 'Miner' && idx === 3) {
        villager.preferredResource = 'iron';
      }
      characters.push(villager);
    });
  });

  // Contested neutral frontier deposits across mid-map corridors
  const frontierNodes: {
    id: string;
    name: string;
    nodeKind: EnvironmentNodeEntity['nodeKind'];
    resourceType: EnvironmentNodeEntity['resourceType'];
    x: number;
    z: number;
    yieldAmount: number;
    rate: number;
  }[] = [
    {
      id: 'res_frontier_gold_west',
      name: 'Contested Western Gold Vein',
      nodeKind: 'gold_outcrop',
      resourceType: 'gold',
      x: -36,
      z: -10,
      yieldAmount: 2400,
      rate: 1.9,
    },
    {
      id: 'res_frontier_iron_east',
      name: 'Eastern Ridge Iron Seam',
      nodeKind: 'iron_deposit',
      resourceType: 'iron',
      x: 38,
      z: -12,
      yieldAmount: 2600,
      rate: 2.0,
    },
    {
      id: 'res_frontier_stone_north',
      name: 'Highland Border Quarry',
      nodeKind: 'stone_quarry',
      resourceType: 'stone',
      x: 0,
      z: -56,
      yieldAmount: 3600,
      rate: 2.2,
    },
  ];

  for (const fn of frontierNodes) {
    const pos = findValidNearbyPlot(fn.x, fn.z, 0, 0, region, seed, [], 3.8);
    resourceNodes.push({
      id: fn.id,
      category: 'resource_node',
      name: fn.name,
      nodeKind: fn.nodeKind,
      resourceType: fn.resourceType,
      richnessLabel: `Neutral Frontier · ${fn.yieldAmount} ${fn.resourceType}`,
      position: {
        x: pos.x,
        y: sampleTerrainHeight(pos.x, pos.z, region, seed),
        z: pos.z,
      },
      rotationY: 0.4,
      footprintRadius: 3.8,
      description: 'Contested neutral mineral deposit located along inter-kingdom borderlands.',
      remainingYield: fn.yieldAmount,
      maxYield: fn.yieldAmount,
      collectionRate: fn.rate,
      interactionRadius: 4.7,
      regenerates: false,
      regrowthDuration: 0,
      regrowthTimer: 0,
      depleted: false,
      activeHarvesterIds: [],
      maxHarvesters: 5,
      ownerKingdomId: null,
    });
  }

  return { buildings, characters, resourceNodes, roads, capitalCenters };
}
