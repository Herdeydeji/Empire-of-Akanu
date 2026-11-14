import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Handshake,
  ScrollText,
  Send,
  Shield,
  Swords,
} from 'lucide-react';
import { KINGDOMS } from '../config/kingdoms';
import {
  DiplomaticRelation,
  DiplomaticRelationState,
  KingdomId,
  TreatyKind,
  WorldEventItem,
} from '../types/game';
import { KingdomEmblem } from './KingdomEmblem';

interface DiplomacyPanelProps {
  playerKingdomId: KingdomId;
  relations: Record<KingdomId, DiplomaticRelation>;
  events: WorldEventItem[];
  onProposeTreaty: (targetId: KingdomId, kind: TreatyKind) => { accepted: boolean; reason: string };
  onSendEnvoy?: (targetId: KingdomId) => { ok: boolean; reason: string };
  onProposePeace?: (targetId: KingdomId) => { accepted: boolean; reason: string };
  onDeclareWar: (targetId: KingdomId) => void;
  onClose: () => void;
}

export const DiplomacyPanel: React.FC<DiplomacyPanelProps> = ({
  playerKingdomId,
  relations,
  events,
  onProposeTreaty,
  onSendEnvoy,
  onProposePeace,
  onDeclareWar,
}) => {
  const rivalIds = (Object.keys(KINGDOMS) as KingdomId[]).filter(
    (id) => id !== playerKingdomId,
  );
  const [selectedTargetId, setSelectedTargetId] = useState<KingdomId>(
    rivalIds[0] ?? 'zambara',
  );
  const [feedbackMessage, setFeedbackMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  const effectiveTargetId =
    selectedTargetId !== playerKingdomId ? selectedTargetId : rivalIds[0] ?? 'zambara';

  const activeRel: DiplomaticRelation = relations[effectiveTargetId] || {
    targetKingdomId: effectiveTargetId,
    state: 'neutral',
    score: 0,
    discovered: false,
    activeTreaties: [],
    lastInteractionTimeSec: 0,
    grievanceCount: 0,
  };

  const selectedKingdom = KINGDOMS[effectiveTargetId];
  const isDiscovered = activeRel.discovered;
  const isAtWar = activeRel.state === 'at_war';

  const showFeedback = (ok: boolean, text: string) => {
    setFeedbackMessage({ ok, text });
    window.setTimeout(() => {
      setFeedbackMessage((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };

  const handlePropose = (kind: TreatyKind) => {
    const result = onProposeTreaty(effectiveTargetId, kind);
    showFeedback(result.accepted, `${result.accepted ? 'Accepted' : 'Declined'}: ${result.reason}`);
  };

  const handleEnvoy = () => {
    if (!onSendEnvoy) return;
    const result = onSendEnvoy(effectiveTargetId);
    showFeedback(result.ok, result.reason);
  };

  const handlePeace = () => {
    if (!onProposePeace) return;
    const result = onProposePeace(effectiveTargetId);
    showFeedback(result.accepted, `${result.accepted ? 'Peace Signed' : 'Refused'}: ${result.reason}`);
  };

  const handleWar = () => {
    onDeclareWar(effectiveTargetId);
    showFeedback(false, `War formally declared against ${selectedKingdom.name}!`);
  };

  const getStateBadgeClass = (state: DiplomaticRelationState, discovered: boolean) => {
    if (!discovered) {
      return 'text-[#B8AA96] border-[#76513A]/60 bg-[#171512]';
    }
    switch (state) {
      case 'allied':
        return 'text-[#86efac] border-[#4ca86b]/60 bg-[#132619]';
      case 'friendly':
        return 'text-[#7dd3fc] border-[#3b82f6]/50 bg-[#112130]';
      case 'neutral':
        return 'text-[#D4A64A] border-[#A77A32]/60 bg-[#292017]';
      case 'hostile':
        return 'text-[#fdba74] border-[#ea580c]/60 bg-[#2b180e]';
      case 'at_war':
        return 'text-[#fca5a5] border-[#dc2626]/70 bg-[#2e1212]';
      default:
        return 'text-[#B8AA96] border-[#76513A]/50 bg-[#171512]';
    }
  };

  const recentRelatedEvents = events
    .filter(
      (e) =>
        e.sourceKingdomId === effectiveTargetId ||
        e.targetKingdomId === effectiveTargetId,
    )
    .slice(-3)
    .reverse();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs sm:max-h-[340px] sm:overflow-y-auto akanu-scroll pr-1">
      {/* Left 4 cols: Rival Kingdom Selector */}
      <div className="lg:col-span-4 space-y-1.5">
        <div className="text-[11px] font-semibold text-[#D4A64A] tracking-wide">
          Rival Sovereign Realms
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
          {rivalIds.map((rId) => {
            const rConfig = KINGDOMS[rId];
            const rel = relations[rId];
            const isSelected = rId === effectiveTargetId;
            const discovered = rel?.discovered ?? false;
            const stateLabel = discovered
              ? (rel?.state || 'neutral').replace('_', ' ').toUpperCase()
              : 'UNCHARTED';

            return (
              <button
                key={rId}
                type="button"
                onClick={() => setSelectedTargetId(rId)}
                aria-pressed={isSelected}
                className={`w-full min-h-[52px] text-left p-2.5 rounded border transition-colors duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-[#292017] border-[#D4A64A]'
                    : 'bg-[#171512] hover:bg-[#292017]/65 border-[#76513A]/55'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <KingdomEmblem kingdomId={rId} size={22} className="shrink-0" />
                    <span className="font-bold text-[#F2E8D5] truncate">{rConfig.name}</span>
                  </div>
                  <span
                    className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${getStateBadgeClass(
                      rel?.state || 'neutral',
                      discovered,
                    )}`}
                  >
                    {stateLabel}
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-[#B8AA96] mt-1 flex items-center justify-between gap-1">
                  <span className="truncate">{rConfig.specialisation}</span>
                  <span className="font-mono-num text-[#D4A64A] shrink-0">
                    {discovered ? `Score ${Math.round(rel?.score ?? 0)}` : 'Unexplored'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right 8 cols: Bilateral Relations, Treaties & Actions */}
      <div className="lg:col-span-8 flex flex-col justify-between rounded bg-[#292017]/65 border border-[#76513A]/60 p-3 space-y-2.5">
        <div className="space-y-2.5">
          {/* Sovereign Header */}
          <div className="flex items-start justify-between gap-3 border-b border-[#76513A]/45 pb-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <KingdomEmblem kingdomId={effectiveTargetId} size={36} className="shrink-0" />
              <div className="min-w-0">
                <h4 className="font-display text-base font-bold text-[#F2E8D5] truncate">
                  {selectedKingdom.name}
                </h4>
                <p className="text-[11px] text-[#B8AA96] truncate">
                  {selectedKingdom.title} · {selectedKingdom.specialisation}
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 text-[11px] font-bold rounded border shrink-0 ${getStateBadgeClass(
                activeRel.state,
                isDiscovered,
              )}`}
            >
              {isDiscovered ? activeRel.state.replace('_', ' ').toUpperCase() : 'UNDISCOVERED'}
            </span>
          </div>

          {!isDiscovered ? (
            <div className="rounded bg-[#171512] border border-[#76513A]/55 p-3 space-y-2">
              <p className="text-[#B8AA96] leading-relaxed">
                Your scouts have not yet reached the borders of{' '}
                <strong className="text-[#F2E8D5]">{selectedKingdom.name}</strong>. Send soldiers
                or scouts across the frontier to discover them organically, or dispatch a royal
                envoy now to open diplomatic channels.
              </p>
              {onSendEnvoy && (
                <button
                  type="button"
                  onClick={handleEnvoy}
                  className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#D4A64A] hover:bg-[#e2b65a] text-xs font-semibold text-[#171512] transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Dispatch Envoy & Gift (100 Gold)</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded bg-[#171512] border border-[#76513A]/45">
                  <div className="text-[10px] text-[#B8AA96]">Standing</div>
                  <div className="text-base font-bold font-mono-num text-[#D4A64A]">
                    {Math.round(activeRel.score)} / 100
                  </div>
                </div>
                <div className="p-2 rounded bg-[#171512] border border-[#76513A]/45">
                  <div className="text-[10px] text-[#B8AA96]">Active Pacts</div>
                  <div className="text-base font-bold font-mono-num text-[#86efac]">
                    {activeRel.activeTreaties.length}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#171512] border border-[#76513A]/45">
                  <div className="text-[10px] text-[#B8AA96]">Grievances</div>
                  <div className="text-base font-bold font-mono-num text-[#fca5a5]">
                    {activeRel.grievanceCount}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-[#D4A64A] mb-1">
                  Active Bilateral Pacts
                </div>
                {activeRel.activeTreaties.length === 0 ? (
                  <div className="text-[11px] text-[#B8AA96] italic">
                    No active treaties. Trade Pacts grant +15% market gold tariffs per partner.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {activeRel.activeTreaties.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#171512] border border-[#A77A32]/50 text-[11px]"
                      >
                        <span className="font-semibold text-[#F2E8D5] capitalize">
                          {t.kind.replace('_', ' ')}
                        </span>
                        <span className="font-mono-num text-[#B8AA96]">
                          {Math.ceil(t.durationRemainingSec / 60)}m
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {recentRelatedEvents.length > 0 && (
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#B8AA96]">
                <ScrollText className="w-3 h-3 text-[#A77A32]" aria-hidden="true" />
                <span>Recent Diplomatic Dispatch</span>
              </div>
              {recentRelatedEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="px-2.5 py-1.5 rounded bg-[#171512] border border-[#76513A]/40 text-[11px] text-[#F2E8D5]"
                >
                  <span className="font-semibold text-[#D4A64A]">{evt.title}:</span>{' '}
                  {evt.description}
                </div>
              ))}
            </div>
          )}

          {feedbackMessage && (
            <div
              role="status"
              className={`flex items-center gap-2 p-2 rounded border text-xs font-medium ${
                feedbackMessage.ok
                  ? 'bg-[#132619] border-[#4ca86b]/60 text-[#d7f7e1]'
                  : 'bg-[#2c1512] border-[#dc2626]/60 text-[#fbd5cf]'
              }`}
            >
              {feedbackMessage.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}
        </div>

        {/* Diplomatic Action Buttons */}
        <div className="border-t border-[#76513A]/45 pt-2 flex flex-wrap items-center gap-1.5">
          {onSendEnvoy && !isAtWar && (
            <button
              type="button"
              onClick={handleEnvoy}
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#171512] hover:bg-[#362a1e] border border-[#A77A32]/65 text-[11px] font-semibold text-[#D4A64A] transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3 h-3" aria-hidden="true" />
              <span>Send Envoy (100g)</span>
            </button>
          )}

          {!isAtWar && (
            <>
              <button
                type="button"
                onClick={() => handlePropose('non_aggression')}
                className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#171512] hover:bg-[#362a1e] border border-[#76513A] text-[11px] font-semibold text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <Shield className="w-3 h-3 text-[#B8AA96]" aria-hidden="true" />
                <span>Non-Aggression</span>
              </button>
              <button
                type="button"
                onClick={() => handlePropose('trade_pact')}
                className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#182824] hover:bg-[#203832] border border-[#4ca86b]/55 text-[11px] font-semibold text-[#c9f7dc] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <Handshake className="w-3 h-3" aria-hidden="true" />
                <span>Trade Pact</span>
              </button>
              <button
                type="button"
                onClick={() => handlePropose('defensive_alliance')}
                className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#292017] hover:bg-[#362a1e] border border-[#D4A64A]/65 text-[11px] font-semibold text-[#F2E8D5] transition-colors duration-150 cursor-pointer whitespace-nowrap"
              >
                <Shield className="w-3 h-3 text-[#D4A64A]" aria-hidden="true" />
                <span>Defensive Alliance</span>
              </button>
            </>
          )}

          {(isAtWar || activeRel.state === 'hostile') && onProposePeace && (
            <button
              type="button"
              onClick={handlePeace}
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#22452c] hover:bg-[#2c5a39] border border-[#6ee7b7]/50 text-[11px] font-semibold text-[#e6ffef] transition-colors duration-150 cursor-pointer whitespace-nowrap"
            >
              <Handshake className="w-3 h-3" aria-hidden="true" />
              <span>Propose Peace Accord</span>
            </button>
          )}

          {!isAtWar && (
            <button
              type="button"
              onClick={handleWar}
              className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#5c1b18] hover:bg-[#75221e] border border-[#f87171]/50 text-[11px] font-semibold text-[#fde2e0] transition-colors duration-150 cursor-pointer whitespace-nowrap sm:ml-auto"
            >
              <Swords className="w-3 h-3" aria-hidden="true" />
              <span>Declare War</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
