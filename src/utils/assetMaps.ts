import { BonusType, CargoType, EngineType, SystemAssets, WallType } from '../types';

export function createIdMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function collectGameAssetUrls(
  cargoTypes: CargoType[],
  engines: EngineType[],
  walls: WallType[],
  systemAssets: SystemAssets,
  bonusTypes?: BonusType[],
  options?: { includeCarriageImages?: boolean },
): string[] {
  const includeCarriages = options?.includeCarriageImages ?? true;
  return [
    ...cargoTypes.map((c) => c.cargoImage),
    ...(includeCarriages ? cargoTypes.map((c) => c.carriageImage) : []),
    ...(bonusTypes ?? []).map((b) => b.image),
    ...engines.map((e) => e.image),
    ...walls.map((w) => w.image),
    systemAssets.startImage,
    systemAssets.gateOpenImage,
    systemAssets.gateClosedImage,
    systemAssets.randomCargoImage,
  ].filter(Boolean) as string[];
}