import React, { useState } from 'react';
import { KINGDOMS } from '../config/kingdoms';
import {
  DiplomaticRelation,
  DiplomaticRelationState,
  KingdomId,
  TreatyKind,
  WorldEventItem,
} from '../types/game';

interface DiplomacyPanelProps {
  playerKingdomId: KingdomId;
  relations: Record<KingdomId, DiplomaticRelation>;
  events: WorldEventItem[];
  onProposeTreaty: (targetId: KingdomId, kind: TreatyKind) => { accepted: boolean; reason: string };
  onDeclareWar: (targetId: KingdomId) => void;
  onClose: () => void;
}

export const DiplomacyPanel: React.FC<DiplomacyPanelProps> = ({
  playerKingdomId,
  relations,
  events,
  onProposeTreaty,
  onDeclareWar,
  onClose,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<KingdomId>('zambara');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const rivalIds = (Object.keys(relations) as KingdomId[]).filter((id) => id !== playerKingdomId);
  const activeRel = relations[selectedTargetId] || {
    targetKingdomId: selectedTargetId,
    state: 'neutral',
    score: 0,
    discovered: true,
    activeTreaties: [],
    lastInteractionTimeSec: 0,
    grievanceCount: 0,
  };

  const selectedKingdom = KINGDOMS[selectedTargetId];

  const handlePropose = (kind: TreatyKind) => {
    const result = onProposeTreaty(selectedTargetId, kind);
    setFeedbackMessage(`${result.accepted ? 'Accepted' : 'Declined'}: ${result.reason}`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleWar = () => {
    onDeclareWar(selectedTargetId);
    setFeedbackMessage(`War formally declared against ${selectedKingdom.name}!`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const getStateColor = (state: DiplomaticRelationState) => {
    switch (state) {
      case 'allied':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
      case 'friendly':
        return 'text-teal-300 border-teal-500/40 bg-teal-950/40';
      case 'neutral':
        return 'text-amber-200 border-amber-500/40 bg-amber-950/40';
      case 'hostile':
        return 'text-orange-400 border-orange-500/40 bg-orange-950/40';
      case 'at_war':
        return 'text-rose-400 border-rose-500/40 bg-rose-950/40';
      default:
        return 'text-slate-400 border-slate-500/40 bg-slate-950/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-950 border border-amber-900/50 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/40 bg-slate-900/80">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-amber-200 font-serif">
              Sovereign Diplomacy & Treaties
            </h2>
            <p className="text-xs text-slate-400">
              Manage non-aggression pacts, commercial trade agreements, and bilateral alliances.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            Close ✕
          </button>
        </div>

        {/* Content Split */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-amber-900/30 overflow-hidden">
          {/* Kingdom List Selector */}
          <div className="p-4 space-y-2 overflow-y-auto bg-slate-900/40">
            <div className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">
              Discovered Kingdoms
            </div>
            {rivalIds.map((rId) => {
              const rConfig = KINGDOMS[rId];
              const rel = relations[rId];
              const isSelected = rId === selectedTargetId;

              return (
                <button
                  key={rId}
                  onClick={() => setSelectedTargetId(rId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-amber-900/30 border-amber-500/60 shadow-md'
                      : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-200">{rConfig.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStateColor(
                        rel?.state || 'neutral',
                      )}`}
                    >
                      {rel?.state ? rel.state.replace('_', ' ').toUpperCase() : 'NEUTRAL'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>Relation: <strong className="text-amber-200 tabular-nums">{rel?.score ?? 0}</strong></span>
                    <span>·</span>
                    <span>{rConfig.title}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Kingdom Inspection & Diplomacy Actions */}
          <div className="md:col-span-2 p-6 flex flex-col justify-between overflow-y-auto space-y-6">
            <div>
              {/* Sovereign Banner */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-2xl font-bold text-amber-200">{selectedKingdom.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedKingdom.specialisation} · {selectedKingdom.culturalInspirationNote}</p>
                </div>
                <div
                  className={`px-3 py-1 text-xs font-bold rounded-lg border ${getStateColor(
                    activeRel.state,
                  )}`}
                >
                  {activeRel.state.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              {/* Status Overview Metrics */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Diplomatic Score</div>
                  <div className="text-xl font-bold text-amber-300 tabular-nums">{activeRel.score} / 100</div>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Active Treaties</div>
                  <div className="text-xl font-bold text-teal-300 tabular-nums">
                    {activeRel.activeTreaties.length}
                  </div>
                </div>
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400">Grievances Recorded</div>
                  <div className="text-xl font-bold text-rose-400 tabular-nums">{activeRel.grievanceCount}</div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                {selectedKingdom.description}
              </p>

              {/* Active Treaties List */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-amber-300 mb-2">Active Bilateral Pacts</div>
                {activeRel.activeTreaties.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No formal treaties currently active.</div>
                ) : (
                  <div className="space-y-2">
                    {activeRel.activeTreaties.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs"
                      >
                        <span className="font-semibold text-amber-200 capitalize">
                          {t.kind.replace('_', ' ')}
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          {Math.ceil(t.durationRemainingSec / 60)} mins remaining
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Response Banner */}
              {feedbackMessage && (
                <div className="mt-4 p-3 bg-amber-950/80 border border-amber-600/50 rounded-xl text-xs text-amber-200 font-medium">
                  {feedbackMessage}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="border-t border-slate-800 pt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => handlePropose('non_aggression')}
                className="px-3 py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              >
                Non-Aggression
              </button>
              <button
                onClick={() => handlePropose('trade_pact')}
                className="px-3 py-2 text-xs font-semibold text-slate-100 bg-teal-900/60 hover:bg-teal-800/80 rounded-lg border border-teal-700/50 transition-colors"
              >
                Trade Pact
              </button>
              <button
                onClick={() => handlePropose('defensive_alliance')}
                className="px-3 py-2 text-xs font-semibold text-slate-100 bg-amber-900/60 hover:bg-amber-800/80 rounded-lg border border-amber-700/50 transition-colors"
              >
                Defensive Alliance
              </button>
              <button
                onClick={handleWar}
                className="px-3 py-2 text-xs font-semibold text-rose-100 bg-rose-900/80 hover:bg-rose-800 rounded-lg border border-rose-700 transition-colors"
              >
                Declare War
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
