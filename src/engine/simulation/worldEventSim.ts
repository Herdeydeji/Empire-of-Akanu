import { WorldEventItem } from '../../types/game';

export interface WorldEventState {
  events: WorldEventItem[];
  maxEvents: number;
}

export function createInitialWorldEventState(
  savedEvents?: WorldEventItem[],
): WorldEventState {
  if (savedEvents && savedEvents.length > 0) {
    return {
      events: savedEvents.slice(0, 50).map((e) => ({ ...e })),
      maxEvents: 50,
    };
  }
  return {
    events: [
      {
        id: 'evt_init_0',
        timestampSec: 0,
        title: 'Kingdoms Established Across Akanu',
        description:
          'The five founding kingdoms have settled regional capitals across the world map.',
        kind: 'territory',
      },
    ],
    maxEvents: 50,
  };
}

export function pushWorldEvent(state: WorldEventState, item: WorldEventItem): void {
  if (state.events.some((e) => e.id === item.id)) return;
  // Prevent near-identical rapid-fire spam within 6 seconds
  const recentDuplicate = state.events.find(
    (e) =>
      e.title === item.title &&
      e.sourceKingdomId === item.sourceKingdomId &&
      e.targetKingdomId === item.targetKingdomId &&
      Math.abs((item.timestampSec ?? 0) - (e.timestampSec ?? 0)) < 6,
  );
  if (recentDuplicate) return;

  state.events.unshift(item);
  if (state.events.length > state.maxEvents) {
    state.events.pop();
  }
}
