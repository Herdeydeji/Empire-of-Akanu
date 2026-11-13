import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Compass, Crown, MapPin, Shield, Shuffle } from 'lucide-react';
import { KINGDOM_LIST, KINGDOMS } from '../config/kingdoms';
import { REGION_LIST, REGIONS } from '../config/regions';
import { AIDifficulty, GameMode, KingdomId, RegionId } from '../types/game';
import { KingdomEmblem, ResourceIcon } from './KingdomEmblem';

const DIFFICULTY_OPTIONS: { id: AIDifficulty; label: string; summary: string }[] = [
  { id: 'easy', label: 'Easy', summary: 'Measured pace · cautious expansion' },
  { id: 'normal', label: 'Normal', summary: 'Balanced strategy · fair competition' },
  { id: 'hard', label: 'Hard', summary: 'Sharp recon · coordinated offensives' },
  { id: 'very_hard', label: 'Very Hard', summary: 'Relentless precision · no AI cheats' },
];

interface KingdomSelectionModalProps {
  mode: GameMode;
  initialKingdomId: KingdomId;
  initialRegionId: RegionId;
  onPreviewChange: (kingdomId: KingdomId, regionId: RegionId, seed: number) => void;
  onConfirmStart: (params: {
    kingdomId: KingdomId;
    regionId: RegionId;
    playerKingdomName: string;
    rulerName: string;
    gameMode: GameMode;
    difficultyLevel: AIDifficulty;
    sandboxAbundantResources: boolean;
    worldSeed: number;
  }) => void;
  onCancel: () => void;
}

