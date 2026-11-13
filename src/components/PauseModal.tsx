import React from 'react';
import { KINGDOMS } from '../config/kingdoms';
import { REGIONS } from '../config/regions';
import { SaveGameData } from '../types/game';
import { KingdomEmblem } from './KingdomEmblem';

interface PauseModalProps {
  activeSave: SaveGameData;
  saveStatusMessage: string | null;
  onResume: () => void;
  onSaveKingdom: () => void;
  onOpenSettings: () => void;
  onReturnToTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  activeSave,
  saveStatusMessage,
  onResume,
  onSaveKingdom,
  onOpenSettings,
  onReturnToTitle,
}) => {
  const kingdom = KINGDOMS[activeSave.kingdomId];
  const region = REGIONS[activeSave.regionId];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-[#090705]/78 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-[#18120c] border border-[#c98f32]/50 p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3.5 pb-4 border-b border-[#8f6c38]/25">
          <KingdomEmblem kingdomId={kingdom.id} size={46} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-[#d6a34b]">Council Paused</p>
            <h2
              id="pause-modal-title"
              className="font-display text-lg font-bold text-[#fbf3e4] truncate"
            >
              {activeSave.playerKingdomName}
            </h2>
            <p className="text-xs text-[#bfb097] truncate">
              {kingdom.name} · {region.name} · {activeSave.progressionStage}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-center">
          <div className="rounded bg-[#120d09] border border-[#6e5332]/30 p-2.5">
            <div className="text-[11px] text-[#a99779]">Population</div>
            <div className="text-base font-bold font-mono-num text-[#fbf3e4]">
              {activeSave.population.current} / {activeSave.population.capacity}
            </div>
          </div>
          <div className="rounded bg-[#120d09] border border-[#6e5332]/30 p-2.5">
            <div className="text-[11px] text-[#a99779]">World Seed</div>
            <div className="text-base font-bold font-mono-num text-[#fbf3e4]">
              {activeSave.worldSeed}
            </div>
          </div>
        </div>

        {saveStatusMessage && (
          <p role="status" className="text-xs text-center text-[#e6be68] font-medium">
            {saveStatusMessage}
          </p>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 px-4 rounded-md bg-[#c98f32] hover:bg-[#dba03f] text-sm font-semibold text-[#171008] cursor-pointer whitespace-nowrap"
          >
            Resume Kingdom
          </button>

          <button
            type="button"
            onClick={onSaveKingdom}
            className="w-full py-2.5 px-4 rounded-md bg-[#261c14] hover:bg-[#34271b] border border-[#c98f32]/45 text-sm font-medium text-[#f5ebd8] cursor-pointer whitespace-nowrap"
          >
            Save Kingdom Progress
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-2.5 px-4 rounded-md bg-[#1e1610] hover:bg-[#2b2017] border border-[#6e5332]/40 text-sm font-medium text-[#dfd1b8] cursor-pointer whitespace-nowrap"
          >
            Settings
          </button>

          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full py-2.5 px-4 rounded-md bg-[#16100c] hover:bg-[#261914] border border-[#6e5332]/35 text-sm font-medium text-[#cbb899] cursor-pointer whitespace-nowrap"
          >
            Save & Return to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
