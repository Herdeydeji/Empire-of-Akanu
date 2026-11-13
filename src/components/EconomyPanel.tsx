import React from 'react';
import {
  ASSIGNABLE_OCCUPATIONS,
  KINGDOM_ECONOMIC_BONUSES,
  OCCUPATION_CONFIGS,
  RESOURCE_KEYS,
} from '../config/economy';
import { KINGDOMS } from '../config/kingdoms';
import { REGIONS } from '../config/regions';
import {
  BuildingEntity,
  CharacterEntity,
  CivilianRole,
  RegionId,
  SaveGameData,
  SelectableEntity,
} from '../types/game';
import { ResourceIcon } from './KingdomEmblem';

interface EconomyPanelProps {
  gameData: SaveGameData;
  allEntities: SelectableEntity[];
  onAdjustWorkforce: (role: CivilianRole, delta: 1 | -1) => void;
  onSelectVillagersByRole: (filter: 'all' | 'idle' | CivilianRole) => void;
  onSelectAndFocusEntity: (id: string) => void;
  onChangeRegionLive: (regionId: RegionId) => void;
}

const STORAGE_SOURCES_LABEL: Record<(typeof RESOURCE_KEYS)[number], string> = {
  food: 'Granary, Compound, Palace',
  wood: 'Warehouse, Compound, Palace',
  stone: 'Warehouse, Mining Camp, Compound',
  iron: 'Warehouse, Blacksmith, Treasury',
  gold: 'Marketplace, Treasury, Compound',
};

