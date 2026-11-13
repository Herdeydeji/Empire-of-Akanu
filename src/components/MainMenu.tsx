import React, { useState } from 'react';
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
      {/* Measured left-side dark scrim so title & menu sit over calm high-contrast space while 65% of live 3D world shines */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[#0e0a07]/95 via-[#0e0a07]/65 to-transparent"
      />

      <main className="relative z-10 flex-1 flex items-center px-6 sm:px-12 lg:px-16 py-6">
        <div className="pointer-events-auto w-full max-w-md space-y-6">
          <AkanuTitleLockup />

          <p className="text-sm text-[#d9ccb4] leading-relaxed max-w-sm">
            Found a sovereign African-inspired realm, survey living territorial biomes, and lay the royal foundations of an enduring continental empire.
          </p>

          {/* Strategy Game Menu Stack */}
          <nav aria-label="Main Game Menu" className="space-y-2.5 pt-1">
            <button
              type="button"
              data-start="true"
              onClick={onNewKingdom}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-md bg-[#c98f32] hover:bg-[#dba03f] text-[#171008] font-semibold text-base shadow-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>New Kingdom</span>
              <span className="text-xs font-mono-num opacity-80">Enter</span>
            </button>

            <button
              type="button"
              disabled={!savedGame}
              onClick={onContinueGame}
              className={`w-full flex items-center justify-between px-5 py-3 rounded-md border text-left transition-colors ${
                savedGame
                  ? 'bg-[#211811]/95 hover:bg-[#2d2117] border-[#c98f32]/55 text-[#f7eedc] cursor-pointer'
                  : 'bg-[#17110c]/75 border-[#594633]/35 text-[#7d6f5d] cursor-not-allowed'
              }`}
            >
              <div className="min-w-0 pr-3">
                <div className="font-semibold text-sm whitespace-nowrap">Continue Game</div>
                {savedGame && savedKingdom && savedRegion ? (
                  <div className="text-xs text-[#cbb894] truncate mt-0.5">
                    {savedGame.playerKingdomName} · {savedKingdom.name} · {savedRegion.name}
                  </div>
                ) : (
                  <div className="text-xs text-[#7d6f5d] mt-0.5">No saved kingdom found</div>
                )}
              </div>
              {savedGame && savedKingdom && (
                <KingdomEmblem kingdomId={savedKingdom.id} size={28} className="shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={onKingdomSandbox}
              className="w-full flex items-center justify-between px-5 py-3 rounded-md bg-[#1d150f]/95 hover:bg-[#2a1f16] border border-[#8f6c38]/45 text-[#f3ead8] font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Kingdom Sandbox</span>
              <span className="text-xs text-[#d6ad60]">Configurable World</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setUpcomingModal('campaign')}
                className="flex flex-col items-start px-4 py-2.5 rounded-md bg-[#16100b]/92 hover:bg-[#221912] border border-[#6b5335]/35 text-left transition-colors cursor-pointer"
              >
                <span className="text-sm font-medium text-[#d8cbb5] whitespace-nowrap">Campaign</span>
                <span className="text-[11px] text-[#a38c68] whitespace-nowrap">Upcoming · Phase 5</span>
              </button>

              <button
                type="button"
                onClick={() => setUpcomingModal('multiplayer')}
                className="flex flex-col items-start px-4 py-2.5 rounded-md bg-[#16100b]/92 hover:bg-[#221912] border border-[#6b5335]/35 text-left transition-colors cursor-pointer"
              >
                <span className="text-sm font-medium text-[#d8cbb5] whitespace-nowrap">Multiplayer</span>
                <span className="text-[11px] text-[#a38c68] whitespace-nowrap">Upcoming · Phase 6</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full flex items-center justify-between px-5 py-2.5 rounded-md bg-[#16100b]/92 hover:bg-[#241a12] border border-[#6b5335]/40 text-[#e2d5be] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Settings</span>
              <span className="text-xs text-[#a89474]">Graphics · Audio · Camera</span>
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
          className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-[#090705]/80 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-[#19120c] border border-[#c98f32]/50 p-6 shadow-2xl space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-[#d6a34b]">
                {upcomingModal === 'campaign'
                  ? 'Scheduled Milestone · Phase 5'
                  : 'Scheduled Milestone · Phase 6'}
              </p>
              <h2
                id="upcoming-mode-title"
                className="font-display text-xl font-bold text-[#fbf2e1]"
              >
                {upcomingModal === 'campaign'
                  ? 'Historical-Inspired Narrative Campaign'
                  : 'Server-Authoritative Persistent Multiplayer'}
              </h2>
            </div>

            <p className="text-sm text-[#d4c5ab] leading-relaxed">
              {upcomingModal === 'campaign'
                ? 'Campaign chronicles will introduce structured single-player missions, diplomatic turning points, and siege encounters across the five regions of Akanu once Economic (Phase 2), Military (Phase 3), and AI Kingdom (Phase 4) systems are complete.'
                : 'Online multiplayer is architected for server-authoritative WebSocket state replication, territory ownership validation, and alliance warfare in Phase 6. For Phase 1, select New Kingdom or Kingdom Sandbox to explore the playable 3D world.'}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUpcomingModal(null)}
                className="px-4 py-2 rounded-md bg-[#2a1f16] hover:bg-[#38291d] border border-[#8f6c38]/40 text-sm font-medium text-[#f3ead8] cursor-pointer whitespace-nowrap"
              >
                Back to Menu
              </button>
              <button
                type="button"
                onClick={() => {
                  setUpcomingModal(null);
                  onNewKingdom();
                }}
                className="px-4 py-2 rounded-md bg-[#c98f32] hover:bg-[#dba03f] text-sm font-semibold text-[#171008] cursor-pointer whitespace-nowrap"
              >
                Launch New Kingdom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single flat, borderless control-hint line in bottom safe margin */}
      <div className="relative z-10 px-6 sm:px-12 lg:px-16 pb-4 pt-2">
        <p className="text-xs text-[#ccb999]/90 tracking-wide">
          WASD / Drag Move · Q / E or Right-Drag Rotate · Scroll / Pinch Zoom · Left-Click Inspect · Esc Pause
        </p>
      </div>
    </div>
  );
};
