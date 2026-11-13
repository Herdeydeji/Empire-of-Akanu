import { KINGDOM_PERSONALITIES } from '../../config/aiPersonalities';
import { KINGDOMS } from '../../config/kingdoms';
import {
  DiplomaticRelation,
  DiplomaticRelationState,
  DiplomaticTreaty,
  KingdomId,
  ResourceAmounts,
  TreatyKind,
  WorldEventItem,
} from '../../types/game';
import {
  depositResourceValidated,
  EconomyWorldRuntime,
  resolveKingdomLedger,
  spendResourcesValidated,
} from './economySim';

export interface DiplomacyState {
  relations: Record<KingdomId, Record<KingdomId, DiplomaticRelation>>;
}

export const ALL_KINGDOM_IDS: KingdomId[] = ['oru', 'zambara', 'kemetra', 'aseka', 'nambara'];

export function computeDiplomaticStateFromScore(score: number, currentState?: DiplomaticRelationState): DiplomaticRelationState {
  if (currentState === 'at_war' && score < -35) return 'at_war';
  if (score <= -60) return 'at_war';
  if (score <= -20) return 'hostile';
  if (score >= 60) return 'allied';
  if (score >= 20) return 'friendly';
  return 'neutral';
}

export function createInitialDiplomacyState(
  playerKingdomId: KingdomId,
  savedRelations?: Record<KingdomId, DiplomaticRelation[]>,
): DiplomacyState {
  const relations: Record<KingdomId, Record<KingdomId, DiplomaticRelation>> = {} as any;

  for (const sourceId of ALL_KINGDOM_IDS) {
    relations[sourceId] = {} as Record<KingdomId, DiplomaticRelation>;
    for (const targetId of ALL_KINGDOM_IDS) {
      if (sourceId === targetId) continue;

      const savedList = savedRelations?.[sourceId];
      const savedItem = savedList?.find((r) => r.targetKingdomId === targetId);

      if (savedItem) {
        relations[sourceId][targetId] = {
          ...savedItem,
          activeTreaties: savedItem.activeTreaties.map((t) => ({ ...t })),
        };
      } else {
        // Diplomatic baseline reflects cultural predispositions while keeping distant realms undiscovered until scouted
        let defaultScore = 0;
        if (sourceId === 'aseka' || targetId === 'aseka') defaultScore += 12;
        if (sourceId === 'zambara' && targetId === 'oru') defaultScore -= 10;
        if (sourceId === 'oru' && targetId === 'zambara') defaultScore -= 10;

        relations[sourceId][targetId] = {
          targetKingdomId: targetId,
          state: computeDiplomaticStateFromScore(defaultScore),
          score: defaultScore,
          discovered: false,
          activeTreaties: [],
          lastInteractionTimeSec: 0,
          grievanceCount: 0,
        };
      }
    }
  }

  // Ensure initial player diplomatic map exists cleanly
  void playerKingdomId;
  return { relations };
}

export function discoverKingdomRelation(
  diplomacy: DiplomacyState,
  sourceId: KingdomId,
  targetId: KingdomId,
): boolean {
  const relA = diplomacy.relations[sourceId]?.[targetId];
  const relB = diplomacy.relations[targetId]?.[sourceId];
  if (!relA || !relB) return false;
  const newlyDiscovered = !relA.discovered;
  relA.discovered = true;
  relB.discovered = true;
  if (relA.state === 'unknown') {
    relA.state = computeDiplomaticStateFromScore(relA.score);
  }
  if (relB.state === 'unknown') {
    relB.state = computeDiplomaticStateFromScore(relB.score);
  }
  return newlyDiscovered;
}

export function hasActiveTreaty(
  diplomacy: DiplomacyState,
  sourceId: KingdomId,
  targetId: KingdomId,
  kind?: TreatyKind,
): boolean {
  const rel = diplomacy.relations[sourceId]?.[targetId];
  if (!rel) return false;
  if (!kind) return rel.activeTreaties.length > 0;
  return rel.activeTreaties.some((t) => t.kind === kind && t.durationRemainingSec > 0);
}

