import {
  AppConfig,
  BonusType,
  CargoType,
  EngineType,
  GameMap,
  SystemAssets,
  WallType,
} from '../types';
import {
  DEFAULT_BONUS_TYPES,
  DEFAULT_CARGO_TYPES,
  DEFAULT_ENGINES,
  DEFAULT_SYSTEM_ASSETS,
  DEFAULT_WALLS,
} from '../constants';

function mergeById<T extends { id: string }>(defaults: T[], loaded?: T[]): T[] {
  if (!loaded?.length) return defaults.map((item) => ({ ...item }));
  const defaultMap = new Map(defaults.map((item) => [item.id, item]));
  const merged = loaded.map((item) => {
    const base = defaultMap.get(item.id);
    return base ? { ...base, ...item } : { ...item };
  });
  for (const item of defaults) {
    if (!merged.some((entry) => entry.id === item.id)) {
      merged.push({ ...item });
    }
  }
  return merged;
}

export function mergeCargoTypes(loaded?: CargoType[]): CargoType[] {
  return mergeById(DEFAULT_CARGO_TYPES, loaded).map((cargo) => ({
    ...cargo,
    pointValue: cargo.pointValue ?? DEFAULT_CARGO_TYPES.find((d) => d.id === cargo.id)?.pointValue ?? 100,
  }));
}

export function mergeBonusTypes(loaded?: BonusType[]): BonusType[] {
  return mergeById(DEFAULT_BONUS_TYPES, loaded).map((bonus) => ({
    ...bonus,
    kind: bonus.kind ?? DEFAULT_BONUS_TYPES.find((d) => d.id === bonus.id)?.kind ?? 'coin',
    pointValue: bonus.pointValue ?? DEFAULT_BONUS_TYPES.find((d) => d.id === bonus.id)?.pointValue ?? 50,
  }));
}

export function mergeEngines(loaded?: EngineType[]): EngineType[] {
  return mergeById(DEFAULT_ENGINES, loaded);
}

export function mergeWalls(loaded?: WallType[]): WallType[] {
  return mergeById(DEFAULT_WALLS, loaded);
}

export function normalizeMap(map: GameMap): GameMap {
  return {
    ...map,
    cargoConfigs: map.cargoConfigs ?? {},
    bonusConfigs: map.bonusConfigs ?? {},
    wallConfigs: map.wallConfigs ?? {},
  };
}

export function normalizeAppConfig(config: Partial<AppConfig>): AppConfig {
  return {
    version: config.version ?? '1.0',
    maps: (config.maps ?? []).map(normalizeMap),
    engines: mergeEngines(config.engines),
    walls: mergeWalls(config.walls),
    cargoTypes: mergeCargoTypes(config.cargoTypes),
    bonusTypes: mergeBonusTypes(config.bonusTypes),
    systemAssets: { ...DEFAULT_SYSTEM_ASSETS, ...config.systemAssets },
  };
}