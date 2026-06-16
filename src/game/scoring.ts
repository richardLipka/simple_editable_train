import { BonusType, CargoType, GameState } from '../types';
import { createIdMap } from '../utils/assetMaps';

export const COMBO_WINDOW_MS = 3000;
export const COMBO_MULTIPLIERS = [1, 1.5, 2, 2.5] as const;
export const FINISH_BONUS_ALL_BONUSES = 500;
export const FINISH_BONUS_NO_BUMPS_KIDS = 500;
export const FINISH_BONUS_NO_BUMPS_NORMAL = 200;

const DEFAULT_CARGO_POINTS: Record<string, number> = {
  coal: 50,
  wood: 75,
  gold: 200,
  food: 100,
  oil: 80,
};

const DEFAULT_BONUS_POINTS: Record<string, number> = {
  coin: 50,
  star: 75,
  gem: 200,
};

export function getCargoPointValue(
  cargo: CargoType | undefined,
  cargoId: string,
  defaults: Map<string, CargoType>,
): number {
  const resolved = cargo ?? defaults.get(cargoId);
  return resolved?.pointValue ?? DEFAULT_CARGO_POINTS[cargoId] ?? 100;
}

export function getBonusPointValue(
  bonus: BonusType | undefined,
  bonusId: string,
  defaults: Map<string, BonusType>,
): number {
  const resolved = bonus ?? defaults.get(bonusId);
  return resolved?.pointValue ?? DEFAULT_BONUS_POINTS[bonusId] ?? 50;
}

export function getComboMultiplier(comboStreak: number): number {
  return COMBO_MULTIPLIERS[Math.min(comboStreak, COMBO_MULTIPLIERS.length - 1)];
}

export function applyComboScore(basePoints: number, comboStreak: number): number {
  return Math.round(basePoints * getComboMultiplier(comboStreak));
}

export function nextComboStreak(lastPickupAtMs: number, nowMs: number, currentStreak: number): number {
  if (lastPickupAtMs > 0 && nowMs - lastPickupAtMs <= COMBO_WINDOW_MS) {
    return currentStreak + 1;
  }
  return 0;
}

export function getLevelScoreMultiplier(levelIndex: number): number {
  return 1 + levelIndex * 0.1;
}

export function calculateFinishBonus(state: GameState, kidsMode: boolean): number {
  let bonus = 0;
  if (state.totalBonusCount > 0 && state.collectedBonusCount === state.totalBonusCount) {
    bonus += FINISH_BONUS_ALL_BONUSES;
  }
  if (state.bumpCount === 0) {
    bonus += kidsMode ? FINISH_BONUS_NO_BUMPS_KIDS : FINISH_BONUS_NO_BUMPS_NORMAL;
  }
  return bonus;
}

export function calculateStars(state: GameState): number {
  let stars = 1;
  const allBonuses = state.totalBonusCount === 0 || state.collectedBonusCount === state.totalBonusCount;
  if (allBonuses) stars = 2;
  if (allBonuses && state.bumpCount === 0) stars = 3;
  return stars;
}

export function resolveCargoTypes(cargoTypes: CargoType[], defaults: CargoType[]): Map<string, CargoType> {
  const defaultMap = createIdMap(defaults);
  const merged = new Map<string, CargoType>();
  for (const cargo of cargoTypes) {
    const base = defaultMap.get(cargo.id);
    merged.set(cargo.id, {
      ...base,
      ...cargo,
      pointValue: cargo.pointValue ?? base?.pointValue ?? DEFAULT_CARGO_POINTS[cargo.id] ?? 100,
    });
  }
  return merged;
}

export function resolveBonusTypes(bonusTypes: BonusType[], defaults: BonusType[]): Map<string, BonusType> {
  const defaultMap = createIdMap(defaults);
  const merged = new Map<string, BonusType>();
  for (const bonus of bonusTypes) {
    const base = defaultMap.get(bonus.id);
    merged.set(bonus.id, {
      ...base,
      ...bonus,
      kind: bonus.kind ?? base?.kind ?? 'coin',
      pointValue: bonus.pointValue ?? base?.pointValue ?? DEFAULT_BONUS_POINTS[bonus.id] ?? 50,
    });
  }
  return merged;
}