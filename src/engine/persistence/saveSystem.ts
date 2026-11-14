import { KINGDOMS } from '../../config/kingdoms';
import { REGIONS } from '../../config/regions';
import { generateInitialSettlement } from '../../config/settlement';
import {
  AIDifficulty,
  BuildingEntity,
  CharacterEntity,
  DiplomaticRelation,
  EnvironmentNodeEntity,
  GameMode,
  GameSettings,
  GraphicsQuality,
  KingdomId,
  RegionId,
  SaveGameData,
} from '../../types/game';
import { createInitialAIKingdomManager } from '../simulation/aiKingdomSim';
import { ALL_KINGDOM_IDS, createInitialDiplomacyState } from '../simulation/diplomacySim';
import { createInitialEconomyRuntime } from '../simulation/economySim';
import { createInitialWorldEventState } from '../simulation/worldEventSim';

export const SAVE_STORAGE_KEY = 'empires_of_akanu_save_v2';
export const LEGACY_SAVE_STORAGE_KEY = 'empires_of_akanu_save_v1';
export const SETTINGS_STORAGE_KEY = 'empires_of_akanu_settings_v1';
export const CURRENT_SAVE_VERSION = 2;

export interface PersistenceProvider {
  saveGame(data: SaveGameData): boolean;
  loadGame(): SaveGameData | null;
  hasSavedGame(): boolean;
  clearSavedGame(): void;
  saveSettings(settings: GameSettings): boolean;
  loadSettings(): GameSettings;
}

export function cloneWorldEntities(entities: {
  buildings: BuildingEntity[];
  characters: CharacterEntity[];
  resourceNodes: EnvironmentNodeEntity[];
}): {
  buildings: BuildingEntity[];
  characters: CharacterEntity[];
  resourceNodes: EnvironmentNodeEntity[];
} {
  return {
    buildings: entities.buildings.map((b) => ({
      ...b,
      position: { ...b.position },
      constructionCost: { ...b.constructionCost },
      storageBonus: { ...b.storageBonus },
      acceptsStorage: [...b.acceptsStorage],
      assignedWorkerIds: [...b.assignedWorkerIds],
      recruitmentQueue: b.recruitmentQueue
        ? b.recruitmentQueue.map((item) => ({ ...item, cost: { ...item.cost } }))
        : undefined,
      rallyPoint: b.rallyPoint ? { ...b.rallyPoint } : null,
    })),
    characters: entities.characters.map((c) => ({
      ...c,
      position: { ...c.position },
      waypoints: c.waypoints.map((w) => ({ ...w })),
      moveTarget: c.moveTarget ? { ...c.moveTarget } : null,
      waterTarget: c.waterTarget ? { ...c.waterTarget } : null,
      formationOffset: c.formationOffset ? { ...c.formationOffset } : undefined,
    })),
    resourceNodes: entities.resourceNodes.map((n) => ({
      ...n,
      position: { ...n.position },
      activeHarvesterIds: [...n.activeHarvesterIds],
    })),
  };
}

export function detectRecommendedGraphicsQuality(): GraphicsQuality {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'medium';
  }
  const cores = navigator.hardwareConcurrency || 4;
  const isSmallTouchScreen =
    window.innerWidth < 768 || /Android|Mobi/i.test(navigator.userAgent || '');
  if (isSmallTouchScreen && cores <= 4) {
    return 'low';
  }
  if (isSmallTouchScreen || cores <= 6) {
    return 'medium';
  }
  return 'high';
}

export function createDefaultSettings(): GameSettings {
  return {
    graphicsQuality: detectRecommendedGraphicsQuality(),
    cameraPanSpeed: 1.0,
    audio: {
      masterVolume: 0.75,
      musicVolume: 0.55,
      ambienceVolume: 0.65,
      sfxVolume: 0.8,
      muted: false,
    },
  };
}

export interface CreateSaveOptions {
  kingdomId: KingdomId;
  playerKingdomName: string;
  rulerName: string;
  regionId: RegionId;
  gameMode: GameMode;
  difficultyLevel?: AIDifficulty;
  sandboxAbundantResources?: boolean;
  worldSeed?: number;
  settings?: GameSettings;
}

