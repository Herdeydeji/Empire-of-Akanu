import React, { useState } from 'react';
import {
  ArrowRight,
  Compass,
  Crown,
  Play,
  ScrollText,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { KINGDOMS } from '../config/kingdoms';
import { REGIONS } from '../config/regions';
import { SaveGameData } from '../types/game';
import { AkanuTitleLockup, KingdomEmblem } from './KingdomEmblem';

interface MainMenuProps {
  savedGame: SaveGameData | null;
  onNewKingdom: () => void;
  onContinueGame: () => void;
  onKingdomSandbox: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  savedGame,
  onNewKingdom,
  onContinueGame,
  onKingdomSandbox,
  onOpenSettings,
}) => {
  const [upcomingModal, setUpcomingModal] = useState<'campaign' | 'multiplayer' | null>(null);

  const savedKingdom = savedGame ? KINGDOMS[savedGame.kingdomId] : null;
  const savedRegion = savedGame ? REGIONS[savedGame.regionId] : null;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
      {/* Measured left-side dark scrim so title & menu sit over calm high-contrast space */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[#171512]/96 via-[#171512]/72 to-transparent"
      />

      <main className="relative z-10 flex-1 flex items-center px-6 sm:px-12 lg:px-16 py-6">
        <div className="pointer-events-auto w-full max-w-md space-y-6">
          <AkanuTitleLockup />

          <p className="text-sm text-[#B8AA96] leading-relaxed max-w-sm">
            Found a sovereign African-inspired realm, command autonomous citizens and armies, and raise an enduring continental empire across five living biomes.
          </p>

          {/* Strategy Game Menu Stack */}
          <nav aria-label="Main Game Menu" className="space-y-2.5 pt-1">
            <button
              type="button"
              data-start="true"
              onClick={onNewKingdom}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-md bg-[#D4A64A] hover:bg-[#e2b65a] text-[#171512] font-semibold text-base shadow-lg transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[48px]"
            >
              <span className="inline-flex items-center gap-2.5">
                <Crown className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>New Kingdom</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono-num opacity-80">
                <span>Enter</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              disabled={!savedGame}
              onClick={onContinueGame}
              className={`w-full flex items-center justify-between px-5 py-3 rounded-md border text-left transition-colors duration-150 min-h-[48px] ${
                savedGame
                  ? 'bg-[#292017]/96 hover:bg-[#362a1e] border-[#A77A32]/70 text-[#F2E8D5] cursor-pointer'
                  : 'bg-[#171512]/80 border-[#76513A]/35 text-[#76513A] cursor-not-allowed'
              }`}
            >
              <div className="min-w-0 pr-3 flex items-center gap-2.5">
                <Play className="w-4 h-4 shrink-0 text-[#D4A64A]" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-semibold text-sm whitespace-nowrap">Continue Game</div>
                  {savedGame && savedKingdom && savedRegion ? (
                    <div className="text-xs text-[#B8AA96] truncate mt-0.5">
                      {savedGame.playerKingdomName} · {savedKingdom.name} · {savedRegion.name}
                    </div>
                  ) : (
                    <div className="text-xs text-[#76513A] mt-0.5">No saved kingdom found</div>
                  )}
                </div>
              </div>
              {savedGame && savedKingdom && (
                <KingdomEmblem kingdomId={savedKingdom.id} size={28} className="shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={onKingdomSandbox}
              className="w-full flex items-center justify-between px-5 py-3 rounded-md bg-[#292017]/95 hover:bg-[#362a1e] border border-[#76513A] text-[#F2E8D5] font-medium text-sm transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[46px]"
            >
              <span className="inline-flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-[#D4A64A] shrink-0" aria-hidden="true" />
                <span>Kingdom Sandbox</span>
              </span>
              <span className="text-xs text-[#B8AA96]">Configurable World</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setUpcomingModal('campaign')}
                className="flex flex-col items-start px-4 py-2.5 rounded-md bg-[#171512]/95 hover:bg-[#292017] border border-[#76513A]/60 text-left transition-colors duration-150 cursor-pointer min-h-[48px]"
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#F2E8D5] whitespace-nowrap">
                  <ScrollText className="w-3.5 h-3.5 text-[#A77A32]" aria-hidden="true" />
                  <span>Campaign</span>
                </span>
                <span className="text-[11px] text-[#B8AA96] whitespace-nowrap">Upcoming · Phase 5</span>
              </button>

              <button
                type="button"
                onClick={() => setUpcomingModal('multiplayer')}
                className="flex flex-col items-start px-4 py-2.5 rounded-md bg-[#171512]/95 hover:bg-[#292017] border border-[#76513A]/60 text-left transition-colors duration-150 cursor-pointer min-h-[48px]"
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#F2E8D5] whitespace-nowrap">
                  <Users className="w-3.5 h-3.5 text-[#A77A32]" aria-hidden="true" />
                  <span>Multiplayer</span>
                </span>
                <span className="text-[11px] text-[#B8AA96] whitespace-nowrap">Upcoming · Phase 6</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full flex items-center justify-between px-5 py-2.5 rounded-md bg-[#171512]/95 hover:bg-[#292017] border border-[#76513A]/70 text-[#F2E8D5] text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap min-h-[44px]"
            >
              <span className="inline-flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-[#A77A32] shrink-0" aria-hidden="true" />
                <span>Settings</span>
              </span>
              <span className="text-xs text-[#B8AA96]">Graphics · Audio · Camera</span>
            </button>
          </nav>
        </div>
      </main>

      {/* Honest Upcoming Mode Information Dialog */}
      {upcomingModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upcoming-mode-title"
          className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-[#0d0b09]/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-[#171512] border border-[#A77A32]/70 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs text-[#D4A64A]">
                  {upcomingModal === 'campaign'
                    ? 'Scheduled Milestone · Phase 5'
                    : 'Scheduled Milestone · Phase 6'}
                </p>
                <h2
                  id="upcoming-mode-title"
                  className="font-display text-xl font-bold text-[#F2E8D5]"
                >
                  {upcomingModal === 'campaign'
                    ? 'Historical-Inspired Narrative Campaign'
                    : 'Server-Authoritative Persistent Multiplayer'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close upcoming feature dialog"
                onClick={() => setUpcomingModal(null)}
                className="p-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-[#B8AA96] hover:text-[#F2E8D5] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-[#B8AA96] leading-relaxed">
              {upcomingModal === 'campaign'
                ? 'Campaign chronicles will introduce structured single-player missions, scripted turning points, and siege encounters across the five regions of Akanu. Meanwhile, Economic, Military, and Intelligent AI Kingdoms are fully playable in New Kingdom and Kingdom Sandbox.'
                : 'Online multiplayer is architected for server-authoritative WebSocket state replication, territory ownership validation, and alliance warfare in Phase 6. Select New Kingdom or Kingdom Sandbox to play against autonomous AI realms today.'}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUpcomingModal(null)}
                className="px-4 py-2 rounded-md bg-[#292017] hover:bg-[#362a1e] border border-[#76513A] text-sm font-medium text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                Back to Menu
              </button>
              <button
                type="button"
                onClick={() => {
                  setUpcomingModal(null);
                  onNewKingdom();
                }}
                className="px-4 py-2 rounded-md bg-[#D4A64A] hover:bg-[#e2b65a] text-sm font-semibold text-[#171512] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                Launch New Kingdom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single flat, borderless control-hint line in bottom safe margin */}
      <div className="relative z-10 px-6 sm:px-12 lg:px-16 pb-4 pt-2">
        <p className="text-xs text-[#B8AA96] tracking-wide">
          WASD / Drag Move · Q / E or Right-Drag Rotate · Scroll / Pinch Zoom · Left-Click Inspect · Esc Pause
        </p>
      </div>
    </div>
  );
};
