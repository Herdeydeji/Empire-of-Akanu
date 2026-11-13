import React from 'react';
import { KINGDOMS } from '../config/kingdoms';
import {
  AIKingdomRuntime,
  DiplomaticRelation,
  KingdomId,
  WorldEventItem,
} from '../types/game';

interface KingdomOverviewPanelProps {
  playerKingdomId: KingdomId;
  aiKingdoms: Record<KingdomId, AIKingdomRuntime>;
  relations: Record<KingdomId, DiplomaticRelation>;
  events: WorldEventItem[];
  onClose: () => void;
}

export const KingdomOverviewPanel: FC<KingdomOverviewPanelProps> = ({
  playerKingdomId,
  aiKingdoms,
  relations,
  events,
  onClose,
}) => {
  const allIds: KingdomId[] = ['oru', 'zambara', 'kemetra', 'aseka', 'nambara'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-950 border border-amber-900/50 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/40 bg-slate-900/80">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-amber-200 font-serif">
              Akanu World Intelligence & Chronicle
            </h2>
            <p className="text-xs text-slate-400">
              Overview of sovereign powers, active posture, territorial reach, and historic event logs.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            Close ✕
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-amber-900/30 overflow-hidden">
          {/* Kingdom Intelligence Matrix */}
          <div className="lg:col-span-2 p-6 overflow-y-auto space-y-4">
            <h3 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">
              Sovereign Power Matrix
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {allIds.map((kId) => {
                const kConfig = KINGDOMS[kId];
                const aiRuntime = aiKingdoms[kId];
                const rel = relations[kId];
                const isPlayer = kId === playerKingdomId;

                return (
                  <div
                    key={kId}
                    className={`p-4 rounded-xl border transition-all ${
                      isPlayer
                        ? 'bg-amber-950/30 border-amber-500/50 shadow-md'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
                      <div>
                        <span className="font-bold text-base text-amber-200">{kConfig.name}</span>
                        {isPlayer && (
                          <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            YOUR KINGDOM
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        Posture: <strong className="text-slate-200 capitalize">{aiRuntime?.strategicPosture || 'Consolidate'}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Specialization</span>
                        <span className="text-slate-200 font-medium">{kConfig.specialisation}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Progression</span>
                        <span className="text-slate-200 font-medium">{aiRuntime?.progressionStage || 'Settlement'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Diplomatic State</span>
                        <span className="text-slate-200 font-medium capitalize">
                          {isPlayer ? 'Sovereign' : rel?.state ? rel.state.replace('_', ' ') : 'Neutral'}
                        </span>
                      </div>
                    </div>

                    {!isPlayer && aiRuntime && (
                      <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                        Strategic Activity: <span className="text-slate-300 italic">{aiRuntime.lastDecisionSummary}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* World Event Chronicle */}
          <div className="p-6 bg-slate-900/40 overflow-y-auto flex flex-col">
            <h3 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-3">
              World Event Chronicle
            </h3>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {events.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No historical events recorded yet.</div>
              ) : (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 text-xs space-y-1"
                  >
                    <div className="font-semibold text-amber-200 flex items-center justify-between">
                      <span>{evt.title}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{evt.kind}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">{evt.description}</p>
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
type FC<P = {}> = React.FC<P>;
