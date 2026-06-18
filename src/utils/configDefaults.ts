import {
  AppConfig,
  BonusKind,
  BonusType,
  CargoConfig,
  CargoType,
  CarObstacleDef,
  CellType,
  Direction,
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

// =============================================================================
// Resilient config sanitization.
//
// The save/load paths must never throw on malformed input. Every sanitizer
// below accepts `unknown`, salvages whatever is usable, drops invalid or
// unknown elements, and falls back to sensible defaults. `sanitizeAppConfig`
// additionally returns a summary of what was skipped so the UI can report it.
// =============================================================================

const MAX_GRID_DIM = 200; // guard against absurd dimensions from junk data

const DIRECTIONS: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
const CELL_TYPES: CellType[] = ['EMPTY', 'WALL', 'GATE', 'CARGO', 'BONUS', 'START'];
const BONUS_KINDS: BonusKind[] = ['coin', 'star', 'gem'];

// ---- primitive coercers -----------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function sanitizePoint(raw: unknown): { x: number; y: number } | null {
  if (!isObject(raw)) return null;
  const x = asFiniteNumber(raw.x);
  const y = asFiniteNumber(raw.y);
  if (x === undefined || y === undefined) return null;
  return { x, y };
}

function sanitizePointArray(raw: unknown): { x: number; y: number }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const points = raw.map(sanitizePoint).filter((p): p is { x: number; y: number } => p !== null);
  return points.length ? points : undefined;
}

// ---- asset element sanitizers ----------------------------------------------
// Each returns a clean object built only from known fields (so unknown keys
// are dropped), or null when the item lacks the minimum required identity.

