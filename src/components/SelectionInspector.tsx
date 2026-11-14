import React, { useEffect, useState } from 'react';
import {
  Ban,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Focus,
  Hammer,
  Minus,
  Move,
  OctagonX,
  Pickaxe,
  Shield,
  Split,
  Square,
  Swords,
  Triangle,
  UserPlus,
  X,
} from 'lucide-react';
import { BUILDING_CATALOG } from '../config/economy';
import { KINGDOMS } from '../config/kingdoms';
import {
  getMilitaryUnitsForBuilding,
  MILITARY_UNIT_CATALOG,
  MilitaryUnitBlueprint,
} from '../config/military';
import {
  BuildingEntity,
  CharacterEntity,
  CivilianRole,
  EnvironmentNodeEntity,
  KingdomId,
  MilitaryFormationType,
  MilitaryStance,
  MilitaryUnitClass,
  ResourceKey,
  SelectableEntity,
  TouchCommandMode,
} from '../types/game';
import { KingdomEmblem, ResourceIcon } from './KingdomEmblem';

interface SelectionInspectorProps {
  playerKingdomId: KingdomId;
  selectedEntities: SelectableEntity[];
  allEntities: SelectableEntity[];
  touchCommandMode: TouchCommandMode;
  onFocusEntity: (id: string) => void;
  onClearSelection: () => void;
  onAssignOccupation: (role: CivilianRole, preferredResource?: ResourceKey | null) => void;
  onCancelVillagerTask: () => void;
  onSetTouchCommandMode: (mode: TouchCommandMode) => void;
  onDispatchWorkerToEntity: (targetId: string) => void;
  onCancelConstruction: (buildingId: string) => void;
  // Phase 3 Military Callbacks
  onRecruitUnit?: (buildingId: string, unitClass: MilitaryUnitClass) => void;
  onCancelRecruitment?: (buildingId: string, index: number) => void;
  onSetFormation?: (formation: MilitaryFormationType) => void;
  onSetStance?: (stance: MilitaryStance) => void;
  onMilitaryAttack?: () => void;
}

const OCCUPATION_BUTTONS: {
  label: string;
  role: CivilianRole;
  preferredResource?: ResourceKey | null;
}[] = [
  { label: 'Farmer', role: 'Farmer', preferredResource: 'food' },
  { label: 'Woodcutter', role: 'Woodcutter', preferredResource: 'wood' },
  { label: 'Miner (Stone)', role: 'Miner', preferredResource: 'stone' },
  { label: 'Miner (Iron)', role: 'Miner', preferredResource: 'iron' },
  { label: 'Miner (Gold)', role: 'Miner', preferredResource: 'gold' },
  { label: 'Builder', role: 'Builder', preferredResource: null },
  { label: 'Hunter', role: 'Hunter', preferredResource: 'food' },
  { label: 'Fisherman', role: 'Fisherman', preferredResource: 'food' },
  { label: 'Trader', role: 'Trader', preferredResource: 'gold' },
  { label: 'Craftsperson', role: 'Craftsperson', preferredResource: 'iron' },
];

const FORMATION_OPTIONS: {
  id: MilitaryFormationType;
  label: string;
  renderIcon: () => React.ReactNode;
}[] = [
  { id: 'line', label: 'Line', renderIcon: () => <Minus className="w-3 h-3" aria-hidden="true" /> },
  { id: 'defensive', label: 'Phalanx', renderIcon: () => <Shield className="w-3 h-3" aria-hidden="true" /> },
  { id: 'wedge', label: 'Wedge', renderIcon: () => <Triangle className="w-3 h-3" aria-hidden="true" /> },
  { id: 'square', label: 'Square', renderIcon: () => <Square className="w-3 h-3" aria-hidden="true" /> },
  { id: 'flanking', label: 'Flank', renderIcon: () => <Split className="w-3 h-3" aria-hidden="true" /> },
];

