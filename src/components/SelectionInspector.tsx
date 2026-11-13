import React, { useState } from 'react';
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
  MilitaryFormationType,
  MilitaryStance,
  MilitaryUnitClass,
  ResourceKey,
  SelectableEntity,
  TouchCommandMode,
} from '../types/game';
import { ResourceIcon } from './KingdomEmblem';

interface SelectionInspectorProps {
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

const FORMATION_OPTIONS: { id: MilitaryFormationType; label: string; icon: string }[] = [
  { id: 'line', label: 'Line', icon: '⎯⎯⎯' },
  { id: 'defensive', label: 'Phalanx', icon: '🛡' },
  { id: 'wedge', label: 'Wedge', icon: '▲' },
  { id: 'square', label: 'Square', icon: '■' },
  { id: 'flanking', label: 'Flank', icon: '⟨ ⟩' },
];

export const SelectionInspector: React.FC<SelectionInspectorProps> = ({
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
  onMilitaryAttack,
}) => {
  if (selectedEntities.length === 0) return null;

  const selectedCharacters = selectedEntities.filter(
    (e): e is CharacterEntity => e.category === 'character',
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
        className="pointer-events-auto w-full max-w-4xl rounded-md bg-[#17100b]/96 border border-[#c44536]/75 px-3.5 py-2.5 shadow-xl space-y-2"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#e07a5f]">
              <span className="font-semibold uppercase tracking-wider">
                {isMulti
                  ? `Military Regiment (${selectedMilitary.length} Soldiers)`
                  : `${bp?.category ?? 'Military'} · ${bp?.name ?? primary.name}`}
              </span>
              <span aria-hidden="true">·</span>
              <span>{KINGDOMS[primary.kingdomId].name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-[#86efac]">Morale {avgMorale}%</span>
              {primary.isMounted && <span>· Mounted</span>}
              {primary.isCommander && <span className="text-[#f6d27a]">· Commander (+18m Aura)</span>}
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h3 className="font-display text-sm sm:text-base font-bold text-[#fbf3e4] truncate">
                {isMulti
                  ? `${selectedMilitary.length} Units in ${currentFormation.toUpperCase()} Formation`
                  : primary.name}
              </h3>
              <span className="text-xs text-[#fca5a5]">
                {primary.activityLabel || 'Ready for orders'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#d6c8b0]">
              <span>
                Health:{' '}
                <strong className="font-mono-num text-[#86efac]">
                  {totalHealth}/{maxTotalHealth}
                </strong>
              </span>
              {bp && (
                <>
                  <span>
                    Attack:{' '}
                    <strong className="font-mono-num text-[#fbf3e4]">{primary.attackDamage}</strong>
                  </span>
                  <span>
                    Armor:{' '}
                    <strong className="font-mono-num text-[#fbf3e4]">{primary.defense}</strong>
                  </span>
                  <span>
                    Range:{' '}
                    <strong className="font-mono-num text-[#fbf3e4]">{primary.attackRange}m</strong>
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
              className={`px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap border ${
                touchCommandMode === 'attack'
                  ? 'bg-[#991b1b] border-[#f87171] text-[#fbf3e4]'
                  : 'bg-[#3b1212] hover:bg-[#521919] border-[#ef4444]/40 text-[#fca5a5]'
              }`}
            >
              {touchCommandMode === 'attack' ? 'Tap Enemy…' : 'Attack'}
            </button>
            <button
              type="button"
              aria-pressed={touchCommandMode === 'move'}
              onClick={() => onSetTouchCommandMode(touchCommandMode === 'move' ? 'select' : 'move')}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap border ${
                touchCommandMode === 'move'
                  ? 'bg-[#2f7d4a] border-[#6ee7b7] text-[#fbf3e4]'
                  : 'bg-[#241b13] hover:bg-[#33261a] border-[#8f6c38]/45 text-[#ebdcc4]'
              }`}
            >
              {touchCommandMode === 'move' ? 'Tap Ground…' : 'Move'}
            </button>
            <button
              type="button"
              onClick={onCancelVillagerTask}
              className="px-2.5 py-1.5 rounded bg-[#2c1915] hover:bg-[#3d221c] border border-[#a15243]/45 text-xs font-medium text-[#f2c6bd] cursor-pointer whitespace-nowrap"
            >
              Halt
            </button>
            <button
              type="button"
              onClick={() => onFocusEntity(primary.id)}
              className="px-2.5 py-1.5 rounded bg-[#c98f32] hover:bg-[#dba03f] text-xs font-semibold text-[#171008] cursor-pointer whitespace-nowrap"
            >
              Focus
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Deselect Military"
              className="px-2 py-1.5 rounded bg-[#261c14] hover:bg-[#36281c] border border-[#8f6c38]/40 text-xs text-[#e5d8c0] cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tactical Formations & Combat Stance Controls */}
        <div className="pt-1.5 border-t border-[#8f6c38]/25 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[#b8a586]">Formation:</span>
            {FORMATION_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={currentFormation === f.id}
                onClick={() => onSetFormation?.(f.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  currentFormation === f.id
                    ? 'bg-[#c98f32] text-[#171008]'
                    : 'bg-[#221911] hover:bg-[#312419] border border-[#8f6c38]/30 text-[#e8dac3]'
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[#b8a586]">Stance:</span>
            {(['aggressive', 'defensive', 'stand_ground'] as MilitaryStance[]).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={currentStance === st}
                onClick={() => onSetStance?.(st)}
                className={`px-2 py-0.5 rounded text-[11px] capitalize font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  currentStance === st
                    ? 'bg-[#b91c1c] text-[#fbf3e4]'
                    : 'bg-[#221911] hover:bg-[#312419] border border-[#8f6c38]/30 text-[#d6c8b0]'
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
        className="pointer-events-auto w-full max-w-4xl rounded-md bg-[#16100b]/96 border border-[#d69f42]/55 px-3.5 py-2.5 shadow-xl space-y-2"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#d8b167]">
              <span>
                {isMulti
                  ? `Workforce Group (${selectedVillagers.length} Villagers)`
                  : `Economic Citizen · ${primary.role}`}
              </span>
              <span aria-hidden="true">·</span>
              <span>{KINGDOMS[primary.kingdomId].name}</span>
              {!isMulti && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-[#b8a586]">
                    Productivity {Math.round(primary.productivity * 100)}%
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h3 className="font-display text-sm sm:text-base font-bold text-[#fbf3e4] truncate">
                {isMulti ? `${selectedVillagers.length} Villagers Selected` : primary.name}
              </h3>
              <span className="text-xs text-[#e8c67a]">
                {isMulti ? `Roles: ${roleSummary}` : primary.activityLabel}
              </span>
            </div>

            {!isMulti ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#d6c8b0]">
                <span>
                  Workplace:{' '}
                  <strong className="font-semibold text-[#f5ead6]">
                    {resolveWorkplaceName(primary)}
                  </strong>
                </span>
                <span>
                  Cargo:{' '}
                  <strong className="font-mono-num font-semibold text-[#f5ead6]">
                    {Math.floor(primary.carriedAmount)}/{primary.carryCapacity}{' '}
                    {primary.carriedResource ? primary.carriedResource : 'empty'}
                  </strong>
                </span>
                <span>
                  Health:{' '}
                  <span className="font-mono-num">
                    {primary.health}/{primary.maxHealth}
                  </span>
                </span>
              </div>
            ) : (
              <div className="text-xs text-[#d6c8b0]">
                Combined Cargo:{' '}
                <strong className="font-mono-num text-[#f5ead6]">{totalCarried}</strong> units ·
                Right-click any tree, deposit, farm, or construction site to command the group.
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
              className={`px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap border ${
                touchCommandMode === 'move'
                  ? 'bg-[#2f7d4a] border-[#6ee7b7] text-[#fbf3e4]'
                  : 'bg-[#241b13] hover:bg-[#33261a] border-[#8f6c38]/45 text-[#ebdcc4]'
              }`}
            >
              {touchCommandMode === 'move' ? 'Tap Ground…' : 'Move To'}
            </button>
            <button
              type="button"
              aria-pressed={touchCommandMode === 'assign'}
              onClick={() =>
                onSetTouchCommandMode(touchCommandMode === 'assign' ? 'select' : 'assign')
              }
              className={`px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap border ${
                touchCommandMode === 'assign'
                  ? 'bg-[#b57a24] border-[#fde68a] text-[#171008]'
                  : 'bg-[#241b13] hover:bg-[#33261a] border-[#8f6c38]/45 text-[#ebdcc4]'
              }`}
            >
              {touchCommandMode === 'assign' ? 'Tap Site…' : 'Assign Site'}
            </button>
            <button
              type="button"
              onClick={onCancelVillagerTask}
              className="px-2.5 py-1.5 rounded bg-[#2c1915] hover:bg-[#3d221c] border border-[#a15243]/45 text-xs font-medium text-[#f2c6bd] cursor-pointer whitespace-nowrap"
            >
              Stop
            </button>
            <button
              type="button"
              onClick={() => onFocusEntity(primary.id)}
              className="px-2.5 py-1.5 rounded bg-[#c98f32] hover:bg-[#dba03f] text-xs font-semibold text-[#171008] cursor-pointer whitespace-nowrap"
            >
              Focus
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Deselect Villagers"
              className="px-2 py-1.5 rounded bg-[#261c14] hover:bg-[#36281c] border border-[#8f6c38]/40 text-xs text-[#e5d8c0] cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Direct Occupation Reassignment Strip */}
        <div className="pt-1.5 border-t border-[#8f6c38]/25 flex flex-wrap items-center gap-1">
          <span className="text-[11px] uppercase tracking-wider text-[#b8a586] mr-1">
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
                className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#c98f32] text-[#171008]'
                    : 'bg-[#221911] hover:bg-[#312419] border border-[#8f6c38]/30 text-[#e8dac3]'
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
        className="pointer-events-auto w-full max-w-3xl rounded-md bg-[#16100b]/96 border border-[#d69f42]/55 px-4 py-3 shadow-xl space-y-2.5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#d8b167]">
              <span>{bld.buildingClass} Structure</span>
              <span aria-hidden="true">·</span>
              <span>{KINGDOMS[bld.kingdomId].name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-[#b8a586]">
                Integrity {Math.round(bld.integrity)}/{bld.maxIntegrity}
              </span>
            </div>

            <h3 className="font-display text-base sm:text-lg font-bold text-[#fbf3e4] truncate">
              {bld.name}
            </h3>

            <p className="text-xs text-[#d6c8b0]">
              {isUnderConstruction ? bld.statusText : blueprint.economicRoleSummary}
            </p>

            {!isUnderConstruction && bld.maxWorkers > 0 && (
              <p className="text-xs text-[#cbb899] font-mono-num">
                Active Workers: {bld.assignedWorkerIds.length}/{bld.maxWorkers}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {canAcceptWorkers && (
              <button
                type="button"
                onClick={() => onDispatchWorkerToEntity(bld.id)}
                className="px-3 py-1.5 rounded bg-[#2d6a3e] hover:bg-[#38824d] border border-[#6ee7b7]/35 text-xs font-semibold text-[#fbf3e4] cursor-pointer whitespace-nowrap"
              >
                {isUnderConstruction ? 'Dispatch Builder' : 'Assign Worker'}
              </button>
            )}
            {isUnderConstruction && (
              <button
                type="button"
                onClick={() => onCancelConstruction(bld.id)}
                className="px-2.5 py-1.5 rounded bg-[#3a1d18] hover:bg-[#4d2620] border border-[#c86454]/45 text-xs font-medium text-[#f5c2b8] cursor-pointer whitespace-nowrap"
              >
                Cancel Site
              </button>
            )}
            <button
              type="button"
              onClick={() => onFocusEntity(bld.id)}
              className="px-3 py-1.5 rounded bg-[#c98f32] hover:bg-[#dba03f] text-xs font-semibold text-[#171008] cursor-pointer whitespace-nowrap"
            >
              Focus
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="px-2.5 py-1.5 rounded bg-[#261c14] hover:bg-[#36281c] border border-[#8f6c38]/40 text-xs text-[#e5d8c0] cursor-pointer"
            >
              Deselect
            </button>
          </div>
        </div>

        {isUnderConstruction && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] text-[#d6c8b0] font-mono-num">
              <span>
                {bld.constructionState === 'planned'
                  ? 'Foundation Staked — Waiting for Builder Arrival'
                  : 'Scaffolding Active'}
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-2 rounded bg-[#261c14] overflow-hidden">
              <div
                className="h-full bg-[#d69f42] transition-all duration-200"
                style={{ width: `${Math.max(4, progressPct)}%` }}
              />
            </div>
          </div>
        )}

        {/* Phase 3 Military Recruitment Yard: Units & Progress Queue */}
        {availableRecruits.length > 0 && (
          <div className="pt-2 border-t border-[#8f6c38]/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#e8c67a]">
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
                  className="rounded bg-[#201710] border border-[#6f5434]/40 p-2 flex flex-col justify-between gap-1.5 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#fbf3e4]">{unit.name}</span>
                      <span className="text-[10px] text-[#d8b167] font-mono-num">
                        {unit.recruitmentDurationSec}s
                      </span>
                    </div>
                    <p className="text-[11px] text-[#cfbe9e] mt-0.5 line-clamp-2">
                      {unit.tacticalRole}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[#5a4227]/30">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono-num text-[#fbf3e4]">
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
                      className="px-2 py-1 rounded bg-[#9e3a24] hover:bg-[#b84830] border border-[#f87171]/40 font-semibold text-xs text-[#fbf3e4] cursor-pointer whitespace-nowrap"
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
                      className="flex items-center justify-between gap-2 bg-[#251910] border border-[#6f5434]/35 px-2.5 py-1.5 rounded text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-semibold text-[#fbf3e4]">
                            {qIdx === 0 ? `Mustering ${qUnit.name}` : `Queued: ${qUnit.name}`}
                          </span>
                          <span className="font-mono-num text-[#86efac]">
                            {qIdx === 0
                              ? `${Math.round(item.progressSec)}s / ${item.totalDurationSec}s`
                              : 'Waiting'}
                          </span>
                        </div>
                        {qIdx === 0 && (
                          <div className="w-full h-1.5 rounded bg-[#150e09] overflow-hidden">
                            <div
                              className="h-full bg-[#86efac] transition-all duration-200"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onCancelRecruitment?.(bld.id, qIdx)}
                        className="px-1.5 py-0.5 rounded bg-[#3a1d18] hover:bg-[#4d2620] border border-[#c86454]/45 text-[10px] text-[#f5c2b8] cursor-pointer"
                      >
                        ✕
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
      className="pointer-events-auto w-full max-w-3xl rounded-md bg-[#16100b]/96 border border-[#d69f42]/55 px-4 py-3 shadow-xl space-y-2"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#d8b167]">
            <span className="capitalize">{node.nodeKind.replace(/_/g, ' ')}</span>
            <span aria-hidden="true">·</span>
            <span>{node.richnessLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-[#86efac]">
              {node.depleted
                ? 'Depleted'
                : `${Math.round(node.remainingYield)}/${node.maxYield} ${node.resourceType}`}
            </span>
          </div>

          <h3 className="font-display text-base sm:text-lg font-bold text-[#fbf3e4] truncate">
            {node.name}
          </h3>

          <p className="text-xs text-[#d6c8b0]">{node.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onDispatchWorkerToEntity(node.id)}
            disabled={node.depleted}
            className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap ${
              node.depleted
                ? 'bg-[#282019] text-[#7a6b57] cursor-not-allowed'
                : 'bg-[#2d6a3e] hover:bg-[#38824d] border border-[#6ee7b7]/35 text-[#fbf3e4] cursor-pointer'
            }`}
          >
            Dispatch Gatherer
          </button>
          <button
            type="button"
            onClick={() => onFocusEntity(node.id)}
            className="px-3 py-1.5 rounded bg-[#c98f32] hover:bg-[#dba03f] text-xs font-semibold text-[#171008] cursor-pointer whitespace-nowrap"
          >
            Focus
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="px-2.5 py-1.5 rounded bg-[#261c14] hover:bg-[#36281c] border border-[#8f6c38]/40 text-xs text-[#e5d8c0] cursor-pointer"
          >
            Deselect
          </button>
        </div>
      </div>

      <div className="space-y-1 pt-1">
        <div className="flex justify-between text-[11px] text-[#d6c8b0] font-mono-num">
          <span>Remaining Seam Yield</span>
          <span>{yieldPct}%</span>
        </div>
        <div className="w-full h-2 rounded bg-[#261c14] overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              node.depleted ? 'bg-[#991b1b]' : 'bg-[#eab308]'
            }`}
            style={{ width: `${Math.max(2, yieldPct)}%` }}
          />
        </div>
      </div>
    </section>
  );
};
