import { Direction, GameState } from '../types';

export function applyDirectionInput(
  state: GameState,
  direction: Direction,
): GameState | null {
  const blocked =
    (direction === 'UP' && state.direction === 'DOWN') ||
    (direction === 'DOWN' && state.direction === 'UP') ||
    (direction === 'LEFT' && state.direction === 'RIGHT') ||
    (direction === 'RIGHT' && state.direction === 'LEFT');

  if (blocked) return null;
  return { ...state, nextDirection: direction };
}