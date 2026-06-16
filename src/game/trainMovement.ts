import { BonusType, CargoType, GameMap, GameState } from '../types';
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
  const cargoById = resolveCargoTypes(activeCargoTypes, DEFAULT_CARGO_TYPES);
  const bonusById = resolveBonusTypes(activeBonusTypes, DEFAULT_BONUS_TYPES);
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
  const collectedCargo = new Set(s.collectedCargoKeys);
  const collectedBonus = new Set(s.collectedBonusKeys);
  const cellInBounds =
    newHead.x >= 0 && newHead.x < map.width && newHead.y >= 0 && newHead.y < map.height;
  const cell = cellInBounds ? map.grid[newHead.y][newHead.x] : null;
  const isActuallyCargo = cell === 'CARGO' && !collectedCargo.has(cargoKey);
  const isActuallyBonus = cell === 'BONUS' && !collectedBonus.has(bonusKey);
  const willGrow = isActuallyCargo;

  const blockReason = resolveBlockReason(newHead, s, map, willGrow);

  if (blockReason) {
    if (options?.softBump) {
      return {
        ...s,
        lastTrain: s.train,
        moveProgress: 0,
        bumpCount: s.bumpCount + 1,
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
    comboStreak,
    lastPickupAtMs,
    lastPickup,
    bumpMessage: undefined,
  };

  if (cell === 'GATE' && nextState.collectedCount === nextState.totalCargoCount) {
    return completeLevel(nextState, kidsMode, nowMs);
  }

  return nextState;
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
    comboStreak: 0,
    lastPickupAtMs: 0,
    starsEarned: 0,
    finishBonus: 0,
  };
}