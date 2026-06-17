
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type CellType = 'EMPTY' | 'WALL' | 'GATE' | 'CARGO' | 'BONUS' | 'START';

export type BonusKind = 'coin' | 'star' | 'gem';

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
  cargoImage?: string;
  carriageImage?: string;
  pointValue?: number;
}

export interface BonusType {
  id: string;
  name: string;
  emoji: string;
  image?: string;
  pointValue?: number;
  kind: BonusKind;
}

export interface CargoConfig {
  type: 'SPECIFIC' | 'RANDOM';
  cargoId?: string;
}

export interface BonusConfig {
  bonusId: string;
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  grid: CellType[][];
  cargoConfigs: Record<string, CargoConfig>;
  bonusConfigs?: Record<string, BonusConfig>;
  wallConfigs: Record<string, string>;
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
  bonusTypes?: BonusType[];
  systemAssets: SystemAssets;
}

export interface PickupFeedback {
  points: number;
  label: string;
  x: number;
  y: number;
  comboMultiplier: number;
}

export interface ScorePopup extends PickupFeedback {
  id: number;
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
  carriages: string[];
  collectedCount: number;
  totalCargoCount: number;
  collectedCargoKeys: string[];
  collectedBonusCount: number;
  totalBonusCount: number;
  collectedBonusKeys: string[];
  stepCount: number;
  bumpCount: number;
  isBumping: boolean;
  comboStreak: number;
  lastPickupAtMs: number;
  starsEarned: number;
  finishBonus: number;
  bumpMessage?: 'gate';
  lastPickup?: PickupFeedback;
}