export function updateDiplomaticScore(
  diplomacy: DiplomacyState,
  sourceId: KingdomId,
  targetId: KingdomId,
  delta: number,
  reason: string,
  timestampSec = 0,
): { newState: DiplomaticRelationState; event?: WorldEventItem } {
  const rel = diplomacy.relations[sourceId]?.[targetId];
  const reverse = diplomacy.relations[targetId]?.[sourceId];
  if (!rel) return { newState: 'neutral' };

  rel.discovered = true;
  rel.score = Math.max(-100, Math.min(100, rel.score + delta));
  rel.lastInteractionTimeSec = timestampSec;
  if (delta <= -8) {
    rel.grievanceCount += 1;
  }

  const newState = computeDiplomaticStateFromScore(rel.score, rel.state);
  const oldState = rel.state;

  rel.state = newState;
  if (reverse) {
    reverse.discovered = true;
    reverse.score = rel.score;
    reverse.state = newState;
    reverse.lastInteractionTimeSec = timestampSec;
    if (delta <= -8) {
      reverse.grievanceCount += 1;
    }
  }

  let event: WorldEventItem | undefined;
  if (newState !== oldState) {
    event = {
      id: `evt_dip_${Math.round(timestampSec * 10)}_${sourceId}_${targetId}_${Math.random().toString(36).substring(2, 6)}`,
      timestampSec,
      title: `Diplomatic Shift: ${KINGDOMS[sourceId].name} & ${KINGDOMS[targetId].name}`,
      description: `Relations shifted from ${oldState.replace('_', ' ')} to ${newState.replace('_', ' ')} due to ${reason}.`,
      sourceKingdomId: sourceId,
      targetKingdomId: targetId,
      kind: 'diplomacy',
    };
  }

  return { newState, event };
}

export function addDiplomaticTreaty(
  diplomacy: DiplomacyState,
  sourceId: KingdomId,
  targetId: KingdomId,
  kind: TreatyKind,
  durationSec = 300,
  tributePerMinute?: Partial<ResourceAmounts>,
  timestampSec = 0,
): WorldEventItem {
  const relA = diplomacy.relations[sourceId][targetId];
  const relB = diplomacy.relations[targetId][sourceId];

  discoverKingdomRelation(diplomacy, sourceId, targetId);

  const treatyId = `trty_${kind}_${sourceId}_${targetId}_${Math.round(timestampSec)}`;
  const treaty: DiplomaticTreaty = {
    id: treatyId,
    kind,
    targetKingdomId: targetId,
    durationRemainingSec: durationSec,
    tributePerMinute,
  };

  relA.activeTreaties = relA.activeTreaties.filter((t) => t.kind !== kind);
  relA.activeTreaties.push(treaty);

  if (relB) {
    relB.activeTreaties = relB.activeTreaties.filter((t) => t.kind !== kind);
    relB.activeTreaties.push({
      ...treaty,
      targetKingdomId: sourceId,
    });
  }

  const boost =
    kind === 'defensive_alliance'
      ? 35
      : kind === 'trade_pact'
        ? 22
        : kind === 'non_aggression'
          ? 16
          : 8;
  updateDiplomaticScore(
    diplomacy,
    sourceId,
    targetId,
    boost,
    `the signing of a ${kind.replace('_', ' ')}`,
    timestampSec,
  );

  return {
    id: `evt_treaty_${Math.round(timestampSec * 10)}_${sourceId}_${targetId}_${kind}`,
    timestampSec,
    title: `Treaty Formed: ${kind.replace('_', ' ').toUpperCase()}`,
    description: `${KINGDOMS[sourceId].name} and ${KINGDOMS[targetId].name} agreed to a ${kind.replace('_', ' ')}.`,
    sourceKingdomId: sourceId,
    targetKingdomId: targetId,
    kind: 'diplomacy',
  };
}

export function declareWarBetweenKingdoms(
  diplomacy: DiplomacyState,
  aggressorId: KingdomId,
  defenderId: KingdomId,
  reason: string,
  timestampSec = 0,
): WorldEventItem | null {
  const relA = diplomacy.relations[aggressorId]?.[defenderId];
  const relB = diplomacy.relations[defenderId]?.[aggressorId];
  if (!relA || !relB) return null;
  if (relA.state === 'at_war') return null;

  const hadTreaties = relA.activeTreaties.length > 0;
  relA.activeTreaties = [];
  relB.activeTreaties = [];
  relA.discovered = true;
  relB.discovered = true;
  relA.score = Math.min(relA.score - (hadTreaties ? 55 : 40), -75);
  relA.score = Math.max(-100, relA.score);
  relB.score = relA.score;
  relA.state = 'at_war';
  relB.state = 'at_war';
  relA.lastInteractionTimeSec = timestampSec;
  relB.lastInteractionTimeSec = timestampSec;
  relB.grievanceCount += hadTreaties ? 3 : 2;

  return {
    id: `evt_war_${Math.round(timestampSec * 10)}_${aggressorId}_${defenderId}`,
    timestampSec,
    title: `War Declared: ${KINGDOMS[aggressorId].name} vs ${KINGDOMS[defenderId].name}`,
    description: `${KINGDOMS[aggressorId].name} declared war on ${KINGDOMS[defenderId].name} (${reason}).`,
    sourceKingdomId: aggressorId,
    targetKingdomId: defenderId,
    kind: 'military',
  };
}

