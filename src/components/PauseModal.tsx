import React from 'react';
import { LogOut, Play, Save, Settings, Shield } from 'lucide-react';
import { KINGDOMS } from '../config/kingdoms';
import { REGIONS } from '../config/regions';
import { AIDifficulty, SaveGameData } from '../types/game';
import { KingdomEmblem } from './KingdomEmblem';

interface PauseModalProps {
  activeSave: SaveGameData;
  saveStatusMessage: string | null;
  onChangeDifficulty?: (difficulty: AIDifficulty) => void;
  onResume: () => void;
  onSaveKingdom: () => void;
  onOpenSettings: () => void;
  onReturnToTitle: () => void;
}

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  very_hard: 'Very Hard',
};

export const PauseModal: React.FC<PauseModalProps> = ({
  activeSave,
  saveStatusMessage,
  onChangeDifficulty,
  onResume,
  onSaveKingdom,
  onOpenSettings,
  onReturnToTitle,
}) => {
  const kingdom = KINGDOMS[activeSave.kingdomId];
  const region = REGIONS[activeSave.regionId];
  const currentDifficulty: AIDifficulty = activeSave.difficultyLevel ?? 'normal';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-[#0d0b09]/82 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-[#171512] border border-[#A77A32]/65 p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3.5 pb-4 border-b border-[#76513A]/50">
          <KingdomEmblem kingdomId={kingdom.id} size={46} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-[#D4A64A]">Council Paused</p>
            <h2
              id="pause-modal-title"
              className="font-display text-lg font-bold text-[#F2E8D5] truncate"
            >
              {activeSave.playerKingdomName}
            </h2>
            <p className="text-xs text-[#B8AA96] truncate">
              {kingdom.name} · {region.name} · {activeSave.progressionStage}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded bg-[#292017] border border-[#76513A]/55 p-2">
            <div className="text-[11px] text-[#B8AA96]">Population</div>
            <div className="text-sm font-bold font-mono-num text-[#F2E8D5]">
              {activeSave.population.current} / {activeSave.population.capacity}
            </div>
          </div>
          <div className="rounded bg-[#292017] border border-[#76513A]/55 p-2">
            <div className="text-[11px] text-[#B8AA96]">AI Difficulty</div>
            <div className="text-sm font-bold text-[#D4A64A]">
              {DIFFICULTY_LABELS[currentDifficulty]}
            </div>
          </div>
          <div className="rounded bg-[#292017] border border-[#76513A]/55 p-2">
            <div className="text-[11px] text-[#B8AA96]">World Seed</div>
            <div className="text-sm font-bold font-mono-num text-[#F2E8D5]">
              {activeSave.worldSeed}
            </div>
          </div>
        </div>

        {onChangeDifficulty && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#B8AA96]">
              <Shield className="w-3.5 h-3.5 text-[#A77A32]" aria-hidden="true" />
              <span>Adjust Rival AI Strategic Pace</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(['easy', 'normal', 'hard', 'very_hard'] as AIDifficulty[]).map((diff) => {
                const active = diff === currentDifficulty;
                return (
                  <button
                    key={diff}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChangeDifficulty(diff)}
                    className={`py-2 px-1 rounded text-[11px] font-semibold border cursor-pointer transition-colors duration-150 whitespace-nowrap ${
                      active
                        ? 'bg-[#D4A64A] border-[#F2E8D5]/50 text-[#171512]'
                        : 'bg-[#292017] hover:bg-[#362a1e] border-[#76513A]/60 text-[#F2E8D5]'
                    }`}
                  >
                    {DIFFICULTY_LABELS[diff]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {saveStatusMessage && (
          <p role="status" className="text-xs text-center text-[#D4A64A] font-medium">
            {saveStatusMessage}
          </p>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#D4A64A] hover:bg-[#e2b65a] text-sm font-semibold text-[#171512] transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px]"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>Resume Kingdom</span>
          </button>

          <button
            type="button"
            onClick={onSaveKingdom}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#292017] hover:bg-[#362a1e] border border-[#A77A32]/65 text-sm font-medium text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px]"
          >
            <Save className="w-4 h-4 text-[#D4A64A]" aria-hidden="true" />
            <span>Save Kingdom Progress</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-sm font-medium text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px]"
          >
            <Settings className="w-4 h-4 text-[#B8AA96]" aria-hidden="true" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={onReturnToTitle}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-[#110f0d] hover:bg-[#292017] border border-[#76513A]/65 text-sm font-medium text-[#B8AA96] hover:text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px]"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Save & Return to Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
