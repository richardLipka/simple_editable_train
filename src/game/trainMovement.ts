import { BonusType, CargoType, CarObstacleDef, CarObstacleState, GameMap, GameState } from '../types';
import { DEFAULT_BONUS_TYPES, DEFAULT_CARGO_TYPES } from '../constants';
import {
  applyComboScore,
  calculateFinishBonus,
  calculateStars,
  getBonusPointValue,
  getCargoPointValue,
  getComboMultiplier,
  getLevelScoreMultiplier,
  nextComboStreak,
  resolveBonusTypes,
  resolveCargoTypes,
} from './scoring';

export function computeCarPath(def: CarObstacleDef): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  if (def.startPos.x === def.endPos.x) {
    const step = def.startPos.y <= def.endPos.y ? 1 : -1;
    for (let y = def.startPos.y; y !== def.endPos.y + step; y += step)
      path.push({ x: def.startPos.x, y });
  } else {
    const step = def.startPos.x <= def.endPos.x ? 1 : -1;
    for (let x = def.startPos.x; x !== def.endPos.x + step; x += step)
      path.push({ x, y: def.startPos.y });
  }
  return path;
}

function stepCarState(cs: CarObstacleState, pathLength: number): CarObstacleState {
  const nextPhase = (1 - (cs.phase ?? 0)) as 0 | 1;
  if (pathLength <= 1 || cs.phase === 1) {
    // Hold tick: stay at current cell, flip phase so next tick the car moves.
    return { ...cs, prevPathIndex: cs.pathIndex, phase: nextPhase };
  }
  let nextIndex = cs.pathIndex + cs.direction;
  let nextDir = cs.direction;
  if (nextIndex >= pathLength) { nextIndex = pathLength - 2; nextDir = -1; }
  else if (nextIndex < 0) { nextIndex = 1; nextDir = 1; }
  return { ...cs, prevPathIndex: cs.pathIndex, pathIndex: nextIndex, direction: nextDir, phase: nextPhase };
}

function moveAndCheckCars(
  trainPositions: { x: number; y: number }[],
  currentCarStates: CarObstacleState[],
  carDefs: CarObstacleDef[],
): { carStates: CarObstacleState[]; carHit: boolean } {
  if (carDefs.length === 0) return { carStates: currentCarStates, carHit: false };
  const newCarStates = currentCarStates.map((cs) => {
    const def = carDefs.find((d) => d.id === cs.id);
    if (!def) return cs;
    return stepCarState(cs, computeCarPath(def).length);
  });
  const trainPosSet = new Set(trainPositions.map((p) => `${p.x},${p.y}`));
  const carHit = newCarStates.some((cs) => {
    const def = carDefs.find((d) => d.id === cs.id);
    if (!def) return false;
    const pos = computeCarPath(def)[cs.pathIndex];
    return pos ? trainPosSet.has(`${pos.x},${pos.y}`) : false;
  });
  return { carStates: newCarStates, carHit };
}

/** Body segments that block the head — excludes head; tail excluded when not growing. */
export function getBlockingBodySegments(train: { x: number; y: number }[], willGrow: boolean) {
  if (train.length <= 1) return [];
  return willGrow ? train.slice(1) : train.slice(1, -1);
}

type BlockReason = 'edge' | 'wall' | 'gate' | 'tail';

function resolveBlockReason(
  newHead: { x: number; y: number },
  s: GameState,
  map: GameMap,
  willGrow: boolean,
): BlockReason | null {
  if (newHead.x < 0 || newHead.x >= map.width || newHead.y < 0 || newHead.y >= map.height) {
    return 'edge';
  }

  const cell = map.grid[newHead.y][newHead.x];
  if (cell === 'WALL') return 'wall';

  if (cell === 'GATE') {
    if (s.collectedCount < s.totalCargoCount) return 'gate';
    return null;
  }

  const blockingBody = getBlockingBodySegments(s.train, willGrow);
  if (blockingBody.some((p) => p.x === newHead.x && p.y === newHead.y)) {
    return 'tail';
  }

  return null;
}

export interface MoveTrainOptions {
  softBump?: boolean;
  cargoTypes?: CargoType[];
  bonusTypes?: BonusType[];
  cargoById?: Map<string, CargoType>;
  bonusById?: Map<string, BonusType>;
  levelIndex?: number;
  kidsMode?: boolean;
  nowMs?: number;
}

