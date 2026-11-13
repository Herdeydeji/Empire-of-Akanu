import { WorldEventItem } from '../../types/game';

export interface WorldEventState {
  events: WorldEventItem[];
  maxEvents: number;
}

export function createInitialWorldEventState(): WorldEventState {
  return {
    events: [
      {
        id: 'evt_init_0',
        timestampSec: 0,
        title: 'Kingdoms Established Across Akanu',
        description: 'The five founding kingdoms have settled regional capitals across the world map.',
        kind: 'territory',
      },
    ],
    maxEvents: 50,
  };
}

export function pushWorldEvent(state: WorldEventState, item: WorldEventItem): void {
  state.events.unshift(item);
  if (state.events.length > state.maxEvents) {
    state.events.pop();
  }
}
