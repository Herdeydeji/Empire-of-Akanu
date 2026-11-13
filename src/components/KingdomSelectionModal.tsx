import React, { useState } from 'react';
import { KINGDOM_LIST, KINGDOMS } from '../config/kingdoms';
import { REGION_LIST, REGIONS } from '../config/regions';
import { GameMode, KingdomId, RegionId } from '../types/game';
import { KingdomEmblem, ResourceIcon } from './KingdomEmblem';

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
      sandboxAbundantResources: abundantResources,
      worldSeed,
    });
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-auto flex items-center justify-center bg-[#0b0806]/82 p-3 sm:p-6 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        aria-label="Founding Kingdom Selection"
        className="w-full max-w-6xl max-h-[94vh] flex flex-col rounded-lg bg-[#16110c]/96 border border-[#c98f32]/45 shadow-2xl overflow-hidden"
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b border-[#8f6c38]/30 shrink-0">
          <div>
            <p className="text-xs text-[#d6a34b]">
              {mode === 'sandbox' ? 'Kingdom Sandbox Charter' : 'Founding Charter · Stage I'}
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#fbf3e4]">
              Choose Your Founding Kingdom
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-md bg-[#261c14] hover:bg-[#34271c] border border-[#8f6c38]/35 text-xs sm:text-sm font-medium text-[#e4d6be] cursor-pointer whitespace-nowrap"
          >
            Back to Menu
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto akanu-scroll p-5 sm:p-7 space-y-6">
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
                  className={`flex flex-col items-start text-left p-4 rounded-md border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#281e14] border-[#e6b352] shadow-md'
                      : 'bg-[#1c150f] hover:bg-[#241b13] border-[#6e5332]/35'
                  }`}
                >
                  <div className="w-full flex items-center justify-between mb-3">
                    <KingdomEmblem kingdomId={k.id} size={42} />
                    <span
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: k.palette.primary }}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#fbf3e4]">{k.name}</h3>
                  <p className="text-xs font-medium text-[#e0b25c] mt-0.5">{k.specialisation}</p>
                  <p className="text-xs text-[#bfb097] mt-2 line-clamp-3 leading-relaxed">
                    {k.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Kingdom Detailed Breakdown + Region & Charter Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
            {/* Left 7 cols: Kingdom Identity & Strengths */}
            <div className="lg:col-span-7 rounded-md bg-[#1d1610] border border-[#8f6c38]/30 p-5 space-y-4">
              <div className="flex items-start gap-4">
                <KingdomEmblem kingdomId={selectedKingdom.id} size={56} className="shrink-0" />
                <div>
                  <div className="text-xs text-[#cbb894]">
                    {selectedKingdom.title} · {selectedKingdom.specialisation}
                  </div>
                  <h3 className="font-display text-2xl font-bold text-[#fbf3e4]">
                    {selectedKingdom.name}
                  </h3>
                  <p className="text-sm text-[#d9ccb4] mt-1 leading-relaxed">
                    {selectedKingdom.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#8f6c38]/20">
                <div>
                  <h4 className="text-xs font-semibold text-[#e2b55f] mb-2">Primary Strengths</h4>
                  <ul className="space-y-1.5 text-xs text-[#e5dac6]">
                    {selectedKingdom.primaryStrengths.map((str) => (
                      <li key={str}>· {str}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#e2b55f] mb-2">
                    Architectural & Strategic Identity
                  </h4>
                  <ul className="space-y-1.5 text-xs text-[#d2c3aa]">
                    {selectedKingdom.uniqueCharacteristics.map((trait) => (
                      <li key={trait}>· {trait}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Starting Stockpile Readout */}
              <div className="pt-3 border-t border-[#8f6c38]/20">
                <div className="text-xs text-[#cbb894] mb-2">
                  Initial Royal Stockpile · Balanced Founding Stores
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs font-mono-num text-[#f3ead8]">
                  {(
                    ['food', 'wood', 'stone', 'iron', 'gold'] as (keyof typeof selectedKingdom.startingResources)[]
                  ).map((resKey) => (
                    <div key={resKey} className="flex items-center gap-1.5">
                      <ResourceIcon type={resKey} size={16} />
                      <span className="capitalize font-sans text-[#bfb097]">{resKey}:</span>
                      <span className="font-semibold">
                        {Math.round(selectedKingdom.startingResources[resKey] * resourceMult)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 5 cols: Region Selection & Royal Charter Inputs */}
            <div className="lg:col-span-5 rounded-md bg-[#1d1610] border border-[#8f6c38]/30 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="kingdom-name-input"
                    className="block text-xs font-medium text-[#dbcba8] mb-1"
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
                    className="w-full px-3 py-2 rounded bg-[#120d09] border border-[#8f6c38]/45 text-sm text-[#fbf3e4] focus:outline-none focus:border-[#e6b352]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ruler-name-input"
                    className="block text-xs font-medium text-[#dbcba8] mb-1"
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
                    className="w-full px-3 py-2 rounded bg-[#120d09] border border-[#8f6c38]/45 text-sm text-[#fbf3e4] focus:outline-none focus:border-[#e6b352]"
                  />
                </div>
              </div>

              {/* Geographical Region Selector (5 Distinct Regions) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#dbcba8]">
                    Starting Geographical Region
                  </span>
                  <span className="text-[11px] text-[#b8a586]">
                    {selectedRegion.statusLabel}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {REGION_LIST.map((reg) => {
                    const active = reg.id === selectedRegionId;
                    return (
                      <button
                        key={reg.id}
                        type="button"
                        onClick={() => handleSelectRegion(reg.id)}
                        aria-pressed={active}
                        className={`flex items-center justify-between px-3 py-2 rounded border text-left transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#2c2015] border-[#e6b352] text-[#fbf3e4]'
                            : 'bg-[#140f0a] hover:bg-[#211810] border-[#6e5332]/30 text-[#cbb99c]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold truncate">
                            {reg.name}
                            {reg.id === 'golden_savannah' ? ' (Featured)' : ''}
                          </div>
                          <div className="text-[11px] text-[#a99779] truncate">{reg.tagline}</div>
                        </div>
                        <span
                          className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/20"
                          style={{ backgroundColor: reg.palette.grassLow }}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sandbox-specific options */}
              {mode === 'sandbox' && (
                <div className="pt-2 border-t border-[#8f6c38]/25 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-[#e5dac6] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={abundantResources}
                      onChange={(e) => setAbundantResources(e.target.checked)}
                      className="accent-[#c98f32]"
                    />
                    <span>Abundant Sandbox Stores (2.5x)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-num text-[#b8a586]">Seed {worldSeed}</span>
                    <button
                      type="button"
                      onClick={handleRandomizeSeed}
                      className="px-2.5 py-1 rounded bg-[#291e14] hover:bg-[#38291c] border border-[#8f6c38]/40 text-xs text-[#f0dca8] cursor-pointer whitespace-nowrap"
                    >
                      New Terrain Seed
                    </button>
                  </div>
                </div>
              )}

              {validationError && (
                <p role="alert" className="text-xs font-medium text-[#f27c66]">
                  {validationError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-t border-[#8f6c38]/30 bg-[#130e0a] shrink-0">
          <div className="text-xs text-[#b8a586] hidden sm:block truncate">
            Live 3D background previews {selectedKingdom.name} architecture in {selectedRegion.name}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-md bg-[#261c14] hover:bg-[#33261b] border border-[#8f6c38]/35 text-sm font-medium text-[#e4d6be] cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-md bg-[#c98f32] hover:bg-[#dba03f] text-sm font-semibold text-[#171008] shadow-md cursor-pointer whitespace-nowrap"
            >
              Enter {selectedRegion.name}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
