
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type CellType = 'EMPTY' | 'WALL' | 'GATE' | 'CARGO' | 'START';

export interface EngineType {
  id: string;
  name: string;
  emoji: string;
  image?: string;
}

export interface WallType {
  id: string;
  name: string;
  emoji: string;
  image?: string;
}

export interface CargoType {
  id: string;
  name: string;
  cargoEmoji: string;
  carriageEmoji: string;
  color: string;
  cargoImage?: string; // Base64 or URL
  carriageImage?: string; // Base64 or URL
}

export interface CargoConfig {
  type: 'SPECIFIC' | 'RANDOM';
  cargoId?: string;
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  grid: CellType[][];
  cargoConfigs: Record<string, CargoConfig>; // key is "x,y"
  wallConfigs: Record<string, string>; // key is "x,y", value is wallId
  startPos: { x: number; y: number };
  startDir: Direction;
  selectedEngineId: string;
  generatedPath?: { x: number; y: number }[];
  pathAnchors?: { x: number; y: number }[];
}

export interface SystemAssets {
  startEmoji: string;
  startImage?: string;
  gateOpenEmoji: string;
  gateOpenImage?: string;
  gateClosedEmoji: string;
  gateClosedImage?: string;
  randomCargoEmoji: string;
  randomCargoImage?: string;
}

export interface AppConfig {
  version: string;
  maps: GameMap[];
  engines: EngineType[];
  walls: WallType[];
  cargoTypes: CargoType[];
  systemAssets: SystemAssets;
}

export interface GameState {
  currentLevelIndex: number;
  score: number;
  isGameOver: boolean;
  isLevelComplete: boolean;
  train: { x: number; y: number }[];
  lastTrain: { x: number; y: number }[];
  moveProgress: number;
  direction: Direction;
  nextDirection: Direction;
  carriages: string[]; // Array of cargoIds
  collectedCount: number;
  totalCargoCount: number;
  collectedCargoKeys: string[]; // Array of "x,y" strings
  bumpMessage?: 'gate';
}