export function createNewKingdomSave(options: CreateSaveOptions): SaveGameData {
  const kingdom = KINGDOMS[options.kingdomId];
  const region = REGIONS[options.regionId];
  const multiplier =
    options.gameMode === 'sandbox' && options.sandboxAbundantResources ? 2.5 : 1.0;

  const trimmedKingdomName = options.playerKingdomName.trim() || `Kingdom of ${kingdom.name}`;
  const trimmedRulerName = options.rulerName.trim() || 'Sovereign Founder';
  const seed =
    typeof options.worldSeed === 'number'
      ? options.worldSeed
      : 4819 + options.kingdomId.charCodeAt(0) * 37;

  const initialSettlement = generateInitialSettlement(options.kingdomId, region, seed);
  const rawStartingResources = {
    food: Math.round(kingdom.startingResources.food * multiplier),
    wood: Math.round(kingdom.startingResources.wood * multiplier),
    stone: Math.round(kingdom.startingResources.stone * multiplier),
    iron: Math.round(kingdom.startingResources.iron * multiplier),
    gold: Math.round(kingdom.startingResources.gold * multiplier),
  };

  const ecoInit = createInitialEconomyRuntime({
    kingdomId: options.kingdomId,
    region,
    seed,
    capacityMultiplier: multiplier > 1 ? 2.2 : 1.0,
    resources: rawStartingResources,
    buildings: initialSettlement.buildings,
    characters: initialSettlement.characters,
    resourceNodes: initialSettlement.resourceNodes,
  });

  const difficulty = options.difficultyLevel ?? 'normal';
  const aiInit = createInitialAIKingdomManager(
    options.kingdomId,
    difficulty,
    undefined,
    initialSettlement.capitalCenters,
  );
  const dipInit = createInitialDiplomacyState(options.kingdomId);
  const diplomacyData = {} as Record<KingdomId, DiplomaticRelation[]>;
  for (const kId of ALL_KINGDOM_IDS) {
    diplomacyData[kId] = Object.values(dipInit.relations[kId] ?? {});
  }
  const eventInit = createInitialWorldEventState();

  return {
    version: CURRENT_SAVE_VERSION,
    savedAtIso: new Date().toISOString(),
    playerKingdomName: trimmedKingdomName,
    rulerName: trimmedRulerName,
    kingdomId: options.kingdomId,
    regionId: options.regionId,
    worldSeed: seed,
    gameMode: options.gameMode,
    difficultyLevel: difficulty,
    progressionStage: ecoInit.progressionStage,
    resources: { ...ecoInit.resources },
    capacities: { ...ecoInit.capacities },
    rates: {
      productionPerMinute: { ...ecoInit.rates.productionPerMinute },
      consumptionPerMinute: { ...ecoInit.rates.consumptionPerMinute },
      netPerMinute: { ...ecoInit.rates.netPerMinute },
    },
    population: { ...ecoInit.population },
    economyStats: {
      ...ecoInit.economyStats,
      totalGathered: { ...ecoInit.economyStats.totalGathered },
    },
    cameraTarget: {
      x: 0,
      z: 4.5,
      yaw: 0.52,
      distance: 44,
    },
    settings: options.settings ?? createDefaultSettings(),
    elapsedPlaySeconds: 0,
    worldEntities: cloneWorldEntities({
      buildings: ecoInit.buildings,
      characters: ecoInit.characters,
      resourceNodes: ecoInit.resourceNodes,
    }),
    aiKingdomsData: Object.values(aiInit.kingdoms),
    diplomacyData,
    worldEventsData: eventInit.events,
  };
}

