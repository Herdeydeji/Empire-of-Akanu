import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Coins,
  Compass,
  Crown,
  Eye,
  FlaskConical,
  Hammer,
  Handshake,
  Home,
  LayoutGrid,
  Menu,
  Pause,
  RotateCcw,
  RotateCw,
  Save,
  Scale,
  ScrollText,
  Settings,
  Shield,
  SlidersHorizontal,
  Swords,
  Users,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { BUILDING_CATALOG, KINGDOM_ECONOMIC_BONUSES } from '../config/economy';
import { KINGDOMS } from '../config/kingdoms';
import { KINGDOM_MILITARY_BONUSES, MILITARY_UNIT_CATALOG } from '../config/military';
import { REGIONS } from '../config/regions';
import {
  AIKingdomRuntime,
  BuildingArchetype,
  BuildingEntity,
  CharacterEntity,
  CivilianRole,
  DiplomaticRelation,
  EconomyNotification,
  KingdomId,
  MilitaryFormationType,
  MilitaryStance,
  MilitaryUnitClass,
  NavigationTab,
  PlacementPreviewState,
  ProgressionStage,
  ResourceKey,
  SaveGameData,
  SelectableEntity,
  TouchCommandMode,
  TreatyKind,
  WorldEventItem,
} from '../types/game';
import { ConstructionPanel } from './ConstructionPanel';
import { DiplomacyPanel } from './DiplomacyPanel';
import { EconomyPanel } from './EconomyPanel';
import { KingdomEmblem, ResourceIcon } from './KingdomEmblem';
import { KingdomOverviewPanel } from './KingdomOverviewPanel';
import { SelectionInspector } from './SelectionInspector';

interface GameHUDProps {
  gameData: SaveGameData;
  selectedEntities: SelectableEntity[];
  allEntities: SelectableEntity[];
  placementPreview: PlacementPreviewState;
  touchCommandMode: TouchCommandMode;
  notifications: EconomyNotification[];
  audioMuted: boolean;
  saveToast: string | null;
  onSelectEntityById: (id: string | null, additive?: boolean) => void;
  onSelectVillagersByRole: (filter: 'all' | 'idle' | CivilianRole) => void;
  onSelectMilitaryUnits?: (filter?: 'all' | MilitaryUnitClass) => void;
  onFocusEntity: (id: string) => void;
  onFocusSettlement: () => void;
  onCameraZoom: (delta: number) => void;
  onCameraRotate: (deltaYaw: number) => void;
  onCameraPreset?: (preset: 'settlement' | 'overview' | 'battle') => void;
  onAssignOccupation: (role: CivilianRole, preferredResource?: ResourceKey | null) => void;
  onAdjustWorkforce: (role: CivilianRole, delta: 1 | -1) => void;
  onCancelVillagerTask: () => void;
  onSetTouchCommandMode: (mode: TouchCommandMode) => void;
  onDispatchWorkerToEntity: (targetId: string) => void;
  onStartBuildingPlacement: (archetype: BuildingArchetype | null) => void;
  onRotatePlacementPreview: () => void;
  onConfirmPlacement: () => void;
  onCancelConstruction: (buildingId: string) => void;
  // Phase 3 Military Callbacks
  onRecruitUnit?: (buildingId: string, unitClass: MilitaryUnitClass) => void;
  onCancelRecruitment?: (buildingId: string, index: number) => void;
  onSetFormation?: (formation: MilitaryFormationType) => void;
  onSetStance?: (stance: MilitaryStance) => void;
  onMilitaryAttack?: () => void;
  onDismissNotification: (id: string) => void;
  onSaveGame: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onOpenPause: () => void;
  onChangeRegionLive: (regionId: SaveGameData['regionId']) => void;
  // Phase 4 Diplomacy & Intelligence Callbacks
  aiKingdomsData?: Record<KingdomId, AIKingdomRuntime>;
  diplomacyRelations?: Record<KingdomId, DiplomaticRelation>;
  worldEventsData?: WorldEventItem[];
  onProposeTreaty?: (targetId: KingdomId, kind: TreatyKind) => { accepted: boolean; reason: string };
  onSendEnvoy?: (targetId: KingdomId) => { ok: boolean; reason: string };
  onProposePeace?: (targetId: KingdomId) => { accepted: boolean; reason: string };
  onDeclareWar?: (targetId: KingdomId) => void;
}

