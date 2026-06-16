
import { CargoType, GameMap, EngineType, WallType, SystemAssets } from './types';

export const GRID_SIZE = 60;
export const TICK_RATE = 150;

export const DEFAULT_SYSTEM_ASSETS: SystemAssets = {
  startEmoji: '🚂',
  gateOpenEmoji: '🏁',
  gateClosedEmoji: '🚧',
  randomCargoEmoji: '🎁',
};

export const DEFAULT_CARGO_TYPES: CargoType[] = [
  { id: 'coal', name: 'Coal', cargoEmoji: '⬛', carriageEmoji: '🛒', color: '#333' },
  { id: 'wood', name: 'Wood', cargoEmoji: '🪵', carriageEmoji: '📦', color: '#8B4513' },
  { id: 'gold', name: 'Gold', cargoEmoji: '💰', carriageEmoji: '💎', color: '#FFD700' },
  { id: 'food', name: 'Food', cargoEmoji: '🍎', carriageEmoji: '🍱', color: '#FF6347' },
  { id: 'oil', name: 'Oil', cargoEmoji: '🛢️', carriageEmoji: '🧪', color: '#2F4F4F' },
];

export const DEFAULT_ENGINES: EngineType[] = [
  { id: 'steam', name: 'Steam Engine', emoji: '🚂' },
  { id: 'diesel', name: 'Diesel Engine', emoji: '🚆' },
  { id: 'electric', name: 'Electric Train', emoji: '🚇' },
];

export const DEFAULT_WALLS: WallType[] = [
  { id: 'brick', name: 'Brick Wall', emoji: '🧱' },
  { id: 'stone', name: 'Stone Wall', emoji: '🪨' },
  { id: 'metal', name: 'Metal Fence', emoji: '🚧' },
];

export const EMOJI_LIST = [
  { category: 'Objects', emojis: ['🎁', '📦', '⬛', '🪵', '💰', '🛢️', '💎', '🧪', '🍱', '🧺', '🏮', '🪑', '🧱', '⚙️', '🔋', '🔌', '💻', '📱', '📷', '📺', '⏰', '🧭', '🕯️', '💡', '🔦', '📖', '📕', '📜', '📄', '📁', '📂', '📅', '🗑️', '🔒', '🔓', '🔑', '🗝️', '🔨', '🛠️', '⛏️', '🔩', '⛓️', '🧲', '🔫', '💣', '🧨', '🛡️', '⚔️', '🏹', '🏺', '⚱️'] },
  { category: 'Food', emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥣', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🧊'] },
  { category: 'Transport', emojis: ['🚃', '🛒', '🚂', '🚆', '🚇', '🚊', '🚉', '🚁', '✈️', '🚀', '🛸', '🚢', '⛵', '🚤', '🛶', '🚜', '🚛', '🚚', '🚐', '🚑', '🚒', '🚓', '🚕', '🚗', '🏎️', '🏍️', '🛵', '🚲', '🛴', '🛹'] },
  { category: 'Nature', emojis: ['🌱', '🌿', '🍀', '🍃', '🍂', '🍁', '🍄', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌙', '⭐', '☁️', '🌧️', '❄️', '🔥', '💧', '🌊', '🌍', '🏔️', '🌋', '🏜️', '🏝️'] },
  { category: 'Animals', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'] }
];

export const INITIAL_MAP: GameMap = {
  id: 'level-1',
  name: 'First Journey',
  width: 20,
  height: 15,
  grid: Array(15).fill(null).map(() => Array(20).fill('EMPTY')),
  cargoConfigs: {},
  wallConfigs: {},
  startPos: { x: 2, y: 7 },
  startDir: 'RIGHT',
  selectedEngineId: 'steam',
};

// Add some walls to the initial map
for (let i = 0; i < 20; i++) {
  INITIAL_MAP.grid[0][i] = 'WALL';
  INITIAL_MAP.wallConfigs[`${i},0`] = 'brick';
  INITIAL_MAP.grid[14][i] = 'WALL';
  INITIAL_MAP.wallConfigs[`${i},14`] = 'brick';
}
for (let i = 0; i < 15; i++) {
  INITIAL_MAP.grid[i][0] = 'WALL';
  INITIAL_MAP.wallConfigs[`0,${i}`] = 'brick';
  INITIAL_MAP.grid[i][19] = 'WALL';
  INITIAL_MAP.wallConfigs[`19,${i}`] = 'brick';
}
INITIAL_MAP.grid[7][19] = 'GATE';
INITIAL_MAP.grid[5][5] = 'CARGO';
INITIAL_MAP.cargoConfigs["5,5"] = { type: 'RANDOM' };
INITIAL_MAP.grid[10][10] = 'CARGO';
INITIAL_MAP.cargoConfigs["10,10"] = { type: 'RANDOM' };