function completeLevel(state: GameState, kidsMode: boolean, nowMs = performance.now()): GameState {
  const finishBonus = calculateFinishBonus(state, kidsMode);
  const starsEarned = calculateStars(state);
  return {
    ...state,
    isLevelComplete: true,
    bumpMessage: undefined,
    score: state.score + finishBonus,
    finishBonus,
    starsEarned,
    lastPickupAtMs: finishBonus > 0 ? nowMs : state.lastPickupAtMs,
    lastPickup: finishBonus > 0
      ? {
          points: finishBonus,
          label: 'finish',
          x: state.train[0]?.x ?? 0,
          y: state.train[0]?.y ?? 0,
          comboMultiplier: 1,
        }
      : state.lastPickup,
  };
}

export function moveTrain(
  s: GameState,
  map: GameMap,
  cargoTypes: CargoType[],
  options?: MoveTrainOptions,
): GameState {
  if (s.isGameOver || s.isLevelComplete) return s;

  const nowMs = options?.nowMs ?? Date.now();
  const kidsMode = options?.kidsMode ?? false;
  const levelIndex = options?.levelIndex ?? 0;
  const activeCargoTypes = options?.cargoTypes ?? cargoTypes;
  const activeBonusTypes = options?.bonusTypes ?? DEFAULT_BONUS_TYPES;
  const cargoById = options?.cargoById ?? resolveCargoTypes(activeCargoTypes, DEFAULT_CARGO_TYPES);
  const bonusById = options?.bonusById ?? resolveBonusTypes(activeBonusTypes, DEFAULT_BONUS_TYPES);
  const levelMultiplier = getLevelScoreMultiplier(levelIndex);

  const newDirection = s.nextDirection;
  const head = s.train[0];
  const newHead = { ...head };

  if (newDirection === 'UP') newHead.y -= 1;
  if (newDirection === 'DOWN') newHead.y += 1;
  if (newDirection === 'LEFT') newHead.x -= 1;
  if (newDirection === 'RIGHT') newHead.x += 1;

  const cargoKey = `${newHead.x},${newHead.y}`;
  const bonusKey = cargoKey;
  const cellInBounds =
    newHead.x >= 0 && newHead.x < map.width && newHead.y >= 0 && newHead.y < map.height;
  const cell = cellInBounds ? map.grid[newHead.y][newHead.x] : null;
  const isActuallyCargo = cell === 'CARGO' && !s.collectedCargoKeys.includes(cargoKey);
  const isActuallyBonus = cell === 'BONUS' && !s.collectedBonusKeys.includes(bonusKey);
  const willGrow = isActuallyCargo;

  const blockReason = resolveBlockReason(newHead, s, map, willGrow);

  if (blockReason) {
    if (options?.softBump) {
      // Deadlock: every direction blocked → game over even in kids mode.
      const deadlocked = [
        { x: head.x, y: head.y - 1 },
        { x: head.x, y: head.y + 1 },
        { x: head.x - 1, y: head.y },
        { x: head.x + 1, y: head.y },
      ].every((candidate) => resolveBlockReason(candidate, s, map, false) !== null);
      if (deadlocked) return { ...s, isGameOver: true };

      // Cars still move while train is blocked; if one reaches the train → game over.
      const { carStates: bumpCarStates, carHit: bumpCarHit } = moveAndCheckCars(
        s.train, s.carObstacleStates ?? [], map.carObstacles ?? [],
      );
      if (bumpCarHit) return { ...s, carObstacleStates: bumpCarStates, isGameOver: true };

      // Penalise hitting a wall or your own carriages once per collision
      // (only on the leading edge — holding into the obstacle doesn't drain
      // points every tick). Edge and gate bumps are not penalised.
      const isPenaltyBump = blockReason === 'wall' || blockReason === 'tail';
      const applyPenalty = isPenaltyBump && !s.isBumping;
      const penaltyPoints = 500;
      return {
        ...s,
        lastTrain: s.train,
        moveProgress: 0,
        bumpCount: s.bumpCount + 1,
        isBumping: true,
        carObstacleStates: bumpCarStates,
        score: applyPenalty ? Math.max(0, s.score - penaltyPoints) : s.score,
        lastPickupAtMs: applyPenalty ? nowMs : s.lastPickupAtMs,
        lastPickup: applyPenalty
          ? { points: -penaltyPoints, label: 'bump', x: head.x, y: head.y, comboMultiplier: 1 }
          : s.lastPickup,
        bumpMessage: blockReason === 'gate' ? 'gate' : undefined,
      };
    }
    return { ...s, isGameOver: true };
  }

  if (cell === 'GATE' && s.collectedCount === s.totalCargoCount) {
    return completeLevel(s, kidsMode, nowMs);
  }

  let newTrain = [newHead, ...s.train];
  let newCarriages = [...s.carriages];
  let newCollectedCount = s.collectedCount;
  let newCollectedBonusCount = s.collectedBonusCount;
  let newScore = s.score;
  let newCollectedCargoKeys = [...s.collectedCargoKeys];
  let newCollectedBonusKeys = [...s.collectedBonusKeys];
  let comboStreak = s.comboStreak;
  let lastPickupAtMs = s.lastPickupAtMs;
  let lastPickup = s.lastPickup;

  const registerPickup = (basePoints: number, label: string) => {
    comboStreak = nextComboStreak(lastPickupAtMs, nowMs, comboStreak);
    const points = Math.round(applyComboScore(basePoints, comboStreak) * levelMultiplier);
    newScore += points;
    lastPickupAtMs = nowMs;
    lastPickup = {
      points,
      label,
      x: newHead.x,
      y: newHead.y,
      comboMultiplier: getComboMultiplier(comboStreak),
    };
  };

  if (isActuallyCargo) {
    newCollectedCount++;
    newCollectedCargoKeys.push(cargoKey);

    const config = map.cargoConfigs[cargoKey];
    let cargoId = config?.cargoId;
    if (!cargoId || config?.type === 'RANDOM') {
      cargoId = activeCargoTypes[Math.floor(Math.random() * activeCargoTypes.length)]?.id ?? 'coal';
    }
    newCarriages.push(cargoId);
    registerPickup(getCargoPointValue(cargoById.get(cargoId), cargoId, cargoById), 'cargo');
  } else if (isActuallyBonus) {
    newCollectedBonusCount++;
    newCollectedBonusKeys.push(bonusKey);
    const config = map.bonusConfigs?.[bonusKey];
    const bonusId = config?.bonusId ?? 'coin';
    registerPickup(getBonusPointValue(bonusById.get(bonusId), bonusId, bonusById), 'bonus');
    newTrain.pop();
  } else {
    newTrain.pop();
  }

  const nextState: GameState = {
    ...s,
    lastTrain: [...s.train],
    train: newTrain,
    direction: newDirection,
    carriages: newCarriages,
    collectedCount: newCollectedCount,
    collectedBonusCount: newCollectedBonusCount,
    score: newScore,
    collectedCargoKeys: newCollectedCargoKeys,
    collectedBonusKeys: newCollectedBonusKeys,
    stepCount: s.stepCount + 1,
    isBumping: false,
    comboStreak,
    lastPickupAtMs,
    lastPickup,
    bumpMessage: undefined,
  };

  // Move cars and check collision with the newly positioned train.
  const { carStates: newCarStates, carHit } = moveAndCheckCars(
    nextState.train, nextState.carObstacleStates ?? [], map.carObstacles ?? [],
  );
  if (carHit) return { ...nextState, carObstacleStates: newCarStates, isGameOver: true };

  const resolvedState = { ...nextState, carObstacleStates: newCarStates };

  if (cell === 'GATE' && resolvedState.collectedCount === resolvedState.totalCargoCount) {
    return completeLevel(resolvedState, kidsMode, nowMs);
  }

  return resolvedState;
}