const NAV_TABS: {
  id: NavigationTab;
  label: string;
  shortLabel: string;
  renderIcon: () => React.ReactNode;
}[] = [
  { id: 'kingdom', label: 'Economy', shortLabel: 'Econ', renderIcon: () => <Coins className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
  { id: 'construction', label: 'Construction', shortLabel: 'Build', renderIcon: () => <Hammer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
  { id: 'military', label: 'Military', shortLabel: 'Army', renderIcon: () => <Swords className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
  { id: 'research', label: 'Doctrine', shortLabel: 'Trait', renderIcon: () => <FlaskConical className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
  { id: 'diplomacy', label: 'Diplomacy', shortLabel: 'Pacts', renderIcon: () => <Handshake className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
  { id: 'trade', label: 'Trade', shortLabel: 'Trade', renderIcon: () => <Scale className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> },
];

const REALM_STAGES: { stage: ProgressionStage; requirement: string }[] = [
  { stage: 'Village', requirement: 'Founding camp & gatherers' },
  { stage: 'Settlement', requirement: '6+ citizens & core granary' },
  { stage: 'Town', requirement: '12+ citizens & 4+ completed structures' },
  { stage: 'Fortified City', requirement: '18+ citizens & martial garrison' },
  { stage: 'Kingdom', requirement: '24+ citizens & Royal Palace built' },
  { stage: 'Empire', requirement: '34+ citizens, palace & regional hegemony' },
];

export const GameHUD: React.FC<GameHUDProps> = ({
  gameData,
  selectedEntities,
  allEntities,
  placementPreview,
  touchCommandMode,
  notifications,
  audioMuted,
  saveToast,
  onSelectEntityById,
  onSelectVillagersByRole,
  onFocusEntity,
  onFocusSettlement,
  onCameraZoom,
  onCameraRotate,
  onCameraPreset,
  onAssignOccupation,
  onAdjustWorkforce,
  onCancelVillagerTask,
  onSetTouchCommandMode,
  onDispatchWorkerToEntity,
  onStartBuildingPlacement,
  onRotatePlacementPreview,
  onConfirmPlacement,
  onCancelConstruction,
  onRecruitUnit,
  onCancelRecruitment,
  onSetFormation,
  onSetStance,
  onSelectMilitaryUnits,
  onDismissNotification,
  onSaveGame,
  onToggleMute,
  onOpenSettings,
  onOpenPause,
  onChangeRegionLive,
  aiKingdomsData,
  diplomacyRelations,
  worldEventsData,
  onProposeTreaty,
  onSendEnvoy,
  onProposePeace,
  onDeclareWar,
}) => {
  const [activeTab, setActiveTab] = useState<NavigationTab | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [showOverview, setShowOverview] = useState<boolean>(false);
  const [activeCamPreset, setActiveCamPreset] = useState<'settlement' | 'overview' | 'battle'>('settlement');
  const [mobileHubOpen, setMobileHubOpen] = useState<boolean>(false);
  const [mobileHubTab, setMobileHubTab] = useState<NavigationTab>('kingdom');
  const [mobileQuickOpen, setMobileQuickOpen] = useState<boolean>(false);
  const [mobileStatsExpanded, setMobileStatsExpanded] = useState<boolean>(false);

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyB') {
        setActiveTab((prev) => (prev === 'construction' ? null : 'construction'));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const kingdom = KINGDOMS[gameData.kingdomId];
  const region = REGIONS[gameData.regionId];
  const villagers = allEntities.filter(
    (e): e is CharacterEntity =>
      e.category === 'character' && e.kingdomId === gameData.kingdomId && !e.isMilitary,
  );
  const playerArmyCount = allEntities.filter(
    (e) => e.category === 'character' && e.kingdomId === gameData.kingdomId && Boolean((e as CharacterEntity).militaryClass),
  ).length;
  const completedBuildings = allEntities.filter(
    (e): e is BuildingEntity =>
      e.category === 'building' &&
      e.kingdomId === gameData.kingdomId &&
      e.constructionState === 'completed',
  );
  const completedMarkets = completedBuildings.filter((b) => b.archetype === 'market_courtyard').length;
  const hasCompletedPalace = completedBuildings.some((b) => b.archetype === 'royal_palace');
  const activeTraders = villagers.filter((v) => v.role === 'Trader').length;

  const isLowFoodAlert = gameData.population.foodSatisfaction < 50;
  const atWarCount = Object.values(diplomacyRelations || {}).filter((rel) => rel.state === 'at_war').length;

  const currentStageIndex = Math.max(
    0,
    REALM_STAGES.findIndex((s) => s.stage === gameData.progressionStage),
  );

  const handleCycleVillager = () => {
    if (villagers.length === 0) return;
    setActiveTab(null);
    setMobileHubOpen(false);
    setMobileQuickOpen(false);
    const currentId = selectedEntities[0]?.id;
    const currentIdx = currentId
      ? villagers.findIndex((v) => v.id === currentId)
      : -1;
    const next = villagers[(currentIdx + 1) % villagers.length];
    onSelectEntityById(next.id, false);
    onFocusEntity(next.id);
  };

  const toggleTab = (tab: NavigationTab) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const handleBeginPlacement = (archetype: BuildingArchetype) => {
    onStartBuildingPlacement(archetype);
    // Collapse construction drawer & mobile hub automatically for clear 3D terrain visibility
    setActiveTab(null);
    setMobileHubOpen(false);
  };

  const handlePresetClick = (preset: 'settlement' | 'overview' | 'battle') => {
    setActiveCamPreset(preset);
    if (onCameraPreset) {
      onCameraPreset(preset);
    } else if (preset === 'settlement') {
      onFocusSettlement();
    }
  };

  const renderDepartmentContent = (tab: NavigationTab, isMobileHub: boolean) => {
    const closeAfterWorldAction = () => {
      if (isMobileHub) {
        setMobileHubOpen(false);
      } else {
        setActiveTab(null);
      }
    };

    if (tab === 'kingdom') {
      return (
        <EconomyPanel
          gameData={gameData}
          allEntities={allEntities}
          onAdjustWorkforce={onAdjustWorkforce}
          onSelectVillagersByRole={(role) => {
            closeAfterWorldAction();
            onSelectVillagersByRole(role);
          }}
          onSelectAndFocusEntity={(id) => {
            closeAfterWorldAction();
            onSelectEntityById(id, false);
            onFocusEntity(id);
          }}
          onChangeRegionLive={onChangeRegionLive}
        />
      );
    }

    if (tab === 'construction') {
      return (
        <ConstructionPanel
          kingdomId={gameData.kingdomId}
          resources={gameData.resources}
          activePlacementArchetype={placementPreview.archetype}
          onStartPlacement={handleBeginPlacement}
        />
      );
    }

    if (tab === 'military') {
      const militaryUnits = allEntities.filter(
        (e): e is CharacterEntity =>
          e.category === 'character' &&
          e.kingdomId === gameData.kingdomId &&
          Boolean(e.militaryClass),
      );
      const militaryBuildings = allEntities.filter(
        (e): e is BuildingEntity =>
          e.category === 'building' &&
          e.kingdomId === gameData.kingdomId &&
          [
            'barracks_compound',
            'archery_grounds',
            'cavalry_stables',
            'weapon_workshop',
            'royal_palace',
          ].includes(e.archetype),
      );
      const totalQueued = militaryBuildings.reduce(
        (acc, b) => acc + (b.recruitmentQueue?.length || 0),
        0,
      );
      const hourlyFoodUpkeep = militaryUnits.reduce((acc, u) => {
        const bp = u.militaryClass ? MILITARY_UNIT_CATALOG[u.militaryClass] : null;
        return acc + (bp?.upkeepPerMinute?.food ?? 0) * 60;
      }, 0);
      const hourlyGoldUpkeep = militaryUnits.reduce((acc, u) => {
        const bp = u.militaryClass ? MILITARY_UNIT_CATALOG[u.militaryClass] : null;
        return acc + (bp?.upkeepPerMinute?.gold ?? 0) * 60;
      }, 0);

      return (
        <div className="space-y-3 text-xs">
          {KINGDOM_MILITARY_BONUSES[gameData.kingdomId] && (
            <div className="rounded bg-[#292017] border border-[#A77A32]/60 p-2.5 flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#D4A64A] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="font-semibold text-[#F2E8D5]">
                  {kingdom.name} Doctrine: {KINGDOM_MILITARY_BONUSES[gameData.kingdomId].name}
                </div>
                <div className="text-[#B8AA96] text-[11px] leading-relaxed mt-0.5">
                  {KINGDOM_MILITARY_BONUSES[gameData.kingdomId].summary}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#292017]/80 border border-[#76513A]/60 rounded p-2.5">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <div>
                  <span className="text-[#B8AA96] uppercase text-[10px] tracking-wider block">
                    Standing Soldiers
                  </span>
                  <span className="font-mono-num font-bold text-base text-[#F2E8D5]">
                    {militaryUnits.length}
                  </span>
                </div>
                <div className="border-l border-[#76513A]/60 pl-3">
                  <span className="text-[#B8AA96] uppercase text-[10px] tracking-wider block">
                    Queued
                  </span>
                  <span className="font-mono-num font-bold text-sm text-[#D4A64A]">
                    {totalQueued}
                  </span>
                </div>
                <div className="border-l border-[#76513A]/60 pl-3">
                  <span className="text-[#B8AA96] uppercase text-[10px] tracking-wider block">
                    Hourly Upkeep
                  </span>
                  <span className="font-mono-num font-bold text-sm text-[#fca5a5]">
                    -{Math.round(hourlyFoodUpkeep)} Food / -{Math.round(hourlyGoldUpkeep)} Gold
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  closeAfterWorldAction();
                  onSelectMilitaryUnits?.('all');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded bg-[#D4A64A] hover:bg-[#e2b65a] text-[#171512] font-semibold text-xs cursor-pointer shadow-sm transition-colors duration-150 whitespace-nowrap min-h-[44px] sm:min-h-0"
              >
                <Swords className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Select Entire Army</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {(
                [
                  'infantry',
                  'spearman',
                  'archer',
                  'cavalry',
                  'royal_guard',
                  'scout',
                  'siege_engineer',
                  'commander',
                ] as MilitaryUnitClass[]
              ).map((uClass) => {
                const count = militaryUnits.filter((u) => u.militaryClass === uClass).length;
                const bp = MILITARY_UNIT_CATALOG[uClass];
                return (
                  <button
                    key={uClass}
                    type="button"
                    onClick={() => {
                      closeAfterWorldAction();
                      onSelectMilitaryUnits?.(uClass);
                    }}
                    className={`p-2 rounded text-left border transition-colors duration-150 cursor-pointer min-h-[44px] ${
                      count > 0
                        ? 'bg-[#292017] border-[#A77A32] hover:border-[#D4A64A]'
                        : 'bg-[#171512] border-[#76513A]/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-[#F2E8D5] truncate">{bp.name}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono-num text-[11px] font-bold shrink-0 ${
                          count > 0 ? 'bg-[#D4A64A] text-[#171512]' : 'bg-[#292017] text-[#B8AA96]'
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#B8AA96] mt-0.5 line-clamp-1 font-mono-num">
                      {bp.tacticalRole} · Atk {bp.attackDamage} · HP {bp.health}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <div className="text-[11px] font-semibold text-[#D4A64A] uppercase tracking-wider mb-1.5">
                Military Facilities & Production Lines
              </div>
              {militaryBuildings.length === 0 ? (
                <div className="p-3 rounded bg-[#292017]/55 border border-[#76513A]/50 text-[#B8AA96] text-center">
                  No dedicated military buildings constructed yet. Open{' '}
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobileHub) {
                        setMobileHubTab('construction');
                      } else {
                        setActiveTab('construction');
                      }
                    }}
                    className="text-[#D4A64A] underline font-medium cursor-pointer"
                  >
                    Construction
                  </button>{' '}
                  to place Barracks, Archery Grounds, or Cavalry Stables.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {militaryBuildings.map((b) => (
                    <div
                      key={b.id}
                      className="p-2.5 rounded bg-[#292017]/80 border border-[#76513A]/60 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[#F2E8D5] text-xs truncate">{b.name}</div>
                        <div className="text-[10px] text-[#B8AA96] font-mono-num">
                          Status: {b.constructionState === 'completed' ? 'Active' : 'Under Construction'} · Queued:{' '}
                          {b.recruitmentQueue?.length || 0}/5
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          closeAfterWorldAction();
                          onSelectEntityById(b.id, false);
                          onFocusEntity(b.id);
                        }}
                        className="px-3 py-1.5 rounded bg-[#171512] hover:bg-[#362a1e] border border-[#76513A] text-[11px] text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[40px] sm:min-h-0"
                      >
                        Manage
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (tab === 'research') {
      return (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded bg-[#292017]/80 border border-[#76513A]/60 p-3 space-y-1">
              <div className="inline-flex items-center gap-1.5 font-semibold text-[#D4A64A]">
                <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{kingdom.name} Economic Doctrine</span>
              </div>
              <p className="text-[#F2E8D5] leading-relaxed">
                {KINGDOM_ECONOMIC_BONUSES[gameData.kingdomId].summary}
              </p>
            </div>

            <div className="rounded bg-[#292017]/80 border border-[#76513A]/60 p-3 space-y-1">
              <div className="inline-flex items-center gap-1.5 font-semibold text-[#D4A64A]">
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  Martial Tradition: {KINGDOM_MILITARY_BONUSES[gameData.kingdomId].name}
                </span>
              </div>
              <p className="text-[#F2E8D5] leading-relaxed">
                {KINGDOM_MILITARY_BONUSES[gameData.kingdomId].summary}
              </p>
            </div>
          </div>

          <div className="rounded bg-[#292017]/65 border border-[#76513A]/55 p-3 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 font-semibold text-[#D4A64A]">
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{region.name} Environmental Adaptation</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-[#B8AA96]">
              {region.strategicTraits.map((trait) => (
                <div
                  key={trait}
                  className="rounded bg-[#171512] border border-[#76513A]/45 px-2.5 py-1.5 text-[#F2E8D5]"
                >
                  {trait}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded bg-[#292017]/65 border border-[#76513A]/55 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#D4A64A]">
                Realm Ascension Track (Current: {gameData.progressionStage})
              </span>
              <span className="font-mono-num text-[11px] text-[#B8AA96]">
                {gameData.population.current} Citizens · {completedBuildings.length} Completed Buildings ·{' '}
                {hasCompletedPalace ? 'Royal Palace Built' : 'Royal Palace Pending'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
              {REALM_STAGES.map((item, idx) => {
                const reached = idx <= currentStageIndex;
                const current = idx === currentStageIndex;
                return (
                  <div
                    key={item.stage}
                    className={`rounded border p-2 space-y-0.5 ${
                      current
                        ? 'bg-[#292017] border-[#D4A64A] text-[#F2E8D5]'
                        : reached
                          ? 'bg-[#171512] border-[#4ca86b]/55 text-[#d7f7e1]'
                          : 'bg-[#110f0d] border-[#76513A]/40 text-[#B8AA96]'
                    }`}
                  >
                    <div className="flex items-center gap-1 font-semibold text-[11px]">
                      {reached ? (
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            current ? 'text-[#D4A64A]' : 'text-[#86efac]'
                          }`}
                          aria-hidden="true"
                        />
                      ) : (
                        <Circle className="w-3.5 h-3.5 shrink-0 text-[#76513A]" aria-hidden="true" />
                      )}
                      <span className="truncate">{item.stage}</span>
                    </div>
                    <div className="text-[10px] leading-snug opacity-85">{item.requirement}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (tab === 'diplomacy') {
      return (
        <DiplomacyPanel
          playerKingdomId={gameData.kingdomId}
          relations={diplomacyRelations || ({} as Record<KingdomId, DiplomaticRelation>)}
          events={worldEventsData || []}
          onProposeTreaty={
            onProposeTreaty || (() => ({ accepted: false, reason: 'Diplomacy unavailable.' }))
          }
          onSendEnvoy={onSendEnvoy}
          onProposePeace={onProposePeace}
          onDeclareWar={onDeclareWar || (() => {})}
          onClose={closeAfterWorldAction}
        />
      );
    }

    const activeTradePacts = Object.values(diplomacyRelations || {}).filter((rel) =>
      rel.activeTreaties.some((t) => t.kind === 'trade_pact' && t.durationRemainingSec > 0),
    ).length;

    return (
      <div className="space-y-2.5 text-xs text-[#F2E8D5] leading-relaxed">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded bg-[#292017]/80 border border-[#76513A]/55 p-2.5">
            <div className="text-[10px] text-[#B8AA96]">Active Marketplaces</div>
            <div className="font-mono-num text-base font-bold text-[#F2E8D5]">{completedMarkets}</div>
          </div>
          <div className="rounded bg-[#292017]/80 border border-[#76513A]/55 p-2.5">
            <div className="text-[10px] text-[#B8AA96]">Assigned Traders</div>
            <div className="font-mono-num text-base font-bold text-[#F2E8D5]">{activeTraders}</div>
          </div>
          <div className="rounded bg-[#292017]/80 border border-[#76513A]/55 p-2.5">
            <div className="text-[10px] text-[#B8AA96]">Trade Pacts</div>
            <div className="font-mono-num text-base font-bold text-[#D4A64A]">
              {activeTradePacts} (+{activeTradePacts * 15}%)
            </div>
          </div>
          <div className="rounded bg-[#292017]/80 border border-[#76513A]/55 p-2.5">
            <div className="text-[10px] text-[#B8AA96]">Gold Rate</div>
            <div className="font-mono-num text-base font-bold text-[#86efac]">
              +{Math.round(gameData.rates.productionPerMinute.gold)}/min
            </div>
          </div>
        </div>
        <p className="text-[#B8AA96]">
          Assign villagers as <strong className="text-[#D4A64A]">Traders</strong>, construct{' '}
          <strong className="text-[#D4A64A]">Marketplaces</strong>, and negotiate{' '}
          <strong className="text-[#D4A64A]">Trade Pacts</strong> in Diplomacy to amplify kingdom
          tariff revenues.
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
      {/* TOP STACK: RESOURCE HEADER + PLACEMENT BANNER + NOTIFICATIONS */}
      <div className="w-full flex flex-col items-center">
        {/* DESKTOP & TABLET (md+) FULL TOP BAR */}
        <div className="pointer-events-auto hidden md:block w-full bg-[#171512]/96 border-b border-[#A77A32]/55 px-5 py-2 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Sovereign Kingdom Identity */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onFocusSettlement}
                aria-label="Center camera on settlement"
                title="Center camera on settlement"
                className="shrink-0 cursor-pointer hover:opacity-90 transition-opacity duration-150"
              >
                <KingdomEmblem kingdomId={kingdom.id} size={32} />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-display text-sm font-bold text-[#F2E8D5] truncate">
                    {gameData.playerKingdomName}
                  </div>
                  {atWarCount > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#4a1816] border border-[#f87171]/60 text-[10px] font-semibold text-[#fca5a5] shrink-0 whitespace-nowrap"
                      title="Active military conflict"
                    >
                      <Swords className="w-3 h-3" aria-hidden="true" />
                      <span>At War ({atWarCount})</span>
                    </span>
                  )}
                  {isLowFoodAlert && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#3b2610] border border-[#D4A64A]/65 text-[10px] font-semibold text-[#D4A64A] shrink-0 whitespace-nowrap"
                      title="Food satisfaction below 50%"
                    >
                      <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                      <span>Low Food</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#B8AA96] truncate">
                  {kingdom.name} · {region.name} · {gameData.progressionStage}
                </div>
              </div>
            </div>

            {/* Center (Desktop md+): Live Resources (Qty/Cap + Net/min) + Population */}
            <div
              aria-label="Kingdom Resources"
              className="flex items-center gap-3.5 lg:gap-5 py-0.5"
            >
              {(
                [
                  { key: 'food', label: 'Food' },
                  { key: 'wood', label: 'Wood' },
                  { key: 'stone', label: 'Stone' },
                  { key: 'iron', label: 'Iron' },
                  { key: 'gold', label: 'Gold' },
                ] as const
              ).map((item) => {
                const val = Math.round(gameData.resources[item.key]);
                const cap = Math.round(gameData.capacities[item.key]);
                const net = Math.round(gameData.rates.netPerMinute[item.key]);
                const isFull = val >= cap;
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-1.5 shrink-0"
                    title={`${item.label}: ${val} / ${cap} (${net >= 0 ? '+' : ''}${net}/min)`}
                  >
                    <ResourceIcon type={item.key} size={16} />
                    <div className="leading-tight">
                      <div className="flex items-baseline gap-1">
                        <span className="hidden 2xl:inline text-[11px] text-[#B8AA96]">
                          {item.label}
                        </span>
                        <span
                          className={`font-mono-num text-sm font-semibold ${
                            isFull ? 'text-[#D4A64A]' : 'text-[#F2E8D5]'
                          }`}
                        >
                          {val}
                        </span>
                        <span className="hidden lg:inline font-mono-num text-[11px] text-[#B8AA96]/75">
                          /{cap}
                        </span>
                      </div>
                      {net !== 0 && (
                        <div
                          className={`font-mono-num text-[10px] leading-none ${
                            net > 0 ? 'text-[#86efac]' : 'text-[#fca5a5]'
                          }`}
                        >
                          {net > 0 ? `+${net}` : net}/m
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div
                className="flex items-center gap-2 pl-3 border-l border-[#76513A]/60 shrink-0"
                title={`Population ${gameData.population.current}/${gameData.population.capacity} · Happiness ${Math.round(gameData.population.happiness)}%`}
              >
                <ResourceIcon type="population" size={16} />
                <div className="leading-tight">
                  <div className="font-mono-num text-sm font-semibold text-[#F2E8D5]">
                    {gameData.population.current}/{gameData.population.capacity}
                  </div>
                  <div className="font-mono-num text-[10px] text-[#B8AA96] leading-none">
                    {Math.round(gameData.population.happiness)}% Happy
                  </div>
                </div>
                {gameData.population.unemployedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectVillagersByRole('idle')}
                    title="Select Idle / Unemployed Villagers"
                    className="px-1.5 py-0.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#A77A32]/65 font-mono-num text-[11px] font-semibold text-[#D4A64A] transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    {gameData.population.unemployedCount} Idle
                  </button>
                )}
              </div>
            </div>

            {/* Right: World Intelligence, Save, Mute, Settings, Pause */}
            <div className="flex items-center gap-1.5 shrink-0">
              {saveToast && (
                <span
                  role="status"
                  className="hidden xl:inline text-xs text-[#D4A64A] mr-1 whitespace-nowrap"
                >
                  {saveToast}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowOverview(true)}
                aria-label="World Intelligence Overview"
                title="World Intelligence Ledger & History"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#A77A32]/65 text-xs font-semibold text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <ScrollText className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
                <span>World Overview</span>
              </button>
              <button
                type="button"
                onClick={onSaveGame}
                aria-label="Save Kingdom"
                title="Save Kingdom"
                className="inline-flex items-center gap-1 justify-center px-2.5 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs font-medium text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5 text-[#A77A32]" aria-hidden="true" />
                <span>Save</span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                aria-label={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
                title={audioMuted ? 'Unmute Audio (M)' : 'Mute Audio (M)'}
                className="w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
              >
                {audioMuted ? (
                  <VolumeX className="w-4 h-4 text-[#fca5a5]" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenSettings();
                }}
                aria-label="Open Settings"
                title="Settings"
                className="w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
              >
                <Settings className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onOpenPause();
                }}
                aria-label="Pause Menu"
                title="Pause Menu (Esc)"
                className="inline-flex items-center gap-1 px-2.5 h-8 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#A77A32]/65 text-xs font-semibold text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <Menu className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
                <span>Menu</span>
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE (< md) ULTRA-MINIMAL SINGLE-ROW TOP BAR */}
        <div className="pointer-events-auto md:hidden w-full bg-[#171512]/96 border-b border-[#A77A32]/55 px-2.5 h-12 flex items-center justify-between gap-2 shadow-md">
          <button
            type="button"
            onClick={onFocusSettlement}
            aria-label="Center camera on settlement"
            className="w-9 h-9 inline-flex items-center justify-center shrink-0 cursor-pointer"
          >
            <KingdomEmblem kingdomId={kingdom.id} size={28} />
          </button>

          {/* Tap-to-Expand Compact Resource Strip (Food · Wood · Gold · Pop) */}
          <button
            type="button"
            onClick={() => setMobileStatsExpanded((s) => !s)}
            aria-expanded={mobileStatsExpanded}
            aria-label="Kingdom Resources Summary — Tap to inspect all stockpiles"
            className="flex-1 min-w-0 h-9 px-2 rounded bg-[#292017]/80 border border-[#76513A]/55 flex items-center justify-between gap-1.5 cursor-pointer"
          >
            <div className="flex items-center justify-around flex-1 gap-1.5 min-w-0 font-mono-num text-[11px] font-semibold text-[#F2E8D5]">
              <span className="inline-flex items-center gap-1 shrink-0">
                <ResourceIcon type="food" size={12} />
                {Math.round(gameData.resources.food)}
              </span>
              <span className="inline-flex items-center gap-1 shrink-0">
                <ResourceIcon type="wood" size={12} />
                {Math.round(gameData.resources.wood)}
              </span>
              <span className="inline-flex items-center gap-1 shrink-0">
                <ResourceIcon type="gold" size={12} />
                {Math.round(gameData.resources.gold)}
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 text-[#D4A64A]">
                <ResourceIcon type="population" size={12} />
                {gameData.population.current}/{gameData.population.capacity}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {atWarCount > 0 && <Swords className="w-3.5 h-3.5 text-[#fca5a5]" aria-hidden="true" />}
              {isLowFoodAlert && (
                <AlertTriangle className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#B8AA96] transition-transform duration-150 ${
                  mobileStatsExpanded ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenPause}
            aria-label="Pause Game"
            className="w-9 h-9 inline-flex items-center justify-center rounded bg-[#292017] border border-[#A77A32]/65 text-[#F2E8D5] shrink-0 cursor-pointer"
          >
            <Pause className="w-4 h-4 text-[#D4A64A]" aria-hidden="true" />
          </button>
        </div>

        {/* MOBILE EXPANDED RESOURCE & REALM POPOVER */}
        {mobileStatsExpanded && (
          <div
            role="region"
            aria-label="Expanded Mobile Kingdom Stockpiles"
            className="pointer-events-auto md:hidden w-[calc(100%-1rem)] mt-1.5 rounded-md bg-[#171512]/96 border border-[#A77A32]/65 p-3 shadow-xl space-y-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#76513A]/45 pb-1.5">
              <div className="min-w-0">
                <div className="font-display font-bold text-sm text-[#F2E8D5] truncate">
                  {gameData.playerKingdomName}
                </div>
                <div className="text-[11px] text-[#B8AA96] truncate">
                  {kingdom.name} · {region.name} · {gameData.progressionStage}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileStatsExpanded(false)}
                aria-label="Collapse resource summary"
                className="w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] border border-[#76513A] text-[#F2E8D5] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1.5 text-center">
              {(
                [
                  { key: 'food', label: 'Food' },
                  { key: 'wood', label: 'Wood' },
                  { key: 'stone', label: 'Stone' },
                  { key: 'iron', label: 'Iron' },
                  { key: 'gold', label: 'Gold' },
                ] as const
              ).map((item) => {
                const val = Math.round(gameData.resources[item.key]);
                const cap = Math.round(gameData.capacities[item.key]);
                const net = Math.round(gameData.rates.netPerMinute[item.key]);
                return (
                  <div
                    key={item.key}
                    className="rounded bg-[#292017]/80 border border-[#76513A]/45 py-1.5 px-1"
                  >
                    <div className="flex items-center justify-center gap-1 text-[10px] text-[#B8AA96]">
                      <ResourceIcon type={item.key} size={11} />
                      <span>{item.label}</span>
                    </div>
                    <div className="font-mono-num text-xs font-bold text-[#F2E8D5] mt-0.5">{val}</div>
                    <div className="font-mono-num text-[9px] text-[#B8AA96]">/{cap}</div>
                    {net !== 0 && (
                      <div
                        className={`font-mono-num text-[9px] ${
                          net > 0 ? 'text-[#86efac]' : 'text-[#fca5a5]'
                        }`}
                      >
                        {net > 0 ? `+${net}` : net}/m
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#B8AA96] pt-0.5">
              <span className="font-mono-num">
                Happiness {Math.round(gameData.population.happiness)}% · Idle{' '}
                {gameData.population.unemployedCount}
              </span>
              {gameData.population.unemployedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileStatsExpanded(false);
                    onSelectVillagersByRole('idle');
                  }}
                  className="px-2 py-1 rounded bg-[#292017] border border-[#A77A32]/65 text-[#D4A64A] font-semibold cursor-pointer"
                >
                  Select Idle
                </button>
              )}
            </div>
          </div>
        )}

        {/* Interactive 3D Building Placement Banner */}
        {placementPreview.active && placementPreview.archetype && (
          <div
            role="region"
            aria-label="Building Placement Controls"
            className="pointer-events-auto mt-2 mx-2 px-3 py-2 rounded-md bg-[#171512]/96 border border-[#D4A64A]/75 shadow-xl flex flex-wrap items-center justify-center gap-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center">
              <span className="font-display font-bold text-[#F2E8D5]">
                Placing {BUILDING_CATALOG[placementPreview.archetype].name}
              </span>
              <span
                className={`font-medium ${
                  placementPreview.valid ? 'text-[#86efac]' : 'text-[#fca5a5]'
                }`}
              >
                {placementPreview.valid
                  ? 'Valid foundation — tap terrain or Confirm'
                  : placementPreview.reason ?? 'Invalid terrain'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onRotatePlacementPreview}
                className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-[#F2E8D5] font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
                <span>Rotate 45°</span>
                <span className="hidden sm:inline">(R)</span>
              </button>
              <button
                type="button"
                disabled={!placementPreview.valid}
                onClick={onConfirmPlacement}
                className={`min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded font-semibold transition-colors duration-150 whitespace-nowrap ${
                  placementPreview.valid
                    ? 'bg-[#2f854e] hover:bg-[#3a9c5e] text-[#F2E8D5] cursor-pointer'
                    : 'bg-[#292017] text-[#B8AA96]/50 cursor-not-allowed'
                }`}
              >
                Confirm Here
              </button>
              <button
                type="button"
                onClick={() => onStartBuildingPlacement(null)}
                className="min-h-[44px] sm:min-h-0 px-2.5 py-1.5 rounded bg-[#361d18] hover:bg-[#492720] border border-[#b45a4b]/55 text-[#f6cbc2] font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Contextual Economy Notifications (Top-Right Perimeter on Desktop, 1 Clean Banner on Mobile) */}
        {notifications.length > 0 && (
          <div
            aria-live="polite"
            className="pointer-events-auto self-center md:self-end md:mr-3 mt-2 w-[calc(100%-1rem)] md:w-full max-w-sm space-y-1.5"
          >
            {notifications.slice(-3).map((n, idx, arr) => (
              <div
                key={n.id}
                className={`${idx < arr.length - 1 ? 'hidden md:flex' : 'flex'} rounded bg-[#171512]/96 border px-3 py-1.5 shadow-lg items-center justify-between gap-2 text-xs ${
                  n.kind === 'alert'
                    ? 'border-[#e06353]/70 text-[#fbd5cf]'
                    : n.kind === 'warning'
                      ? 'border-[#D4A64A]/70 text-[#F2E8D5]'
                      : n.kind === 'success'
                        ? 'border-[#4ca86b]/70 text-[#d7f7e1]'
                        : 'border-[#76513A] text-[#F2E8D5]'
                }`}
              >
                <span className="leading-snug">{n.message}</span>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => onDismissNotification(n.id)}
                  className="text-[#B8AA96] hover:text-[#F2E8D5] p-0.5 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM UNIFIED RTS DOCK (md+) & LIGHTWEIGHT MOBILE CONTROLS (< md) */}
      <div className="w-full flex flex-col items-center px-2.5 sm:px-4 pb-2.5 sm:pb-3 gap-2">
        {/* Contextual Entity / Multi-Villager / Military Selection Inspector */}
        {!activeTab && !mobileHubOpen && (
          <SelectionInspector
            playerKingdomId={gameData.kingdomId}
            selectedEntities={selectedEntities}
            allEntities={allEntities}
            touchCommandMode={touchCommandMode}
            onFocusEntity={onFocusEntity}
            onClearSelection={() => onSelectEntityById(null)}
            onAssignOccupation={onAssignOccupation}
            onCancelVillagerTask={onCancelVillagerTask}
            onSetTouchCommandMode={onSetTouchCommandMode}
            onDispatchWorkerToEntity={onDispatchWorkerToEntity}
            onCancelConstruction={onCancelConstruction}
            onRecruitUnit={onRecruitUnit}
            onCancelRecruitment={onCancelRecruitment}
            onSetFormation={onSetFormation}
            onSetStance={onSetStance}
          />
        )}

        {/* MOBILE (< md) FLOATING CONTROLS: Bottom-Left Quick Toggle + Bottom-Right Command Hub */}
        <div className="md:hidden w-full flex items-end justify-between gap-2 relative">
          {/* Bottom-Left Quick Shortcuts Toggle */}
          <div className="pointer-events-auto relative flex flex-col items-start">
            {mobileQuickOpen && (
              <div
                role="region"
                aria-label="Quick Camera and Unit Shortcuts"
                className="mb-2 w-52 rounded-md bg-[#171512]/96 border border-[#A77A32]/65 p-1.5 shadow-2xl space-y-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMobileQuickOpen(false);
                    onFocusSettlement();
                  }}
                  className="w-full min-h-[44px] px-3 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A]/55 flex items-center justify-between text-xs font-semibold text-[#F2E8D5] cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Home className="w-4 h-4 text-[#D4A64A]" aria-hidden="true" />
                    <span>Center Settlement</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileQuickOpen(false);
                    handlePresetClick(activeCamPreset === 'overview' ? 'settlement' : 'overview');
                  }}
                  className="w-full min-h-[44px] px-3 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A]/55 flex items-center justify-between text-xs font-semibold text-[#F2E8D5] cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#D4A64A]" aria-hidden="true" />
                    <span>
                      {activeCamPreset === 'overview' ? 'Settlement View' : 'Overview Camera'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleCycleVillager}
                  className="w-full min-h-[44px] px-3 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A]/55 flex items-center justify-between text-xs font-semibold text-[#F2E8D5] cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#D4A64A]" aria-hidden="true" />
                    <span>Next Villager</span>
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileQuickOpen(false);
                      onSelectVillagersByRole('all');
                    }}
                    className="min-h-[44px] px-2 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A]/55 text-xs font-semibold font-mono-num text-[#F2E8D5] cursor-pointer whitespace-nowrap"
                  >
                    All ({villagers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileQuickOpen(false);
                      onSelectMilitaryUnits?.('all');
                    }}
                    className="min-h-[44px] px-2 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#A77A32]/65 text-xs font-semibold font-mono-num text-[#D4A64A] cursor-pointer whitespace-nowrap"
                  >
                    Army ({playerArmyCount})
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileQuickOpen((o) => !o)}
              aria-expanded={mobileQuickOpen}
              aria-label="Toggle Quick Camera and Selection Controls"
              className={`min-h-[44px] px-3.5 rounded-md border shadow-xl inline-flex items-center gap-2 text-xs font-semibold transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                mobileQuickOpen
                  ? 'bg-[#292017] border-[#D4A64A] text-[#D4A64A]'
                  : 'bg-[#171512]/96 border-[#A77A32]/65 text-[#F2E8D5]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-[#D4A64A]" aria-hidden="true" />
              <span>Quick</span>
            </button>
          </div>

          {/* Bottom-Right Primary Floating Kingdom Menu Button */}
          <button
            type="button"
            onClick={() => {
              setMobileQuickOpen(false);
              setMobileStatsExpanded(false);
              setMobileHubOpen(true);
            }}
            aria-label="Open Kingdom Command Hub"
            className="pointer-events-auto min-h-[46px] px-4 rounded-md bg-[#D4A64A] hover:bg-[#e2b65a] text-[#171512] shadow-xl inline-flex items-center gap-2 text-xs font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            <span>Menu</span>
          </button>
        </div>

        {/* DESKTOP & TABLET (md+) INLINE NAVIGATION DRAWER */}
        {!dockCollapsed && activeTab && (
          <section
            aria-label={`${activeTab} management panel`}
            className="pointer-events-auto hidden md:block w-full max-w-4xl rounded-md bg-[#171512]/96 border border-[#A77A32]/65 p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#76513A]/50 pb-2">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-[#F2E8D5] capitalize truncate">
                  {activeTab === 'kingdom'
                    ? 'Kingdom Economy & Workforce'
                    : activeTab === 'military'
                      ? 'Kingdom Military High Command'
                      : activeTab === 'research'
                        ? 'Royal Doctrine & Realm Milestones'
                        : `${activeTab} Council`}
                </h3>
                <p className="text-xs text-[#B8AA96] truncate">
                  {activeTab === 'kingdom'
                    ? `${gameData.playerKingdomName} · ${gameData.rulerName} · ${region.name}`
                    : activeTab === 'construction'
                      ? 'Select a structure to preview footprint and place on buildable terrain'
                      : activeTab === 'military'
                        ? `${kingdom.name} Standing Army & Martial Doctrine · Real-Time RTS Formations`
                        : activeTab === 'research'
                          ? `${kingdom.name} Sovereign Doctrines, Biome Adaptation & Realm Progression`
                          : activeTab === 'diplomacy'
                            ? `${kingdom.name} Bilateral Relations, Treaties & Envoys`
                            : 'Kingdom Marketplaces, Traders & Tariff Revenue'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Close</span>
              </button>
            </div>

            {renderDepartmentContent(activeTab, false)}
          </section>
        )}

        {/* DESKTOP & TABLET (md+) UNIFIED BOTTOM DOCK */}
        <div className="pointer-events-auto hidden md:flex flex-col items-center w-full max-w-6xl">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-t bg-[#171512]/96 border border-b-0 border-[#A77A32]/55 text-[11px] text-[#B8AA96] hover:text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
            )}
            <span>{dockCollapsed ? 'Show Command Dock (H)' : 'Hide Command Dock (H)'}</span>
          </button>

          {!dockCollapsed && (
            <div className="w-full rounded-md bg-[#171512]/96 border border-[#A77A32]/65 px-3 py-2 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-2">
              <nav
                aria-label="Kingdom Departments"
                className="grid grid-cols-6 xl:flex items-center gap-1 w-full xl:w-auto"
              >
                {NAV_TABS.map((t) => {
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-label={t.label}
                      aria-pressed={isActive}
                      onClick={() => toggleTab(t.id)}
                      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold text-center transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-[#D4A64A] text-[#171512]'
                          : 'bg-[#292017] hover:bg-[#362a1e] border border-[#76513A]/50 text-[#F2E8D5]'
                      }`}
                    >
                      {t.renderIcon()}
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="flex flex-nowrap items-center justify-between xl:justify-end gap-1.5 w-full xl:w-auto">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleCycleVillager}
                    title="Select & Focus Next Villager"
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs font-medium text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    <Users className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
                    <span>Next</span>
                    <span className="hidden 2xl:inline">Villager</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(null);
                      onSelectVillagersByRole('all');
                    }}
                    title="Select All Villagers"
                    className="px-2 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs font-medium text-[#F2E8D5] font-mono-num transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    All ({villagers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(null);
                      onSelectMilitaryUnits?.('all');
                    }}
                    title="Select All Military Units"
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#A77A32]/70 text-xs font-semibold text-[#D4A64A] font-mono-num transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    <Swords className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Army ({playerArmyCount})</span>
                  </button>
                </div>

                {/* Camera Presets & Rig Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <div
                    role="group"
                    aria-label="Camera Presets"
                    className="flex items-center rounded bg-[#110f0d] border border-[#76513A]/60 p-0.5 mr-1"
                  >
                    {(
                      [
                        { id: 'settlement', label: 'Settlement' },
                        { id: 'overview', label: 'Overview' },
                        { id: 'battle', label: 'Army' },
                      ] as const
                    ).map((preset) => {
                      const active = activeCamPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => handlePresetClick(preset.id)}
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[#D4A64A] text-[#171512]'
                              : 'text-[#B8AA96] hover:text-[#F2E8D5]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => onCameraRotate(-0.38)}
                    aria-label="Rotate Camera Left"
                    title="Rotate Camera Left (Q)"
                    className="w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onCameraRotate(0.38)}
                    aria-label="Rotate Camera Right"
                    title="Rotate Camera Right (E)"
                    className="w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onCameraZoom(-7)}
                    aria-label="Zoom In"
                    title="Zoom In (+)"
                    className="w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onCameraZoom(7)}
                    aria-label="Zoom Out"
                    title="Zoom Out (-)"
                    className="w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onFocusSettlement}
                    aria-label="Focus Settlement Center"
                    title="Focus Settlement Center (Home)"
                    className="px-2.5 h-8 inline-flex items-center gap-1 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs font-medium text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
                  >
                    <Home className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
                    <span>Center</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE FULL-SCREEN COMMAND HUB OVERLAY (< md) */}
      {mobileHubOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Kingdom Command Hub"
          className="pointer-events-auto md:hidden fixed inset-0 z-30 bg-[#171512] flex flex-col"
        >
          {/* Hub Header */}
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#292017] border-b border-[#76513A]/60 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <KingdomEmblem kingdomId={kingdom.id} size={28} className="shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-[#F2E8D5] truncate">
                  {gameData.playerKingdomName}
                </h2>
                <p className="text-[11px] text-[#B8AA96] truncate">
                  {region.name} · {gameData.progressionStage}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileHubOpen(false)}
              aria-label="Close Kingdom Command Hub"
              className="w-11 h-11 inline-flex items-center justify-center rounded-md bg-[#171512] border border-[#76513A] text-[#F2E8D5] shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Hub Utility Row (World Overview, Save, Audio, Settings) */}
          <div className="grid grid-cols-4 gap-1.5 px-3.5 py-2 bg-[#110f0d] border-b border-[#76513A]/45 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMobileHubOpen(false);
                setShowOverview(true);
              }}
              className="min-h-[44px] px-2 rounded bg-[#292017] border border-[#A77A32]/65 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#F2E8D5] cursor-pointer whitespace-nowrap"
            >
              <ScrollText className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
              <span>World</span>
            </button>
            <button
              type="button"
              onClick={onSaveGame}
              className="min-h-[44px] px-2 rounded bg-[#292017] border border-[#76513A] flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#F2E8D5] cursor-pointer whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5 text-[#A77A32]" aria-hidden="true" />
              <span>{saveToast ? 'Saved' : 'Save'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="min-h-[44px] px-2 rounded bg-[#292017] border border-[#76513A] flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#F2E8D5] cursor-pointer whitespace-nowrap"
            >
              {audioMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-[#fca5a5]" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
              )}
              <span>{audioMuted ? 'Muted' : 'Audio'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileHubOpen(false);
                onOpenSettings();
              }}
              className="min-h-[44px] px-2 rounded bg-[#292017] border border-[#76513A] flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#F2E8D5] cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5 text-[#B8AA96]" aria-hidden="true" />
              <span>Settings</span>
            </button>
          </div>

          {/* Hub Scrollable Department Tabs */}
          <nav
            aria-label="Mobile Kingdom Departments"
            className="flex items-center gap-1.5 px-3.5 py-2 overflow-x-auto akanu-scroll border-b border-[#76513A]/45 shrink-0"
          >
            {NAV_TABS.map((t) => {
              const isActive = mobileHubTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setMobileHubTab(t.id)}
                  className={`min-h-[44px] px-3.5 rounded inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#D4A64A] text-[#171512]'
                      : 'bg-[#292017] border border-[#76513A]/60 text-[#F2E8D5]'
                  }`}
                >
                  {t.renderIcon()}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Hub Department Content */}
          <div className="flex-1 overflow-y-auto akanu-scroll p-3.5">
            {renderDepartmentContent(mobileHubTab, true)}
          </div>
        </div>
      )}

      {showOverview && (
        <KingdomOverviewPanel
          playerKingdomId={gameData.kingdomId}
          difficultyLevel={gameData.difficultyLevel}
          aiKingdoms={aiKingdomsData || ({} as Record<KingdomId, AIKingdomRuntime>)}
          relations={diplomacyRelations || ({} as Record<KingdomId, DiplomaticRelation>)}
          events={worldEventsData || []}
          onClose={() => setShowOverview(false)}
        />
      )}
    </div>
  );
};