export function validateSaveGameData(raw: unknown): SaveGameData | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<SaveGameData>;

  // Accept Phase 2 v2 saves and cleanly upgrade Phase 1 v1 saves if encountered
  if (candidate.version !== CURRENT_SAVE_VERSION && candidate.version !== 1) return null;
  if (!candidate.kingdomId || !(candidate.kingdomId in KINGDOMS)) return null;
  if (!candidate.regionId || !(candidate.regionId in REGIONS)) return null;
  if (typeof candidate.playerKingdomName !== 'string' || !candidate.playerKingdomName.trim()) {
    return null;
  }
  if (!candidate.resources || typeof candidate.resources.food !== 'number') return null;
  if (!candidate.population || typeof candidate.population.current !== 'number') return null;
  if (!candidate.cameraTarget || typeof candidate.cameraTarget.distance !== 'number') return null;
  if (typeof candidate.worldSeed !== 'number' || !Number.isFinite(candidate.worldSeed)) {
    return null;
  }

  // Upgrade v1 save or missing worldEntities cleanly
  if (candidate.version === 1 || !candidate.worldEntities) {
    const base = createNewKingdomSave({
      kingdomId: candidate.kingdomId,
      playerKingdomName: candidate.playerKingdomName,
      rulerName: candidate.rulerName ?? 'Sovereign Founder',
      regionId: candidate.regionId,
      gameMode: candidate.gameMode ?? 'standard',
      worldSeed: candidate.worldSeed,
      settings: candidate.settings,
    });
    return {
      ...base,
      resources: {
        food: Math.max(0, candidate.resources.food),
        wood: Math.max(0, candidate.resources.wood ?? 0),
        stone: Math.max(0, candidate.resources.stone ?? 0),
        iron: Math.max(0, candidate.resources.iron ?? 0),
        gold: Math.max(0, candidate.resources.gold ?? 0),
      },
      cameraTarget: candidate.cameraTarget,
      elapsedPlaySeconds: candidate.elapsedPlaySeconds ?? 0,
    };
  }

  if (
    !Array.isArray(candidate.worldEntities.buildings) ||
    !Array.isArray(candidate.worldEntities.characters) ||
    !Array.isArray(candidate.worldEntities.resourceNodes)
  ) {
    return null;
  }

  const validDifficulties: AIDifficulty[] = ['easy', 'normal', 'hard', 'very_hard'];
  const normalizedDifficulty: AIDifficulty = validDifficulties.includes(
    candidate.difficultyLevel as AIDifficulty,
  )
    ? (candidate.difficultyLevel as AIDifficulty)
    : 'normal';

  return {
    ...(candidate as SaveGameData),
    difficultyLevel: normalizedDifficulty,
    version: CURRENT_SAVE_VERSION,
  };
}

export class StoragePersistenceProvider implements PersistenceProvider {
  private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  constructor(customStorage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
    if (customStorage) {
      this.storage = customStorage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      const mem = new Map<string, string>();
      this.storage = {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => {
          mem.set(k, v);
        },
        removeItem: (k) => {
          mem.delete(k);
        },
      };
    }
  }

  saveGame(data: SaveGameData): boolean {
    try {
      const updated: SaveGameData = {
        ...data,
        version: CURRENT_SAVE_VERSION,
        savedAtIso: new Date().toISOString(),
        worldEntities: data.worldEntities
          ? cloneWorldEntities(data.worldEntities)
          : undefined,
      };
      this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }

  loadGame(): SaveGameData | null {
    try {
      const raw =
        this.storage.getItem(SAVE_STORAGE_KEY) ??
        this.storage.getItem(LEGACY_SAVE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return validateSaveGameData(parsed);
    } catch {
      return null;
    }
  }

  hasSavedGame(): boolean {
    return this.loadGame() !== null;
  }

  clearSavedGame(): void {
    try {
      this.storage.removeItem(SAVE_STORAGE_KEY);
      this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
    } catch {
      // ignore storage restrictions
    }
  }

  saveSettings(settings: GameSettings): boolean {
    try {
      this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      return true;
    } catch {
      return false;
    }
  }

  loadSettings(): GameSettings {
    const fallback = createDefaultSettings();
    try {
      const raw = this.storage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      if (
        parsed.graphicsQuality !== 'low' &&
        parsed.graphicsQuality !== 'medium' &&
        parsed.graphicsQuality !== 'high' &&
        parsed.graphicsQuality !== 'ultra'
      ) {
        return fallback;
      }
      return {
        graphicsQuality: parsed.graphicsQuality,
        cameraPanSpeed:
          typeof parsed.cameraPanSpeed === 'number'
            ? Math.max(0.4, Math.min(2.2, parsed.cameraPanSpeed))
            : fallback.cameraPanSpeed,
        audio: {
          masterVolume: parsed.audio?.masterVolume ?? fallback.audio.masterVolume,
          musicVolume: parsed.audio?.musicVolume ?? fallback.audio.musicVolume,
          ambienceVolume: parsed.audio?.ambienceVolume ?? fallback.audio.ambienceVolume,
          sfxVolume: parsed.audio?.sfxVolume ?? fallback.audio.sfxVolume,
          muted: Boolean(parsed.audio?.muted),
        },
      };
    } catch {
      return fallback;
    }
  }
}

export const defaultPersistence = new StoragePersistenceProvider();
