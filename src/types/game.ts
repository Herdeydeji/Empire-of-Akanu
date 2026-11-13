export type KingdomId = 'oru' | 'zambara' | 'kemetra' | 'aseka' | 'nambara';

export type RegionId =
  | 'golden_savannah'
  | 'great_forests'
  | 'northern_highlands'
  | 'riverlands'
  | 'coastal_territories';

export type ProgressionStage =
  | 'Village'
  | 'Settlement'
  | 'Town'
  | 'Fortified City'
  | 'Kingdom'
  | 'Empire';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type GameShellScreen = 'title' | 'setup' | 'playing' | 'paused';

export type GameMode = 'standard' | 'sandbox';

export type NavigationTab =
  | 'kingdom'
  | 'construction'
  | 'military'
  | 'research'
  | 'diplomacy'
  | 'trade';

export type ResourceKey = 'food' | 'wood' | 'stone' | 'iron' | 'gold';

export type CharacterAnimationState =
  | 'idle'
  | 'walking'
  | 'running'
  | 'chopping'
  | 'farming'
  | 'mining'
  | 'building'
  | 'hunting'
  | 'fishing'
  | 'crafting'
  // Phase 3 Military Animations
  | 'attacking_melee'
  | 'attacking_spear'
  | 'shooting_bow'
  | 'charging'
  | 'defending'
  | 'taking_damage'
  | 'retreating'
  | 'operating_siege'
  | 'victory'
  | 'dead';

export type CivilianRole =
  | 'Unemployed'
  | 'Farmer'
  | 'Woodcutter'
  | 'Miner'
  | 'Builder'
  | 'Trader'
  | 'Hunter'
  | 'Fisherman'
  | 'Craftsperson';

export type MilitaryUnitClass =
  | 'infantry'
  | 'spearman'
  | 'archer'
  | 'cavalry'
  | 'royal_guard'
  | 'scout'
  | 'siege_engineer'
  | 'battering_ram'
  | 'catapult'
  | 'siege_tower'
  | 'commander';

export type MilitaryFormationType =
  | 'line'
  | 'defensive'
  | 'wedge'
  | 'square'
  | 'flanking';

export type MilitaryStance = 'aggressive' | 'defensive' | 'stand_ground';

export type CombatState =
  | 'idle'
  | 'marching'
  | 'engaging'
  | 'charging'
  | 'firing'
  | 'braced'
  | 'routing'
  | 'operating';

export type VillagerTaskType =
  | 'idle'
  | 'move_to'
  | 'gather_node'
  | 'work_farm'
  | 'construct_building'
  | 'deliver_resource'
  | 'trade_exchange'
  | 'craft_workshop'
  // Phase 3 Military Tasks
  | 'military_march'
  | 'military_attack'
  | 'military_defend'
  | 'military_patrol'
  | 'military_retreat'
  | 'military_siege';

export interface ResourceAmounts {
  food: number;
  wood: number;
  stone: number;
  iron: number;
  gold: number;
}

export interface ResourceCapacities extends ResourceAmounts {}

export interface ResourceRates {
  productionPerMinute: ResourceAmounts;
  consumptionPerMinute: ResourceAmounts;
  netPerMinute: ResourceAmounts;
}

export interface PopulationState {
  current: number;
  capacity: number;
  availableWorkforce: number;
  employedCount: number;
  unemployedCount: number;
  happiness: number; // 0..100
  foodSatisfaction: number; // 0..100
  growthProgress: number; // 0..100 toward next villager arrival
}

export interface KingdomPalette {
  primary: string;
  secondary: string;
  accent: string;
  bannerCloth: string;
  trimMetal: string;
  masonryTint: string;
  roofTint: string;
}

export interface KingdomGameplayModifiers {
  infantryDefenseMultiplier: number;
  cavalrySpeedMultiplier: number;
  constructionEfficiencyMultiplier: number;
  tradeYieldMultiplier: number;
  archerReconMultiplier: number;
}

export interface KingdomConfig {
  id: KingdomId;
  name: string;
  title: string;
  specialisation: string;
  description: string;
  culturalInspirationNote: string;
  architecturalStyle:
    | 'bastion_courtyard'
    | 'sahelian_pavilion'
    | 'monumental_pylon'
    | 'arcaded_compound'
    | 'canopy_timber';
  primaryStrengths: string[];
  uniqueCharacteristics: string[];
  startingResources: ResourceAmounts;
  recommendedRegion: RegionId;
  palette: KingdomPalette;
  modifiers: KingdomGameplayModifiers;
  futureUnitsPreview: { name: string; role: string; phase: string }[];
  futureBuildingsPreview: { name: string; category: string; effect: string; phase: string }[];
}

