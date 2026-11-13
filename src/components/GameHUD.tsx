import React, { useState } from 'react';
import { BUILDING_CATALOG, KINGDOM_ECONOMIC_BONUSES } from '../config/economy';
import { KINGDOMS } from '../config/kingdoms';
import { REGIONS } from '../config/regions';
import {
  BuildingArchetype,
  BuildingEntity,
  CharacterEntity,
  CivilianRole,
  EconomyNotification,
  MilitaryFormationType,
  MilitaryStance,
  MilitaryUnitClass,
  NavigationTab,
  PlacementPreviewState,
  ResourceKey,
  SaveGameData,
  SelectableEntity,
  TouchCommandMode,
} from '../types/game';
import { KINGDOM_MILITARY_BONUSES, MILITARY_UNIT_CATALOG } from '../config/military';
import { ConstructionPanel } from './ConstructionPanel';
import { EconomyPanel } from './EconomyPanel';
import { KingdomEmblem, ResourceIcon } from './KingdomEmblem';
import { SelectionInspector } from './SelectionInspector';
import { DiplomacyPanel } from './DiplomacyPanel';
import { KingdomOverviewPanel } from './KingdomOverviewPanel';
import {
  AIKingdomRuntime,
  DiplomaticRelation,
  KingdomId,
  TreatyKind,
  WorldEventItem,
} from '../types/game';

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
  onDeclareWar?: (targetId: KingdomId) => void;
}

