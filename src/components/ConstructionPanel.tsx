import React, { useState } from 'react';
import { Clock, Coins, Crown, Hammer, Home, Shield, Swords } from 'lucide-react';
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

const renderClassIcon = (buildingClass: BuildingClass) => {
  switch (buildingClass) {
    case 'Residential':
      return <Home className="w-3.5 h-3.5 text-[#D4A64A] shrink-0" aria-hidden="true" />;
    case 'Economic':
      return <Coins className="w-3.5 h-3.5 text-[#D4A64A] shrink-0" aria-hidden="true" />;
    case 'Military':
      return <Swords className="w-3.5 h-3.5 text-[#D4A64A] shrink-0" aria-hidden="true" />;
    case 'Royal':
      return <Crown className="w-3.5 h-3.5 text-[#D4A64A] shrink-0" aria-hidden="true" />;
    case 'Defensive':
      return <Shield className="w-3.5 h-3.5 text-[#D4A64A] shrink-0" aria-hidden="true" />;
  }
};

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
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Building Categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={category === cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors duration-150 whitespace-nowrap ${
                category === cat
                  ? 'bg-[#D4A64A] text-[#171512]'
                  : 'bg-[#292017] hover:bg-[#362a1e] border border-[#76513A]/55 text-[#F2E8D5]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-[#B8AA96]">{bonusSummary}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:max-h-64 sm:overflow-y-auto akanu-scroll pr-1">
        {filtered.map((arch) => {
          const bp = BUILDING_CATALOG[arch];
          const cost = getAdjustedBuildingCost(arch, kingdomId);
          const canAfford = RESOURCE_KEYS.every((k) => resources[k] + 1e-6 >= cost[k]);
          const isPlacingThis = activePlacementArchetype === arch;

          return (
            <div
              key={arch}
              className={`rounded bg-[#292017]/80 border p-2.5 flex flex-col justify-between gap-2 ${
                isPlacingThis
                  ? 'border-[#4ca86b]'
                  : canAfford
                    ? 'border-[#76513A]/70'
                    : 'border-[#76513A]/35 opacity-85'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="mt-0.5">{renderClassIcon(bp.buildingClass)}</span>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-[#F2E8D5] text-xs sm:text-sm truncate">
                        {bp.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#B8AA96]">
                        <span>{bp.buildingClass}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-0.5 font-mono-num">
                          <Clock className="w-3 h-3 text-[#A77A32]" aria-hidden="true" />
                          {bp.constructionWorkRequired}s
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#F2E8D5]/90 leading-snug">
                  {bp.economicRoleSummary}
                </p>

                {bp.phaseNote && (
                  <p className="text-[10px] text-[#B8AA96]">{bp.phaseNote}</p>
                )}
              </div>

              <div className="space-y-2 pt-1.5 border-t border-[#76513A]/45">
                <div className="flex flex-wrap items-center gap-2.5">
                  {RESOURCE_KEYS.filter((k) => cost[k] > 0).map((k) => {
                    const enough = resources[k] + 1e-6 >= cost[k];
                    return (
                      <span
                        key={k}
                        className={`inline-flex items-center gap-1 font-mono-num text-[11px] font-semibold ${
                          enough ? 'text-[#F2E8D5]' : 'text-[#fca5a5]'
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
                  className={`w-full inline-flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition-colors duration-150 whitespace-nowrap ${
                    canAfford
                      ? 'bg-[#D4A64A] hover:bg-[#e2b65a] text-[#171512] cursor-pointer'
                      : 'bg-[#171512] border border-[#76513A]/40 text-[#B8AA96]/60 cursor-not-allowed'
                  }`}
                >
                  <Hammer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {isPlacingThis
                      ? 'Placing on Terrain…'
                      : canAfford
                        ? `Place ${bp.name}`
                        : 'Insufficient Resources'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