export const KingdomSelectionModal: React.FC<KingdomSelectionModalProps> = ({
  mode,
  initialKingdomId,
  initialRegionId,
  onPreviewChange,
  onConfirmStart,
  onCancel,
}) => {
  const [selectedKingdomId, setSelectedKingdomId] = useState<KingdomId>(initialKingdomId);
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId>(initialRegionId);
  const [kingdomName, setKingdomName] = useState<string>(
    `Kingdom of ${KINGDOMS[initialKingdomId].name}`,
  );
  const [customNameTouched, setCustomNameTouched] = useState<boolean>(false);
  const [rulerName, setRulerName] = useState<string>('Sovereign Amari');
  const [difficultyLevel, setDifficultyLevel] = useState<AIDifficulty>('normal');
  const [abundantResources, setAbundantResources] = useState<boolean>(mode === 'sandbox');
  const [worldSeed, setWorldSeed] = useState<number>(4819);
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedKingdom = KINGDOMS[selectedKingdomId];
  const selectedRegion = REGIONS[selectedRegionId];
  const resourceMult = mode === 'sandbox' && abundantResources ? 2.5 : 1.0;

  const handleSelectKingdom = (id: KingdomId) => {
    setSelectedKingdomId(id);
    if (!customNameTouched) {
      setKingdomName(`Kingdom of ${KINGDOMS[id].name}`);
    }
    setValidationError(null);
    onPreviewChange(id, selectedRegionId, worldSeed);
  };

  const handleSelectRegion = (rId: RegionId) => {
    setSelectedRegionId(rId);
    onPreviewChange(selectedKingdomId, rId, worldSeed);
  };

  const handleRandomizeSeed = () => {
    const nextSeed = Math.floor(1000 + Math.random() * 8999);
    setWorldSeed(nextSeed);
    onPreviewChange(selectedKingdomId, selectedRegionId, nextSeed);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kingdomName.trim()) {
      setValidationError('Please enter a name for your founding kingdom.');
      return;
    }
    if (!rulerName.trim()) {
      setValidationError('Please enter a sovereign ruler name.');
      return;
    }
    onConfirmStart({
      kingdomId: selectedKingdomId,
      regionId: selectedRegionId,
      playerKingdomName: kingdomName.trim(),
      rulerName: rulerName.trim(),
      gameMode: mode,
      difficultyLevel,
      sandboxAbundantResources: abundantResources,
      worldSeed,
    });
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-auto flex items-center justify-center bg-[#0d0b09]/85 p-3 sm:p-6 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        aria-label="Founding Kingdom Selection"
        className="w-full max-w-6xl max-h-[94vh] flex flex-col rounded-lg bg-[#171512]/98 border border-[#A77A32]/65 shadow-2xl overflow-hidden"
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 bg-[#292017] border-b border-[#76513A]/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Crown className="w-5 h-5 text-[#D4A64A] shrink-0 hidden sm:block" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-[#D4A64A]">
                {mode === 'sandbox' ? 'Kingdom Sandbox Charter' : 'Founding Charter · Stage I'}
              </p>
              <h2 className="font-display text-lg sm:text-2xl font-bold text-[#F2E8D5] truncate">
                Choose Your Founding Kingdom
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#171512] hover:bg-[#362a1e] border border-[#76513A] text-xs sm:text-sm font-medium text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Menu</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto akanu-scroll p-4 sm:p-5 space-y-4">
          {/* Five Founding Kingdoms Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {KINGDOM_LIST.map((k) => {
              const isSelected = k.id === selectedKingdomId;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => handleSelectKingdom(k.id)}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-start text-left p-3 rounded-md border transition-colors duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-[#292017] border-[#D4A64A] shadow-md'
                      : 'bg-[#110f0d] hover:bg-[#292017]/65 border-[#76513A]/50'
                  }`}
                >
                  <div className="w-full flex items-center justify-between mb-2">
                    <KingdomEmblem kingdomId={k.id} size={36} />
                    <span
                      className="w-3 h-3 rounded-sm border border-[#F2E8D5]/25"
                      style={{ backgroundColor: k.palette.primary }}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="font-display text-base font-bold text-[#F2E8D5]">{k.name}</h3>
                  <p className="text-xs font-medium text-[#D4A64A] mt-0.5">{k.specialisation}</p>
                  <p className="text-xs text-[#B8AA96] mt-1.5 line-clamp-2 leading-relaxed">
                    {k.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Kingdom Detailed Breakdown + Region & Charter Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-0.5">
            {/* Left 7 cols: Kingdom Identity & Strengths */}
            <div className="lg:col-span-7 rounded-md bg-[#292017]/65 border border-[#76513A]/60 p-5 space-y-4">
              <div className="flex items-start gap-4">
                <KingdomEmblem kingdomId={selectedKingdom.id} size={56} className="shrink-0" />
                <div>
                  <div className="text-xs text-[#B8AA96]">
                    {selectedKingdom.title} · {selectedKingdom.specialisation}
                  </div>
                  <h3 className="font-display text-2xl font-bold text-[#F2E8D5]">
                    {selectedKingdom.name}
                  </h3>
                  <p className="text-sm text-[#B8AA96] mt-1 leading-relaxed">
                    {selectedKingdom.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#76513A]/45">
                <div>
                  <h4 className="text-xs font-semibold text-[#D4A64A] mb-2">Primary Strengths</h4>
                  <ul className="space-y-1.5 text-xs text-[#F2E8D5]">
                    {selectedKingdom.primaryStrengths.map((str) => (
                      <li key={str}>· {str}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#D4A64A] mb-2">
                    Architectural & Strategic Identity
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#B8AA96]">
                    {selectedKingdom.uniqueCharacteristics.map((trait) => (
                      <li key={trait}>· {trait}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Starting Stockpile Readout */}
              <div className="pt-3 border-t border-[#76513A]/45">
                <div className="text-xs text-[#B8AA96] mb-2">
                  Initial Royal Stockpile · Balanced Founding Stores
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono-num text-[#F2E8D5]">
                  {(
                    [
                      'food',
                      'wood',
                      'stone',
                      'iron',
                      'gold',
                    ] as (keyof typeof selectedKingdom.startingResources)[]
                  ).map((resKey) => (
                    <div key={resKey} className="flex items-center gap-1.5">
                      <ResourceIcon type={resKey} size={16} />
                      <span className="capitalize font-sans text-[#B8AA96]">{resKey}:</span>
                      <span className="font-semibold">
                        {Math.round(selectedKingdom.startingResources[resKey] * resourceMult)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 5 cols: Region Selection & Royal Charter Inputs */}
            <div className="lg:col-span-5 rounded-md bg-[#292017]/65 border border-[#76513A]/60 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="kingdom-name-input"
                    className="block text-xs font-medium text-[#F2E8D5] mb-1"
                  >
                    Player Kingdom Name
                  </label>
                  <input
                    id="kingdom-name-input"
                    type="text"
                    maxLength={36}
                    value={kingdomName}
                    onChange={(e) => {
                      setCustomNameTouched(true);
                      setKingdomName(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full px-3 py-1.5 rounded bg-[#171512] border border-[#76513A] text-sm text-[#F2E8D5] focus:outline-none focus:border-[#D4A64A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ruler-name-input"
                    className="block text-xs font-medium text-[#F2E8D5] mb-1"
                  >
                    Sovereign Founder
                  </label>
                  <input
                    id="ruler-name-input"
                    type="text"
                    maxLength={28}
                    value={rulerName}
                    onChange={(e) => {
                      setRulerName(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full px-3 py-1.5 rounded bg-[#171512] border border-[#76513A] text-sm text-[#F2E8D5] focus:outline-none focus:border-[#D4A64A]"
                  />
                </div>
              </div>

              {/* Geographical Region Selector (5 Distinct Regions) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F2E8D5]">
                    <MapPin className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
                    <span>Starting Geographical Region</span>
                  </span>
                  <span className="text-[11px] text-[#B8AA96]">
                    {selectedRegion.statusLabel}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {REGION_LIST.map((reg) => {
                    const active = reg.id === selectedRegionId;
                    return (
                      <button
                        key={reg.id}
                        type="button"
                        onClick={() => handleSelectRegion(reg.id)}
                        aria-pressed={active}
                        className={`flex items-center justify-between px-3 py-1.5 rounded border text-left transition-colors duration-150 cursor-pointer ${
                          active
                            ? 'bg-[#292017] border-[#D4A64A] text-[#F2E8D5]'
                            : 'bg-[#171512] hover:bg-[#292017]/65 border-[#76513A]/45 text-[#B8AA96]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold truncate text-[#F2E8D5]">
                            {reg.name}
                            {reg.id === 'golden_savannah' ? ' (Featured)' : ''}
                          </div>
                          <div className="text-[11px] text-[#B8AA96] truncate">{reg.tagline}</div>
                        </div>
                        <span
                          className="w-3.5 h-3.5 rounded-sm shrink-0 border border-[#F2E8D5]/25"
                          style={{ backgroundColor: reg.palette.grassLow }}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rival AI Strategic Difficulty */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F2E8D5]">
                    <Shield className="w-3.5 h-3.5 text-[#D4A64A]" aria-hidden="true" />
                    <span>Rival AI Strategic Difficulty</span>
                  </span>
                  <span className="text-[11px] text-[#B8AA96]">Fair rules · zero AI cheats</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-label="AI Difficulty">
                  {DIFFICULTY_OPTIONS.map((opt) => {
                    const active = difficultyLevel === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDifficultyLevel(opt.id)}
                        aria-pressed={active}
                        title={opt.summary}
                        className={`px-2.5 py-2 rounded border text-center transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#D4A64A] border-[#F2E8D5]/50 text-[#171512]'
                            : 'bg-[#171512] hover:bg-[#292017] border-[#76513A]/55 text-[#F2E8D5]'
                        }`}
                      >
                        <div className="text-xs font-semibold">{opt.label}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#B8AA96] mt-1">
                  {DIFFICULTY_OPTIONS.find((o) => o.id === difficultyLevel)?.summary}
                </p>
              </div>

              {/* Sandbox-specific options */}
              {mode === 'sandbox' && (
                <div className="pt-2 border-t border-[#76513A]/45 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-[#F2E8D5] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={abundantResources}
                      onChange={(e) => setAbundantResources(e.target.checked)}
                      className="accent-[#D4A64A]"
                    />
                    <span>Abundant Sandbox Stores (2.5x)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-num text-[#B8AA96]">Seed {worldSeed}</span>
                    <button
                      type="button"
                      onClick={handleRandomizeSeed}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-xs text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
                    >
                      <Shuffle className="w-3 h-3 text-[#D4A64A]" aria-hidden="true" />
                      <span>New Terrain Seed</span>
                    </button>
                  </div>
                </div>
              )}

              {validationError && (
                <p role="alert" className="text-xs font-medium text-[#fca5a5]">
                  {validationError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-t border-[#76513A]/60 bg-[#292017] shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#B8AA96] truncate">
            <Compass className="w-4 h-4 text-[#A77A32] shrink-0" aria-hidden="true" />
            <span className="truncate">
              Live 3D background previews {selectedKingdom.name} architecture in {selectedRegion.name}
            </span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-md bg-[#171512] hover:bg-[#362a1e] border border-[#76513A] text-sm font-medium text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#D4A64A] hover:bg-[#e2b65a] text-sm font-semibold text-[#171512] shadow-md transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px] sm:min-h-0"
            >
              <span>Enter {selectedRegion.name}</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