export interface RegionPalette {
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  grassLow: string;
  grassHigh: string;
  soilPath: string;
  rockPrimary: string;
  sandBank: string;
  waterDeep: string;
  waterShallow: string;
  foliagePrimary: string;
  foliageSecondary: string;
  trunkColor: string;
}

export interface RegionTerrainParams {
  elevationScale: number;
  ridgeSharpness: number;
  riverWidth: number;
  hasCoastline: boolean;
  treeDensity: number;
  rockDensity: number;
  grassDensity: number;
  treeArchetype:
    | 'acacia_baobab'
    | 'rainforest_canopy'
    | 'highland_cedar'
    | 'river_palm'
    | 'coastal_palm';
}

export interface RegionConfig {
  id: RegionId;
  name: string;
  statusLabel: 'Primary Playable Region' | 'Playable Procedural Region';
  tagline: string;
  description: string;
  strategicTraits: string[];
  environmentalFeatures: string[];
  palette: RegionPalette;
  terrain: RegionTerrainParams;
}

export type EntityCategory = 'character' | 'building' | 'resource_node';

export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

export interface CharacterEntity {
  id: string;
  category: 'character';
  name: string;
  role: CivilianRole;
  kingdomId: KingdomId;
  position: WorldPosition;
  rotationY: number;
  speed: number;
  animationState: CharacterAnimationState;
  activityLabel: string;
  gaitPhase: number;
  waypoints: { x: number; z: number; waitSeconds: number; runToNext?: boolean }[];
  currentWaypointIndex: number;
  waitTimer: number;
  health: number;
  maxHealth: number;
  tunicColor: string;
  accentColor: string;
  skinTone?: string;
  propType:
    | 'basket'
    | 'staff'
    | 'mallet'
    | 'jar'
    | 'scroll'
    | 'bow_slung'
    | 'axe'
    | 'pickaxe'
    // Phase 3 Military Weapons & Shields
    | 'sword_bronze'
    | 'spear_long'
    | 'bow_drawn'
    | 'cavalry_lance'
    | 'royal_polearm'
    | 'scout_dagger'
    | 'engineer_wrench'
    | 'siege_ram'
    | 'commander_scepter';
  // Phase 2 Economic Villager State
  taskType: VillagerTaskType;
  carriedResource: ResourceKey | null;
  carriedAmount: number;
  carryCapacity: number;
  assignedNodeId: string | null;
  assignedBuildingId: string | null;
  deliveryBuildingId: string | null;
  moveTarget: { x: number; z: number } | null;
  workProgress: number;
  productivity: number;
  preferredResource: ResourceKey | null;
  // Phase 3 Military & Combat State
  isMilitary?: boolean;
  militaryClass?: MilitaryUnitClass;
  isHostile?: boolean; // Enemy faction or raider
  formation?: MilitaryFormationType;
  stance?: MilitaryStance;
  combatState?: CombatState;
  targetEntityId?: string | null;
  attackCooldownTimer?: number;
  attackSpeedSec?: number;
  attackRange?: number;
  attackDamage?: number;
  defense?: number;
  moveSpeedCombat?: number;
  morale?: number; // 0..100
  experience?: number; // 0..100
  veterancyLevel?: number; // 1, 2, 3
  isMounted?: boolean;
  isSiegeEngine?: boolean;
  isCommander?: boolean;
  commanderAuraRadius?: number;
  assignedCommanderId?: string | null;
  formationOffset?: { x: number; z: number };
  chargeSpeedMultiplier?: number;
  isCharging?: boolean;
  lastHitTimeSec?: number;
}

export type BuildingArchetype =
  | 'royal_compound'
  | 'royal_palace'
  | 'council_chambers'
  | 'royal_treasury'
  | 'residential_compound'
  | 'dwelling_house'
  | 'granary_storehouse'
  | 'warehouse_storehouse'
  | 'cultivated_farm'
  | 'market_courtyard'
  | 'mine_pit'
  | 'blacksmith_workshop'
  | 'barracks_compound'
  | 'archery_grounds'
  | 'cavalry_stables'
  | 'weapon_workshop'
  | 'watch_post';

export type BuildingConstructionState =
  | 'planned'
  | 'under_construction'
  | 'completed'
  | 'damaged'
  | 'destroyed';

export type BuildingClass = 'Royal' | 'Residential' | 'Economic' | 'Military' | 'Defensive';