/** Previous grid position for animating train segment i. */
export function getSegmentOrigin(
  train: { x: number; y: number }[],
  lastTrain: { x: number; y: number }[],
  index: number,
): { x: number; y: number } {
  if (index < lastTrain.length) return lastTrain[index];
  return train[index];
}

export function createInitialGameState(map: GameMap, startDir: GameState['direction']): GameState {
  let totalCargo = 0;
  let totalBonus = 0;
  map.grid.forEach((row) =>
    row.forEach((cell) => {
      if (cell === 'CARGO') totalCargo++;
      if (cell === 'BONUS') totalBonus++;
    }),
  );

  return {
    currentLevelIndex: 0,
    score: 0,
    isGameOver: false,
    isLevelComplete: false,
    train: [{ ...map.startPos }],
    lastTrain: [{ ...map.startPos }],
    moveProgress: 0,
    direction: startDir,
    nextDirection: startDir,
    carriages: [],
    collectedCount: 0,
    totalCargoCount: totalCargo,
    collectedCargoKeys: [],
    collectedBonusCount: 0,
    totalBonusCount: totalBonus,
    collectedBonusKeys: [],
    stepCount: 0,
    bumpCount: 0,
    isBumping: false,
    carObstacleStates: (map.carObstacles ?? []).map((def) => ({
      id: def.id,
      pathIndex: 0,
      prevPathIndex: 0,
      direction: 1 as const,
      phase: 0 as const,
    })),
    comboStreak: 0,
    lastPickupAtMs: 0,
    starsEarned: 0,
    finishBonus: 0,
  };
}