import { GameMap, GameState } from '../types';

/** Body segments that block the head — excludes head; tail excluded when not growing. */
export function getBlockingBodySegments(train: { x: number; y: number }[], willGrow: boolean) {
  if (train.length <= 1) return [];
  return willGrow ? train.slice(1) : train.slice(1, -1);
}

export function moveTrain(
  s: GameState,
  map: GameMap,
  cargoTypes: { id: string }[],
): GameState {
  if (s.isGameOver || s.isLevelComplete) return s;

  const newDirection = s.nextDirection;
  const head = s.train[0];
  const newHead = { ...head };

  if (newDirection === 'UP') newHead.y -= 1;
  if (newDirection === 'DOWN') newHead.y += 1;
  if (newDirection === 'LEFT') newHead.x -= 1;
  if (newDirection === 'RIGHT') newHead.x += 1;

  if (newHead.x < 0 || newHead.x >= map.width || newHead.y < 0 || newHead.y >= map.height) {
    return { ...s, isGameOver: true };
  }

  const cell = map.grid[newHead.y][newHead.x];
  const cargoKey = `${newHead.x},${newHead.y}`;
  const collectedCargo = new Set(s.collectedCargoKeys);
  const isActuallyCargo = cell === 'CARGO' && !collectedCargo.has(cargoKey);

  if (cell === 'WALL') return { ...s, isGameOver: true };

  if (cell === 'GATE') {
    if (s.collectedCount === s.totalCargoCount) {
      return { ...s, isLevelComplete: true };
    }
    return { ...s, isGameOver: true };
  }

  const blockingBody = getBlockingBodySegments(s.train, isActuallyCargo);
  if (blockingBody.some(p => p.x === newHead.x && p.y === newHead.y)) {
    return { ...s, isGameOver: true };
  }

  let newTrain = [newHead, ...s.train];
  let newCarriages = [...s.carriages];
  let newCollectedCount = s.collectedCount;
  let newScore = s.score;
  let newCollectedCargoKeys = [...s.collectedCargoKeys];

  if (isActuallyCargo) {
    newCollectedCount++;
    newScore += 100;
    newCollectedCargoKeys.push(cargoKey);

    const config = map.cargoConfigs[cargoKey];
    let cargoId = config?.cargoId;
    if (!cargoId || config.type === 'RANDOM') {
      cargoId = cargoTypes[Math.floor(Math.random() * cargoTypes.length)].id;
    }
    newCarriages.push(cargoId);
  } else {
    // Drop the vacated tail position only — wagon types stay tied to their segments
    newTrain.pop();
  }

  return {
    ...s,
    lastTrain: [...s.train],
    train: newTrain,
    direction: newDirection,
    carriages: newCarriages,
    collectedCount: newCollectedCount,
    score: newScore,
    collectedCargoKeys: newCollectedCargoKeys,
  };
}

/** Previous grid position for animating train segment i. */
export function getSegmentOrigin(
  train: { x: number; y: number }[],
  lastTrain: { x: number; y: number }[],
  index: number,
): { x: number; y: number } {
  if (index < lastTrain.length) return lastTrain[index];
  // New carriage after growth: appears at its cell without sliding in
  return train[index];
}