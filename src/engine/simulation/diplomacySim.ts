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

export interface DiplomacyState {
  relations: Record<KingdomId, Record<KingdomId, DiplomaticRelation>>;
}

const ALL_KINGDOM_IDS: KingdomId[] = ['oru', 'zambara', 'kemetra', 'aseka', 'nambara'];

export function createInitialDiplomacyState(
  playerKingdomId: KingdomId,
  savedRelations?: Record<KingdomId, DiplomaticRelation[]>,
): DiplomacyState {
  const relations: Record<KingdomId, Record<KingdomId, DiplomaticRelation>> = {} as any;

  for (const sourceId of ALL_KINGDOM_IDS) {
    relations[sourceId] = {} as Record<KingdomId, DiplomaticRelation>;
    for (const targetId of ALL_KINGDOM_IDS) {
      if (sourceId === targetId) continue;

      // Check if saved
      const savedList = savedRelations?.[sourceId];
      const savedItem = savedList?.find((r) => r.targetKingdomId === targetId);

      if (savedItem) {
        relations[sourceId][targetId] = { ...savedItem, activeTreaties: [...savedItem.activeTreaties] };
      } else {
        const isPlayerInvolved = sourceId === playerKingdomId || targetId === playerKingdomId;
        const defaultState: DiplomaticRelationState = isPlayerInvolved ? 'neutral' : 'neutral';
        const defaultScore = sourceId === 'aseka' || targetId === 'aseka' ? 15 : 0;

        relations[sourceId][targetId] = {
          targetKingdomId: targetId,
          state: defaultState,
          score: defaultScore,
          discovered: isPlayerInvolved ? true : false,
          activeTreaties: [],
          lastInteractionTimeSec: 0,
          grievanceCount: 0,
        };
      }
    }
  }

  return { relations };
}

export function updateDiplomaticScore(
  diplomacy: DiplomacyState,
  sourceId: KingdomId,
  targetId: KingdomId,
  delta: number,
  reason: string,
): { newState: DiplomaticRelationState; event?: WorldEventItem } {
  const rel = diplomacy.relations[sourceId]?.[targetId];
  if (!rel) return { newState: 'neutral' };

  rel.score = Math.max(-100, Math.min(100, rel.score + delta));

  // Determine state change based on score
  let newState: DiplomaticRelationState = rel.state;
  if (rel.score <= -60) {
    newState = 'at_war';
  } else if (rel.score <= -20) {
    newState = 'hostile';
  } else if (rel.score >= 60) {
    newState = 'allied';
  } else if (rel.score >= 20) {
    newState = 'friendly';
  } else {
    newState = 'neutral';
  }

  let event: WorldEventItem | undefined;
  if (newState !== rel.state) {
    const oldState = rel.state;
    rel.state = newState;
    // Mirror bilateral state
    if (diplomacy.relations[targetId]?.[sourceId]) {
      diplomacy.relations[targetId][sourceId].state = newState;
      diplomacy.relations[targetId][sourceId].score = rel.score;
    }

    event = {
      id: `evt_dip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestampSec: 0,
      title: `Diplomatic Shift: ${KINGDOMS[sourceId].name} & ${KINGDOMS[targetId].name}`,
      description: `Relations transitioned from ${oldState.replace('_', ' ')} to ${newState.replace('_', ' ')} due to ${reason}.`,
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
): WorldEventItem {
  const relA = diplomacy.relations[sourceId][targetId];
  const relB = diplomacy.relations[targetId][sourceId];

  const treatyId = `trty_${kind}_${Date.now()}`;
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

  // Boost relationship score when treaty formed
  const boost = kind === 'defensive_alliance' ? 35 : kind === 'trade_pact' ? 20 : 15;
  updateDiplomaticScore(diplomacy, sourceId, targetId, boost, `the agreement of a ${kind.replace('_', ' ')}`);

  return {
    id: `evt_treaty_${Date.now()}`,
    timestampSec: 0,
    title: `Treaty Formed: ${kind.replace('_', ' ').toUpperCase()}`,
    description: `${KINGDOMS[sourceId].name} and ${KINGDOMS[targetId].name} agreed to a ${kind.replace('_', ' ')}.`,
    sourceKingdomId: sourceId,
    targetKingdomId: targetId,
    kind: 'diplomacy',
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

  if (proposalKind === 'non_aggression') {
    if (rel.score >= -30) {
      return { accepted: true, reason: 'Agreed to maintain regional peace.' };
    }
    return { accepted: false, reason: 'Distrust remains too deep.' };
  }

  if (proposalKind === 'trade_pact') {
    if (rel.score >= -10) {
      return { accepted: true, reason: 'Commercial exchange accepted.' };
    }
    return { accepted: false, reason: 'Refused trade due to low trust.' };
  }

  if (proposalKind === 'defensive_alliance') {
    if (rel.score >= 40) {
      return { accepted: true, reason: 'Accepted solemn military alliance.' };
    }
    return { accepted: false, reason: 'Requires stronger diplomatic bond (+40 relation required).' };
  }

  if (proposalKind === 'demand_tribute') {
    if (rel.score <= -40) {
      return { accepted: false, reason: 'Refused tribute and retaliates!' };
    }
    if (rel.score < 0) {
      return { accepted: true, reason: 'Conceded tribute to avoid war.' };
    }
    return { accepted: false, reason: 'Refused tribute proposal.' };
  }

  return { accepted: false, reason: 'Proposal declined.' };
}

export function stepDiplomacy(
  dt: number,
  diplomacy: DiplomacyState,
): WorldEventItem[] {
  const events: WorldEventItem[] = [];

  for (const sourceId of ALL_KINGDOM_IDS) {
    for (const targetId of ALL_KINGDOM_IDS) {
      if (sourceId === targetId) continue;

      const rel = diplomacy.relations[sourceId]?.[targetId];
      if (!rel) continue;

      // Update treaty countdowns
      const remainingTreaties: DiplomaticTreaty[] = [];
      for (const t of rel.activeTreaties) {
        t.durationRemainingSec -= dt;
        if (t.durationRemainingSec <= 0) {
          events.push({
            id: `evt_exp_${Date.now()}_${t.id}`,
            timestampSec: 0,
            title: `Treaty Expired: ${t.kind.replace('_', ' ')}`,
            description: `The ${t.kind.replace('_', ' ')} between ${KINGDOMS[sourceId].name} and ${KINGDOMS[targetId].name} has expired.`,
            sourceKingdomId: sourceId,
            targetKingdomId: targetId,
            kind: 'diplomacy',
          });
        } else {
          remainingTreaties.push(t);
        }
      }
      rel.activeTreaties = remainingTreaties;

      // Gradual drift toward neutral (0) if no active conflict or alliance
      if (rel.activeTreaties.length === 0 && Math.abs(rel.score) > 0) {
        const drift = (rel.score > 0 ? -0.05 : 0.05) * dt;
        rel.score += drift;
      }
    }
  }

  return events;
}