export interface BuildingEntity {
  id: string;
  category: 'building';
  name: string;
  archetype: BuildingArchetype;
  buildingClass: BuildingClass;
  kingdomId: KingdomId;
  position: WorldPosition;
  rotationY: number;
  footprintRadius: number;
  description: string;
  statusText: string;
  integrity: number;
  maxIntegrity: number;
  // Phase 2 Economic & Construction State
  constructionState: BuildingConstructionState;
  constructionProgress: number; // 0..1
  constructionWorkRequired: number; // work-seconds
  constructionCost: ResourceAmounts;
  housingBonus: number;
  storageBonus: Partial<ResourceAmounts>;
  acceptsStorage: ResourceKey[];
  assignedWorkerIds: string[];
  maxWorkers: number;
  linkedNodeId?: string | null;
  // Phase 3 Military Recruitment & Fortification State
  recruitmentQueue?: RecruitmentQueueItem[];
  rallyPoint?: { x: number; z: number } | null;
  isFortification?: boolean;
  fortificationType?: 'wall' | 'gate' | 'tower';
}

export interface RecruitmentQueueItem {
  id: string;
  unitClass: MilitaryUnitClass;
  progressSec: number;
  totalDurationSec: number;
  cost: ResourceAmounts;
}

export interface ArrowProjectile {
  id: string;
  sourceX: number;
  sourceY: number;
  sourceZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  startX: number;
  startY: number;
  startZ: number;
  targetEntityId: string;
  attackerKingdomId?: KingdomId;
  isSiege?: boolean;
  progress: number; // 0..1
  speed: number;
  damage: number;
  isFire?: boolean;
  flightDuration?: number;
  onImpact?: (dmg: number, targetId: string) => void;
}

export interface MilitaryStatistics {
  unitsRecruited: number;
  enemiesDefeated: number;
  alliesLost: number;
  structuresRazed: number;
}

export interface MilitaryOverviewState {
  totalMilitaryPopulation: number;
  upkeepPerMinute: ResourceAmounts;
  hasUpkeepDeficit: boolean;
  activeRecruitmentCount: number;
  commandersCount: number;
  unitsByClass: Record<MilitaryUnitClass, number>;
}

export type ResourceNodeKind =
  | 'gold_outcrop'
  | 'iron_deposit'
  | 'stone_quarry'
  | 'timber_grove'
  | 'harvestable_tree'
  | 'fertile_fishery'
  | 'hunting_ground';

export interface EnvironmentNodeEntity {
  id: string;
  category: 'resource_node';
  name: string;
  nodeKind: ResourceNodeKind;
  resourceType: ResourceKey;
  richnessLabel: string;
  position: WorldPosition;
  rotationY: number;
  footprintRadius: number;
  description: string;
  remainingYield: number;
  // Phase 2 Node Mechanics
  maxYield: number;
  collectionRate: number; // units per second of harvesting
  interactionRadius: number;
  regenerates: boolean;
  regrowthDuration: number; // seconds to regrow when depleted
  regrowthTimer: number;
  depleted: boolean;
  activeHarvesterIds: string[];
  maxHarvesters: number;
  ownerKingdomId: KingdomId | null;
}

export type SelectableEntity = CharacterEntity | BuildingEntity | EnvironmentNodeEntity;

export interface EconomyNotification {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'alert';
  message: string;
  timestampSec: number;
}

export interface EconomyStatistics {
  totalGathered: ResourceAmounts;
  totalConsumedFood: number;
  buildingsConstructed: number;
  villagersBorn: number;
}

export interface PlacementPreviewState {
  active: boolean;
  archetype: BuildingArchetype | null;
  x: number;
  z: number;
  rotationY: number;
  valid: boolean;
  reason?: string;
}

export type TouchCommandMode = 'select' | 'move' | 'assign' | 'attack' | 'defend';

export type MusicMood =
  | 'menu'
  | 'peaceful'
  | 'expansion'
  | 'diplomacy'
  | 'military_prep'
  | 'combat'
  | 'victory'
  | 'defeat';

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  ambienceVolume?: number;
  sfxVolume: number;
  muted: boolean;
}

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  cameraPanSpeed: number;
  audio: AudioSettings;
}

export interface CameraRigState {
  targetX: number;
  targetZ: number;
  desiredTargetX: number;
  desiredTargetZ: number;
  yaw: number;
  desiredYaw: number;
  distance: number;
  desiredDistance: number;
  minBounds: number;
  maxBounds: number;
}

// Phase 4 Types: AI Kingdoms, Diplomacy, World Events & Difficulty

export type AIDifficulty = 'easy' | 'normal' | 'hard' | 'very_hard';

export type DiplomaticRelationState =
  | 'unknown'
  | 'neutral'
  | 'friendly'
  | 'allied'
  | 'hostile'
  | 'at_war';

export type TreatyKind = 'non_aggression' | 'trade_pact' | 'defensive_alliance' | 'tribute';

