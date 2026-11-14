import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { KINGDOMS } from '../config/kingdoms';
import { REGIONS } from '../config/regions';
import {
  BuildingArchetype,
  BuildingEntity,
  CameraRigState,
  CharacterEntity,
  CivilianRole,
  EconomyNotification,
  EconomyStatistics,
  GameSettings,
  GraphicsQuality,
  KingdomId,
  PlacementPreviewState,
  PopulationState,
  ProgressionStage,
  RegionId,
  ResourceAmounts,
  ResourceCapacities,
  ResourceKey,
  ResourceRates,
  SaveGameData,
  SelectableEntity,
  TouchCommandMode,
} from '../types/game';
import {
  createInitialCameraRig,
  focusCameraOnPoint,
  panCameraLocal,
  rotateCamera,
  stepCameraRig,
  zoomCamera,
} from './camera/rtsCameraMath';
import {
  FootstepSurface,
  resolveAdaptiveMusicMood,
  soundEngine,
} from './audio/soundEngine';
import { updateProceduralCharacterAnimation } from './graphics/characterFactory';
import { createProceduralTextureSet, ProceduralTextureSet } from './graphics/proceduralTextures';
import { buildProceduralWorld, BuiltWorldScene } from './graphics/worldBuilder';
import { getRiverCenterZ, sampleTerrainHeight, WATER_LEVEL } from './math/noise';
import { cloneWorldEntities } from './persistence/saveSystem';
import {
  assignVillagerOccupation,
  attachAIKingdomLedgers,
  cancelPlannedOrActiveConstruction,
  cancelVillagerTask,
  commandVillagerMove,
  commandVillagersToEntity,
  createInitialEconomyRuntime,
  EconomyWorldRuntime,
  placeNewBuilding,
  pushEconomyNotification,
  stepEconomyAndVillagers,
  validateBuildingPlacement,
} from './simulation/economySim';
import {
  AIDifficulty,
  AIKingdomRuntime,
  DiplomaticRelation,
  MilitaryFormationType,
  MilitaryStance,
  MilitaryUnitClass,
  TreatyKind,
  WorldEventItem,
} from '../types/game';
import {
  cancelQueuedUnitRecruitment,
  commandMilitaryAttack,
  commandMilitaryFormation,
  commandMilitaryMove,
  commandMilitaryStance,
  createInitialMilitaryState,
  getMilitaryOverview,
  MilitarySimulationState,
  queueUnitRecruitment,
  stepMilitaryRecruitmentQueues,
  stepMilitaryUnits,
  stepMilitaryUpkeep,
  stepProjectiles,
} from './simulation/militarySim';
import {
  AIKingdomManager,
  createInitialAIKingdomManager,
  estimateMilitaryPower,
  stepAIKingdomManager,
  updateAllKingdomIntelligence,
} from './simulation/aiKingdomSim';
import {
  addDiplomaticTreaty,
  createInitialDiplomacyState,
  declareWarBetweenKingdoms,
  DiplomacyState,
  evaluateProposalAcceptance,
  proposePeaceTreaty,
  sendDiplomaticGift,
  stepDiplomacy,
} from './simulation/diplomacySim';
import {
  createInitialWorldEventState,
  pushWorldEvent,
  WorldEventState,
} from './simulation/worldEventSim';
import { stepVillageLivestock } from './simulation/livestockSim';

export interface EconomyHudSnapshot {
  resources: ResourceAmounts;
  capacities: ResourceCapacities;
  rates: ResourceRates;
  population: PopulationState;
  progressionStage: ProgressionStage;
  economyStats: EconomyStatistics;
  elapsedPlaySeconds: number;
  allEntities: SelectableEntity[];
  difficultyLevel: AIDifficulty;
}

export interface EngineCallbacks {
  onSelectionChange: (entities: SelectableEntity[]) => void;
  onEconomySnapshot?: (snapshot: EconomyHudSnapshot) => void;
  onNotifications?: (notifications: EconomyNotification[]) => void;
  onPlacementPreviewChange?: (preview: PlacementPreviewState) => void;
  onTouchCommandModeChange?: (mode: TouchCommandMode) => void;
}

export interface WorldLoadParams {
  kingdomId: KingdomId;
  regionId: RegionId;
  seed: number;
  quality: GraphicsQuality;
  initialCamera?: { x: number; z: number; yaw: number; distance: number };
  savedGame?: SaveGameData;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function snapshotSelectableEntity(entity: SelectableEntity): SelectableEntity {
  if (entity.category === 'character') {
    return {
      ...entity,
      position: { ...entity.position },
      moveTarget: entity.moveTarget ? { ...entity.moveTarget } : null,
      waterTarget: entity.waterTarget ? { ...entity.waterTarget } : null,
    };
  }
  if (entity.category === 'building') {
    return {
      ...entity,
      position: { ...entity.position },
      constructionCost: { ...entity.constructionCost },
      storageBonus: { ...entity.storageBonus },
      acceptsStorage: [...entity.acceptsStorage],
      assignedWorkerIds: [...entity.assignedWorkerIds],
    };
  }
  return {
    ...entity,
    position: { ...entity.position },
    activeHarvesterIds: [...entity.activeHarvesterIds],
  };
}

/**
 * Core 3D RTS Engine managing WebGLRenderer, RoomEnvironment PBR lighting,
 * Phase 2 Kingdom Economy & Villager Simulation, interactive 3D Building Placement,
 * single/multi-villager selection & commands, and GPU-fence software-WebGL pacing.
 */
export class AkanuEngine {
  public readonly isSoftwareGl: boolean;
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sunLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private envTexture: THREE.Texture | null = null;
  private textures: ProceduralTextureSet;

  private activeWorld: BuiltWorldScene | null = null;
  private economyRuntime: EconomyWorldRuntime | null = null;
  private militaryState: MilitarySimulationState = createInitialMilitaryState();
  private aiKingdomManager: AIKingdomManager = createInitialAIKingdomManager('oru', 'normal');
  private diplomacyState: DiplomacyState = createInitialDiplomacyState('oru');
  private worldEventState: WorldEventState = createInitialWorldEventState();
  private projectileMeshesGroup: THREE.Group = new THREE.Group();
  private currentParams: WorldLoadParams = {
    kingdomId: 'oru',
    regionId: 'golden_savannah',
    seed: 4819,
    quality: 'high',
  };

  private cameraRig: CameraRigState = createInitialCameraRig();
  private cameraTourMode = true;
  private tourAngle = 0.55;
  private isPaused = false;
  private panSpeedMultiplier = 1.0;

  private selectedEntityIds: string[] = [];
  private touchCommandMode: TouchCommandMode = 'select';
  private placementPreview: PlacementPreviewState = {
    active: false,
    archetype: null,
    x: 0,
    z: 0,
    rotationY: 0,
    valid: false,
  };
  private moveMarkerTimer = 0;
  private callbacks: EngineCallbacks;

  // Reusable zero-GC math scratch objects
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private lastFrameTimeMs = 0;
  private elapsedSeconds = 0;
  private hudSyncAccumulator = 0;
  private lastHoverRaycastMs = 0;

  // Spatial Audio & Foley Synchronization State
  private celebratedCompletedBuildingIds = new Set<string>();
  private charLastStepWave = new Map<string, number>();
  private charLastActionWave = new Map<string, number>();
  private ambientVoiceCooldownSec = 1.6;
  private birdCheckCooldownSec = 2.5;
  private livestockCheckCooldownSec = 3.2;

  // Input state
  private readonly keysHeld = new Set<string>();
  private pointerDownPos = { x: 0, y: 0 };
  private lastPointerPos = { x: 0, y: 0 };
  private activeMouseButton: number | null = null;
  private hasDragged = false;

  // Touch gesture state
  private activeTouches = new Map<number, { x: number; y: number }>();
  private prevPinchDist = 0;
  private prevPinchAngle = 0;