const NAV_TABS: { id: NavigationTab; label: string; shortLabel: string }[] = [
  { id: 'kingdom', label: 'Economy', shortLabel: 'Econ' },
  { id: 'construction', label: 'Construction', shortLabel: 'Build' },
  { id: 'military', label: 'Military', shortLabel: 'Army' },
  { id: 'research', label: 'Research', shortLabel: 'Tech' },
  { id: 'diplomacy', label: 'Diplomacy', shortLabel: 'Pacts' },
  { id: 'trade', label: 'Trade', shortLabel: 'Trade' },
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
  onMilitaryAttack,
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
  onDeclareWar,
}) => {
  const [activeTab, setActiveTab] = useState<NavigationTab | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [showOverview, setShowOverview] = useState<boolean>(false);

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
  const villagers = allEntities.filter((e) => e.category === 'character');
  const completedMarkets = allEntities.filter(
    (e) =>
      e.category === 'building' &&
      e.archetype === 'market_courtyard' &&
      e.constructionState === 'completed',
  ).length;
  const activeTraders = allEntities.filter(
    (e) => e.category === 'character' && e.role === 'Trader',
  ).length;

  const handleCycleVillager = () => {
    if (villagers.length === 0) return;
    setActiveTab(null);
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
    // Collapse the construction drawer automatically so the player has full 3D terrain visibility
    setActiveTab(null);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
      {/* TOP STACK: RESOURCE HEADER + PLACEMENT BANNER + NOTIFICATIONS */}
      <div className="w-full flex flex-col items-center">
        <div className="pointer-events-auto w-full bg-[#15100b]/96 border-b border-[#b98736]/40 px-3 sm:px-5 py-1.5 sm:py-2 shadow-lg">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Sovereign Kingdom Identity */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={onFocusSettlement}
                aria-label="Center camera on settlement"
                title="Center camera on settlement"
                className="shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <KingdomEmblem kingdomId={kingdom.id} size={32} />
              </button>
              <div className="min-w-0">
                <div className="font-display text-xs sm:text-sm font-bold text-[#fbf3e4] truncate">
                  {gameData.playerKingdomName}
                </div>
                <div className="text-[11px] text-[#c9b593] truncate">
                  {kingdom.name} · {region.name} · {gameData.progressionStage}
                </div>
              </div>
            </div>

            {/* Center (Desktop md+): Live Resources (Qty/Cap + Net/min) + Population */}
            <div
              aria-label="Kingdom Resources"
              className="hidden md:flex items-center gap-3.5 lg:gap-5 py-0.5"
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
                        <span className="hidden 2xl:inline text-[11px] text-[#b8a586]">
                          {item.label}
                        </span>
                        <span
                          className={`font-mono-num text-sm font-semibold ${
                            isFull ? 'text-[#fbbf24]' : 'text-[#f7eedc]'
                          }`}
                        >
                          {val}
                        </span>
                        <span className="hidden lg:inline font-mono-num text-[11px] text-[#9c896d]">
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
                className="flex items-center gap-2 pl-3 border-l border-[#8f6c38]/30 shrink-0"
                title={`Population ${gameData.population.current}/${gameData.population.capacity} · Happiness ${Math.round(gameData.population.happiness)}%`}
              >
                <ResourceIcon type="population" size={16} />
                <div className="leading-tight">
                  <div className="font-mono-num text-sm font-semibold text-[#f7eedc]">
                    {gameData.population.current}/{gameData.population.capacity}
                  </div>
                  <div className="font-mono-num text-[10px] text-[#c9b593] leading-none">
                    {Math.round(gameData.population.happiness)}% Happy
                  </div>
                </div>
                {gameData.population.unemployedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectVillagersByRole('idle')}
                    title="Select Idle / Unemployed Villagers"
                    className="px-1.5 py-0.5 rounded bg-[#3a2814] hover:bg-[#4d351b] border border-[#e6be68]/45 font-mono-num text-[11px] font-semibold text-[#f6d27a] cursor-pointer"
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
                  className="hidden xl:inline text-xs text-[#e6be68] mr-1 whitespace-nowrap"
                >
                  {saveToast}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowOverview(true)}
                aria-label="World Intelligence Overview"
                title="World Intelligence Ledger & History"
                className="px-2.5 py-1 rounded bg-[#2b1f13] hover:bg-[#3d2b1a] border border-[#b98736]/45 text-xs font-semibold text-[#f8e5b6] cursor-pointer whitespace-nowrap"
              >
                📜 World Overview
              </button>
              <button
                type="button"
                onClick={onSaveGame}
                aria-label="Save Kingdom"
                title="Save Kingdom"
                className="hidden sm:inline-flex items-center justify-center px-2.5 py-1.5 rounded bg-[#241b13] hover:bg-[#33261a] border border-[#8f6c38]/40 text-xs font-medium text-[#ebdcc4] cursor-pointer whitespace-nowrap"
              >
                Save
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
                className="w-8 h-8 inline-flex items-center justify-center rounded bg-[#241b13] hover:bg-[#33261a] border border-[#8f6c38]/40 text-xs text-[#f3ead8] cursor-pointer"
              >
                {audioMuted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
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
                className="w-8 h-8 inline-flex items-center justify-center rounded bg-[#241b13] hover:bg-[#33261a] border border-[#8f6c38]/40 text-xs text-[#f3ead8] cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
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
                className="px-2.5 h-8 inline-flex items-center justify-center rounded bg-[#2b2016] hover:bg-[#3a2b1d] border border-[#c98f32]/45 text-xs font-semibold text-[#f7eedc] cursor-pointer whitespace-nowrap"
              >
                Menu
              </button>
            </div>
          </div>

          {/* Mobile (< md) Full 6-Stat Resource Strip: Zero Clipping */}
          <div
            aria-label="Mobile Kingdom Resources"
            className="grid grid-cols-6 gap-1 md:hidden pt-1.5 mt-1.5 border-t border-[#8f6c38]/25 text-center"
          >
            {(
              [
                { key: 'food', val: gameData.resources.food },
                { key: 'wood', val: gameData.resources.wood },
                { key: 'stone', val: gameData.resources.stone },
                { key: 'iron', val: gameData.resources.iron },
                { key: 'gold', val: gameData.resources.gold },
              ] as const
            ).map((item) => (
              <div key={item.key} className="flex items-center justify-center gap-1">
                <ResourceIcon type={item.key} size={13} />
                <span className="font-mono-num text-[11px] font-semibold text-[#f7eedc]">
                  {Math.round(item.val)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-center gap-1">
              <ResourceIcon type="population" size={13} />
              <span className="font-mono-num text-[11px] font-semibold text-[#f7eedc]">
                {gameData.population.current}/{gameData.population.capacity}
              </span>
            </div>
          </div>
        </div>

        {/* Interactive 3D Building Placement Banner */}
        {placementPreview.active && placementPreview.archetype && (
          <div
            role="region"
            aria-label="Building Placement Controls"
            className="pointer-events-auto mt-2 mx-2 px-3.5 py-2 rounded-md bg-[#16100b]/96 border border-[#c98f32]/65 shadow-xl flex flex-wrap items-center justify-center gap-2.5 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-[#fbf3e4]">
                Placing {BUILDING_CATALOG[placementPreview.archetype].name}
              </span>
              <span
                className={`font-medium ${
                  placementPreview.valid ? 'text-[#86efac]' : 'text-[#fca5a5]'
                }`}
              >
                {placementPreview.valid
                  ? 'Valid foundation — click terrain or Confirm'
                  : placementPreview.reason ?? 'Invalid terrain'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onRotatePlacementPreview}
                className="px-2.5 py-1 rounded bg-[#261c14] hover:bg-[#35271c] border border-[#8f6c38]/45 text-[#f3ead8] font-medium cursor-pointer"
              >
                Rotate 45° (R)
              </button>
              <button
                type="button"
                disabled={!placementPreview.valid}
                onClick={onConfirmPlacement}
                className={`px-3 py-1 rounded font-semibold ${
                  placementPreview.valid
                    ? 'bg-[#2f854e] hover:bg-[#3a9c5e] text-[#fbf3e4] cursor-pointer'
                    : 'bg-[#282019] text-[#7a6b57] cursor-not-allowed'
                }`}
              >
                Confirm Here
              </button>
              <button
                type="button"
                onClick={() => onStartBuildingPlacement(null)}
                className="px-2.5 py-1 rounded bg-[#361d18] hover:bg-[#492720] border border-[#b45a4b]/45 text-[#f6cbc2] font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Contextual Economy Notifications (Top-Right Perimeter, Zero Blur) */}
        {notifications.length > 0 && (
          <div
            aria-live="polite"
            className="pointer-events-auto self-end mr-3 mt-2 w-full max-w-sm space-y-1.5 px-2 sm:px-0"
          >
            {notifications.slice(-3).map((n) => (
              <div
                key={n.id}
                className={`rounded bg-[#16100b]/96 border px-3 py-1.5 shadow-lg flex items-center justify-between gap-2 text-xs ${
                  n.kind === 'alert'
                    ? 'border-[#e06353]/65 text-[#fbd5cf]'
                    : n.kind === 'warning'
                      ? 'border-[#e0a23b]/65 text-[#fae5be]'
                      : n.kind === 'success'
                        ? 'border-[#4ca86b]/65 text-[#d7f7e1]'
                        : 'border-[#9c7940]/55 text-[#efe2cb]'
                }`}
              >
                <span className="leading-snug">{n.message}</span>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => onDismissNotification(n.id)}
                  className="text-[#b8a586] hover:text-[#fbf3e4] px-1 cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM UNIFIED RTS DOCK & CONTEXTUAL INSPECTOR */}
      <div className="w-full flex flex-col items-center px-2 sm:px-4 pb-2 sm:pb-3 gap-2">
        {/* Contextual Entity / Multi-Villager / Military Selection Inspector */}
        {!activeTab && (
          <SelectionInspector
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
            onMilitaryAttack={onMilitaryAttack}
          />
        )}

        {/* Active Navigation Drawer (Economy / Construction / Military / Research / Diplomacy / Trade) */}
        {!dockCollapsed && activeTab && (
          <section
            aria-label={`${activeTab} management panel`}
            className="pointer-events-auto w-full max-w-4xl rounded-md bg-[#17110c]/96 border border-[#c98f32]/45 p-3.5 sm:p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[#8f6c38]/25 pb-2">
              <div>
                <h3 className="font-display text-base font-bold text-[#fbf3e4] capitalize">
                  {activeTab === 'kingdom'
                    ? 'Kingdom Economy & Workforce'
                    : activeTab === 'military'
                      ? 'Kingdom Military High Command'
                      : `${activeTab} Council`}
                </h3>
                <p className="text-xs text-[#b8a586]">
                  {activeTab === 'kingdom'
                    ? `${gameData.playerKingdomName} · ${gameData.rulerName} · ${region.name}`
                    : activeTab === 'construction'
                      ? 'Select a structure to preview footprint and place on buildable terrain'
                      : activeTab === 'military'
                        ? `${kingdom.name} Standing Army & Martial Doctrine · Real-Time RTS Formations`
                        : 'Kingdom Strategic Overview'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="px-2.5 py-1 rounded bg-[#261c14] hover:bg-[#34271c] border border-[#8f6c38]/35 text-xs text-[#e5d8c0] cursor-pointer whitespace-nowrap"
              >
                Close Panel
              </button>
            </div>

            {activeTab === 'kingdom' && (
              <EconomyPanel
                gameData={gameData}
                allEntities={allEntities}
                onAdjustWorkforce={onAdjustWorkforce}
                onSelectVillagersByRole={(role) => {
                  setActiveTab(null);
                  onSelectVillagersByRole(role);
                }}
                onSelectAndFocusEntity={(id) => {
                  setActiveTab(null);
                  onSelectEntityById(id, false);
                  onFocusEntity(id);
                }}
                onChangeRegionLive={onChangeRegionLive}
              />
            )}

            {activeTab === 'construction' && (
              <ConstructionPanel
                kingdomId={gameData.kingdomId}
                resources={gameData.resources}
                activePlacementArchetype={placementPreview.archetype}
                onStartPlacement={handleBeginPlacement}
              />
            )}

            {activeTab === 'military' && (
              <div className="space-y-3 text-xs">
                {/* Kingdom Doctrine Trait Banner */}
                {KINGDOM_MILITARY_BONUSES[gameData.kingdomId] && (
                  <div className="rounded bg-[#20150d] border border-[#d4993a]/40 p-2.5 flex items-start gap-3">
                    <span className="text-lg">🛡️</span>
                    <div>
                      <div className="font-semibold text-[#f8e5b6]">
                        {kingdom.name} Doctrine: {KINGDOM_MILITARY_BONUSES[gameData.kingdomId].name}
                      </div>
                      <div className="text-[#c8b79b] text-[11px] leading-relaxed mt-0.5">
                        {KINGDOM_MILITARY_BONUSES[gameData.kingdomId].summary}
                      </div>
                    </div>
                  </div>
                )}

                {/* Military Roster & Quick Selection */}
                {(() => {
                  const militaryUnits = allEntities.filter(
                    (e): e is CharacterEntity => e.category === 'character' && Boolean(e.militaryClass),
                  );
                  const militaryBuildings = allEntities.filter(
                    (e): e is BuildingEntity =>
                      e.category === 'building' &&
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
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1b130c] border border-[#6f5331]/40 rounded p-2.5">
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-[#a89578] uppercase text-[10px] tracking-wider block">
                              Standing Soldiers
                            </span>
                            <span className="font-bold text-base text-[#fbf3e4]">
                              {militaryUnits.length}
                            </span>
                          </div>
                          <div className="border-l border-[#6f5331]/40 pl-3">
                            <span className="text-[#a89578] uppercase text-[10px] tracking-wider block">
                              Queued Recruits
                            </span>
                            <span className="font-bold text-sm text-[#f0c265]">
                              {totalQueued}
                            </span>
                          </div>
                          <div className="border-l border-[#6f5331]/40 pl-3">
                            <span className="text-[#a89578] uppercase text-[10px] tracking-wider block">
                              Hourly Upkeep
                            </span>
                            <span className="font-bold text-sm text-[#e08677]">
                              -{hourlyFoodUpkeep} Food / -{hourlyGoldUpkeep} Gold
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab(null);
                              onSelectMilitaryUnits?.('all');
                            }}
                            className="px-3 py-1.5 rounded bg-[#b97a2c] hover:bg-[#cf8b34] text-[#140e07] font-semibold text-xs cursor-pointer shadow-sm transition-colors"
                          >
                            ⚔ Select Entire Army
                          </button>
                        </div>
                      </div>

                      {/* Unit Roster by Class */}
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
                          const count = militaryUnits.filter(
                            (u) => u.militaryClass === uClass,
                          ).length;
                          const bp = MILITARY_UNIT_CATALOG[uClass];
                          return (
                            <button
                              key={uClass}
                              type="button"
                              onClick={() => {
                                setActiveTab(null);
                                onSelectMilitaryUnits?.(uClass);
                              }}
                              className={`p-2 rounded text-left border transition-all cursor-pointer ${
                                count > 0
                                  ? 'bg-[#211710] border-[#c98f32]/45 hover:border-[#f0c265]'
                                  : 'bg-[#1a120b] border-[#4f3c24]/30 opacity-70'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#f8e5b6] truncate">
                                  {bp.name}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[11px] font-bold ${
                                    count > 0
                                      ? 'bg-[#c98f32] text-[#140d07]'
                                      : 'bg-[#291e14] text-[#8c775c]'
                                  }`}
                                >
                                  {count}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#b09e82] mt-0.5 line-clamp-1">
                                {bp.tacticalRole} · Atk {bp.attackDamage} · HP {bp.health}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Military Facilities List */}
                      <div className="pt-2">
                        <div className="text-[11px] font-semibold text-[#d4c19c] uppercase tracking-wider mb-1.5">
                          Military Facilities & Production Lines
                        </div>
                        {militaryBuildings.length === 0 ? (
                          <div className="p-3 rounded bg-[#18120b] border border-[#523d24]/35 text-[#a89578] text-center">
                            No dedicated military buildings constructed yet. Open{' '}
                            <button
                              type="button"
                              onClick={() => setActiveTab('construction')}
                              className="text-[#f0c265] underline font-medium cursor-pointer"
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
                                className="p-2.5 rounded bg-[#1c140d] border border-[#6b5030]/40 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-semibold text-[#fbf3e4] text-xs">
                                    {b.name}
                                  </div>
                                  <div className="text-[10px] text-[#ab987a]">
                                    Status: {b.constructionState === 'completed' ? 'Active' : 'Under Construction'} · Queued: {b.recruitmentQueue?.length || 0}/5
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab(null);
                                    onSelectEntityById(b.id, false);
                                    onFocusEntity(b.id);
                                  }}
                                  className="px-2.5 py-1 rounded bg-[#2e2116] hover:bg-[#3d2c1e] border border-[#8f6c38]/40 text-[11px] text-[#f0dca8] cursor-pointer"
                                >
                                  Manage
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'research' && (
              <div className="text-xs text-[#d9ccb4] leading-relaxed">
                Academy technologies across Agriculture, Masonry Construction, Metallurgy, Siege
                Engineering, and Commerce unlock in{' '}
                <span className="font-semibold text-[#f0c265]">
                  Phase 5: Progression and Diplomacy
                </span>
                . Active {kingdom.name} Phase 2 trait:{' '}
                <span className="font-semibold text-[#fbf3e4]">
                  {KINGDOM_ECONOMIC_BONUSES[gameData.kingdomId].summary}
                </span>
                .
              </div>
            )}

            {activeTab === 'diplomacy' && (
              <DiplomacyPanel
                playerKingdomId={gameData.kingdomId}
                relations={diplomacyRelations || {
                  oru: { targetKingdomId: 'oru', state: 'neutral', score: 0, discovered: true, activeTreaties: [], lastInteractionTimeSec: 0, grievanceCount: 0 },
                  zambara: { targetKingdomId: 'zambara', state: 'neutral', score: 0, discovered: true, activeTreaties: [], lastInteractionTimeSec: 0, grievanceCount: 0 },
                  kemetra: { targetKingdomId: 'kemetra', state: 'neutral', score: 0, discovered: true, activeTreaties: [], lastInteractionTimeSec: 0, grievanceCount: 0 },
                  aseka: { targetKingdomId: 'aseka', state: 'neutral', score: 0, discovered: true, activeTreaties: [], lastInteractionTimeSec: 0, grievanceCount: 0 },
                  nambara: { targetKingdomId: 'nambara', state: 'neutral', score: 0, discovered: true, activeTreaties: [], lastInteractionTimeSec: 0, grievanceCount: 0 },
                }}
                events={worldEventsData || []}
                onProposeTreaty={onProposeTreaty || ((targetId, kind) => ({ accepted: true, reason: 'Pact established.' }))}
                onDeclareWar={onDeclareWar || (() => {})}
                onClose={() => setActiveTab(null)}
              />
            )}

            {activeTab === 'trade' && (
              <div className="space-y-2 text-xs text-[#d9ccb4] leading-relaxed">
                <p>
                  Active Marketplaces:{' '}
                  <strong className="font-mono-num text-[#fbf3e4]">{completedMarkets}</strong> ·
                  Assigned Traders:{' '}
                  <strong className="font-mono-num text-[#fbf3e4]">{activeTraders}</strong> · Gold
                  Production:{' '}
                  <strong className="font-mono-num text-[#86efac]">
                    +{Math.round(gameData.rates.productionPerMinute.gold)}/min
                  </strong>
                  .
                </p>
                <p>
                  Assign villagers as <strong className="text-[#f0c265]">Traders</strong> or build
                  additional <strong className="text-[#f0c265]">Marketplaces</strong> to expand
                  domestic tariff gold generation. Inter-kingdom caravan diplomacy arrives in{' '}
                  <span className="font-semibold text-[#f0c265]">Phase 5</span>.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Unified Bottom Dock with Collapse/Expand Toggle */}
        <div className="pointer-events-auto flex flex-col items-center w-full max-w-4xl">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            className="px-3 py-0.5 rounded-t bg-[#17110c]/95 border border-b-0 border-[#8f6c38]/40 text-[11px] text-[#cbb899] hover:text-[#fbf3e4] cursor-pointer whitespace-nowrap"
          >
            {dockCollapsed ? '▴ Show Command Dock (H)' : '▾ Hide Command Dock (H)'}
          </button>

          {!dockCollapsed && (
            <div className="w-full rounded-md bg-[#16100b]/96 border border-[#b98736]/45 px-2 sm:px-4 py-2 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-2">
              <nav
                aria-label="Kingdom Departments"
                className="grid grid-cols-6 md:flex items-center gap-1 sm:gap-1.5 w-full md:w-auto"
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
                      className={`px-1 sm:px-3.5 py-2 rounded text-[11px] sm:text-xs font-semibold text-center transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-[#c98f32] text-[#171008]'
                          : 'bg-[#221911] hover:bg-[#2f2318] text-[#e5d8c0]'
                      }`}
                    >
                      <span className="sm:hidden">{t.shortLabel}</span>
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="flex items-center justify-between md:justify-end gap-1 w-full md:w-auto">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCycleVillager}
                    title="Select & Focus Next Villager"
                    className="px-2.5 py-2 rounded bg-[#241b13] hover:bg-[#34271b] border border-[#8f6c38]/35 text-xs font-medium text-[#f0dca8] cursor-pointer whitespace-nowrap"
                  >
                    Next Villager
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(null);
                      onSelectVillagersByRole('all');
                    }}
                    title="Select All Villagers"
                    className="px-2 py-2 rounded bg-[#211811] hover:bg-[#302318] border border-[#8f6c38]/35 text-xs font-medium text-[#e5d8c0] cursor-pointer whitespace-nowrap"
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
                    className="px-2.5 py-2 rounded bg-[#2c1d12] hover:bg-[#3d2717] border border-[#b98736]/50 text-xs font-semibold text-[#f8e5b6] cursor-pointer whitespace-nowrap"
                  >
                    ⚔ Army ({allEntities.filter((e) => e.category === 'character' && Boolean((e as CharacterEntity).militaryClass)).length})
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onCameraRotate(-0.38)}
                    aria-label="Rotate Camera Left"
                    title="Rotate Camera Left (Q)"
                    className="w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded bg-[#211811] hover:bg-[#302318] border border-[#8f6c38]/35 text-xs font-semibold text-[#e5d8c0] cursor-pointer"
                  >
                    ↺
                  </button>
                  <button
                    type="button"
                    onClick={() => onCameraRotate(0.38)}
                    aria-label="Rotate Camera Right"
                    title="Rotate Camera Right (E)"
                    className="w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded bg-[#211811] hover:bg-[#302318] border border-[#8f6c38]/35 text-xs font-semibold text-[#e5d8c0] cursor-pointer"
                  >
                    ↻
                  </button>
                  <button
                    type="button"
                    onClick={() => onCameraZoom(-7)}
                    aria-label="Zoom In"
                    title="Zoom In (+)"
                    className="w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded bg-[#211811] hover:bg-[#302318] border border-[#8f6c38]/35 text-sm font-bold text-[#e5d8c0] cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => onCameraZoom(7)}
                    aria-label="Zoom Out"
                    title="Zoom Out (-)"
                    className="w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded bg-[#211811] hover:bg-[#302318] border border-[#8f6c38]/35 text-sm font-bold text-[#e5d8c0] cursor-pointer"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={onFocusSettlement}
                    aria-label="Focus Settlement Center"
                    title="Focus Settlement Center"
                    className="px-2.5 h-9 sm:h-8 inline-flex items-center justify-center rounded bg-[#211811] hover:bg-[#302318] border border-[#8f6c38]/35 text-xs font-medium text-[#e5d8c0] cursor-pointer whitespace-nowrap"
                  >
                    Center
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showOverview && (
        <KingdomOverviewPanel
          playerKingdomId={gameData.kingdomId}
          aiKingdoms={aiKingdomsData || {} as any}
          relations={diplomacyRelations || {} as any}
          events={worldEventsData || []}
          onClose={() => setShowOverview(false)}
        />
      )}
    </div>
  );
};