export const SelectionInspector: React.FC<SelectionInspectorProps> = ({
  playerKingdomId,
  selectedEntities,
  allEntities,
  touchCommandMode,
  onFocusEntity,
  onClearSelection,
  onAssignOccupation,
  onCancelVillagerTask,
  onSetTouchCommandMode,
  onDispatchWorkerToEntity,
  onCancelConstruction,
  onRecruitUnit,
  onCancelRecruitment,
  onSetFormation,
  onSetStance,
}) => {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const firstId = selectedEntities[0]?.id ?? null;

  useEffect(() => {
    setMobileExpanded(false);
  }, [firstId]);

  if (selectedEntities.length === 0) return null;

  const firstEntity = selectedEntities[0];
  if (
    (firstEntity.category === 'character' || firstEntity.category === 'building') &&
    firstEntity.kingdomId !== playerKingdomId
  ) {
    const foreignKingdom = KINGDOMS[firstEntity.kingdomId];
    const isChar = firstEntity.category === 'character';
    const curHp = isChar ? Math.round(firstEntity.health) : Math.round(firstEntity.integrity);
    const maxHp = isChar ? Math.round(firstEntity.maxHealth) : Math.round(firstEntity.maxIntegrity);
    const hpPct = Math.max(0, Math.min(100, Math.round((curHp / Math.max(1, maxHp)) * 100)));

    return (
      <section
        aria-label="Foreign Kingdom Entity Information"
        className="pointer-events-auto w-full max-w-3xl max-h-[34vh] md:max-h-[38vh] overflow-y-auto akanu-scroll rounded-md bg-[#171512]/96 border border-[#a8553a]/75 px-3 sm:px-4 py-2.5 sm:py-3 shadow-xl space-y-2"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <KingdomEmblem kingdomId={firstEntity.kingdomId} size={32} className="shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-[#e49b7d]">
                <span className="font-semibold uppercase tracking-wider">
                  {isChar
                    ? firstEntity.isMilitary
                      ? `Foreign Military · ${firstEntity.militaryClass ?? 'Soldier'}`
                      : `Foreign Citizen · ${firstEntity.role}`
                    : `Foreign ${firstEntity.buildingClass}`}
                </span>
                <span aria-hidden="true">·</span>
                <span>{foreignKingdom.name}</span>
              </div>
              <h3 className="font-display text-sm sm:text-base font-bold text-[#F2E8D5] truncate">
                {firstEntity.name}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#B8AA96] truncate">
                {isChar
                  ? `${firstEntity.activityLabel || 'Operating independently'} · HP ${curHp}/${maxHp}`
                  : `${
                      firstEntity.constructionState === 'completed'
                        ? 'Operational'
                        : `Building (${Math.round(firstEntity.constructionProgress * 100)}%)`
                    } · Integrity ${curHp}/${maxHp}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onFocusEntity(firstEntity.id)}
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#D4A64A] hover:bg-[#e2b65a] text-xs font-semibold text-[#171512] transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <Focus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Focus</span>
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Deselect"
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Deselect</span>
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="w-full h-1.5 rounded bg-[#292017] overflow-hidden">
            <div
              className="h-full bg-[#c96a4b] transition-all duration-150"
              style={{ width: `${Math.max(2, hpPct)}%` }}
            />
          </div>
          <p className="hidden sm:block text-[11px] text-[#B8AA96]">
            Read-only intelligence view. Use your own soldiers to attack hostile targets or open Diplomacy to manage relations.
          </p>
        </div>
      </section>
    );
  }

  const selectedCharacters = selectedEntities.filter(
    (e): e is CharacterEntity => e.category === 'character' && e.kingdomId === playerKingdomId,
  );

  // 1. MILITARY UNITS SELECTED
  const selectedMilitary = selectedCharacters.filter((c) => c.isMilitary);
  if (selectedMilitary.length > 0) {
    const primary = selectedMilitary[0];
    const isMulti = selectedMilitary.length > 1;
    const currentFormation = primary.formation ?? 'line';
    const currentStance = primary.stance ?? 'defensive';
    const bp = primary.militaryClass ? MILITARY_UNIT_CATALOG[primary.militaryClass] : null;

    const totalHealth = selectedMilitary.reduce((acc, u) => acc + u.health, 0);
    const maxTotalHealth = selectedMilitary.reduce((acc, u) => acc + u.maxHealth, 0);
    const avgMorale = Math.round(
      selectedMilitary.reduce((acc, u) => acc + (u.morale ?? 100), 0) / selectedMilitary.length,
    );

    return (
      <section
        aria-label="Selected Military Command Panel"
        className="pointer-events-auto w-full max-w-4xl max-h-[38vh] md:max-h-[42vh] overflow-y-auto akanu-scroll rounded-md bg-[#171512]/96 border border-[#c44536]/80 px-3 sm:px-3.5 py-2.5 shadow-xl space-y-2"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#e07a5f] min-w-0">
                <span className="font-semibold uppercase tracking-wider truncate">
                  {isMulti
                    ? `Regiment (${selectedMilitary.length})`
                    : `${bp?.name ?? primary.name}`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-[#86efac]">Morale {avgMorale}%</span>
                <span className="hidden md:inline text-[#B8AA96]">· {KINGDOMS[primary.kingdomId].name}</span>
              </div>
              <button
                type="button"
                onClick={onClearSelection}
                aria-label="Deselect Military"
                className="sm:hidden w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] border border-[#76513A] text-[#F2E8D5] shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h3 className="font-display text-sm sm:text-base font-bold text-[#F2E8D5] truncate">
                {isMulti
                  ? `${selectedMilitary.length} Units · ${currentFormation.toUpperCase()}`
                  : primary.name}
              </h3>
              <span className="text-[11px] sm:text-xs text-[#fca5a5] truncate">
                {primary.activityLabel || 'Ready for orders'}
              </span>
            </div>

            <div className={`${mobileExpanded ? 'flex' : 'hidden md:flex'} flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#B8AA96]`}>
              <span>
                Health:{' '}
                <strong className="font-mono-num text-[#86efac]">
                  {Math.round(totalHealth)}/{Math.round(maxTotalHealth)}
                </strong>
              </span>
              {bp && (
                <>
                  <span>
                    Attack:{' '}
                    <strong className="font-mono-num text-[#F2E8D5]">{primary.attackDamage}</strong>
                  </span>
                  <span>
                    Armor:{' '}
                    <strong className="font-mono-num text-[#F2E8D5]">{primary.defense}</strong>
                  </span>
                  <span>
                    Range:{' '}
                    <strong className="font-mono-num text-[#F2E8D5]">{primary.attackRange}m</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-pressed={touchCommandMode === 'attack'}
              onClick={() => onSetTouchCommandMode(touchCommandMode === 'attack' ? 'select' : 'attack')}
              className={`min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap border transition-colors duration-150 ${
                touchCommandMode === 'attack'
                  ? 'bg-[#991b1b] border-[#f87171] text-[#F2E8D5]'
                  : 'bg-[#3b1212] hover:bg-[#521919] border-[#ef4444]/45 text-[#fca5a5]'
              }`}
            >
              <Swords className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{touchCommandMode === 'attack' ? 'Tap Enemy…' : 'Attack'}</span>
            </button>
            <button
              type="button"
              aria-pressed={touchCommandMode === 'move'}
              onClick={() => onSetTouchCommandMode(touchCommandMode === 'move' ? 'select' : 'move')}
              className={`min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap border transition-colors duration-150 ${
                touchCommandMode === 'move'
                  ? 'bg-[#2f7d4a] border-[#6ee7b7] text-[#F2E8D5]'
                  : 'bg-[#292017] hover:bg-[#362a1e] border-[#76513A] text-[#F2E8D5]'
              }`}
            >
              <Move className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{touchCommandMode === 'move' ? 'Tap Ground…' : 'Move'}</span>
            </button>
            <button
              type="button"
              onClick={onCancelVillagerTask}
              className={`${mobileExpanded ? 'inline-flex' : 'hidden sm:inline-flex'} min-h-[44px] sm:min-h-0 items-center gap-1 px-2.5 py-1.5 rounded bg-[#2c1915] hover:bg-[#3d221c] border border-[#a15243]/50 text-xs font-medium text-[#f2c6bd] transition-colors duration-150 cursor-pointer whitespace-nowrap`}
            >
              <OctagonX className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Halt</span>
            </button>
            <button
              type="button"
              onClick={() => onFocusEntity(primary.id)}
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#D4A64A] hover:bg-[#e2b65a] text-xs font-semibold text-[#171512] transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <Focus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Focus</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileExpanded((v) => !v)}
              aria-expanded={mobileExpanded}
              className="md:hidden min-h-[44px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#292017] border border-[#A77A32]/65 text-xs font-semibold text-[#D4A64A] cursor-pointer whitespace-nowrap ml-auto"
            >
              {mobileExpanded ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{mobileExpanded ? 'Less' : 'Tactics'}</span>
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Deselect Military"
              className="hidden sm:inline-flex items-center justify-center p-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Tactical Formations & Combat Stance Controls */}
        <div className={`${mobileExpanded ? 'flex' : 'hidden md:flex'} pt-1.5 border-t border-[#76513A]/45 flex-wrap items-center justify-between gap-2 text-xs`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[#B8AA96]">Formation:</span>
            {FORMATION_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={currentFormation === f.id}
                onClick={() => onSetFormation?.(f.id)}
                className={`min-h-[40px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 sm:px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors duration-150 whitespace-nowrap ${
                  currentFormation === f.id
                    ? 'bg-[#D4A64A] text-[#171512]'
                    : 'bg-[#292017] hover:bg-[#362a1e] border border-[#76513A]/60 text-[#F2E8D5]'
                }`}
              >
                {f.renderIcon()}
                <span>{f.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[#B8AA96]">Stance:</span>
            {(['aggressive', 'defensive', 'stand_ground'] as MilitaryStance[]).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={currentStance === st}
                onClick={() => onSetStance?.(st)}
                className={`min-h-[40px] sm:min-h-0 px-2.5 sm:px-2 py-1 rounded text-[11px] capitalize font-medium cursor-pointer transition-colors duration-150 whitespace-nowrap ${
                  currentStance === st
                    ? 'bg-[#b91c1c] text-[#F2E8D5]'
                    : 'bg-[#292017] hover:bg-[#362a1e] border border-[#76513A]/60 text-[#B8AA96]'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // 2. CIVILIAN WORKFORCE SELECTED
  const selectedVillagers = selectedCharacters.filter((c) => !c.isMilitary);
  if (selectedVillagers.length > 0) {
    const primary = selectedVillagers[0];
    const isMulti = selectedVillagers.length > 1;

    const resolveWorkplaceName = (v: CharacterEntity): string => {
      if (v.assignedBuildingId) {
        return allEntities.find((e) => e.id === v.assignedBuildingId)?.name ?? 'Assigned Structure';
      }
      if (v.assignedNodeId) {
        return allEntities.find((e) => e.id === v.assignedNodeId)?.name ?? 'Resource Site';
      }
      if (v.deliveryBuildingId) {
        return allEntities.find((e) => e.id === v.deliveryBuildingId)?.name ?? 'Storehouse';
      }
      return 'Unassigned';
    };

    const roleSummary = isMulti
      ? Array.from(new Set(selectedVillagers.map((v) => v.role))).join(', ')
      : primary.role;

    const totalCarried = Math.round(
      selectedVillagers.reduce((acc, v) => acc + v.carriedAmount, 0),
    );

    return (
      <section
        aria-label="Selected Villager Command Panel"
        className="pointer-events-auto w-full max-w-4xl max-h-[38vh] md:max-h-[42vh] overflow-y-auto akanu-scroll rounded-md bg-[#171512]/96 border border-[#A77A32]/75 px-3 sm:px-3.5 py-2.5 shadow-xl space-y-2"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#D4A64A] min-w-0">
                <span className="truncate">
                  {isMulti
                    ? `Workforce (${selectedVillagers.length})`
                    : `${primary.role} · ${Math.round(primary.productivity * 100)}%`}
                </span>
                <span className="hidden md:inline text-[#B8AA96]">
                  · {KINGDOMS[primary.kingdomId].name}
                </span>
              </div>
              <button
                type="button"
                onClick={onClearSelection}
                aria-label="Deselect Villagers"
                className="sm:hidden w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] border border-[#76513A] text-[#F2E8D5] shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h3 className="font-display text-sm sm:text-base font-bold text-[#F2E8D5] truncate">
                {isMulti ? `${selectedVillagers.length} Villagers Selected` : primary.name}
              </h3>
              <span className="text-[11px] sm:text-xs text-[#D4A64A] truncate">
                {isMulti ? `Roles: ${roleSummary}` : primary.activityLabel}
              </span>
            </div>

            {!isMulti ? (
              <div className={`${mobileExpanded ? 'flex' : 'hidden md:flex'} flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#B8AA96]`}>
                <span>
                  Workplace:{' '}
                  <strong className="font-semibold text-[#F2E8D5]">
                    {resolveWorkplaceName(primary)}
                  </strong>
                </span>
                <span>
                  Cargo:{' '}
                  <strong className="font-mono-num font-semibold text-[#F2E8D5]">
                    {Math.floor(primary.carriedAmount)}/{primary.carryCapacity}{' '}
                    {primary.carriedResource ? primary.carriedResource : 'empty'}
                  </strong>
                </span>
                <span>
                  Health:{' '}
                  <span className="font-mono-num text-[#F2E8D5]">
                    {Math.round(primary.health)}/{Math.round(primary.maxHealth)}
                  </span>
                </span>
              </div>
            ) : (
              <div className={`${mobileExpanded ? 'block' : 'hidden md:block'} text-xs text-[#B8AA96]`}>
                Combined Cargo:{' '}
                <strong className="font-mono-num text-[#F2E8D5]">{totalCarried}</strong> units ·
                Tap any tree, deposit, farm, or construction site to command.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-pressed={touchCommandMode === 'move'}
              onClick={() =>
                onSetTouchCommandMode(touchCommandMode === 'move' ? 'select' : 'move')
              }
              className={`min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap border transition-colors duration-150 ${
                touchCommandMode === 'move'
                  ? 'bg-[#2f7d4a] border-[#6ee7b7] text-[#F2E8D5]'
                  : 'bg-[#292017] hover:bg-[#362a1e] border-[#76513A] text-[#F2E8D5]'
              }`}
            >
              <Move className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{touchCommandMode === 'move' ? 'Tap Ground…' : 'Move To'}</span>
            </button>
            <button
              type="button"
              aria-pressed={touchCommandMode === 'assign'}
              onClick={() =>
                onSetTouchCommandMode(touchCommandMode === 'assign' ? 'select' : 'assign')
              }
              className={`min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap border transition-colors duration-150 ${
                touchCommandMode === 'assign'
                  ? 'bg-[#D4A64A] border-[#F2E8D5]/60 text-[#171512]'
                  : 'bg-[#292017] hover:bg-[#362a1e] border-[#76513A] text-[#F2E8D5]'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{touchCommandMode === 'assign' ? 'Tap Site…' : 'Assign Site'}</span>
            </button>
            <button
              type="button"
              onClick={onCancelVillagerTask}
              className={`${mobileExpanded ? 'inline-flex' : 'hidden sm:inline-flex'} min-h-[44px] sm:min-h-0 items-center gap-1 px-2.5 py-1.5 rounded bg-[#2c1915] hover:bg-[#3d221c] border border-[#a15243]/50 text-xs font-medium text-[#f2c6bd] transition-colors duration-150 cursor-pointer whitespace-nowrap`}
            >
              <OctagonX className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Stop</span>
            </button>
            <button
              type="button"
              onClick={() => onFocusEntity(primary.id)}
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#D4A64A] hover:bg-[#e2b65a] text-xs font-semibold text-[#171512] transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <Focus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Focus</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileExpanded((v) => !v)}
              aria-expanded={mobileExpanded}
              className="md:hidden min-h-[44px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#292017] border border-[#A77A32]/65 text-xs font-semibold text-[#D4A64A] cursor-pointer whitespace-nowrap ml-auto"
            >
              {mobileExpanded ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{mobileExpanded ? 'Less' : 'Roles'}</span>
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Deselect Villagers"
              className="hidden sm:inline-flex items-center justify-center p-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Direct Occupation Reassignment Strip */}
        <div className={`${mobileExpanded ? 'flex' : 'hidden md:flex'} pt-1.5 border-t border-[#76513A]/45 flex-wrap items-center gap-1.5`}>
          <span className="text-[11px] uppercase tracking-wider text-[#B8AA96] mr-1">
            Assign Role:
          </span>
          {OCCUPATION_BUTTONS.map((btn) => {
            const isActive =
              !isMulti &&
              primary.role === btn.role &&
              (btn.role !== 'Miner' || primary.preferredResource === btn.preferredResource);
            return (
              <button
                key={btn.label}
                type="button"
                aria-pressed={isActive}
                onClick={() => onAssignOccupation(btn.role, btn.preferredResource)}
                className={`min-h-[40px] sm:min-h-0 px-2.5 sm:px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#D4A64A] text-[#171512]'
                    : 'bg-[#292017] hover:bg-[#362a1e] border border-[#76513A]/55 text-[#F2E8D5]'
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  const single = selectedEntities[0];

  // 3. BUILDING / MILITARY RECRUITMENT FACILITY INSPECTOR
  if (single.category === 'building') {
    const bld: BuildingEntity = single;
    const blueprint = BUILDING_CATALOG[bld.archetype];
    const isUnderConstruction = bld.constructionState !== 'completed';
    const progressPct = Math.round(bld.constructionProgress * 100);

    const availableRecruits = !isUnderConstruction
      ? getMilitaryUnitsForBuilding(bld.archetype)
      : [];

    const canAcceptWorkers =
      isUnderConstruction ||
      bld.archetype === 'cultivated_farm' ||
      bld.archetype === 'market_courtyard' ||
      bld.archetype === 'mine_pit' ||
      bld.archetype === 'blacksmith_workshop' ||
      bld.archetype === 'weapon_workshop';

    return (
      <section
        aria-label="Selected Building Information"
        className="pointer-events-auto w-full max-w-3xl max-h-[40vh] md:max-h-[44vh] overflow-y-auto akanu-scroll rounded-md bg-[#171512]/96 border border-[#A77A32]/75 px-3 sm:px-4 py-2.5 sm:py-3 shadow-xl space-y-2"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-[#D4A64A] min-w-0">
                <span>{bld.buildingClass}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-[#B8AA96]">
                  HP {Math.round(bld.integrity)}/{bld.maxIntegrity}
                </span>
                <span className="hidden md:inline text-[#B8AA96]">· {KINGDOMS[bld.kingdomId].name}</span>
              </div>
              <button
                type="button"
                onClick={onClearSelection}
                aria-label="Deselect Building"
                className="sm:hidden w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] border border-[#76513A] text-[#F2E8D5] shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <h3 className="font-display text-sm sm:text-lg font-bold text-[#F2E8D5] truncate">
              {bld.name}
            </h3>

            <p className="text-[11px] sm:text-xs text-[#B8AA96] truncate">
              {isUnderConstruction ? bld.statusText : blueprint.economicRoleSummary}
            </p>

            {!isUnderConstruction && bld.maxWorkers > 0 && (
              <p className={`${mobileExpanded ? 'block' : 'hidden md:block'} text-xs text-[#F2E8D5] font-mono-num`}>
                Active Workers: {bld.assignedWorkerIds.length}/{bld.maxWorkers}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {canAcceptWorkers && (
              <button
                type="button"
                onClick={() => onDispatchWorkerToEntity(bld.id)}
                className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#2d6a3e] hover:bg-[#38824d] border border-[#6ee7b7]/40 text-xs font-semibold text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                {isUnderConstruction ? (
                  <Hammer className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{isUnderConstruction ? 'Dispatch Builder' : 'Assign Worker'}</span>
              </button>
            )}
            {isUnderConstruction && (
              <button
                type="button"
                onClick={() => onCancelConstruction(bld.id)}
                className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#3a1d18] hover:bg-[#4d2620] border border-[#c86454]/50 text-xs font-medium text-[#f5c2b8] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Cancel Site</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onFocusEntity(bld.id)}
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#D4A64A] hover:bg-[#e2b65a] text-xs font-semibold text-[#171512] transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <Focus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Focus</span>
            </button>
            {availableRecruits.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileExpanded((v) => !v)}
                aria-expanded={mobileExpanded}
                className="md:hidden min-h-[44px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#292017] border border-[#A77A32]/65 text-xs font-semibold text-[#D4A64A] cursor-pointer whitespace-nowrap ml-auto"
              >
                {mobileExpanded ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />}
                <span>{mobileExpanded ? 'Less' : 'Recruit'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClearSelection}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Deselect</span>
            </button>
          </div>
        </div>

        {isUnderConstruction && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] text-[#B8AA96] font-mono-num">
              <span>
                {bld.constructionState === 'planned'
                  ? 'Foundation Staked — Waiting for Builder Arrival'
                  : 'Scaffolding Active'}
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-2 rounded bg-[#292017] overflow-hidden">
              <div
                className="h-full bg-[#D4A64A] transition-all duration-150"
                style={{ width: `${Math.max(4, progressPct)}%` }}
              />
            </div>
          </div>
        )}

        {!isUnderConstruction && bld.archetype === 'cultivated_farm' && (
          (() => {
            const moisturePct = Math.round((bld.soilMoisture ?? 0.35) * 100);
            const growthPct = Math.round((bld.cropGrowthProgress ?? 0.25) * 100);
            const stageNames = [
              'Seeded Furrows',
              'Tender Sprouts',
              'Leafy Stalks',
              'Ripening Panicles',
              'Golden Harvest Ready',
            ];
            const stageIdx = Math.max(0, Math.min(4, bld.cropGrowthStage ?? 1));
            const assignedFarmers = allEntities.filter(
              (e): e is CharacterEntity =>
                e.category === 'character' &&
                e.assignedBuildingId === bld.id &&
                e.role === 'Farmer',
            );
            const hydroText =
              assignedFarmers.find((f) => f.hydroPhase && f.hydroPhase !== 'idle')?.activityLabel ??
              (moisturePct < 40 ? 'Needs river irrigation' : 'Hydrated & growing');

            return (
              <div className="pt-1.5 border-t border-[#76513A]/45 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="space-y-1">
                  <div className="flex justify-between text-[#B8AA96] font-mono-num">
                    <span>Soil Moisture</span>
                    <span className={moisturePct < 35 ? 'text-[#fbbf24]' : 'text-[#67e8f9]'}>
                      {moisturePct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded bg-[#292017] overflow-hidden">
                    <div
                      className="h-full bg-[#38bdf8] transition-all duration-200"
                      style={{ width: `${Math.max(4, moisturePct)}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[#B8AA96] font-mono-num">
                    <span>{stageNames[stageIdx]}</span>
                    <span className="text-[#86efac]">{growthPct}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded bg-[#292017] overflow-hidden">
                    <div
                      className="h-full bg-[#84cc16] transition-all duration-200"
                      style={{ width: `${Math.max(4, growthPct)}%` }}
                    />
                  </div>
                </div>
                <p className="sm:col-span-2 text-[11px] text-[#D4A64A] truncate">{hydroText}</p>
              </div>
            );
          })()
        )}

        {/* Phase 3 Military Recruitment Yard: Units & Progress Queue */}
        {availableRecruits.length > 0 && (
          <div className={`${mobileExpanded ? 'block' : 'hidden md:block'} pt-2 border-t border-[#76513A]/45 space-y-2`}>
            <div className="flex items-center justify-between text-xs text-[#D4A64A]">
              <span className="font-semibold uppercase tracking-wider">Muster & Recruitment</span>
              {bld.recruitmentQueue && bld.recruitmentQueue.length > 0 && (
                <span className="font-mono-num text-[11px]">
                  Queue ({bld.recruitmentQueue.length}/5)
                </span>
              )}
            </div>

            {/* Recruitment Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {availableRecruits.map((unit: MilitaryUnitBlueprint) => (
                <div
                  key={unit.unitClass}
                  className="rounded bg-[#292017]/80 border border-[#76513A]/60 p-2 flex flex-col justify-between gap-1.5 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#F2E8D5]">{unit.name}</span>
                      <span className="text-[10px] text-[#D4A64A] font-mono-num">
                        {unit.recruitmentDurationSec}s
                      </span>
                    </div>
                    <p className="text-[11px] text-[#B8AA96] mt-0.5 line-clamp-2">
                      {unit.tacticalRole}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#76513A]/40">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono-num text-[#F2E8D5]">
                      {unit.cost.food > 0 && (
                        <span className="flex items-center gap-0.5">
                          <ResourceIcon type="food" size={11} /> {unit.cost.food}
                        </span>
                      )}
                      {unit.cost.wood > 0 && (
                        <span className="flex items-center gap-0.5">
                          <ResourceIcon type="wood" size={11} /> {unit.cost.wood}
                        </span>
                      )}
                      {unit.cost.iron > 0 && (
                        <span className="flex items-center gap-0.5">
                          <ResourceIcon type="iron" size={11} /> {unit.cost.iron}
                        </span>
                      )}
                      {unit.cost.gold > 0 && (
                        <span className="flex items-center gap-0.5">
                          <ResourceIcon type="gold" size={11} /> {unit.cost.gold}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRecruitUnit?.(bld.id, unit.unitClass)}
                      className="px-2.5 py-1 rounded bg-[#9e3a24] hover:bg-[#b84830] border border-[#f87171]/45 font-semibold text-xs text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      Recruit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Active Training Progress Bar */}
            {bld.recruitmentQueue && bld.recruitmentQueue.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {bld.recruitmentQueue.map((item, qIdx) => {
                  const pct = Math.min(
                    100,
                    Math.round((item.progressSec / Math.max(0.1, item.totalDurationSec)) * 100),
                  );
                  const qUnit = MILITARY_UNIT_CATALOG[item.unitClass];
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 bg-[#292017] border border-[#76513A]/55 px-2.5 py-1.5 rounded text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-semibold text-[#F2E8D5]">
                            {qIdx === 0 ? `Mustering ${qUnit.name}` : `Queued: ${qUnit.name}`}
                          </span>
                          <span className="font-mono-num text-[#86efac]">
                            {qIdx === 0
                              ? `${Math.round(item.progressSec)}s / ${item.totalDurationSec}s`
                              : 'Waiting'}
                          </span>
                        </div>
                        {qIdx === 0 && (
                          <div className="w-full h-1.5 rounded bg-[#171512] overflow-hidden">
                            <div
                              className="h-full bg-[#86efac] transition-all duration-150"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={`Cancel recruitment of ${qUnit.name}`}
                        onClick={() => onCancelRecruitment?.(bld.id, qIdx)}
                        className="inline-flex items-center justify-center p-1 rounded bg-[#3a1d18] hover:bg-[#4d2620] border border-[#c86454]/50 text-[#f5c2b8] cursor-pointer"
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  // 4. NATURAL RESOURCE DEPOSIT / TREE / FISHERY / HUNTING GROUND INSPECTOR
  if (single.category !== 'resource_node') return null;
  const node: EnvironmentNodeEntity = single;
  const yieldPct = Math.round(
    (Math.max(0, node.remainingYield) / Math.max(1, node.maxYield)) * 100,
  );

  return (
    <section
      aria-label="Selected Resource Node Information"
      className="pointer-events-auto w-full max-w-3xl rounded-md bg-[#171512]/96 border border-[#A77A32]/75 px-3 sm:px-4 py-2.5 sm:py-3 shadow-xl space-y-2"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-[#D4A64A] min-w-0">
              <span className="capitalize">{node.nodeKind.replace(/_/g, ' ')}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-[#86efac]">
                {node.depleted
                  ? 'Depleted'
                  : `${Math.round(node.remainingYield)}/${node.maxYield} ${node.resourceType}`}
              </span>
              <span className="hidden md:inline text-[#B8AA96]">· {node.richnessLabel}</span>
            </div>
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Deselect Resource"
              className="sm:hidden w-8 h-8 inline-flex items-center justify-center rounded bg-[#292017] border border-[#76513A] text-[#F2E8D5] shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <h3 className="font-display text-sm sm:text-lg font-bold text-[#F2E8D5] truncate">
            {node.name}
          </h3>

          <p className="hidden sm:block text-xs text-[#B8AA96]">{node.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onDispatchWorkerToEntity(node.id)}
            disabled={node.depleted}
            className={`min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
              node.depleted
                ? 'bg-[#292017] text-[#B8AA96]/50 cursor-not-allowed'
                : 'bg-[#2d6a3e] hover:bg-[#38824d] border border-[#6ee7b7]/40 text-[#F2E8D5] cursor-pointer'
            }`}
          >
            <Pickaxe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Dispatch Gatherer</span>
          </button>
          <button
            type="button"
            onClick={() => onFocusEntity(node.id)}
            className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#D4A64A] hover:bg-[#e2b65a] text-xs font-semibold text-[#171512] transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <Focus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Focus</span>
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Deselect</span>
          </button>
        </div>
      </div>

      <div className="space-y-1 pt-0.5">
        <div className="flex justify-between text-[11px] text-[#B8AA96] font-mono-num">
          <span>Remaining Seam Yield</span>
          <span>{yieldPct}%</span>
        </div>
        <div className="w-full h-1.5 sm:h-2 rounded bg-[#292017] overflow-hidden">
          <div
            className={`h-full transition-all duration-150 ${
              node.depleted ? 'bg-[#991b1b]' : 'bg-[#D4A64A]'
            }`}
            style={{ width: `${Math.max(2, yieldPct)}%` }}
          />
        </div>
      </div>
    </section>
  );
};