export const EconomyPanel: React.FC<EconomyPanelProps> = ({
  gameData,
  allEntities,
  onAdjustWorkforce,
  onSelectVillagersByRole,
  onSelectAndFocusEntity,
  onChangeRegionLive,
}) => {
  const kingdom = KINGDOMS[gameData.kingdomId];
  const bonus = KINGDOM_ECONOMIC_BONUSES[gameData.kingdomId];
  const villagers = allEntities.filter((e): e is CharacterEntity => e.category === 'character');
  const buildings = allEntities.filter((e): e is BuildingEntity => e.category === 'building');

  const roleCounts = villagers.reduce(
    (acc, v) => {
      acc[v.role] = (acc[v.role] || 0) + 1;
      return acc;
    },
    {} as Record<CivilianRole, number>,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs max-h-72 overflow-y-auto akanu-scroll pr-1">
      {/* Column 1 (5 cols): Live 5-Resource Economic Ledger */}
      <div className="lg:col-span-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#e2b55f]">
            Kingdom Resource Ledger (Rates / min)
          </span>
          <span className="text-[11px] text-[#b8a586]">{kingdom.name} Economy</span>
        </div>

        <div className="space-y-1.5">
          {RESOURCE_KEYS.map((key) => {
            const qty = Math.round(gameData.resources[key]);
            const cap = Math.round(gameData.capacities[key]);
            const prod = Math.round(gameData.rates.productionPerMinute[key]);
            const cons = Math.round(gameData.rates.consumptionPerMinute[key]);
            const net = Math.round(gameData.rates.netPerMinute[key]);
            const fillPct = Math.min(100, Math.round((qty / Math.max(1, cap)) * 100));
            const nearFull = fillPct >= 95;

            return (
              <div
                key={key}
                className="rounded bg-[#1f1710] border border-[#8f6c38]/30 px-2.5 py-1.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 capitalize font-semibold text-[#fbf3e4]">
                    <ResourceIcon type={key} size={14} />
                    <span>{key}</span>
                    <span className="text-[10px] font-normal text-[#a99678] hidden sm:inline">
                      · {STORAGE_SOURCES_LABEL[key]}
                    </span>
                  </div>
                  <div className="font-mono-num flex items-center gap-2">
                    <span className={nearFull ? 'text-[#fbbf24] font-bold' : 'text-[#fbf3e4]'}>
                      {qty}/{cap}
                    </span>
                    <span
                      className={`text-[11px] ${
                        net > 0
                          ? 'text-[#86efac]'
                          : net < 0
                            ? 'text-[#fca5a5]'
                            : 'text-[#b8a586]'
                      }`}
                    >
                      {net > 0 ? `+${net}` : net}/m
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px] text-[#b8a586] font-mono-num">
                  <div className="w-full h-1.5 rounded bg-[#140e09] overflow-hidden">
                    <div
                      className={`h-full ${nearFull ? 'bg-[#f59e0b]' : 'bg-[#c98f32]'}`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <span className="shrink-0">
                    +{prod} / -{cons}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Column 2 (4 cols): Direct Workforce Occupation Allocation */}
      <div className="lg:col-span-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#e2b55f]">
            Workforce ({gameData.population.employedCount} Active ·{' '}
            {gameData.population.unemployedCount} Idle)
          </span>
          <button
            type="button"
            onClick={() => onSelectVillagersByRole('all')}
            className="text-[11px] text-[#f0c265] hover:underline cursor-pointer"
          >
            Select All
          </button>
        </div>

        <div className="space-y-1">
          {ASSIGNABLE_OCCUPATIONS.filter((r) => r !== 'Unemployed').map((role) => {
            const count = roleCounts[role] || 0;
            const cfg = OCCUPATION_CONFIGS[role];
            return (
              <div
                key={role}
                className="flex items-center justify-between rounded bg-[#1f1710] border border-[#8f6c38]/25 px-2 py-1"
              >
                <button
                  type="button"
                  onClick={() => onSelectVillagersByRole(role)}
                  title={cfg.shortDesc}
                  className="text-left truncate text-[#f3ead8] hover:text-[#f0c265] cursor-pointer"
                >
                  {cfg.label}
                </button>
                <div className="flex items-center gap-1.5 shrink-0 font-mono-num">
                  <button
                    type="button"
                    aria-label={`Remove one ${cfg.label}`}
                    disabled={count <= 0}
                    onClick={() => onAdjustWorkforce(role, -1)}
                    className="w-6 h-6 inline-flex items-center justify-center rounded bg-[#2a1f16] hover:bg-[#3a2b1f] disabled:opacity-40 text-[#fbf3e4] cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-5 text-center font-semibold text-[#fbf3e4]">{count}</span>
                  <button
                    type="button"
                    aria-label={`Assign one ${cfg.label}`}
                    onClick={() => onAdjustWorkforce(role, 1)}
                    className="w-6 h-6 inline-flex items-center justify-center rounded bg-[#2a1f16] hover:bg-[#3a2b1f] text-[#fbf3e4] cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Column 3 (3 cols): Population Growth, Kingdom Trait & Structures */}
      <div className="lg:col-span-3 space-y-2.5">
        <div className="rounded bg-[#1f1710] border border-[#8f6c38]/30 p-2.5 space-y-1.5">
          <div className="font-semibold text-[#e2b55f]">Population & Housing</div>
          <div className="flex justify-between font-mono-num text-[#f3ead8]">
            <span>Citizens / Housing</span>
            <span>
              {gameData.population.current}/{gameData.population.capacity}
            </span>
          </div>
          <div className="flex justify-between font-mono-num text-[#d6c8b0]">
            <span>Satisfaction</span>
            <span>{Math.round(gameData.population.happiness)}%</span>
          </div>
          <div className="space-y-0.5 pt-0.5">
            <div className="flex justify-between text-[10px] text-[#b8a586] font-mono-num">
              <span>Next Citizen Arrival</span>
              <span>{Math.round(gameData.population.growthProgress)}%</span>
            </div>
            <div className="w-full h-1.5 rounded bg-[#140e09] overflow-hidden">
              <div
                className="h-full bg-[#65a34e]"
                style={{ width: `${Math.round(gameData.population.growthProgress)}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-[#b8a586] leading-snug pt-0.5">{bonus.summary}</p>
        </div>

        <div className="space-y-1">
          <div className="font-semibold text-[#e2b55f]">
            Structures ({buildings.length})
          </div>
          <div className="max-h-24 overflow-y-auto akanu-scroll space-y-1 pr-1">
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelectAndFocusEntity(b.id)}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-[#211811] hover:bg-[#2d2117] text-[#ebdcc4] cursor-pointer"
              >
                <span className="truncate">{b.name}</span>
                <span className="text-[10px] text-[#c9a55c] font-mono-num ml-1 shrink-0">
                  {b.constructionState === 'completed'
                    ? 'Active'
                    : `${Math.round(b.constructionProgress * 100)}%`}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-[#b8a586] mb-1">
            Territory Region
          </label>
          <select
            aria-label="Explore Geographical Region"
            value={gameData.regionId}
            onChange={(e) => onChangeRegionLive(e.target.value as RegionId)}
            className="w-full px-2 py-1 rounded bg-[#110c08] border border-[#8f6c38]/45 text-xs text-[#fbf3e4]"
          >
            {Object.values(REGIONS).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