export function sendDiplomaticGift(
  diplomacy: DiplomacyState,
  runtime: EconomyWorldRuntime,
  sourceId: KingdomId,
  targetId: KingdomId,
  goldAmount = 100,
): { ok: boolean; reason: string; event?: WorldEventItem } {
  if (sourceId === targetId) return { ok: false, reason: 'Cannot send gift to self.' };
  const cost: ResourceAmounts = { food: 0, wood: 0, stone: 0, iron: 0, gold: goldAmount };
  if (!spendResourcesValidated(runtime, cost, sourceId)) {
    return { ok: false, reason: `Insufficient gold (${goldAmount} Gold required).` };
  }
  depositResourceValidated(runtime, 'gold', goldAmount, targetId);
  discoverKingdomRelation(diplomacy, sourceId, targetId);

  const p = KINGDOM_PERSONALITIES[targetId];
  const bonus = Math.round(14 + p.diplomaticBias * 12);
  const res = updateDiplomaticScore(
    diplomacy,
    sourceId,
    targetId,
    bonus,
    'a royal gold envoy',
    runtime.elapsedSeconds,
  );
  return {
    ok: true,
    reason: `${KINGDOMS[targetId].name} welcomed the ${goldAmount} Gold envoy (+${bonus} relations).`,
    event: res.event,
  };
}

export function proposePeaceTreaty(
  diplomacy: DiplomacyState,
  proposerId: KingdomId,
  responderId: KingdomId,
  proposerStrength: number,
  responderStrength: number,
  timestampSec = 0,
): { accepted: boolean; reason: string; event?: WorldEventItem } {
  const rel = diplomacy.relations[responderId]?.[proposerId];
  const reverse = diplomacy.relations[proposerId]?.[responderId];
  if (!rel || !reverse) return { accepted: false, reason: 'Relations unknown.' };
  if (rel.state !== 'at_war' && rel.state !== 'hostile') {
    return { accepted: false, reason: 'Kingdoms are already at peace.' };
  }

  const personality = KINGDOM_PERSONALITIES[responderId];
  const warDuration = Math.max(0, timestampSec - rel.lastInteractionTimeSec);
  const strengthRatio = proposerStrength / Math.max(1, responderStrength);

  // Responder accepts peace when outmatched, exhausted after prolonged war, or diplomatically inclined
  const peaceDesire =
    personality.diplomaticBias * 0.45 +
    Math.min(0.45, warDuration / 180) +
    (strengthRatio > 1.15 ? 0.35 : strengthRatio < 0.75 ? -0.25 : 0.05) -
    personality.aggressionBias * 0.25;

  if (peaceDesire < 0.32 && rel.score <= -85) {
    return {
      accepted: false,
      reason: `${KINGDOMS[responderId].name} rejects peace and vows to fight on.`,
    };
  }

  rel.score = Math.max(-15, Math.min(0, rel.score + 55));
  reverse.score = rel.score;
  rel.state = 'neutral';
  reverse.state = 'neutral';
  rel.lastInteractionTimeSec = timestampSec;
  reverse.lastInteractionTimeSec = timestampSec;

  const truceEvent = addDiplomaticTreaty(
    diplomacy,
    proposerId,
    responderId,
    'non_aggression',
    180,
    undefined,
    timestampSec,
  );
  truceEvent.title = `Peace Accord: ${KINGDOMS[proposerId].name} & ${KINGDOMS[responderId].name}`;
  truceEvent.description = `${KINGDOMS[proposerId].name} and ${KINGDOMS[responderId].name} concluded hostilities with a 3-minute truce.`;

  return {
    accepted: true,
    reason: `${KINGDOMS[responderId].name} signed a Peace Accord and Non-Aggression Truce.`,
    event: truceEvent,
  };
}

