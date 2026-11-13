import React from 'react';
import { Building2, MapPin, Minus, Plus, Users } from 'lucide-react';
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
  const villagers = allEntities.filter(
    (e): e is CharacterEntity =>
      e.category === 'character' && e.kingdomId === gameData.kingdomId && !e.isMilitary,
  );
  const buildings = allEntities.filter(
    (e): e is BuildingEntity =>
      e.category === 'building' && e.kingdomId === gameData.kingdomId,
  );

  const roleCounts = villagers.reduce(
    (acc, v) => {
      acc[v.role] = (acc[v.role] || 0) + 1;
      return acc;
    },
    {} as Record<CivilianRole, number>,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs sm:max-h-72 sm:overflow-y-auto akanu-scroll pr-1">
      {/* Column 1 (5 cols): Live 5-Resource Economic Ledger */}
      <div className="lg:col-span-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#D4A64A]">
            Kingdom Resource Ledger (Rates / min)
          </span>
          <span className="text-[11px] text-[#B8AA96]">{kingdom.name} Economy</span>
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
            const flowTotal = Math.max(1, prod + cons);
            const prodShare = Math.round((prod / flowTotal) * 100);

            return (
              <div
                key={key}
                className="rounded bg-[#292017]/80 border border-[#76513A]/55 px-2.5 py-2 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 capitalize font-semibold text-[#F2E8D5]">
                    <ResourceIcon type={key} size={14} />
                    <span>{key}</span>
                    <span className="text-[10px] font-normal text-[#B8AA96] hidden sm:inline">
                      · {STORAGE_SOURCES_LABEL[key]}
                    </span>
                  </div>
                  <div className="font-mono-num flex items-center gap-2">
                    <span className={nearFull ? 'text-[#D4A64A] font-bold' : 'text-[#F2E8D5]'}>
                      {qty}/{cap} ({fillPct}%)
                    </span>
                    <span
                      className={`text-[11px] ${
                        net > 0
                          ? 'text-[#86efac]'
                          : net < 0
                            ? 'text-[#fca5a5]'
                            : 'text-[#B8AA96]'
                      }`}
                    >
                      {net > 0 ? `+${net}` : net}/m
                    </span>
                  </div>
                </div>

                {/* Storage fill meter */}
                <div className="flex items-center justify-between gap-2 text-[10px] text-[#B8AA96] font-mono-num">
                  <div className="w-full h-1.5 rounded bg-[#171512] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        nearFull ? 'bg-[#D4A64A]' : 'bg-[#A77A32]'
                      }`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <span className="shrink-0">
                    +{prod} / -{cons}
                  </span>
                </div>

                {/* Production vs Consumption Flow Balance Bar */}
                {(prod > 0 || cons > 0) && (
                  <div className="flex items-center gap-1.5 text-[10px] text-[#B8AA96]">
                    <span className="shrink-0">Flow</span>
                    <div className="flex-1 h-1 rounded bg-[#171512] overflow-hidden flex">
                      <div className="h-full bg-[#4ca86b]" style={{ width: `${prodShare}%` }} />
                      <div className="h-full bg-[#c96a4b]" style={{ width: `${100 - prodShare}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Column 2 (4 cols): Direct Workforce Occupation Allocation */}
      <div className="lg:col-span-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#D4A64A]">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              Workforce ({gameData.population.employedCount} Active ·{' '}
              {gameData.population.unemployedCount} Idle)
            </span>
          </span>
          <button
            type="button"
            onClick={() => onSelectVillagersByRole('all')}
            className="text-[11px] text-[#D4A64A] hover:underline cursor-pointer whitespace-nowrap"
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
                className="flex items-center justify-between rounded bg-[#292017]/80 border border-[#76513A]/50 px-2.5 py-1"
              >
                <button
                  type="button"
                  onClick={() => onSelectVillagersByRole(role)}
                  title={cfg.shortDesc}
                  className="text-left truncate text-[#F2E8D5] hover:text-[#D4A64A] transition-colors duration-150 cursor-pointer"
                >
                  {cfg.label}
                </button>
                <div className="flex items-center gap-1.5 shrink-0 font-mono-num">
                  <button
                    type="button"
                    aria-label={`Remove one ${cfg.label}`}
                    disabled={count <= 0}
                    onClick={() => onAdjustWorkforce(role, -1)}
                    className="w-7 h-7 inline-flex items-center justify-center rounded bg-[#171512] hover:bg-[#362a1e] border border-[#76513A]/60 disabled:opacity-40 text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" aria-hidden="true" />
                  </button>
                  <span className="w-5 text-center font-semibold text-[#F2E8D5]">{count}</span>
                  <button
                    type="button"
                    aria-label={`Assign one ${cfg.label}`}
                    onClick={() => onAdjustWorkforce(role, 1)}
                    className="w-7 h-7 inline-flex items-center justify-center rounded bg-[#171512] hover:bg-[#362a1e] border border-[#76513A]/60 text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Column 3 (3 cols): Population Growth, Kingdom Trait & Structures */}
      <div className="lg:col-span-3 space-y-2.5">
        <div className="rounded bg-[#292017]/80 border border-[#76513A]/55 p-2.5 space-y-1.5">
          <div className="font-semibold text-[#D4A64A]">Population & Housing</div>
          <div className="flex justify-between font-mono-num text-[#F2E8D5]">
            <span>Citizens / Housing</span>
            <span>
              {gameData.population.current}/{gameData.population.capacity}
            </span>
          </div>
          <div className="flex justify-between font-mono-num text-[#B8AA96]">
            <span>Satisfaction</span>
            <span className="text-[#F2E8D5]">{Math.round(gameData.population.happiness)}%</span>
          </div>
          <div className="space-y-0.5 pt-0.5">
            <div className="flex justify-between text-[10px] text-[#B8AA96] font-mono-num">
              <span>Next Citizen Arrival</span>
              <span>{Math.round(gameData.population.growthProgress)}%</span>
            </div>
            <div className="w-full h-1.5 rounded bg-[#171512] overflow-hidden">
              <div
                className="h-full bg-[#4ca86b] transition-all duration-150"
                style={{ width: `${Math.round(gameData.population.growthProgress)}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-[#B8AA96] leading-snug pt-0.5">{bonus.summary}</p>
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 font-semibold text-[#D4A64A]">
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Structures ({buildings.length})</span>
          </div>
          <div className="max-h-24 overflow-y-auto akanu-scroll space-y-1 pr-1">
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelectAndFocusEntity(b.id)}
                className="w-full flex items-center justify-between px-2 py-1 rounded bg-[#292017]/80 hover:bg-[#362a1e] border border-[#76513A]/40 text-[#F2E8D5] transition-colors duration-150 cursor-pointer"
              >
                <span className="truncate">{b.name}</span>
                <span className="text-[10px] text-[#D4A64A] font-mono-num ml-1 shrink-0">
                  {b.constructionState === 'completed'
                    ? 'Active'
                    : `${Math.round(b.constructionProgress * 100)}%`}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="territory-region-select"
            className="inline-flex items-center gap-1 text-[10px] text-[#B8AA96] mb-1"
          >
            <MapPin className="w-3 h-3 text-[#A77A32]" aria-hidden="true" />
            <span>Territory Region</span>
          </label>
          <select
            id="territory-region-select"
            aria-label="Explore Geographical Region"
            value={gameData.regionId}
            onChange={(e) => onChangeRegionLive(e.target.value as RegionId)}
            className="w-full px-2 py-1.5 rounded bg-[#171512] border border-[#76513A] text-xs text-[#F2E8D5]"
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