function sanitizeEngine(raw: unknown): EngineType | null {
  if (!isObject(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const image = asString(raw.image);
  return {
    id,
    name: asString(raw.name) ?? id,
    emoji: asString(raw.emoji) ?? '🚂',
    ...(image ? { image } : {}),
  };
}

function sanitizeWall(raw: unknown): WallType | null {
  if (!isObject(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const image = asString(raw.image);
  return {
    id,
    name: asString(raw.name) ?? id,
    emoji: asString(raw.emoji) ?? '🧱',
    ...(image ? { image } : {}),
  };
}

function sanitizeCargo(raw: unknown): CargoType | null {
  if (!isObject(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const cargoImage = asString(raw.cargoImage);
  const carriageImage = asString(raw.carriageImage);
  const pointValue = asFiniteNumber(raw.pointValue);
  return {
    id,
    name: asString(raw.name) ?? id,
    cargoEmoji: asString(raw.cargoEmoji) ?? '🎁',
    carriageEmoji: asString(raw.carriageEmoji) ?? '🚃',
    color: asString(raw.color) ?? '#10b981',
    ...(cargoImage ? { cargoImage } : {}),
    ...(carriageImage ? { carriageImage } : {}),
    ...(pointValue !== undefined ? { pointValue } : {}),
  };
}

function sanitizeBonus(raw: unknown): BonusType | null {
  if (!isObject(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const kindRaw = asString(raw.kind);
  const kind: BonusKind = kindRaw && BONUS_KINDS.includes(kindRaw as BonusKind) ? (kindRaw as BonusKind) : 'coin';
  const image = asString(raw.image);
  const pointValue = asFiniteNumber(raw.pointValue);
  return {
    id,
    name: asString(raw.name) ?? id,
    emoji: asString(raw.emoji) ?? '🪙',
    kind,
    ...(image ? { image } : {}),
    ...(pointValue !== undefined ? { pointValue } : {}),
  };
}

// ---- map sub-structure sanitizers ------------------------------------------

function sanitizeCargoConfigs(raw: unknown): Record<string, CargoConfig> {
  const out: Record<string, CargoConfig> = {};
  if (!isObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isObject(value)) continue;
    if (asString(value.type) === 'SPECIFIC') {
      const cargoId = asString(value.cargoId);
      out[key] = { type: 'SPECIFIC', ...(cargoId ? { cargoId } : {}) };
    } else {
      out[key] = { type: 'RANDOM' };
    }
  }
  return out;
}

function sanitizeBonusConfigs(raw: unknown): Record<string, { bonusId: string }> {
  const out: Record<string, { bonusId: string }> = {};
  if (!isObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!isObject(value)) continue;
    const bonusId = asString(value.bonusId);
    if (!bonusId) continue;
    out[key] = { bonusId };
  }
  return out;
}

function sanitizeWallConfigs(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObject(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function sanitizeCarObstacles(raw: unknown): CarObstacleDef[] {
  if (!Array.isArray(raw)) return [];
  const out: CarObstacleDef[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const id = asString(item.id);
    const startPos = sanitizePoint(item.startPos);
    const endPos = sanitizePoint(item.endPos);
    if (!id || !startPos || !endPos) continue;
    out.push({ id, startPos, endPos });
  }
  return out;
}

// Sanitize a single map. Returns null when the map can't be salvaged (no id,
// or no usable dimensions). The grid is always rebuilt to an exact
// width × height matrix of valid cell types so renderers never see holes.
function sanitizeMapStrict(raw: unknown): GameMap | null {
  if (!isObject(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;

  // Parse the grid into rows of valid cell types (unknown cells become EMPTY).
  let grid: CellType[][] | undefined;
  if (Array.isArray(raw.grid)) {
    grid = (raw.grid as unknown[]).map((row) =>
      Array.isArray(row)
        ? (row as unknown[]).map((cell) =>
            typeof cell === 'string' && CELL_TYPES.includes(cell as CellType) ? (cell as CellType) : 'EMPTY',
          )
        : [],
    );
  }

  // Resolve dimensions: prefer explicit width/height, else derive from grid.
  let width = asFiniteNumber(raw.width);
  let height = asFiniteNumber(raw.height);
  if (grid && grid.length) {
    height = height ?? grid.length;
    width = width ?? Math.max(...grid.map((r) => r.length));
  }
  if (!width || !height || width <= 0 || height <= 0) return null;
  width = clamp(Math.floor(width), 1, MAX_GRID_DIM);
  height = clamp(Math.floor(height), 1, MAX_GRID_DIM);

  // Rebuild the grid to exact dimensions.
  const normGrid: CellType[][] = [];
  for (let y = 0; y < height; y++) {
    const srcRow = grid?.[y] ?? [];
    const row: CellType[] = [];
    for (let x = 0; x < width; x++) {
      row.push(srcRow[x] ?? 'EMPTY');
    }
    normGrid.push(row);
  }

  const startPoint = sanitizePoint(raw.startPos) ?? { x: 1, y: 1 };
  const startPos = {
    x: clamp(Math.floor(startPoint.x), 0, width - 1),
    y: clamp(Math.floor(startPoint.y), 0, height - 1),
  };

  const dirRaw = asString(raw.startDir);
  const startDir: Direction = dirRaw && DIRECTIONS.includes(dirRaw as Direction) ? (dirRaw as Direction) : 'RIGHT';

  const map: GameMap = {
    id,
    name: asString(raw.name) ?? id,
    width,
    height,
    grid: normGrid,
    cargoConfigs: sanitizeCargoConfigs(raw.cargoConfigs),
    bonusConfigs: sanitizeBonusConfigs(raw.bonusConfigs),
    wallConfigs: sanitizeWallConfigs(raw.wallConfigs),
    startPos,
    startDir,
    selectedEngineId: asString(raw.selectedEngineId) ?? 'steam',
  };

  const generatedPath = sanitizePointArray(raw.generatedPath);
  if (generatedPath) map.generatedPath = generatedPath;
  const pathAnchors = sanitizePointArray(raw.pathAnchors);
  if (pathAnchors) map.pathAnchors = pathAnchors;
  const carObstacles = sanitizeCarObstacles(raw.carObstacles);
  if (carObstacles.length) map.carObstacles = carObstacles;

  return map;
}

// All known SystemAssets fields. Every field is a string (emoji or base64
// image), so we copy only string-valued known keys and drop everything else.
const SYSTEM_ASSET_KEYS: (keyof SystemAssets)[] = [
  'startEmoji', 'startImage',
  'gateOpenEmoji', 'gateOpenImage',
  'gateClosedEmoji', 'gateClosedImage',
  'randomCargoEmoji', 'randomCargoImage',
  'carObstacleEmoji', 'carObstacleImage',
  'roadMidEmoji', 'roadMidImage',
  'roadEdgeEmoji', 'roadEdgeImage',
];

export function sanitizeSystemAssets(raw: unknown): SystemAssets {
  const merged: Record<string, string> = { ...DEFAULT_SYSTEM_ASSETS };
  if (isObject(raw)) {
    for (const key of SYSTEM_ASSET_KEYS) {
      const value = raw[key as string];
      if (typeof value === 'string') merged[key as string] = value;
    }
  }
  return merged as unknown as SystemAssets;
}

// ---- list helpers + default merging ----------------------------------------

interface CleanList<T> {
  items: T[];
  skipped: number;
  malformed: boolean; // present but not an array
}

function cleanItemList<T extends { id: string }>(
  raw: unknown,
  sanitize: (r: unknown) => T | null,
): CleanList<T> {
  if (raw === undefined || raw === null) return { items: [], skipped: 0, malformed: false };
  if (!Array.isArray(raw)) return { items: [], skipped: 0, malformed: true };
  const items = raw.map(sanitize).filter((x): x is T => x !== null);
  return { items, skipped: raw.length - items.length, malformed: false };
}

// Merge already-sanitized loaded items over defaults, keeping any defaults the
// loaded set didn't override and preserving the loaded ordering.
function mergeById<T extends { id: string }>(defaults: T[], loaded: T[]): T[] {
  if (!loaded.length) return defaults.map((item) => ({ ...item }));
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

function fillCargoDefaults(cargo: CargoType[]): CargoType[] {
  return cargo.map((c) => ({
    ...c,
    pointValue: c.pointValue ?? DEFAULT_CARGO_TYPES.find((d) => d.id === c.id)?.pointValue ?? 100,
  }));
}

function fillBonusDefaults(bonus: BonusType[]): BonusType[] {
  return bonus.map((b) => ({
    ...b,
    kind: b.kind ?? DEFAULT_BONUS_TYPES.find((d) => d.id === b.id)?.kind ?? 'coin',
    pointValue: b.pointValue ?? DEFAULT_BONUS_TYPES.find((d) => d.id === b.id)?.pointValue ?? 50,
  }));
}

// ---- public merge/sanitize entry points -------------------------------------

export function mergeCargoTypes(loaded?: unknown): CargoType[] {
  return fillCargoDefaults(mergeById(DEFAULT_CARGO_TYPES, cleanItemList(loaded, sanitizeCargo).items));
}

export function mergeBonusTypes(loaded?: unknown): BonusType[] {
  return fillBonusDefaults(mergeById(DEFAULT_BONUS_TYPES, cleanItemList(loaded, sanitizeBonus).items));
}

export function mergeEngines(loaded?: unknown): EngineType[] {
  return mergeById(DEFAULT_ENGINES, cleanItemList(loaded, sanitizeEngine).items);
}

export function mergeWalls(loaded?: unknown): WallType[] {
  return mergeById(DEFAULT_WALLS, cleanItemList(loaded, sanitizeWall).items);
}

// Engines/walls loaded from localStorage are sanitized but NOT re-merged with
// defaults — a user who deleted a default asset should keep it deleted.
export function sanitizeEngines(loaded?: unknown): EngineType[] {
  return cleanItemList(loaded, sanitizeEngine).items;
}

export function sanitizeWalls(loaded?: unknown): WallType[] {
  return cleanItemList(loaded, sanitizeWall).items;
}

// Filter a raw value into a clean array of maps, dropping anything unsalvageable.
export function sanitizeMaps(loaded?: unknown): GameMap[] {
  if (!Array.isArray(loaded)) return [];
  return loaded.map(sanitizeMapStrict).filter((m): m is GameMap => m !== null);
}

export interface SanitizeSummary {
  rootInvalid: boolean;
  skipped: { maps: number; engines: number; walls: number; cargo: number; bonuses: number };
  malformedSections: string[];
}

export interface SanitizeResult {
  config: AppConfig;
  summary: SanitizeSummary;
}

// Resiliently turn arbitrary input into a complete AppConfig, reporting what
// was skipped. Never throws.
export function sanitizeAppConfig(raw: unknown): SanitizeResult {
  const summary: SanitizeSummary = {
    rootInvalid: !isObject(raw),
    skipped: { maps: 0, engines: 0, walls: 0, cargo: 0, bonuses: 0 },
    malformedSections: [],
  };
  const obj = isObject(raw) ? raw : {};

  let maps: GameMap[] = [];
  if (obj.maps !== undefined && obj.maps !== null) {
    if (!Array.isArray(obj.maps)) {
      summary.malformedSections.push('maps');
    } else {
      maps = obj.maps.map(sanitizeMapStrict).filter((m): m is GameMap => m !== null);
      summary.skipped.maps = obj.maps.length - maps.length;
    }
  }

  const eng = cleanItemList(obj.engines, sanitizeEngine);
  const wal = cleanItemList(obj.walls, sanitizeWall);
  const car = cleanItemList(obj.cargoTypes, sanitizeCargo);
  const bon = cleanItemList(obj.bonusTypes, sanitizeBonus);

  if (eng.malformed) summary.malformedSections.push('engines');
  if (wal.malformed) summary.malformedSections.push('walls');
  if (car.malformed) summary.malformedSections.push('cargo');
  if (bon.malformed) summary.malformedSections.push('bonuses');
  summary.skipped.engines = eng.skipped;
  summary.skipped.walls = wal.skipped;
  summary.skipped.cargo = car.skipped;
  summary.skipped.bonuses = bon.skipped;

  const config: AppConfig = {
    version: asString(obj.version) ?? '1.0',
    maps,
    engines: mergeById(DEFAULT_ENGINES, eng.items),
    walls: mergeById(DEFAULT_WALLS, wal.items),
    cargoTypes: fillCargoDefaults(mergeById(DEFAULT_CARGO_TYPES, car.items)),
    bonusTypes: fillBonusDefaults(mergeById(DEFAULT_BONUS_TYPES, bon.items)),
    systemAssets: sanitizeSystemAssets(obj.systemAssets),
    ...(typeof obj.kidsMode === 'boolean' ? { kidsMode: obj.kidsMode } : {}),
  };

  return { config, summary };
}

export function normalizeAppConfig(config: unknown): AppConfig {
  return sanitizeAppConfig(config).config;
}