export interface DiplomaticTreaty {
  id: string;
  kind: TreatyKind;
  targetKingdomId: KingdomId;
  durationRemainingSec: number;
  tributePerMinute?: Partial<ResourceAmounts>;
}

export interface DiplomaticRelation {
  targetKingdomId: KingdomId;
  state: DiplomaticRelationState;
  score: number; // -100 to +100
  discovered: boolean;
  activeTreaties: DiplomaticTreaty[];
  lastInteractionTimeSec: number;
  grievanceCount: number;
}

export interface AIKingdomPersonality {
  id: KingdomId;
  archetypeTitle: string;
  defensiveness: number; // 0..1
  expansionism: number; // 0..1
  engineeringFocus: number; // 0..1
  commerceFocus: number; // 0..1
  wildernessFocus: number; // 0..1
  aggressionBias: number; // 0..1
  diplomaticBias: number; // 0..1
  retreatThreshold: number; // 0..1 fraction of force lost/low morale before retreating
  attackStrengthRatio: number; // required estimated strength ratio to launch attack
  targetArmyRatio: number; // target military share of population
  preferredFormation: MilitaryFormationType;
  preferredStance: MilitaryStance;
  economyRatios: {
    farmer: number;
    woodcutter: number;
    miner: number;
    trader: number;
    builder: number;
    craftsperson: number;
  };
  preferredUnits: MilitaryUnitClass[];
  preferredBuildings: BuildingArchetype[];
}

export interface TerritoryZone {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  isCapital: boolean;
}

export interface KingdomIntelligenceRecord {
  targetKingdomId: KingdomId;
  discovered: boolean;
  lastSeenSec: number;
  estimatedMilitaryStrength: number;
  estimatedEconomicStrength: number;
  estimatedPopulation: number;
  knownSettlementLocations: { x: number; z: number; name: string }[];
  recentHostileActions: number;
}

export interface AIDecisionLogEntry {
  timestampSec: number;
  category: 'economy' | 'settlement' | 'military' | 'diplomacy' | 'territory' | 'intel';
  summary: string;
  score: number;
}

export interface AIKingdomRuntime {
  id: KingdomId;
  name: string;
  rulerName: string;
  isPlayer: boolean;
  settlementCenter: { x: number; z: number };
  territoryRadius: number;
  territories?: TerritoryZone[];
  resources: ResourceAmounts;
  capacities: ResourceCapacities;
  rates?: ResourceRates;
  population: PopulationState;
  economyStats?: EconomyStatistics;
  militaryStats?: MilitaryStatistics;
  hasUpkeepDeficit?: boolean;
  stability?: number; // 0..100
  progressionStage: ProgressionStage;
  strategicPosture:
    | 'consolidate'
    | 'expand'
    | 'fortify'
    | 'trade'
    | 'mobilize'
    | 'attack'
    | 'defend'
    | 'rebuild';
  strategicObjectives?: string[];
  decisionTimerSec: number;
  lastDecisionSummary: string;
  decisionLog?: AIDecisionLogEntry[];
  knownIntelligence?: Record<KingdomId, KingdomIntelligenceRecord>;
  discoveredResourceNodes?: string[];
  lastAttackTimeSec?: number;
  lastExpansionSec?: number;
  lastDiplomacyTimeSec?: number;
  defeatCount?: number;
}

export interface WorldEventItem {
  id: string;
  timestampSec: number;
  title: string;
  description: string;
  sourceKingdomId?: KingdomId;
  targetKingdomId?: KingdomId;
  kind: 'diplomacy' | 'military' | 'economy' | 'territory' | 'crisis';
}

export interface SaveGameData {
  version: number;
  savedAtIso: string;
  playerKingdomName: string;
  rulerName: string;
  kingdomId: KingdomId;
  regionId: RegionId;
  worldSeed: number;
  gameMode: GameMode;
  progressionStage: ProgressionStage;
  resources: ResourceAmounts;
  capacities: ResourceCapacities;
  rates: ResourceRates;
  population: PopulationState;
  economyStats: EconomyStatistics;
  militaryStats?: MilitaryStatistics;
  cameraTarget: { x: number; z: number; yaw: number; distance: number };
  settings: GameSettings;
  elapsedPlaySeconds: number;
  // Phase 4 Multi-Kingdom Persistence Extensions
  difficultyLevel?: AIDifficulty;
  aiKingdomsData?: AIKingdomRuntime[];
  diplomacyData?: Record<KingdomId, DiplomaticRelation[]>;
  worldEventsData?: WorldEventItem[];
  // World Entity Persistence
  worldEntities?: {
    buildings: BuildingEntity[];
    characters: CharacterEntity[];
    resourceNodes: EnvironmentNodeEntity[];
  };
}

