import React, { useState } from 'react';
import {
  BUILDABLE_ARCHETYPES,
  BUILDING_CATALOG,
  getAdjustedBuildingCost,
  KINGDOM_ECONOMIC_BONUSES,
  RESOURCE_KEYS,
} from '../config/economy';
import {
  BuildingArchetype,
  BuildingClass,
  KingdomId,
  ResourceAmounts,
} from '../types/game';
import { ResourceIcon } from './KingdomEmblem';

interface ConstructionPanelProps {
  kingdomId: KingdomId;
  resources: ResourceAmounts;
  activePlacementArchetype: BuildingArchetype | null;
  onStartPlacement: (archetype: BuildingArchetype) => void;
}

type CategoryFilter = 'All' | BuildingClass;

const CATEGORIES: CategoryFilter[] = [
  'All',
  'Residential',
  'Economic',
  'Military',
  'Royal',
  'Defensive',
];

export const ConstructionPanel: React.FC<ConstructionPanelProps> = ({
  kingdomId,
  resources,
  activePlacementArchetype,
  onStartPlacement,
}) => {
  const [category, setCategory] = useState<CategoryFilter>('All');

  const filtered = BUILDABLE_ARCHETYPES.filter((arch) => {
    const bp = BUILDING_CATALOG[arch];
    return category === 'All' || bp.buildingClass === category;
  });

  const bonusSummary = KINGDOM_ECONOMIC_BONUSES[kingdomId].summary;

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={category === cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                category === cat
                  ? 'bg-[#c98f32] text-[#171008]'
                  : 'bg-[#221911] hover:bg-[#312418] text-[#e5d8c0]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-[#d9b468]">{bonusSummary}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto akanu-scroll pr-1">
        {filtered.map((arch) => {
          const bp = BUILDING_CATALOG[arch];
          const cost = getAdjustedBuildingCost(arch, kingdomId);
          const canAfford = RESOURCE_KEYS.every((k) => resources[k] + 1e-6 >= cost[k]);
          const isPlacingThis = activePlacementArchetype === arch;

          return (
            <div
              key={arch}
              className={`rounded bg-[#1f1710] border p-2.5 flex flex-col justify-between gap-2 ${
                isPlacingThis
                  ? 'border-[#4ade80]'
                  : canAfford
                    ? 'border-[#8f6c38]/40'
                    : 'border-[#6e5332]/25 opacity-85'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-bold text-[#fbf3e4] text-xs sm:text-sm">
                      {bp.name}
                    </div>
                    <div className="text-[11px] text-[#c9a55c]">
                      {bp.buildingClass} · {bp.constructionWorkRequired}s build work
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#d2c3aa] leading-snug">
                  {bp.economicRoleSummary}
                </p>

                {bp.phaseNote && (
                  <p className="text-[10px] text-[#b89f74]">{bp.phaseNote}</p>
                )}
              </div>

              <div className="space-y-2 pt-1 border-t border-[#8f6c38]/20">
                <div className="flex flex-wrap items-center gap-2">
                  {RESOURCE_KEYS.filter((k) => cost[k] > 0).map((k) => {
                    const enough = resources[k] + 1e-6 >= cost[k];
                    return (
                      <span
                        key={k}
                        className={`inline-flex items-center gap-1 font-mono-num text-[11px] font-semibold ${
                          enough ? 'text-[#f3ead8]' : 'text-[#f87171]'
                        }`}
                        title={`${k}: ${cost[k]}`}
                      >
                        <ResourceIcon type={k} size={12} />
                        {cost[k]}
                      </span>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => onStartPlacement(arch)}
                  aria-label={`Build ${bp.name}`}
                  className={`w-full py-1.5 rounded text-xs font-semibold transition-colors ${
                    canAfford
                      ? 'bg-[#c98f32] hover:bg-[#dca03e] text-[#171008] cursor-pointer'
                      : 'bg-[#2a2018] text-[#7f705c] cursor-not-allowed'
                  }`}
                >
                  {isPlacingThis
                    ? 'Placing on Terrain…'
                    : canAfford
                      ? `Place ${bp.name}`
                      : 'Insufficient Resources'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
