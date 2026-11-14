import React, { useState } from 'react';
import { Eye, ScrollText, Shield, X } from 'lucide-react';
import { KINGDOM_PERSONALITIES } from '../config/aiPersonalities';
import { KINGDOMS } from '../config/kingdoms';
import {
  AIDifficulty,
  AIKingdomRuntime,
  DiplomaticRelation,
  KingdomId,
  WorldEventItem,
} from '../types/game';
import { KingdomEmblem } from './KingdomEmblem';

interface KingdomOverviewPanelProps {
  playerKingdomId: KingdomId;
  difficultyLevel?: AIDifficulty;
  aiKingdoms: Record<KingdomId, AIKingdomRuntime>;
  relations: Record<KingdomId, DiplomaticRelation>;
  events: WorldEventItem[];
  onClose: () => void;
}

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  very_hard: 'Very Hard',
};

export const KingdomOverviewPanel: React.FC<KingdomOverviewPanelProps> = ({
  playerKingdomId,
  difficultyLevel = 'normal',
  aiKingdoms,
  relations,
  events,
  onClose,
}) => {
  const [expandedLogsId, setExpandedLogsId] = useState<KingdomId | null>(null);
  const [mobileView, setMobileView] = useState<'realms' | 'chronicle'>('realms');
  const allIds: KingdomId[] = ['oru', 'zambara', 'kemetra', 'aseka', 'nambara'];
  const playerIntelMap = aiKingdoms[playerKingdomId]?.knownIntelligence;

  const isKnownKingdom = (kId: KingdomId) =>
    kId === playerKingdomId ||
    Boolean(playerIntelMap?.[kId]?.discovered || relations[kId]?.discovered);

  const visibleEvents = events.filter((evt) => {
    if (!evt.sourceKingdomId && !evt.targetKingdomId) return true;
    return Boolean(
      (evt.sourceKingdomId && isKnownKingdom(evt.sourceKingdomId)) ||
        (evt.targetKingdomId && isKnownKingdom(evt.targetKingdomId)),
    );
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Akanu World Intelligence and Chronicle"
      className="fixed inset-0 z-40 pointer-events-auto flex items-center justify-center bg-[#0d0b09]/85 p-2.5 sm:p-5"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#171512] border border-[#A77A32]/65 rounded-lg shadow-2xl text-[#F2E8D5] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[#76513A]/60 bg-[#292017] shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Eye className="w-4 h-4 text-[#D4A64A] shrink-0" aria-hidden="true" />
              <h2 className="font-display text-base sm:text-xl font-bold text-[#F2E8D5]">
                Akanu World Intelligence & Chronicle
              </h2>
              <span className="text-xs font-medium text-[#D4A64A]">
                · AI {DIFFICULTY_LABELS[difficultyLevel]}
              </span>
            </div>
            <p className="hidden sm:block text-xs text-[#B8AA96] mt-0.5">
              Reconnaissance estimates, territorial zones, kingdom stability, and historical chronicle.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close World Overview"
            className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#F2E8D5] bg-[#171512] hover:bg-[#362a1e] rounded border border-[#76513A] transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        {/* Mobile (< lg) Sub-Tab Switcher: Realms vs Chronicle */}
        <div
          role="tablist"
          aria-label="World Overview Sections"
          className="lg:hidden grid grid-cols-2 gap-1.5 p-2 bg-[#110f0d] border-b border-[#76513A]/45 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'realms'}
            onClick={() => setMobileView('realms')}
            className={`min-h-[42px] px-3 rounded inline-flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
              mobileView === 'realms'
                ? 'bg-[#D4A64A] text-[#171512]'
                : 'bg-[#292017] border border-[#76513A]/50 text-[#F2E8D5]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Realms ({allIds.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'chronicle'}
            onClick={() => setMobileView('chronicle')}
            className={`min-h-[42px] px-3 rounded inline-flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
              mobileView === 'chronicle'
                ? 'bg-[#D4A64A] text-[#171512]'
                : 'bg-[#292017] border border-[#76513A]/50 text-[#F2E8D5]'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Chronicle ({visibleEvents.length})</span>
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-[#76513A]/45 overflow-hidden">
          {/* Kingdom Intelligence Matrix */}
          <div
            className={`lg:col-span-7 p-3.5 sm:p-5 overflow-y-auto akanu-scroll space-y-3 ${
              mobileView === 'realms' ? 'block' : 'hidden lg:block'
            }`}
          >
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D4A64A] tracking-wide">
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sovereign Power Matrix (Fog-of-Knowledge Active)</span>
            </h3>

            <div className="space-y-2.5">
              {allIds.map((kId) => {
                const kConfig = KINGDOMS[kId];
                const personality = KINGDOM_PERSONALITIES[kId];
                const aiRuntime = aiKingdoms[kId];
                const rel = relations[kId];
                const intel = playerIntelMap?.[kId];
                const isPlayer = kId === playerKingdomId;
                const isDiscovered = isPlayer || Boolean(intel?.discovered || rel?.discovered);
                const logs = aiRuntime?.decisionLog ?? [];
                const showLogs = expandedLogsId === kId;

                return (
                  <div
                    key={kId}
                    className={`p-3.5 rounded-md border ${
                      isPlayer
                        ? 'bg-[#292017] border-[#D4A64A]/75'
                        : isDiscovered
                          ? 'bg-[#292017]/55 border-[#76513A]/60'
                          : 'bg-[#110f0d] border-[#76513A]/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-[#76513A]/40 pb-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <KingdomEmblem kingdomId={kId} size={28} className="shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-bold text-sm sm:text-base text-[#F2E8D5] truncate">
                              {kConfig.name}
                            </span>
                            {isPlayer && (
                              <span className="text-[11px] font-semibold text-[#D4A64A]">
                                · Your Realm
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#B8AA96] truncate">
                            {personality.archetypeTitle} · {kConfig.specialisation}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 text-xs">
                        {isDiscovered ? (
                          <span className="text-[#B8AA96]">
                            Posture:{' '}
                            <strong className="text-[#F2E8D5] capitalize">
                              {aiRuntime?.strategicPosture || 'consolidate'}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-[#B8AA96]/70 font-medium">Undiscovered</span>
                        )}
                      </div>
                    </div>

                    {!isDiscovered ? (
                      <p className="text-xs text-[#B8AA96]/80 italic">
                        No scouts or envoys have observed {kConfig.name}. Explore the frontier or send
                        a diplomatic envoy to establish intelligence.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-[#B8AA96] block text-[10px]">Stage & Zones</span>
                            <span className="text-[#F2E8D5] font-medium font-mono-num">
                              {aiRuntime?.progressionStage || 'Settlement'} ·{' '}
                              {aiRuntime?.territories?.length ?? 1} Zone
                              {(aiRuntime?.territories?.length ?? 1) === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#B8AA96] block text-[10px]">Stability</span>
                            <span className="text-[#86efac] font-semibold font-mono-num">
                              {Math.round(aiRuntime?.stability ?? 80)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[#B8AA96] block text-[10px]">
                              {isPlayer ? 'Population' : 'Est. Military Power'}
                            </span>
                            <span className="text-[#D4A64A] font-semibold font-mono-num">
                              {isPlayer
                                ? `${aiRuntime?.population.current ?? 0}/${aiRuntime?.population.capacity ?? 0}`
                                : intel?.estimatedMilitaryStrength ?? 0}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#B8AA96] block text-[10px]">Relation</span>
                            <span className="text-[#F2E8D5] font-medium capitalize">
                              {isPlayer ? 'Sovereign' : rel?.state ? rel.state.replace('_', ' ') : 'Neutral'}
                            </span>
                          </div>
                        </div>

                        {!isPlayer && aiRuntime && (
                          <div className="mt-2.5 pt-2 border-t border-[#76513A]/35 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-[#B8AA96] truncate">
                                Recent Mandate:{' '}
                                <span className="text-[#F2E8D5]">{aiRuntime.lastDecisionSummary}</span>
                              </span>
                              {logs.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedLogsId(showLogs ? null : kId)}
                                  className="text-[#D4A64A] hover:underline shrink-0 cursor-pointer whitespace-nowrap"
                                >
                                  {showLogs ? 'Hide Log' : `AI Log (${logs.length})`}
                                </button>
                              )}
                            </div>

                            {showLogs && logs.length > 0 && (
                              <div className="rounded bg-[#110f0d] border border-[#76513A]/45 p-2 space-y-1 max-h-28 overflow-y-auto akanu-scroll text-[11px]">
                                {logs.slice(0, 8).map((entry, idx) => (
                                  <div
                                    key={`${kId}_log_${idx}`}
                                    className="flex items-center justify-between gap-2 text-[#F2E8D5]/90"
                                  >
                                    <span className="truncate">
                                      <span className="text-[#D4A64A] uppercase text-[10px] mr-1.5">
                                        [{entry.category}]
                                      </span>
                                      {entry.summary}
                                    </span>
                                    <span className="font-mono-num text-[10px] text-[#B8AA96] shrink-0">
                                      u={entry.score}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* World Event Chronicle */}
          <div
            className={`lg:col-span-5 p-3.5 sm:p-5 bg-[#110f0d] overflow-y-auto akanu-scroll flex-col ${
              mobileView === 'chronicle' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D4A64A] tracking-wide mb-3">
              <ScrollText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>World Event Chronicle</span>
            </h3>

            <div className="space-y-2 flex-1 overflow-y-auto akanu-scroll pr-1">
              {visibleEvents.length === 0 ? (
                <div className="text-xs text-[#B8AA96] italic">
                  No major treaties, border skirmishes, or sovereign milestones recorded yet.
                </div>
              ) : (
                [...visibleEvents]
                  .slice(-25)
                  .reverse()
                  .map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2.5 bg-[#171512] rounded border border-[#76513A]/50 text-xs space-y-1"
                    >
                      <div className="font-semibold text-[#D4A64A] flex items-center justify-between gap-2">
                        <span className="truncate">{evt.title}</span>
                        <span className="text-[10px] text-[#B8AA96] uppercase shrink-0 font-mono-num">
                          {Math.floor(evt.timestampSec)}s · {evt.kind}
                        </span>
                      </div>
                      <p className="text-[#F2E8D5]/90 leading-relaxed text-[11px]">{evt.description}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