  private frameHandle = 0;
  private isTimerHandle = false;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.07;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    this.renderer.domElement.setAttribute('data-testid', 'akanu-3d-canvas');
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 360);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    this.hemiLight = new THREE.HemisphereLight('#9bc1e6', '#5c3b1e', 0.58);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#ffd18c', 2.15);
    this.sunLight.position.set(62, 40, 46);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1536, 1536);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 210;
    const shadowExtent = 64;
    this.sunLight.shadow.camera.left = -shadowExtent;
    this.sunLight.shadow.camera.right = shadowExtent;
    this.sunLight.shadow.camera.top = shadowExtent;
    this.sunLight.shadow.camera.bottom = -shadowExtent;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.028;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight('#90b6dc', 0.36);
    this.rimLight.position.set(-48, 30, -40);
    this.scene.add(this.rimLight);
    this.scene.add(this.rimLight.target);

    this.textures = createProceduralTextureSet(this.renderer.capabilities.getMaxAnisotropy());

    this.bindInputListeners();
    this.loadWorld(this.currentParams);

    this.lastFrameTimeMs = performance.now();
    this.scheduleNextFrame();
  }

  public setCallbacks(callbacks: EngineCallbacks): void {
    this.callbacks = callbacks;
  }

  public setCameraTourMode(enabled: boolean): void {
    this.cameraTourMode = enabled;
    if (!enabled) {
      this.keysHeld.clear();
    } else {
      this.startBuildingPlacement(null);
    }
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (paused) {
      this.keysHeld.clear();
    }
  }

  public setPanSpeedMultiplier(speed: number): void {
    this.panSpeedMultiplier = Math.max(0.4, Math.min(2.2, speed));
  }

  public getTouchCommandMode(): TouchCommandMode {
    return this.touchCommandMode;
  }

  public setTouchCommandMode(mode: TouchCommandMode): void {
    this.touchCommandMode = mode;
    this.callbacks.onTouchCommandModeChange?.(mode);
  }

  public getPlacementPreview(): PlacementPreviewState {
    return { ...this.placementPreview };
  }

  public getCameraSnapshot(): { x: number; z: number; yaw: number; distance: number } {
    return {
      x: Number(this.cameraRig.targetX.toFixed(2)),
      z: Number(this.cameraRig.targetZ.toFixed(2)),
      yaw: Number(this.cameraRig.yaw.toFixed(3)),
      distance: Number(this.cameraRig.distance.toFixed(2)),
    };
  }

  public getAllSelectableEntities(): SelectableEntity[] {
    if (!this.activeWorld) return [];
    return [
      ...this.activeWorld.buildings.map(snapshotSelectableEntity),
      ...this.activeWorld.characters.map(snapshotSelectableEntity),
      ...this.activeWorld.resourceNodes.map(snapshotSelectableEntity),
    ];
  }

  public loadWorld(params: WorldLoadParams): void {
    this.startBuildingPlacement(null);
    this.setTouchCommandMode('select');
    this.currentParams = { ...params };

    if (this.activeWorld) {
      this.scene.remove(this.activeWorld.root);
      this.activeWorld.dispose();
      this.activeWorld = null;
    }

    const region = REGIONS[params.regionId];
    const kingdom = KINGDOMS[params.kingdomId];
    this.scene.background = new THREE.Color(region.palette.skyHorizon);
    this.scene.fog = new THREE.FogExp2(region.palette.fogColor, region.palette.fogDensity);

    this.sunLight.color.set(region.palette.sunColor);
    this.sunLight.intensity = region.palette.sunIntensity;
    this.hemiLight.color.set(region.palette.hemiSkyColor);
    this.hemiLight.groundColor.set(region.palette.hemiGroundColor);
    this.rimLight.color.set(region.palette.hemiSkyColor);

    soundEngine.setMusicMood(this.cameraTourMode ? 'menu' : 'peaceful', params.regionId);

    this.applyQualityToRenderer(params.quality);

    const saved = params.savedGame;
    this.activeWorld = buildProceduralWorld(
      params.kingdomId,
      params.regionId,
      params.seed,
      params.quality,
      this.textures,
      saved?.worldEntities,
    );
    this.scene.add(this.activeWorld.root);

    this.celebratedCompletedBuildingIds.clear();
    for (const bld of this.activeWorld.buildings) {
      if (bld.constructionState === 'completed') {
        this.celebratedCompletedBuildingIds.add(bld.id);
      }
    }
    this.charLastStepWave.clear();
    this.charLastActionWave.clear();

    const isAbundantSandbox =
      saved?.gameMode === 'sandbox' && (saved?.capacities?.wood ?? 0) > 1100;

    this.economyRuntime = createInitialEconomyRuntime({
      kingdomId: params.kingdomId,
      region,
      seed: params.seed,
      capacityMultiplier: isAbundantSandbox ? 2.2 : 1.0,
      resources: saved?.resources ?? { ...kingdom.startingResources },
      buildings: this.activeWorld.buildings,
      characters: this.activeWorld.characters,
      resourceNodes: this.activeWorld.resourceNodes,
      existingStats: saved?.economyStats,
      existingPopulation: saved?.population,
      elapsedSeconds: saved?.elapsedPlaySeconds ?? 0,
    });
    this.elapsedSeconds = this.economyRuntime.elapsedSeconds;
    this.militaryState = createInitialMilitaryState(saved?.militaryStats);

    this.aiKingdomManager = createInitialAIKingdomManager(
      params.kingdomId,
      saved?.difficultyLevel || 'normal',
      saved?.aiKingdomsData,
      this.activeWorld.capitalCenters,
    );
    attachAIKingdomLedgers(this.economyRuntime, this.aiKingdomManager.kingdoms);

    this.diplomacyState = createInitialDiplomacyState(
      params.kingdomId,
      saved?.diplomacyData,
    );
    this.worldEventState = createInitialWorldEventState(saved?.worldEventsData);
    updateAllKingdomIntelligence(
      this.aiKingdomManager,
      this.economyRuntime,
      this.diplomacyState,
      this.worldEventState.events,
    );

    this.scene.remove(this.projectileMeshesGroup);
    this.projectileMeshesGroup.clear();
    this.scene.add(this.projectileMeshesGroup);

    if (params.initialCamera) {
      this.cameraRig.targetX = params.initialCamera.x;
      this.cameraRig.desiredTargetX = params.initialCamera.x;
      this.cameraRig.targetZ = params.initialCamera.z;
      this.cameraRig.desiredTargetZ = params.initialCamera.z;
      this.cameraRig.yaw = params.initialCamera.yaw;
      this.cameraRig.desiredYaw = params.initialCamera.yaw;
      this.cameraRig.distance = params.initialCamera.distance;
      this.cameraRig.desiredDistance = params.initialCamera.distance;
    } else {
      this.cameraRig = createInitialCameraRig();
    }

    this.clearSelection();
    this.emitEconomySnapshot();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    if (this.currentParams.quality === quality) return;
    const camSnap = this.getCameraSnapshot();
    const liveSaved = this.economyRuntime
      ? ({
          version: 2,
          savedAtIso: new Date().toISOString(),
          playerKingdomName: 'Active Kingdom',
          rulerName: 'Sovereign',
          kingdomId: this.currentParams.kingdomId,
          regionId: this.currentParams.regionId,
          worldSeed: this.currentParams.seed,
          gameMode:
            this.economyRuntime.capacityMultiplier > 1.5 ? 'sandbox' : 'standard',
          progressionStage: this.economyRuntime.progressionStage,
          resources: { ...this.economyRuntime.resources },
          capacities: { ...this.economyRuntime.capacities },
          rates: this.economyRuntime.rates,
          population: { ...this.economyRuntime.population },
          economyStats: this.economyRuntime.economyStats,
          cameraTarget: camSnap,
          settings: {
            graphicsQuality: quality,
            cameraPanSpeed: this.panSpeedMultiplier,
            audio: {
              masterVolume: 0.75,
              musicVolume: 0.55,
              ambienceVolume: 0.65,
              sfxVolume: 0.8,
              muted: false,
            },
          },
          elapsedPlaySeconds: this.economyRuntime.elapsedSeconds,
          difficultyLevel: this.aiKingdomManager.difficulty,
          aiKingdomsData: Object.values(this.aiKingdomManager.kingdoms),
          diplomacyData: Object.entries(this.diplomacyState.relations).reduce((acc, [k, v]) => {
            acc[k as KingdomId] = Object.values(v);
            return acc;
          }, {} as Record<KingdomId, DiplomaticRelation[]>),
          worldEventsData: [...this.worldEventState.events],
          worldEntities: cloneWorldEntities({
            buildings: this.economyRuntime.buildings,
            characters: this.economyRuntime.characters,
            resourceNodes: this.economyRuntime.resourceNodes,
          }),
        } satisfies SaveGameData)
      : undefined;

    this.loadWorld({
      ...this.currentParams,
      quality,
      initialCamera: camSnap,
      savedGame: liveSaved,
    });
  }

  public exportSaveSnapshot(baseSave: SaveGameData, settings: GameSettings): SaveGameData {
    const camSnap = this.getCameraSnapshot();
    if (!this.economyRuntime || !this.activeWorld) {
      return {
        ...baseSave,
        cameraTarget: camSnap,
        settings,
        savedAtIso: new Date().toISOString(),
      };
    }

    const diplomacyData = Object.entries(this.diplomacyState.relations).reduce(
      (acc, [k, v]) => {
        acc[k as KingdomId] = Object.values(v);
        return acc;
      },
      {} as Record<KingdomId, DiplomaticRelation[]>,
    );

    return {
      version: 2,
      savedAtIso: new Date().toISOString(),
      playerKingdomName: baseSave.playerKingdomName,
      rulerName: baseSave.rulerName,
      kingdomId: this.currentParams.kingdomId,
      regionId: this.currentParams.regionId,
      worldSeed: this.currentParams.seed,
      gameMode: this.economyRuntime.capacityMultiplier > 1.5 ? 'sandbox' : 'standard',
      difficultyLevel: this.aiKingdomManager.difficulty,
      progressionStage: this.economyRuntime.progressionStage,
      resources: { ...this.economyRuntime.resources },
      capacities: { ...this.economyRuntime.capacities },
      rates: {
        productionPerMinute: { ...this.economyRuntime.rates.productionPerMinute },
        consumptionPerMinute: { ...this.economyRuntime.rates.consumptionPerMinute },
        netPerMinute: { ...this.economyRuntime.rates.netPerMinute },
      },
      population: { ...this.economyRuntime.population },
      economyStats: {
        ...this.economyRuntime.economyStats,
        totalGathered: { ...this.economyRuntime.economyStats.totalGathered },
      },
      militaryStats: { ...this.militaryState.stats },
      cameraTarget: camSnap,
      settings,
      elapsedPlaySeconds: this.economyRuntime.elapsedSeconds,
      aiKingdomsData: Object.values(this.aiKingdomManager.kingdoms),
      diplomacyData,
      worldEventsData: [...this.worldEventState.events],
      worldEntities: cloneWorldEntities({
        buildings: this.economyRuntime.buildings,
        characters: this.economyRuntime.characters,
        resourceNodes: this.economyRuntime.resourceNodes,
      }),
    };
  }

  private applyQualityToRenderer(quality: GraphicsQuality): void {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
      return;
    }

    if (quality === 'low') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
    } else if (quality === 'ultra') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
    } else {
      // 'high' (default)
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1536, 1536);
    }
  }

  // ============================================================================
  // SELECTION & MULTI-VILLAGER MANAGEMENT
  // ============================================================================

  public selectEntityById(entityId: string | null, additive = false): SelectableEntity[] {
    if (!entityId || !this.activeWorld) {
      this.clearSelection();
      return [];
    }
    const entity = this.activeWorld.entitiesById.get(entityId);
    if (!entity) {
      this.clearSelection();
      return [];
    }

    if (additive && entity.category === 'character') {
      const existingChars = this.selectedEntityIds.filter((id) => {
        const e = this.activeWorld?.entitiesById.get(id);
        return e?.category === 'character';
      });
      if (existingChars.includes(entity.id)) {
        this.selectedEntityIds = existingChars.filter((id) => id !== entity.id);
      } else {
        this.selectedEntityIds = [...existingChars, entity.id];
      }
    } else {
      this.selectedEntityIds = [entity.id];
    }

    if (this.selectedEntityIds.length === 0) {
      this.clearSelection();
      return [];
    }

    this.updateSelectionRings();
    const selectedSnapshots = this.getSelectedEntitiesSnapshot();
    this.callbacks.onSelectionChange(selectedSnapshots);
    soundEngine.playSelectEntity(
      entity.category,
      entity.position.x,
      entity.position.z,
      this.hashEntityVoiceSeed(entity.id),
    );
    return selectedSnapshots;
  }

  public selectEntitiesByIds(ids: string[]): SelectableEntity[] {
    if (!this.activeWorld || ids.length === 0) {
      this.clearSelection();
      return [];
    }
    const valid = ids.filter((id) => this.activeWorld?.entitiesById.has(id));
    if (valid.length === 0) {
      this.clearSelection();
      return [];
    }
    this.selectedEntityIds = valid;
    this.updateSelectionRings();
    const snaps = this.getSelectedEntitiesSnapshot();
    this.callbacks.onSelectionChange(snaps);
    if (snaps.length > 0) {
      soundEngine.playSelectEntity(
        snaps[0].category,
        snaps[0].position.x,
        snaps[0].position.z,
        this.hashEntityVoiceSeed(snaps[0].id),
      );
    }
    return snaps;
  }

  public selectVillagersByFilter(filter: 'all' | 'idle' | CivilianRole): SelectableEntity[] {
    if (!this.activeWorld) return [];
    const matched = this.activeWorld.characters
      .filter((c) => {
        if (c.kingdomId !== this.currentParams.kingdomId || c.isMilitary || c.health <= 0) {
          return false;
        }
        if (filter === 'all') return true;
        if (filter === 'idle') return c.role === 'Unemployed';
        return c.role === filter;
      })
      .map((c) => c.id);
    return this.selectEntitiesByIds(matched);
  }

  public selectMilitaryUnits(filter?: MilitaryUnitClass | 'all'): SelectableEntity[] {
    if (!this.activeWorld) return [];
    const matched = this.activeWorld.characters
      .filter((c) => {
        if (
          c.kingdomId !== this.currentParams.kingdomId ||
          !c.isMilitary ||
          c.health <= 0 ||
          c.isHostile
        ) {
          return false;
        }
        if (!filter || filter === 'all') return true;
        return c.militaryClass === filter;
      })
      .map((c) => c.id);
    return this.selectEntitiesByIds(matched);
  }

  public clearSelection(): void {
    this.selectedEntityIds = [];
    if (this.activeWorld) {
      for (const r of this.activeWorld.selectionRings) {
        r.visible = false;
      }
    }
    if (this.touchCommandMode !== 'select') {
      this.setTouchCommandMode('select');
    }
    this.callbacks.onSelectionChange([]);
  }

  private getSelectedEntitiesSnapshot(): SelectableEntity[] {
    if (!this.activeWorld) return [];
    const list: SelectableEntity[] = [];
    for (const id of this.selectedEntityIds) {
      const ent = this.activeWorld.entitiesById.get(id);
      if (ent) list.push(snapshotSelectableEntity(ent));
    }
    return list;
  }

  private getSelectedVillagers(): CharacterEntity[] {
    if (!this.activeWorld) return [];
    const list: CharacterEntity[] = [];
    for (const id of this.selectedEntityIds) {
      const ent = this.activeWorld.entitiesById.get(id);
      if (
        ent &&
        ent.category === 'character' &&
        ent.kingdomId === this.currentParams.kingdomId &&
        ent.health > 0
      ) {
        list.push(ent);
      }
    }
    return list;
  }

  // ============================================================================
  // DIRECT VILLAGER & ECONOMY COMMANDS
  // ============================================================================

  public assignSelectedVillagersOccupation(
    role: CivilianRole,
    preferredResource?: ResourceKey | null,
  ): void {
    if (!this.economyRuntime) return;
    const villagers = this.getSelectedVillagers();
    if (villagers.length === 0) return;

    for (let i = 0; i < villagers.length; i++) {
      assignVillagerOccupation(
        villagers[i],
        role,
        this.economyRuntime,
        preferredResource,
        i > 0, // emit single notification for group assignment
      );
    }
    if (villagers.length > 1) {
      pushEconomyNotification(
        this.economyRuntime,
        `multi_assign_${role}`,
        'info',
        `Assigned ${villagers.length} villagers as ${role}.`,
        1,
      );
    }
    soundEngine.playVillagerVoice(
      'command',
      villagers[0].position.x,
      villagers[0].position.z,
      this.hashEntityVoiceSeed(villagers[0].id),
    );
    this.flushEconomyChangesImmediate();
  }

  public adjustWorkforceAllocation(role: CivilianRole, delta: 1 | -1): void {
    if (!this.economyRuntime || role === 'Unemployed') return;
    const chars = this.economyRuntime.characters.filter(
      (c) =>
        c.kingdomId === this.currentParams.kingdomId &&
        !c.isMilitary &&
        c.health > 0,
    );

    if (delta === 1) {
      let candidate = chars.find((c) => c.role === 'Unemployed');
      if (!candidate) {
        candidate = chars.find((c) => c.role !== role);
      }
      if (candidate) {
        assignVillagerOccupation(candidate, role, this.economyRuntime);
        this.flushEconomyChangesImmediate();
      }
    } else {
      const existing = chars.find((c) => c.role === role);
      if (existing) {
        cancelVillagerTask(existing, this.economyRuntime);
        this.flushEconomyChangesImmediate();
      }
    }
  }

  public cancelSelectedVillagersTask(): void {
    if (!this.economyRuntime) return;
    const villagers = this.getSelectedVillagers().filter((v) => !v.isMilitary);
    for (const v of villagers) {
      cancelVillagerTask(v, this.economyRuntime);
    }
    this.flushEconomyChangesImmediate();
  }

  public dispatchWorkerToEntity(targetId: string): string | null {
    if (!this.economyRuntime || !this.activeWorld) return null;
    const target = this.activeWorld.entitiesById.get(targetId);
    if (!target) return null;
    if (target.category === 'building' && target.kingdomId !== this.currentParams.kingdomId) {
      return null;
    }

    let workers = this.getSelectedVillagers().filter((v) => !v.isMilitary);
    if (workers.length === 0) {
      const candidates = this.economyRuntime.characters
        .filter(
          (c) =>
            c.kingdomId === this.currentParams.kingdomId &&
            !c.isMilitary &&
            c.health > 0,
        )
        .sort((a, b) => {
          const aScore =
            (a.role === 'Unemployed'
              ? -200
              : a.role === 'Builder' &&
                  target.category === 'building' &&
                  target.constructionState !== 'completed'
                ? -120
                : 0) +
            Math.hypot(a.position.x - target.position.x, a.position.z - target.position.z);
          const bScore =
            (b.role === 'Unemployed'
              ? -200
              : b.role === 'Builder' &&
                  target.category === 'building' &&
                  target.constructionState !== 'completed'
                ? -120
                : 0) +
            Math.hypot(b.position.x - target.position.x, b.position.z - target.position.z);
          return aScore - bScore;
        });
      if (candidates.length > 0) {
        workers = [candidates[0]];
      }
    }

    const summary = commandVillagersToEntity(workers, target, this.economyRuntime);
    if (summary) {
      pushEconomyNotification(this.economyRuntime, `dispatch_${target.id}`, 'info', summary, 1);
      if (workers[0]) {
        soundEngine.playVillagerVoice(
          'command',
          workers[0].position.x,
          workers[0].position.z,
          this.hashEntityVoiceSeed(workers[0].id),
        );
      }
      this.flushEconomyChangesImmediate();
    }
    return summary;
  }

  // ============================================================================
  // PHASE 3 MILITARY & RECRUITMENT COMMANDS
  // ============================================================================

  public recruitUnitAtBuilding(buildingId: string, unitClass: MilitaryUnitClass): boolean {
    if (!this.economyRuntime || !this.activeWorld) return false;
    const bld = this.activeWorld.buildings.find(
      (b) => b.id === buildingId && b.kingdomId === this.currentParams.kingdomId,
    );
    if (!bld) return false;

    const ok = queueUnitRecruitment(unitClass, bld, this.economyRuntime);
    if (ok) {
      this.flushEconomyChangesImmediate();
    }
    return ok;
  }

  public cancelRecruitment(buildingId: string, queueIndex: number): boolean {
    if (!this.economyRuntime || !this.activeWorld) return false;
    const bld = this.activeWorld.buildings.find(
      (b) => b.id === buildingId && b.kingdomId === this.currentParams.kingdomId,
    );
    if (!bld) return false;

    const ok = cancelQueuedUnitRecruitment(bld, queueIndex, this.economyRuntime);
    if (ok) {
      this.flushEconomyChangesImmediate();
    }
    return ok;
  }

  public setBuildingRallyPoint(buildingId: string, x: number, z: number): void {
    if (!this.activeWorld) return;
    const bld = this.activeWorld.buildings.find(
      (b) => b.id === buildingId && b.kingdomId === this.currentParams.kingdomId,
    );
    if (bld) {
      bld.rallyPoint = { x, z };
      this.flushEconomyChangesImmediate();
    }
  }

  public commandSelectedMilitaryMove(x: number, z: number): void {
    const units = this.getSelectedVillagers().filter((u) => u.isMilitary && u.health > 0);
    if (units.length === 0) return;
    const formation = units[0]?.formation ?? 'line';
    commandMilitaryMove(units, x, z, formation);
    if (this.activeWorld) {
      this.activeWorld.moveMarkerMesh.position.set(x, WATER_LEVEL + 0.1, z);
      this.activeWorld.moveMarkerMesh.visible = true;
      this.moveMarkerTimer = 1.1;
    }
    soundEngine.playVillagerVoice(
      'command',
      units[0].position.x,
      units[0].position.z,
      this.hashEntityVoiceSeed(units[0].id),
    );
    this.flushEconomyChangesImmediate();
  }

  public commandSelectedMilitaryAttack(targetEntity: CharacterEntity | BuildingEntity): void {
    const units = this.getSelectedVillagers().filter((u) => u.isMilitary && u.health > 0);
    if (units.length === 0) return;
    commandMilitaryAttack(units, targetEntity);
    soundEngine.playVillagerVoice(
      'work_call',
      units[0].position.x,
      units[0].position.z,
      this.hashEntityVoiceSeed(units[0].id),
    );
    this.flushEconomyChangesImmediate();
  }

  public setFormationForSelectedMilitary(formation: MilitaryFormationType): void {
    const units = this.getSelectedVillagers().filter((u) => u.isMilitary && u.health > 0);
    if (units.length === 0) return;
    commandMilitaryFormation(units, formation);
    this.flushEconomyChangesImmediate();
  }

  public setStanceForSelectedMilitary(stance: MilitaryStance): void {
    const units = this.getSelectedVillagers().filter((u) => u.isMilitary && u.health > 0);
    if (units.length === 0) return;
    commandMilitaryStance(units, stance);
    this.flushEconomyChangesImmediate();
  }

  public getMilitaryOverviewSnapshot(): ReturnType<typeof getMilitaryOverview> | null {
    if (!this.economyRuntime) return null;
    return getMilitaryOverview(this.economyRuntime, this.militaryState);
  }

  public commandSelectedVillagersMove(x: number, z: number): void {
    if (!this.economyRuntime || !this.activeWorld) return;
    const villagers = this.getSelectedVillagers();
    if (villagers.length === 0) return;

    villagers.forEach((v, idx) => {
      const angle = (idx / Math.max(1, villagers.length)) * Math.PI * 2;
      const spread = villagers.length > 1 ? 0.95 : 0;
      commandVillagerMove(
        v,
        x + Math.cos(angle) * spread,
        z + Math.sin(angle) * spread,
        this.economyRuntime!,
      );
    });

    const groundY = Math.max(
      WATER_LEVEL + 0.06,
      sampleTerrainHeight(x, z, REGIONS[this.currentParams.regionId], this.currentParams.seed),
    );
    this.activeWorld.moveMarkerMesh.position.set(x, groundY + 0.09, z);
    this.activeWorld.moveMarkerMesh.visible = true;
    this.moveMarkerTimer = 1.1;

    soundEngine.playVillagerVoice(
      'command',
      villagers[0].position.x,
      villagers[0].position.z,
      this.hashEntityVoiceSeed(villagers[0].id),
    );
    this.flushEconomyChangesImmediate();
  }

  // ============================================================================
  // INTERACTIVE 3D BUILDING PLACEMENT & CONSTRUCTION
  // ============================================================================

  public startBuildingPlacement(archetype: BuildingArchetype | null): void {
    if (!archetype || !this.activeWorld || !this.economyRuntime) {
      this.placementPreview = {
        active: false,
        archetype: null,
        x: 0,
        z: 0,
        rotationY: 0,
        valid: false,
      };
      if (this.activeWorld) {
        this.activeWorld.placementGhost.root.visible = false;
      }
      this.callbacks.onPlacementPreviewChange?.({ ...this.placementPreview });
      return;
    }

    // Find a valid initial spot near camera focus so preview is immediately ready on desktop & mobile
    let initX = this.cameraRig.targetX;
    let initZ = this.cameraRig.targetZ;
    for (let i = 0; i < 42; i++) {
      const r = i === 0 ? 0 : 4.5 + i * 0.9;
      const theta = i * 2.39996;
      const cx = this.cameraRig.targetX + Math.cos(theta) * r;
      const cz = this.cameraRig.targetZ + Math.sin(theta) * r;
      const check = validateBuildingPlacement(archetype, cx, cz, this.economyRuntime);
      if (check.valid) {
        initX = cx;
        initZ = cz;
        break;
      }
    }

    this.activeWorld.placementGhost.setArchetype(archetype);
    this.activeWorld.placementGhost.root.visible = true;
    this.updatePlacementPreviewAt(archetype, initX, initZ, 0);
  }

  public rotatePlacementPreview(deltaRad = Math.PI / 4): void {
    if (!this.placementPreview.active || !this.placementPreview.archetype) return;
    const nextRot = (this.placementPreview.rotationY + deltaRad) % (Math.PI * 2);
    this.updatePlacementPreviewAt(
      this.placementPreview.archetype,
      this.placementPreview.x,
      this.placementPreview.z,
      nextRot,
    );
  }

  private updatePlacementPreviewAt(
    archetype: BuildingArchetype,
    x: number,
    z: number,
    rotationY: number,
  ): void {
    if (!this.activeWorld || !this.economyRuntime) return;
    const validation = validateBuildingPlacement(archetype, x, z, this.economyRuntime);
    const y = Math.max(
      WATER_LEVEL,
      sampleTerrainHeight(x, z, REGIONS[this.currentParams.regionId], this.currentParams.seed),
    );

    const ghost = this.activeWorld.placementGhost;
    ghost.root.position.set(x, y, z);
    ghost.root.rotation.y = rotationY;
    ghost.setValid(validation.valid);

    const changed =
      !this.placementPreview.active ||
      this.placementPreview.archetype !== archetype ||
      this.placementPreview.valid !== validation.valid ||
      this.placementPreview.reason !== validation.reason ||
      Math.hypot(this.placementPreview.x - x, this.placementPreview.z - z) > 0.5 ||
      Math.abs(this.placementPreview.rotationY - rotationY) > 0.01;

    this.placementPreview = {
      active: true,
      archetype,
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
      rotationY,
      valid: validation.valid,
      reason: validation.reason,
    };

    if (changed) {
      this.callbacks.onPlacementPreviewChange?.({ ...this.placementPreview });
    }
  }

  public confirmPlacementAtCurrentPreview(keepPlacing = false): BuildingArchetype | null {
    if (
      !this.placementPreview.active ||
      !this.placementPreview.archetype ||
      !this.economyRuntime ||
      !this.activeWorld
    ) {
      return null;
    }

    const arch = this.placementPreview.archetype;
    const result = placeNewBuilding(
      arch,
      this.placementPreview.x,
      this.placementPreview.z,
      this.placementPreview.rotationY,
      this.economyRuntime,
    );

    if (!result.ok || !result.building) {
      this.flushEconomyChangesImmediate();
      return null;
    }

    this.activeWorld.addBuildingEntity(result.building);
    this.economyRuntime.dirtyBuildingIds.delete(result.building.id);
    soundEngine.playWorkAction('build', result.building.position.x, result.building.position.z);

    if (!keepPlacing) {
      this.startBuildingPlacement(null);
      this.selectEntityById(result.building.id);
    } else {
      this.updatePlacementPreviewAt(
        arch,
        this.placementPreview.x,
        this.placementPreview.z,
        this.placementPreview.rotationY,
      );
    }

    this.flushEconomyChangesImmediate();
    return arch;
  }

  public cancelBuildingConstruction(buildingId: string): boolean {
    if (!this.economyRuntime || !this.activeWorld) return false;
    const ok = cancelPlannedOrActiveConstruction(buildingId, this.economyRuntime);
    if (ok) {
      this.activeWorld.removeBuildingEntity(buildingId);
      this.economyRuntime.dirtyBuildingIds.delete(buildingId);
      if (this.selectedEntityIds.includes(buildingId)) {
        this.clearSelection();
      }
      this.flushEconomyChangesImmediate();
    }
    return ok;
  }

  public focusOnEntity(entityId: string): void {
    if (!this.activeWorld) return;
    const entity = this.activeWorld.entitiesById.get(entityId);
    if (!entity) return;
    const dist = entity.category === 'character' ? 21 : 28;
    focusCameraOnPoint(this.cameraRig, entity.position.x, entity.position.z, dist);
  }

  public focusSettlementCenter(): void {
    focusCameraOnPoint(this.cameraRig, 0, 1.5, 38);
  }

  public setCameraPreset(preset: 'settlement' | 'overview' | 'battle'): void {
    if (preset === 'settlement') {
      focusCameraOnPoint(this.cameraRig, 0, 1.5, 36);
      return;
    }
    if (preset === 'overview') {
      focusCameraOnPoint(this.cameraRig, 0, 1.5, 62);
      return;
    }
    // 'battle': jump to an engaging soldier or player military vanguard if present
    const activeUnit =
      this.activeWorld?.characters.find(
        (c) =>
          c.kingdomId === this.currentParams.kingdomId &&
          c.isMilitary &&
          c.health > 0 &&
          (c.combatState === 'engaging' || c.combatState === 'charging' || c.combatState === 'firing'),
      ) ||
      this.activeWorld?.characters.find(
        (c) => c.kingdomId === this.currentParams.kingdomId && c.isMilitary && c.health > 0,
      );
    if (activeUnit) {
      focusCameraOnPoint(this.cameraRig, activeUnit.position.x, activeUnit.position.z, 28);
    } else {
      focusCameraOnPoint(this.cameraRig, 0, 1.5, 36);
    }
  }

  public zoomStep(delta: number): void {
    zoomCamera(this.cameraRig, delta);
  }

  public rotateStep(yawDelta: number): void {
    rotateCamera(this.cameraRig, yawDelta);
  }

  public panStep(rightDelta: number, forwardDelta: number): void {
    panCameraLocal(this.cameraRig, rightDelta, forwardDelta);
  }

  private updateSelectionRings(): void {
    if (!this.activeWorld) return;
    const rings = this.activeWorld.selectionRings;
    const region = REGIONS[this.currentParams.regionId];

    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      const entityId = this.selectedEntityIds[i];
      if (!entityId) {
        ring.visible = false;
        continue;
      }
      const entity = this.activeWorld.entitiesById.get(entityId);
      if (!entity) {
        ring.visible = false;
        continue;
      }

      ring.visible = true;
      const radius =
        entity.category === 'character'
          ? 1.35
          : entity.category === 'building'
            ? entity.footprintRadius * 1.12
            : entity.footprintRadius * 0.98;
      ring.scale.set(radius, 1, radius);
      const groundY = Math.max(
        WATER_LEVEL + 0.05,
        sampleTerrainHeight(
          entity.position.x,
          entity.position.z,
          region,
          this.currentParams.seed,
        ),
      );
      ring.position.set(entity.position.x, groundY + 0.07, entity.position.z);
      ring.rotation.y = this.elapsedSeconds * 0.45;
    }
  }

  private emitEconomySnapshot(): void {
    if (!this.economyRuntime || !this.activeWorld) return;
    const rt = this.economyRuntime;

    this.callbacks.onEconomySnapshot?.({
      resources: { ...rt.resources },
      capacities: { ...rt.capacities },
      rates: {
        productionPerMinute: { ...rt.rates.productionPerMinute },
        consumptionPerMinute: { ...rt.rates.consumptionPerMinute },
        netPerMinute: { ...rt.rates.netPerMinute },
      },
      population: { ...rt.population },
      progressionStage: rt.progressionStage,
      economyStats: {
        ...rt.economyStats,
        totalGathered: { ...rt.economyStats.totalGathered },
      },
      elapsedPlaySeconds: rt.elapsedSeconds,
      allEntities: this.getAllSelectableEntities(),
      difficultyLevel: this.aiKingdomManager.difficulty,
    });

    if (this.selectedEntityIds.length > 0) {
      this.callbacks.onSelectionChange(this.getSelectedEntitiesSnapshot());
    }

    // Sync adaptive soundtrack intensity to live settlement & conflict state
    const rels = Object.values(
      this.diplomacyState.relations[this.currentParams.kingdomId] || {},
    );
    const atWarCount = rels.filter((r) => r.state === 'at_war').length;
    const playerMil = rt.characters.filter(
      (c) => c.kingdomId === this.currentParams.kingdomId && c.isMilitary && c.health > 0,
    );
    const activeCombatEvents = playerMil.filter(
      (c) => c.combatState === 'engaging' || c.combatState === 'firing' || c.combatState === 'charging',
    ).length;
    const queuedRecruits = rt.buildings
      .filter((b) => b.kingdomId === this.currentParams.kingdomId)
      .reduce((acc, b) => acc + (b.recruitmentQueue?.length ?? 0), 0);
    const activeConstructionCount = rt.buildings.filter(
      (b) => b.kingdomId === this.currentParams.kingdomId && b.constructionState === 'under_construction',
    ).length;
    const resolvedMood = resolveAdaptiveMusicMood({
      isMenu: this.cameraTourMode,
      activeCombatEvents,
      atWarCount,
      militaryUnitCount: playerMil.length,
      queuedRecruits,
      activeConstructionCount,
      lowFoodAlert: rt.population.foodSatisfaction < 45,
    });
    soundEngine.setMusicMood(resolvedMood, this.currentParams.regionId);
  }

  private flushEconomyChangesImmediate(): void {
    this.syncDirtyWorldVisuals();
    this.emitEconomySnapshot();
  }

  private syncDirtyWorldVisuals(): void {
    if (!this.economyRuntime || !this.activeWorld) return;
    const rt = this.economyRuntime;

    if (rt.newlySpawnedBuildings.length > 0) {
      for (const bld of rt.newlySpawnedBuildings) {
        this.activeWorld.addBuildingEntity(bld);
      }
      rt.newlySpawnedBuildings.length = 0;
    }

    if (rt.dirtyBuildingIds.size > 0) {
      for (const bId of rt.dirtyBuildingIds) {
        this.activeWorld.syncBuildingVisual(bId);
      }
      rt.dirtyBuildingIds.clear();
    }

    if (rt.dirtyNodeIds.size > 0) {
      for (const nId of rt.dirtyNodeIds) {
        this.activeWorld.syncResourceNodeVisual(nId);
      }
      rt.dirtyNodeIds.clear();
    }

    if (rt.newlySpawnedCharacters.length > 0) {
      let playerRecruitSpawned = false;
      for (const spawned of rt.newlySpawnedCharacters) {
        this.activeWorld.addCharacterEntity(spawned);
        if (spawned.kingdomId === this.currentParams.kingdomId && spawned.isMilitary) {
          playerRecruitSpawned = true;
        }
      }
      if (!this.cameraTourMode && playerRecruitSpawned) {
        soundEngine.playAlert('recruit');
      }
      rt.newlySpawnedCharacters.length = 0;
    }

    if (rt.pendingNotifications.length > 0) {
      if (!this.cameraTourMode) {
        this.callbacks.onNotifications?.([...rt.pendingNotifications]);
      }
      rt.pendingNotifications.length = 0;
    }
  }

  private syncProjectilesVisual(): void {
    const activeProjs = this.militaryState.projectiles;
    // Fast pooled reuse of meshes in projectileMeshesGroup
    while (this.projectileMeshesGroup.children.length < activeProjs.length) {
      const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffdd88 });
      const arrowGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 5);
      arrowGeo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(arrowGeo, arrowMat);
      this.projectileMeshesGroup.add(mesh);
    }

    for (let i = 0; i < this.projectileMeshesGroup.children.length; i++) {
      const mesh = this.projectileMeshesGroup.children[i] as THREE.Mesh;
      if (i < activeProjs.length) {
        const p = activeProjs[i];
        mesh.visible = true;
        const curX = p.startX + (p.targetX - p.startX) * p.progress;
        const curZ = p.startZ + (p.targetZ - p.startZ) * p.progress;
        // Parabolic arc for ballistics
        const arcY = Math.sin(p.progress * Math.PI) * (p.isFire ? 6.5 : 2.5);
        const curY = p.startY + (p.targetY - p.startY) * p.progress + arcY;
        mesh.position.set(curX, curY, curZ);
        mesh.lookAt(p.targetX, p.targetY, p.targetZ);
      } else {
        mesh.visible = false;
      }
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext | WebGLRenderingContext;
    if ('fenceSync' in gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.isTimerHandle = true;
          this.frameHandle = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.isTimerHandle = true;
          this.frameHandle = window.setTimeout(cb, 80);
        }
      };
      this.isTimerHandle = true;
      this.frameHandle = window.setTimeout(poll, 5);
    } else {
      gl.finish();
      this.isTimerHandle = true;
      this.frameHandle = window.setTimeout(cb, 80);
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.isTimerHandle = false;
      this.frameHandle = window.requestAnimationFrame(this.tick);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const nowMs = performance.now();
    const rawDt = (nowMs - this.lastFrameTimeMs) * 0.001;
    this.lastFrameTimeMs = nowMs;
    const frameDt = Math.min(Math.max(rawDt, 0), 0.16);
    const camDt = Math.min(frameDt, 0.05);
    const region = REGIONS[this.currentParams.regionId];

    if (!this.isPaused && this.activeWorld && this.economyRuntime) {
      this.elapsedSeconds += frameDt;
      this.activeWorld.updateWater(this.elapsedSeconds);
      this.activeWorld.updateEnvironment(
        this.elapsedSeconds,
        frameDt,
        this.cameraRig.targetX,
        this.cameraRig.targetZ,
      );

      // Sub-step economy & military simulation in <= 0.05s slices so 10Hz software-WebGL keeps 1.0x real-time speed safely
      let rem = frameDt;
      let frameCombatCount = 0;
      let hadWarEvent = false;
      let hadPeaceEvent = false;
      while (rem > 1e-5) {
        const slice = Math.min(rem, 0.05);
        const combatEvents: WorldEventItem[] = [];
        stepEconomyAndVillagers(this.economyRuntime, slice);
        stepMilitaryRecruitmentQueues(
          slice,
          this.economyRuntime,
          this.militaryState,
          this.aiKingdomManager,
        );
        stepMilitaryUnits(
          slice,
          this.economyRuntime,
          this.militaryState,
          this.diplomacyState,
          this.aiKingdomManager,
          combatEvents,
        );
        stepProjectiles(
          slice,
          this.militaryState,
          this.economyRuntime,
          this.diplomacyState,
          this.aiKingdomManager,
          combatEvents,
        );
        stepMilitaryUpkeep(
          slice,
          this.economyRuntime,
          this.militaryState,
          this.aiKingdomManager,
        );
        stepVillageLivestock(
          this.activeWorld.livestock,
          this.activeWorld.buildings,
          slice,
          region,
          this.currentParams.seed,
          this.elapsedSeconds,
        );

        const aiEvents = stepAIKingdomManager(
          slice,
          this.aiKingdomManager,
          this.economyRuntime,
          this.militaryState,
          this.diplomacyState,
          region,
          this.currentParams.seed,
        );
        const dipEvents = stepDiplomacy(slice, this.diplomacyState, this.economyRuntime);
        for (const e of [...combatEvents, ...aiEvents, ...dipEvents]) {
          pushWorldEvent(this.worldEventState, e);
          if (e.kind === 'military') frameCombatCount++;
          if (e.kind === 'diplomacy' && /war/i.test(e.title)) hadWarEvent = true;
          if (e.kind === 'diplomacy' && /peace|treaty|alliance/i.test(e.title)) hadPeaceEvent = true;
        }
        rem -= slice;
      }

      if (!this.cameraTourMode) {
        if (hadWarEvent) soundEngine.playAlert('war');
        else if (hadPeaceEvent) soundEngine.playAlert('peace');
        if (frameCombatCount > 0) soundEngine.playCombatHit('sword');
      }

      // Building Completion Celebration (Triumphant Chime + Village Cheers + Rising Golden Light Aura)
      for (const bId of this.economyRuntime.dirtyBuildingIds) {
        const b = this.economyRuntime.buildings.find((item) => item.id === bId);
        if (
          b &&
          b.kingdomId === this.currentParams.kingdomId &&
          b.constructionState === 'completed' &&
          !this.celebratedCompletedBuildingIds.has(b.id)
        ) {
          this.celebratedCompletedBuildingIds.add(b.id);
          if (!this.cameraTourMode) {
            this.activeWorld.spawnVfxBurst(
              b.position.x,
              b.position.y,
              b.position.z,
              'building_complete',
            );
            soundEngine.playBuildingCompleted(b.position.x, b.position.z);
          }
        }
      }

      this.syncDirtyWorldVisuals();
      this.syncProjectilesVisual();

      // Update spatial audio listener & continuous wind/river/village ambience
      soundEngine.updateSpatialListener({
        targetX: this.cameraRig.targetX,
        targetZ: this.cameraRig.targetZ,
        yaw: this.cameraRig.yaw,
        distance: this.cameraRig.distance,
      });

      const tx = this.cameraRig.targetX;
      const tz = this.cameraRig.targetZ;
      let waterNearX = tx;
      let waterNearZ = getRiverCenterZ(tx, this.currentParams.seed);
      if (region.terrain.hasCoastline) {
        const shorelineZ = 25.0 + Math.sin(tx * 0.042) * 6.0 + Math.cos(tx * 0.09) * 2.5;
        const streamX = -24 + tz * 0.35 + Math.sin(tz * 0.08) * 3.5;
        if (Math.abs(tx - streamX) < Math.abs(tz - shorelineZ) && tz < shorelineZ + 4) {
          waterNearX = streamX;
          waterNearZ = tz;
        } else {
          waterNearX = tx;
          waterNearZ = shorelineZ;
        }
      }
      const wDx = waterNearX - tx;
      const wDz = waterNearZ - tz;
      const riverDist = Math.hypot(wDx, wDz);
      const riverProjRight =
        wDx * Math.cos(this.cameraRig.yaw) + wDz * -Math.sin(this.cameraRig.yaw);
      const riverPan = Math.max(-0.85, Math.min(0.85, riverProjRight / 18));
      const zoomGain = Math.max(0.32, Math.min(1.2, 34 / Math.max(15, this.cameraRig.distance)));
      const riverProximity = Math.max(0, Math.min(1, 1 - riverDist / 38)) * zoomGain;
      const groundAtCam = sampleTerrainHeight(tx, tz, region, this.currentParams.seed);
      const elevationRatio = Math.max(0, Math.min(1, (groundAtCam - 0.6) / 7.5));

      let nearbyActiveWorkers = 0;
      const nearbyTalkingCandidates: CharacterEntity[] = [];

      // Animate all articulated 3D character rigs + stride-synced footsteps, activity foley, and voices
      for (let i = 0; i < this.activeWorld.characterRigs.length; i++) {
        const rig = this.activeWorld.characterRigs[i];
        const entity = this.activeWorld.characters[i];
        if (rig && entity) {
          updateProceduralCharacterAnimation(rig, entity);

          const distToCam = Math.hypot(entity.position.x - tx, entity.position.z - tz);
          if (!this.cameraTourMode && entity.health > 0 && distToCam < 34) {
            nearbyActiveWorkers++;
            if (distToCam < 28 && entity.kingdomId === this.currentParams.kingdomId) {
              nearbyTalkingCandidates.push(entity);
            }

            const stepWave = Math.sin(entity.gaitPhase);
            const prevStep = this.charLastStepWave.get(entity.id) ?? 0;
            this.charLastStepWave.set(entity.id, stepWave);

            const isMoving =
              entity.animationState === 'walking' ||
              entity.animationState === 'running' ||
              entity.animationState === 'charging' ||
              entity.animationState === 'retreating';

            if (
              isMoving &&
              ((prevStep <= 0 && stepWave > 0) || (prevStep >= 0 && stepWave < 0))
            ) {
              const surface: FootstepSurface =
                entity.position.y < WATER_LEVEL + 0.52
                  ? 'wet_bank'
                  : Math.hypot(entity.position.x, entity.position.z) < 16.5 ||
                      entity.animationState === 'running'
                    ? 'soil'
                    : 'grass';
              soundEngine.playFootstep(
                surface,
                entity.position.x,
                entity.position.z,
                entity.animationState === 'running' || entity.animationState === 'charging',
              );
            }

            // Work & Hydro-Farming Foley synced to swing/pour peak
            const prevAct = this.charLastActionWave.get(entity.id) ?? 0;
            this.charLastActionWave.set(entity.id, stepWave);
            if (prevAct <= 0.88 && stepWave > 0.88) {
              const st = entity.animationState;
              if (st === 'chopping') {
                soundEngine.playWorkAction('chop', entity.position.x, entity.position.z);
              } else if (st === 'mining') {
                soundEngine.playWorkAction('mine', entity.position.x, entity.position.z);
              } else if (st === 'building') {
                soundEngine.playWorkAction('build', entity.position.x, entity.position.z);
              } else if (st === 'farming') {
                soundEngine.playWorkAction('harvest', entity.position.x, entity.position.z);
              } else if (st === 'crafting') {
                soundEngine.playWorkAction('craft', entity.position.x, entity.position.z);
              } else if (st === 'drawing_water') {
                soundEngine.playHydroAction('draw_water', entity.position.x, entity.position.z);
              } else if (st === 'watering_crops') {
                soundEngine.playHydroAction('pour_water', entity.position.x, entity.position.z);
              } else if (st === 'shooting_bow') {
                soundEngine.playCombatHit('bow', entity.position.x, entity.position.z);
              }
            }
          }

          if (
            (entity.animationState === 'attacking_melee' ||
              entity.animationState === 'attacking_spear') &&
            Math.sin(entity.gaitPhase) > 0.94
          ) {
            this.activeWorld.spawnVfxBurst(
              entity.position.x,
              entity.position.y + 1.1,
              entity.position.z,
              'spark',
            );
          } else if (
            entity.animationState === 'drawing_water' &&
            entity.waterTarget &&
            Math.random() < 0.22
          ) {
            this.activeWorld.spawnVfxBurst(
              entity.waterTarget.x,
              WATER_LEVEL + 0.03,
              entity.waterTarget.z,
              'water_ripple',
            );
          } else if (entity.animationState === 'watering_crops' && Math.random() < 0.42) {
            const pourX = entity.position.x + Math.sin(entity.rotationY) * 0.65;
            const pourZ = entity.position.z + Math.cos(entity.rotationY) * 0.65;
            this.activeWorld.spawnVfxBurst(pourX, entity.position.y + 0.95, pourZ, 'water_drop');
          }
        }
      }

      this.activeWorld.updateLivestockVisuals();

      if (!this.cameraTourMode) {
        const villageBustle =
          Math.max(0, Math.min(1, nearbyActiveWorkers / 9)) *
          Math.max(0.15, 1 - this.cameraRig.distance / 72);
        soundEngine.updateAmbienceTelemetry(
          {
            windIntensity: 0.36 + elevationRatio * 0.45,
            riverProximity,
            riverPan,
            villageBustle,
            elevationRatio,
          },
          this.elapsedSeconds,
        );

        // Ambient Villager Conversations, Greetings & Work Calls
        this.ambientVoiceCooldownSec -= frameDt;
        if (this.ambientVoiceCooldownSec <= 0 && nearbyTalkingCandidates.length > 0) {
          this.ambientVoiceCooldownSec = 2.4 + Math.random() * 2.3;
          const speaker =
            nearbyTalkingCandidates[
              Math.floor(Math.random() * nearbyTalkingCandidates.length)
            ];
          const hasNeighbor = nearbyTalkingCandidates.some(
            (other) =>
              other.id !== speaker.id &&
              Math.hypot(
                other.position.x - speaker.position.x,
                other.position.z - speaker.position.z,
              ) < 7.0,
          );
          const isEffortWork =
            speaker.animationState === 'chopping' ||
            speaker.animationState === 'mining' ||
            speaker.animationState === 'building' ||
            speaker.animationState === 'watering_crops';
          const voiceKind = hasNeighbor
            ? 'greeting'
            : isEffortWork
              ? 'work_call'
              : 'chatter';
          soundEngine.playVillagerVoice(
            voiceKind,
            speaker.position.x,
            speaker.position.z,
            this.hashEntityVoiceSeed(speaker.id),
          );
        }

        // Flying Bird Wingbeats & Soaring Calls when flock passes overhead
        this.birdCheckCooldownSec -= frameDt;
        if (this.birdCheckCooldownSec <= 0 && this.activeWorld.birdPositions.length > 0) {
          this.birdCheckCooldownSec = 3.2 + Math.random() * 2.8;
          let nearestBird = this.activeWorld.birdPositions[0];
          let nearestDist = Infinity;
          for (const bp of this.activeWorld.birdPositions) {
            const d = Math.hypot(bp.x - tx, bp.z - tz);
            if (d < nearestDist) {
              nearestDist = d;
              nearestBird = bp;
            }
          }
          if (nearestDist < 48) {
            soundEngine.playBirdFlight(
              this.currentParams.regionId,
              nearestBird.x,
              nearestBird.z,
              true,
            );
          }
        }

        // Domestic Pasture Livestock Sounds
        this.livestockCheckCooldownSec -= frameDt;
        if (this.livestockCheckCooldownSec <= 0 && this.activeWorld.livestock.length > 0) {
          this.livestockCheckCooldownSec = 4.2 + Math.random() * 3.6;
          const nearAnimals = this.activeWorld.livestock.filter(
            (a) => Math.hypot(a.position.x - tx, a.position.z - tz) < 32,
          );
          if (nearAnimals.length > 0) {
            const picked = nearAnimals[Math.floor(Math.random() * nearAnimals.length)];
            soundEngine.playLivestockSound(
              picked.kind,
              picked.position.x,
              picked.position.z,
            );
          }
        }
      } else {
        soundEngine.updateAmbienceTelemetry(
          {
            windIntensity: 0.42,
            riverProximity: 0.25,
            riverPan: 0,
            villageBustle: 0.2,
            elevationRatio: 0.25,
          },
          this.elapsedSeconds,
        );
      }

      if (this.moveMarkerTimer > 0) {
        this.moveMarkerTimer = Math.max(0, this.moveMarkerTimer - frameDt);
        const s = 0.7 + (1.1 - this.moveMarkerTimer) * 0.9;
        this.activeWorld.moveMarkerMesh.scale.set(s, 1, s);
        if (this.moveMarkerTimer <= 0) {
          this.activeWorld.moveMarkerMesh.visible = false;
        }
      }

      if (this.selectedEntityIds.length > 0) {
        this.updateSelectionRings();
      }

      // Throttled HUD economy & entity sync (~3.3Hz during active play, never 60Hz)
      if (!this.cameraTourMode) {
        this.hudSyncAccumulator += frameDt;
        if (this.hudSyncAccumulator >= 0.3) {
          this.hudSyncAccumulator = 0;
          this.emitEconomySnapshot();
        }
      }
    }

    if (this.cameraTourMode) {
      this.tourAngle += camDt * 0.11;
      this.cameraRig.desiredTargetX = Math.sin(this.tourAngle * 0.7) * 5.5;
      this.cameraRig.desiredTargetZ = 1.0 + Math.cos(this.tourAngle * 0.5) * 4.5;
      this.cameraRig.desiredYaw = this.tourAngle;
      this.cameraRig.desiredDistance = 42 + Math.sin(this.tourAngle * 0.9) * 4.5;
    } else if (!this.isPaused) {
      this.applyKeyboardCameraControls(camDt);
    }

    const pose = stepCameraRig(this.cameraRig, camDt, region, this.currentParams.seed);
    this.camera.position.set(pose.eyeX, pose.eyeY, pose.eyeZ);
    this.camera.lookAt(pose.lookX, pose.lookY, pose.lookZ);

    this.sunLight.position.set(pose.lookX + 62, pose.lookY + 40, pose.lookZ + 46);
    this.sunLight.target.position.set(pose.lookX, pose.lookY, pose.lookZ);
    this.sunLight.target.updateMatrixWorld();

    this.rimLight.position.set(pose.lookX - 48, pose.lookY + 30, pose.lookZ - 40);
    this.rimLight.target.position.set(pose.lookX, pose.lookY, pose.lookZ);
    this.rimLight.target.updateMatrixWorld();

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private applyKeyboardCameraControls(dt: number): void {
    const panRate = (26 + this.cameraRig.distance * 0.42) * this.panSpeedMultiplier * dt;
    let right = 0;
    let forward = 0;

    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) forward += panRate;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) forward -= panRate;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) right += panRate;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) right -= panRate;

    if (right !== 0 || forward !== 0) {
      panCameraLocal(this.cameraRig, right, forward);
    }

    const rotRate = 1.65 * dt;
    if (this.keysHeld.has('KeyQ')) rotateCamera(this.cameraRig, -rotRate);
    if (this.keysHeld.has('KeyE')) rotateCamera(this.cameraRig, rotRate);

    const zoomRate = 32 * dt;
    if (this.keysHeld.has('Equal') || this.keysHeld.has('NumpadAdd')) {
      zoomCamera(this.cameraRig, -zoomRate);
    }
    if (this.keysHeld.has('Minus') || this.keysHeld.has('NumpadSubtract')) {
      zoomCamera(this.cameraRig, zoomRate);
    }
  }

  private updateRaycasterFromClient(clientX: number, clientY: number): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    return true;
  }

  private raycastTerrainPoint(clientX: number, clientY: number): { x: number; z: number } | null {
    if (!this.activeWorld || !this.updateRaycasterFromClient(clientX, clientY)) return null;
    const hits = this.raycaster.intersectObject(this.activeWorld.terrainMesh, false);
    if (hits.length > 0) {
      return { x: hits[0].point.x, z: hits[0].point.z };
    }
    return null;
  }

  private raycastEntityHit(clientX: number, clientY: number): SelectableEntity | null {
    if (!this.activeWorld || !this.updateRaycasterFromClient(clientX, clientY)) return null;
    const hits = this.raycaster.intersectObjects(this.activeWorld.raycastTargets, false);
    if (hits.length > 0) {
      const entityId = hits[0].object.userData?.entityId as string | undefined;
      if (entityId) {
        return this.activeWorld.entitiesById.get(entityId) ?? null;
      }
    }
    return null;
  }

  private handlePrimaryCanvasClick(
    clientX: number,
    clientY: number,
    shiftKey: boolean,
    isTouchTap: boolean,
  ): void {
    if (!this.activeWorld || this.cameraTourMode) return;

    // 1. Building Placement Mode
    if (this.placementPreview.active && this.placementPreview.archetype) {
      const pt = this.raycastTerrainPoint(clientX, clientY);
      if (pt) {
        const distFromPrev = Math.hypot(
          pt.x - this.placementPreview.x,
          pt.z - this.placementPreview.z,
        );
        this.updatePlacementPreviewAt(
          this.placementPreview.archetype,
          pt.x,
          pt.z,
          this.placementPreview.rotationY,
        );
        // On desktop mouse click, place immediately; on touch tap, first tap positions ghost and second tap near ghost (or HUD Confirm button) places!
        if (!isTouchTap || (distFromPrev < 2.6 && this.placementPreview.valid)) {
          this.confirmPlacementAtCurrentPreview(shiftKey);
        }
      }
      return;
    }

    // 2. Explicit Move / Assign / Attack / Defend Command Modes (Mobile & HUD Button Workflow)
    const selectedVillagers = this.getSelectedVillagers();
    const hasMilitary = selectedVillagers.some((u) => u.isMilitary);

    if (this.touchCommandMode === 'attack' && hasMilitary) {
      const hitEntity = this.raycastEntityHit(clientX, clientY);
      if (hitEntity && (hitEntity.category === 'character' || hitEntity.category === 'building')) {
        this.commandSelectedMilitaryAttack(hitEntity as CharacterEntity | BuildingEntity);
      }
      this.setTouchCommandMode('select');
      return;
    }

    if (this.touchCommandMode === 'move' && selectedVillagers.length > 0) {
      const pt = this.raycastTerrainPoint(clientX, clientY);
      if (pt) {
        if (hasMilitary) {
          this.commandSelectedMilitaryMove(pt.x, pt.z);
        } else {
          this.commandSelectedVillagersMove(pt.x, pt.z);
        }
      }
      this.setTouchCommandMode('select');
      return;
    }

    if (this.touchCommandMode === 'assign' && selectedVillagers.length > 0 && this.economyRuntime) {
      const hitEntity = this.raycastEntityHit(clientX, clientY);
      if (hitEntity && hitEntity.category !== 'character') {
        const msg = commandVillagersToEntity(selectedVillagers, hitEntity, this.economyRuntime);
        if (msg) {
          pushEconomyNotification(this.economyRuntime, `cmd_${hitEntity.id}`, 'info', msg, 1);
          soundEngine.playVillagerVoice(
            'command',
            selectedVillagers[0].position.x,
            selectedVillagers[0].position.z,
            this.hashEntityVoiceSeed(selectedVillagers[0].id),
          );
          this.flushEconomyChangesImmediate();
        }
      }
      this.setTouchCommandMode('select');
      return;
    }

    // 3. Standard Entity Selection (Shift+Click toggles multi-villager selection)
    const hitEntity = this.raycastEntityHit(clientX, clientY);
    if (hitEntity) {
      this.selectEntityById(hitEntity.id, shiftKey);
      return;
    }
    this.clearSelection();
  }

  private handleSecondaryContextCommand(clientX: number, clientY: number): void {
    if (!this.activeWorld || !this.economyRuntime || this.cameraTourMode) return;

    if (this.placementPreview.active) {
      this.startBuildingPlacement(null);
      return;
    }

    const selectedVillagers = this.getSelectedVillagers();
    if (selectedVillagers.length === 0) return;

    const hitEntity = this.raycastEntityHit(clientX, clientY);
    const hasMilitary = selectedVillagers.some((u) => u.isMilitary);

    // If military units selected and clicked an enemy or valid combat target, order attack!
    if (hasMilitary && hitEntity) {
      if (hitEntity.category === 'character' || hitEntity.category === 'building') {
        this.commandSelectedMilitaryAttack(hitEntity as CharacterEntity | BuildingEntity);
        return;
      }
    }

    if (hitEntity && hitEntity.category !== 'character') {
      const msg = commandVillagersToEntity(selectedVillagers, hitEntity, this.economyRuntime);
      if (msg) {
        pushEconomyNotification(this.economyRuntime, `rcmd_${hitEntity.id}`, 'info', msg, 1);
        soundEngine.playVillagerVoice(
          'command',
          selectedVillagers[0].position.x,
          selectedVillagers[0].position.z,
          this.hashEntityVoiceSeed(selectedVillagers[0].id),
        );
        this.flushEconomyChangesImmediate();
      }
      return;
    }

    const pt = this.raycastTerrainPoint(clientX, clientY);
    if (pt) {
      if (hasMilitary) {
        this.commandSelectedMilitaryMove(pt.x, pt.z);
      } else {
        this.commandSelectedVillagersMove(pt.x, pt.z);
      }
    }
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'KeyR' && this.placementPreview.active) {
      e.preventDefault();
      this.rotatePlacementPreview(Math.PI / 4);
      return;
    }
    this.keysHeld.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private clearInputs = (): void => {
    this.keysHeld.clear();
    this.activeMouseButton = null;
    this.activeTouches.clear();
  };

  private onMouseDown = (e: MouseEvent): void => {
    soundEngine.unlockAndStartMusic();
    if (this.cameraTourMode) return;
    this.activeMouseButton = e.button;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.lastPointerPos = { x: e.clientX, y: e.clientY };
    this.hasDragged = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.cameraTourMode) return;

    // Live 3D ghost tracking when in placement mode and not dragging camera
    if (
      this.placementPreview.active &&
      this.placementPreview.archetype &&
      this.activeMouseButton === null
    ) {
      const now = performance.now();
      if (now - this.lastHoverRaycastMs >= 32) {
        this.lastHoverRaycastMs = now;
        const pt = this.raycastTerrainPoint(e.clientX, e.clientY);
        if (pt) {
          this.updatePlacementPreviewAt(
            this.placementPreview.archetype,
            pt.x,
            pt.z,
            this.placementPreview.rotationY,
          );
        }
      }
    }

    if (this.activeMouseButton === null) return;
    const dx = e.clientX - this.lastPointerPos.x;
    const dy = e.clientY - this.lastPointerPos.y;
    this.lastPointerPos = { x: e.clientX, y: e.clientY };

    if (
      Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y) > 5
    ) {
      this.hasDragged = true;
    }

    if ((this.activeMouseButton === 2 || this.activeMouseButton === 1) && this.hasDragged) {
      rotateCamera(this.cameraRig, -dx * 0.0065);
    } else if (this.activeMouseButton === 0 && this.hasDragged) {
      const panFactor = this.cameraRig.distance * 0.0021 * this.panSpeedMultiplier;
      panCameraLocal(this.cameraRig, -dx * panFactor, dy * panFactor);
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.cameraTourMode) return;
    if (!this.hasDragged) {
      if (this.activeMouseButton === 0) {
        this.handlePrimaryCanvasClick(e.clientX, e.clientY, e.shiftKey, false);
      } else if (this.activeMouseButton === 2) {
        this.handleSecondaryContextCommand(e.clientX, e.clientY);
      }
    }
    this.activeMouseButton = null;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.cameraTourMode) return;
    e.preventDefault();
    zoomCamera(this.cameraRig, e.deltaY * 0.035);
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onTouchStart = (e: TouchEvent): void => {
    soundEngine.unlockAndStartMusic();
    if (this.cameraTourMode) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (this.activeTouches.size === 1) {
      const first = [...this.activeTouches.values()][0];
      this.pointerDownPos = { x: first.x, y: first.y };
      this.hasDragged = false;
    } else if (this.activeTouches.size >= 2) {
      const pts = [...this.activeTouches.values()];
      this.prevPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      this.prevPinchAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      this.hasDragged = true;
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (this.cameraTourMode) return;
    e.preventDefault();

    if (this.activeTouches.size === 1 && e.touches.length === 1) {
      const t = e.touches[0];
      const prev = this.activeTouches.get(t.identifier);
      if (prev) {
        const dx = t.clientX - prev.x;
        const dy = t.clientY - prev.y;
        if (Math.hypot(t.clientX - this.pointerDownPos.x, t.clientY - this.pointerDownPos.y) > 7) {
          this.hasDragged = true;
        }
        const panFactor = this.cameraRig.distance * 0.0024 * this.panSpeedMultiplier;
        panCameraLocal(this.cameraRig, -dx * panFactor, dy * panFactor);
        this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    } else if (e.touches.length >= 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      this.activeTouches.set(t0.identifier, { x: t0.clientX, y: t0.clientY });
      this.activeTouches.set(t1.identifier, { x: t1.clientX, y: t1.clientY });

      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);

      if (this.prevPinchDist > 0) {
        const pinchDelta = this.prevPinchDist - dist;
        zoomCamera(this.cameraRig, pinchDelta * 0.14);

        let angleDelta = angle - this.prevPinchAngle;
        if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
        if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
        rotateCamera(this.cameraRig, angleDelta * 1.15);
      }
      this.prevPinchDist = dist;
      this.prevPinchAngle = angle;
      this.hasDragged = true;
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (this.cameraTourMode) return;
    if (this.activeTouches.size === 1 && !this.hasDragged && e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      this.handlePrimaryCanvasClick(t.clientX, t.clientY, false, true);
    }
    for (let i = 0; i < e.changedTouches.length; i++) {
      this.activeTouches.delete(e.changedTouches[i].identifier);
    }
    if (this.activeTouches.size < 2) {
      this.prevPinchDist = 0;
    }
  };

  private bindInputListeners(): void {
    const canvas = this.renderer.domElement;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearInputs);
    window.addEventListener('resize', this.handleResize);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }

    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);

    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
    canvas.addEventListener('touchcancel', this.onTouchEnd);
  }

  // Phase 4 Diplomacy, Intelligence & Difficulty Public API Methods
  public setAIDifficulty(difficulty: AIDifficulty): void {
    this.aiKingdomManager.difficulty = difficulty;
    this.flushEconomyChangesImmediate();
  }

  public getAIDifficulty(): AIDifficulty {
    return this.aiKingdomManager.difficulty;
  }

  public dispatchDiplomaticEnvoy(targetId: KingdomId, goldAmount = 100): { ok: boolean; reason: string } {
    if (!this.economyRuntime) return { ok: false, reason: 'World not loaded.' };
    const res = sendDiplomaticGift(
      this.diplomacyState,
      this.economyRuntime,
      this.currentParams.kingdomId,
      targetId,
      goldAmount,
    );
    if (res.ok) {
      soundEngine.playAlert('peace');
      if (res.event) pushWorldEvent(this.worldEventState, res.event);
      updateAllKingdomIntelligence(
        this.aiKingdomManager,
        this.economyRuntime,
        this.diplomacyState,
        this.worldEventState.events,
      );
      this.flushEconomyChangesImmediate();
    }
    return { ok: res.ok, reason: res.reason };
  }

  public proposeDiplomaticTreaty(
    targetId: KingdomId,
    kind: TreatyKind,
  ): { accepted: boolean; reason: string } {
    const result = evaluateProposalAcceptance(
      this.diplomacyState,
      this.currentParams.kingdomId,
      targetId,
      kind,
    );
    if (result.accepted) {
      soundEngine.playAlert('peace');
      const evt = addDiplomaticTreaty(
        this.diplomacyState,
        this.currentParams.kingdomId,
        targetId,
        kind,
        300,
        undefined,
        this.economyRuntime?.elapsedSeconds ?? 0,
      );
      pushWorldEvent(this.worldEventState, evt);
      this.flushEconomyChangesImmediate();
    }
    return result;
  }

  public proposePeace(targetId: KingdomId): { accepted: boolean; reason: string } {
    const myUnits = this.economyRuntime?.characters.filter(
      (c) => c.kingdomId === this.currentParams.kingdomId && c.isMilitary && c.health > 0,
    ) ?? [];
    const targetUnits = this.economyRuntime?.characters.filter(
      (c) => c.kingdomId === targetId && c.isMilitary && c.health > 0,
    ) ?? [];
    const res = proposePeaceTreaty(
      this.diplomacyState,
      this.currentParams.kingdomId,
      targetId,
      estimateMilitaryPower(myUnits),
      estimateMilitaryPower(targetUnits),
      this.economyRuntime?.elapsedSeconds ?? 0,
    );
    if (res.accepted && res.event) {
      soundEngine.playAlert('peace');
      pushWorldEvent(this.worldEventState, res.event);
      this.flushEconomyChangesImmediate();
    }
    return { accepted: res.accepted, reason: res.reason };
  }

  public declareWar(targetId: KingdomId): void {
    const evt = declareWarBetweenKingdoms(
      this.diplomacyState,
      this.currentParams.kingdomId,
      targetId,
      'sovereign war declaration',
      this.economyRuntime?.elapsedSeconds ?? 0,
    );
    if (evt) {
      soundEngine.playAlert('war');
      pushWorldEvent(this.worldEventState, evt);
    }
    this.flushEconomyChangesImmediate();
  }

  private hashEntityVoiceSeed(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 97;
  }

  public getAIKingdomsData(): Record<KingdomId, AIKingdomRuntime> {
    return this.aiKingdomManager.kingdoms;
  }

  public getDiplomacyRelations(): Record<KingdomId, DiplomaticRelation> {
    return this.diplomacyState.relations[this.currentParams.kingdomId] || ({} as any);
  }

  public getWorldEvents(): WorldEventItem[] {
    return this.worldEventState.events;
  }

  public dispose(): void {
    this.disposed = true;
    if (this.isTimerHandle) {
      window.clearTimeout(this.frameHandle);
    } else {
      window.cancelAnimationFrame(this.frameHandle);
    }

    const canvas = this.renderer.domElement;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearInputs);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();

    canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('contextmenu', this.onContextMenu);

    canvas.removeEventListener('touchstart', this.onTouchStart);
    canvas.removeEventListener('touchmove', this.onTouchMove);
    canvas.removeEventListener('touchend', this.onTouchEnd);
    canvas.removeEventListener('touchcancel', this.onTouchEnd);

    if (this.activeWorld) {
      this.activeWorld.dispose();
      this.activeWorld = null;
    }
    this.economyRuntime = null;
    this.textures.dispose();
    this.envTexture?.dispose();
    this.renderer.dispose();
  }
}