export function evaluateProposalAcceptance(
  diplomacy: DiplomacyState,
  proposerId: KingdomId,
  responderId: KingdomId,
  proposalKind: TreatyKind | 'declare_war' | 'demand_tribute',
): { accepted: boolean; reason: string } {
  if (proposalKind === 'declare_war') {
    return { accepted: true, reason: 'War declared unconditionally.' };
  }

  const rel = diplomacy.relations[responderId]?.[proposerId];
  if (!rel) return { accepted: false, reason: 'Kingdom relations unknown.' };

  const p = KINGDOM_PERSONALITIES[responderId];
  const biasBonus = Math.round((p.diplomaticBias - p.aggressionBias) * 14);
  const effectiveScore = rel.score + biasBonus;

  if (proposalKind === 'non_aggression') {
    if (rel.state === 'at_war') {
      return { accepted: false, reason: 'Must conclude Peace Accord before signing Non-Aggression.' };
    }
    if (effectiveScore >= -25) {
      return { accepted: true, reason: 'Agreed to maintain regional peace.' };
    }
    return { accepted: false, reason: 'Distrust remains too deep.' };
  }

  if (proposalKind === 'trade_pact') {
    if (rel.state === 'at_war') {
      return { accepted: false, reason: 'Cannot open trade during active war.' };
    }
    if (effectiveScore >= -8) {
      return { accepted: true, reason: 'Commercial exchange accepted.' };
    }
    return { accepted: false, reason: 'Refused trade due to low trust.' };
  }

  if (proposalKind === 'defensive_alliance') {
    if (rel.state === 'at_war') {
      return { accepted: false, reason: 'Hostilities prevent forming an alliance.' };
    }
    if (effectiveScore >= 38) {
      return { accepted: true, reason: 'Accepted solemn military alliance.' };
    }
    return { accepted: false, reason: 'Requires stronger diplomatic bond (+40 relation required).' };
  }

  if (proposalKind === 'demand_tribute') {
    if (rel.score <= -40) {
      return { accepted: false, reason: 'Refused tribute and vows defiance!' };
    }
    if (rel.score < 5 && p.aggressionBias < 0.7) {
      return { accepted: true, reason: 'Conceded tribute to avoid escalation.' };
    }
    return { accepted: false, reason: 'Refused tribute demand.' };
  }

  return { accepted: false, reason: 'Proposal declined.' };
}

export function stepDiplomacy(
  dt: number,
  diplomacy: DiplomacyState,
  runtime?: EconomyWorldRuntime,
): WorldEventItem[] {
  const events: WorldEventItem[] = [];
  const elapsed = runtime?.elapsedSeconds ?? 0;

  for (let i = 0; i < ALL_KINGDOM_IDS.length; i++) {
    const sourceId = ALL_KINGDOM_IDS[i];
    for (let j = i + 1; j < ALL_KINGDOM_IDS.length; j++) {
      const targetId = ALL_KINGDOM_IDS[j];
      const relA = diplomacy.relations[sourceId]?.[targetId];
      const relB = diplomacy.relations[targetId]?.[sourceId];
      if (!relA || !relB) continue;

      // Update active treaties symmetrically on canonical pair (sourceId < targetId)
      const remainingA: DiplomaticTreaty[] = [];
      for (const t of relA.activeTreaties) {
        t.durationRemainingSec -= dt;

        // Transfer active tribute using real economy balances (no magic resource generation)
        if (runtime && t.kind === 'tribute' && t.tributePerMinute && t.durationRemainingSec > 0) {
          const factor = dt / 60;
          for (const key of ['food', 'wood', 'stone', 'iron', 'gold'] as const) {
            const amt = (t.tributePerMinute[key] ?? 0) * factor;
            if (amt > 0.001) {
              const payerLedger = resolveKingdomLedger(runtime, targetId);
              const payable = Math.min(payerLedger.resources[key], amt);
              if (payable > 0.001) {
                payerLedger.resources[key] -= payable;
                depositResourceValidated(runtime, key, payable, sourceId);
              }
            }
          }
        }

        if (t.durationRemainingSec <= 0) {
          events.push({
            id: `evt_exp_${Math.round(elapsed * 10)}_${t.id}`,
            timestampSec: elapsed,
            title: `Treaty Expired: ${t.kind.replace('_', ' ')}`,
            description: `The ${t.kind.replace('_', ' ')} between ${KINGDOMS[sourceId].name} and ${KINGDOMS[targetId].name} has expired.`,
            sourceKingdomId: sourceId,
            targetKingdomId: targetId,
            kind: 'diplomacy',
          });
        } else {
          remainingA.push(t);
        }
      }
      relA.activeTreaties = remainingA;

      // Mirror remaining treaties back onto relB cleanly
      relB.activeTreaties = remainingA.map((t) => ({
        ...t,
        targetKingdomId: sourceId,
      }));

      // Gradual drift toward neutral (0) when no treaties and not actively locked in total war
      if (relA.activeTreaties.length === 0 && relA.state !== 'at_war' && Math.abs(relA.score) > 0.05) {
        const drift = (relA.score > 0 ? -0.04 : 0.04) * dt;
        relA.score += drift;
        relB.score = relA.score;
        const nextState = computeDiplomaticStateFromScore(relA.score, relA.state);
        relA.state = nextState;
        relB.state = nextState;
      }
    }
  }

  return events;
}
