
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMap, GameState, Direction, CargoType, CargoConfig, BonusConfig, BonusType, EngineType, WallType, SystemAssets, ScorePopup } from '../types';
import { GRID_SIZE, TICK_RATE, DEFAULT_CARGO_TYPES, DEFAULT_BONUS_TYPES } from '../constants';
import { Trophy, RotateCcw, Play as PlayIcon, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Gauge, Eye, EyeOff, Star } from 'lucide-react';
import { createInitialGameState, computeCarPath, getSegmentOrigin, moveTrain } from '../game/trainMovement';
import { resolveCargoTypes, resolveBonusTypes } from '../game/scoring';
import { getImageCache, preloadImages } from '../utils/imagePreload';
import { collectGameAssetUrls, createIdMap } from '../utils/assetMaps';
import { createGridBackground } from '../utils/canvasBackground';
import { applyDirectionInput } from '../utils/directionInput';

const MAX_FRAME_DELTA_MS = 50;
const SCORE_POPUP_DURATION_MS = 1000;

function needsHudUpdate(prev: GameState, next: GameState): boolean {
  return (
    prev.score !== next.score ||
    prev.collectedCount !== next.collectedCount ||
    prev.isGameOver !== next.isGameOver ||
    prev.isLevelComplete !== next.isLevelComplete ||
    prev.train.length !== next.train.length ||
    prev.bumpMessage !== next.bumpMessage ||
    prev.collectedBonusCount !== next.collectedBonusCount ||
    prev.finishBonus !== next.finishBonus ||
    prev.starsEarned !== next.starsEarned ||
    prev.lastPickup !== next.lastPickup
  );
}

interface PlayProps {
  map: GameMap;
  cargoTypes: CargoType[];
  bonusTypes: BonusType[];
  engines: EngineType[];
  walls: WallType[];
  systemAssets: SystemAssets;
  kidsMode: boolean;
  levelIndex: number;
  onExit: () => void;
  onNextLevel: () => void;
  hasMoreLevels: boolean;
}

export const Play: React.FC<PlayProps> = ({ map, cargoTypes, bonusTypes, engines, walls, systemAssets, kidsMode, levelIndex, onExit, onNextLevel, hasMoreLevels }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<GameState | null>(null);
  const [showPath, setShowPath] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // countdown: 3→2→1→0 ("GO") then null (gone). The game loop reads the ref so
  // the canvas stays frozen (isPausedRef=true) until the overlay disappears.
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 0 | null>(null);
  const countdownRef = useRef<3 | 2 | 1 | 0 | null>(null);
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const popupIdRef = useRef(0);
  const lastProcessedPickupAtRef = useRef(0);

  const [tickRate, setTickRate] = useState(TICK_RATE);
  const tickRateRef = useRef(TICK_RATE);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const isPausedRef = useRef(false);
  const assetsReadyRef = useRef(false);
  const showPathRef = useRef(false);
  const resetTimingRef = useRef(true);
  const needsRedrawRef = useRef(true);
  const kidsModeRef = useRef(kidsMode);
  const levelIndexRef = useRef(levelIndex);
  const imageCache = getImageCache();
  const collectedCargoSetRef = useRef<Set<string>>(new Set());
  const collectedBonusSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    kidsModeRef.current = kidsMode;
  }, [kidsMode]);

  useEffect(() => {
    levelIndexRef.current = levelIndex;
  }, [levelIndex]);

  useEffect(() => {
    const pickupAt = state?.lastPickupAtMs ?? 0;
    if (pickupAt === 0 || pickupAt === lastProcessedPickupAtRef.current) return;

    const pickup = state?.lastPickup;
    if (!pickup) return;

    lastProcessedPickupAtRef.current = pickupAt;
    setScorePopups((prev) => [
      ...prev,
      { ...pickup, id: ++popupIdRef.current },
    ]);
  }, [state?.lastPickupAtMs]);

  const dismissScorePopup = useCallback((popupId: number) => {
    setScorePopups((prev) => prev.filter((popup) => popup.id !== popupId));
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
    needsRedrawRef.current = true;
  }, [isPaused]);

  useEffect(() => {
    showPathRef.current = showPath;
    needsRedrawRef.current = true;
  }, [showPath]);

  useEffect(() => {
    let cancelled = false;
    assetsReadyRef.current = false;

    preloadImages(collectGameAssetUrls(cargoTypes, engines, walls, systemAssets, bonusTypes), { prune: true }).then(() => {
      if (!cancelled) {
        assetsReadyRef.current = true;
        needsRedrawRef.current = true;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cargoTypes, bonusTypes, engines, walls, systemAssets]);

  // Keep ref in sync with state for the animation loop
  useEffect(() => {
    tickRateRef.current = tickRate;
  }, [tickRate]);

  const initGame = useCallback(() => {
    const newState = createInitialGameState(map, map.startDir);
    stateRef.current = newState;
    setState(newState);
    setScorePopups([]);
    lastProcessedPickupAtRef.current = 0;
    collectedCargoSetRef.current = new Set();
    collectedBonusSetRef.current = new Set();
    setIsPaused(false);
    isPausedRef.current = true; // held frozen until countdown finishes
    resetTimingRef.current = true;
    needsRedrawRef.current = true;

    // Cancel any countdown still in flight from a previous start/retry.
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];

    // Countdown 3 → 2 → 1 → GO (0) → release
    const steps: Array<3 | 2 | 1 | 0> = [3, 2, 1, 0];
    steps.forEach((n, i) => {
      countdownTimersRef.current.push(setTimeout(() => {
        setCountdown(n);
        countdownRef.current = n;
        needsRedrawRef.current = true;
      }, i * 1000));
    });
    // After GO has shown for 600 ms, clear the overlay and start the game.
    countdownTimersRef.current.push(setTimeout(() => {
      setCountdown(null);
      countdownRef.current = null;
      isPausedRef.current = false;
      resetTimingRef.current = true;
      needsRedrawRef.current = true;
    }, 3 * 1000 + 600));
  }, [map]);

  // Clear any pending countdown timers when the screen unmounts.
  useEffect(() => () => {
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const setDirection = useCallback((direction: Direction) => {
    const current = stateRef.current;
    if (!current) return;
    const next = applyDirectionInput(current, direction);
    if (next) stateRef.current = next;
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const current = stateRef.current;
    if (!current) return;
    switch (e.key) {
      case 'ArrowUp': setDirection('UP'); break;
      case 'ArrowDown': setDirection('DOWN'); break;
      case 'ArrowLeft': setDirection('LEFT'); break;
      case 'ArrowRight': setDirection('RIGHT'); break;
      case ' ': 
      case 'p':
      case 'P':
        setIsPaused(p => !p); 
        break;
      case 'n':
      case 'N':
        setTickRate(prev => Math.min(500, prev + 10));
        break;
      case 'm':
      case 'M':
        setTickRate(prev => Math.max(50, prev - 10));
        break;
    }
  }, [setDirection]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const wallById = createIdMap<WallType>(walls);
    const cargoById = resolveCargoTypes(cargoTypes, DEFAULT_CARGO_TYPES);
    const bonusById = resolveBonusTypes(bonusTypes, DEFAULT_BONUS_TYPES);
    const cargoEntries = Object.entries(map.cargoConfigs);
    const bonusEntries = Object.entries(map.bonusConfigs ?? {});
    const selectedEngine: EngineType | undefined =
      engines.find((e) => e.id === map.selectedEngineId) || engines[0];
    const gridBackground = createGridBackground(canvas.width, canvas.height, map.width, map.height);

    // Car obstacle paths are fixed for the level — compute once instead of
    // re-allocating an array per car on every animation frame.
    const carPaths = new Map<string, { x: number; y: number }[]>(
      (map.carObstacles ?? []).map((c) => [c.id, computeCarPath(c)]),
    );

    let staticLayer: HTMLCanvasElement | null = null;
    let staticLayerGateOpen: boolean | null = null;
    // Track the asset-readiness the static layer was built at, so it's rebuilt
    // once when images finish loading — but NOT on every forced redraw.
    let staticLayerAssetsReady = false;

    const drawWallCell = (
      target: CanvasRenderingContext2D,
      x: number,
      y: number,
    ) => {
      const px = x * GRID_SIZE;
      const py = y * GRID_SIZE;
      const wallId = map.wallConfigs?.[`${x},${y}`];
      const wall = wallId ? wallById.get(wallId) : undefined;

      if (wall?.image && imageCache[wall.image]?.complete) {
        target.drawImage(imageCache[wall.image], px, py, GRID_SIZE, GRID_SIZE);
        return;
      }

      target.fillStyle = '#172554';
      target.fillRect(px, py, GRID_SIZE, GRID_SIZE);
      target.font = '32px serif';
      target.textAlign = 'center';
      target.fillStyle = 'white';
      target.fillText(wall?.emoji || '🧱', px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 12);
    };

    const drawGateCell = (
      target: CanvasRenderingContext2D,
      x: number,
      y: number,
      gateOpen: boolean,
    ) => {
      const px = x * GRID_SIZE;
      const py = y * GRID_SIZE;
      const gateImage = gateOpen ? systemAssets.gateOpenImage : systemAssets.gateClosedImage;
      const gateEmoji = gateOpen ? systemAssets.gateOpenEmoji : systemAssets.gateClosedEmoji;

      if (gateImage && imageCache[gateImage]?.complete) {
        target.drawImage(imageCache[gateImage], px, py, GRID_SIZE, GRID_SIZE);
        return;
      }

      target.fillStyle = gateOpen ? '#172554' : '#17255444';
      target.beginPath();
      target.roundRect(px + 4, py + 4, GRID_SIZE - 8, GRID_SIZE - 8, 8);
      target.fill();
      target.strokeStyle = '#172554';
      target.lineWidth = 2;
      target.stroke();
      target.fillStyle = gateOpen ? 'white' : '#172554';
      target.font = '40px serif';
      target.textAlign = 'center';
      target.fillText(gateEmoji, px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 14);
    };

    const buildStaticLayer = (gateOpen: boolean) => {
      const layer = document.createElement('canvas');
      layer.width = canvas.width;
      layer.height = canvas.height;
      const layerCtx = layer.getContext('2d');
      if (!layerCtx) return layer;

      layerCtx.drawImage(gridBackground, 0, 0);

      // Roads are static — draw before walls so walls overdraw if overlapping.
      for (const car of (map.carObstacles ?? [])) {
        const path = carPaths.get(car.id)!;
        const isH = car.startPos.y === car.endPos.y;
        const edgeImg = systemAssets.roadEdgeImage && imageCache[systemAssets.roadEdgeImage]?.complete
          ? imageCache[systemAssets.roadEdgeImage] : null;
        const midImg = systemAssets.roadMidImage && imageCache[systemAssets.roadMidImage]?.complete
          ? imageCache[systemAssets.roadMidImage] : null;

        for (let i = 0; i < path.length; i++) {
          const p = path[i];
          const px = p.x * GRID_SIZE;
          const py = p.y * GRID_SIZE;
          const isEdge = i === 0 || i === path.length - 1;
          const img = isEdge ? edgeImg : midImg;

          // Edge convention: image designed horizontal, cap on the right.
          let angle = 0;
          if (isEdge) {
            if (isH) angle = i === 0 ? Math.PI : 0;
            else angle = i === 0 ? -Math.PI / 2 : Math.PI / 2;
          } else if (!isH) {
            angle = Math.PI / 2;
          }
          layerCtx.save();
          layerCtx.translate(px + GRID_SIZE / 2, py + GRID_SIZE / 2);
          layerCtx.rotate(angle);
          if (img) {
            layerCtx.drawImage(img, -GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
          } else {
            const emoji = isEdge ? (systemAssets.roadEdgeEmoji ?? '🛣️') : (systemAssets.roadMidEmoji ?? '🛣️');
            layerCtx.font = '32px serif';
            layerCtx.textAlign = 'center';
            layerCtx.textBaseline = 'middle';
            layerCtx.fillText(emoji, 0, 0);
          }
          layerCtx.restore();
        }
      }

      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const cell = map.grid[y][x];
          if (cell === 'WALL') drawWallCell(layerCtx, x, y);
          if (cell === 'GATE') drawGateCell(layerCtx, x, y, gateOpen);
        }
      }

      return layer;
    };

    let frameId = 0;
    let lastTime = performance.now();
    let skipDelta = true;

    const drawPathOverlay = () => {
      if (!showPathRef.current || !map.generatedPath) return;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      map.generatedPath.forEach((p, i) => {
        const px = p.x * GRID_SIZE + GRID_SIZE / 2;
        const py = p.y * GRID_SIZE + GRID_SIZE / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawFrame = () => {
      const gameState = stateRef.current;
      if (!gameState) return;

      const gateOpen = gameState.collectedCount === gameState.totalCargoCount;
      // Rebuild the cached background canvas only when its contents actually
      // change — the gate opening/closing, or images finishing loading. Forced
      // redraws (pause, path toggle, countdown) re-blit the existing layer
      // instead of allocating a fresh full-size canvas every time.
      if (
        !staticLayer ||
        staticLayerGateOpen !== gateOpen ||
        staticLayerAssetsReady !== assetsReadyRef.current
      ) {
        staticLayer = buildStaticLayer(gateOpen);
        staticLayerGateOpen = gateOpen;
        staticLayerAssetsReady = assetsReadyRef.current;
      }

      ctx.drawImage(staticLayer, 0, 0);
      drawPathOverlay();

      const collectedCargo = collectedCargoSetRef.current;
      for (const [key, config] of cargoEntries) {
        if (collectedCargo.has(key)) continue;

        const comma = key.indexOf(',');
        const x = Number(key.slice(0, comma));
        const y = Number(key.slice(comma + 1));
        const px = x * GRID_SIZE;
        const py = y * GRID_SIZE;
        const cargoConfig = config as CargoConfig;
        const cargo =
          cargoConfig.type === 'SPECIFIC' && cargoConfig.cargoId
            ? cargoById.get(cargoConfig.cargoId)
            : null;

        const cargoImage =
          cargo?.cargoImage ||
          (cargoConfig.type === 'RANDOM' ? systemAssets.randomCargoImage : null);
        const cargoEmoji =
          cargo?.cargoEmoji ||
          (cargoConfig.type === 'RANDOM' ? systemAssets.randomCargoEmoji : '🎁');

        if (cargoImage && imageCache[cargoImage]?.complete) {
          ctx.drawImage(imageCache[cargoImage], px, py, GRID_SIZE, GRID_SIZE);
        } else {
          ctx.font = '40px serif';
          ctx.textAlign = 'center';
          ctx.fillText(cargoEmoji, px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 14);
        }
      }

      const collectedBonus = collectedBonusSetRef.current;
      for (const [key, config] of bonusEntries) {
        if (collectedBonus.has(key)) continue;

        const comma = key.indexOf(',');
        const x = Number(key.slice(0, comma));
        const y = Number(key.slice(comma + 1));
        const px = x * GRID_SIZE;
        const py = y * GRID_SIZE;
        const bonusConfig = config as BonusConfig;
        const bonus = bonusById.get(bonusConfig.bonusId);

        if (bonus?.image && imageCache[bonus.image]?.complete) {
          ctx.drawImage(imageCache[bonus.image], px, py, GRID_SIZE, GRID_SIZE);
        } else {
          ctx.font = '36px serif';
          ctx.textAlign = 'center';
          ctx.fillText(bonus?.emoji ?? '⭐', px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 12);
        }
      }

      const renderProgress = Math.min(gameState.moveProgress, 1);

      // Draw moving car obstacles (behind train so train overlaps on collision).
      for (const carDef of (map.carObstacles ?? [])) {
        const cs = (gameState.carObstacleStates ?? []).find((c) => c.id === carDef.id);
        if (!cs) continue;
        const path = carPaths.get(carDef.id)!;
        const isH = carDef.startPos.y === carDef.endPos.y;
        const prev = path[cs.prevPathIndex] ?? path[cs.pathIndex];
        const curr = path[cs.pathIndex];
        const carX = (prev.x + (curr.x - prev.x) * renderProgress) * GRID_SIZE + GRID_SIZE / 2;
        const carY = (prev.y + (curr.y - prev.y) * renderProgress) * GRID_SIZE + GRID_SIZE / 2;

        const carImg = systemAssets.carObstacleImage && imageCache[systemAssets.carObstacleImage]?.complete
          ? imageCache[systemAssets.carObstacleImage] : null;

        ctx.save();
        ctx.translate(carX, carY);
        if (!isH) ctx.rotate(Math.PI / 2);
        if (carImg) {
          ctx.drawImage(carImg, -GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
        } else {
          ctx.font = '40px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(systemAssets.carObstacleEmoji ?? '🚗', 0, 0);
        }
        ctx.restore();
      }

      for (let i = gameState.train.length - 1; i >= 0; i--) {
        const p = gameState.train[i];
        const lastP = getSegmentOrigin(gameState.train, gameState.lastTrain, i);
        const px = (lastP.x + (p.x - lastP.x) * renderProgress) * GRID_SIZE;
        const py = (lastP.y + (p.y - lastP.y) * renderProgress) * GRID_SIZE;

        let segmentDir: Direction = gameState.direction;
        if (p.x > lastP.x) segmentDir = 'RIGHT';
        else if (p.x < lastP.x) segmentDir = 'LEFT';
        else if (p.y > lastP.y) segmentDir = 'DOWN';
        else if (p.y < lastP.y) segmentDir = 'UP';
        else if (i > 0) {
          const prev = gameState.train[i - 1];
          if (prev.x > p.x) segmentDir = 'RIGHT';
          else if (prev.x < p.x) segmentDir = 'LEFT';
          else if (prev.y > p.y) segmentDir = 'DOWN';
          else if (prev.y < p.y) segmentDir = 'UP';
        }

        let rotation = 0;
        if (segmentDir === 'UP') rotation = -Math.PI / 2;
        if (segmentDir === 'DOWN') rotation = Math.PI / 2;
        if (segmentDir === 'LEFT') rotation = Math.PI;

        ctx.save();
        ctx.translate(px + GRID_SIZE / 2, py + GRID_SIZE / 2);
        ctx.rotate(rotation);

        if (i === 0) {
          if (selectedEngine?.image && imageCache[selectedEngine.image]?.complete) {
            ctx.drawImage(imageCache[selectedEngine.image], -GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
          } else {
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
            ctx.font = '40px serif';
            ctx.textAlign = 'center';
            ctx.fillText(selectedEngine?.emoji || '🚂', 0, 14);
          }
        } else {
          const cargoType = cargoById.get(gameState.carriages[i - 1]);

          if (cargoType?.carriageImage && imageCache[cargoType.carriageImage]?.complete) {
            ctx.drawImage(imageCache[cargoType.carriageImage], -GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
          } else {
            ctx.fillStyle = cargoType?.color || '#555';
            ctx.fillRect(-GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.fillText(cargoType?.carriageEmoji || '🚃', 0, 12);
          }
        }
        ctx.restore();
      }
    };

    const loop = (time: number) => {
      if (resetTimingRef.current) {
        resetTimingRef.current = false;
        skipDelta = true;
        lastTime = time;
      }

      let delta = time - lastTime;
      lastTime = time;

      if (skipDelta) {
        skipDelta = false;
        delta = 0;
      } else {
        delta = Math.min(delta, MAX_FRAME_DELTA_MS);
      }

      const paused = isPausedRef.current || !assetsReadyRef.current;
      const current = stateRef.current;
      const running = !paused && !!current && !current.isGameOver && !current.isLevelComplete;

      if (running && current) {
        let newProgress = current.moveProgress + delta / tickRateRef.current;
        let next = current;

        while (newProgress >= 1 && !next.isGameOver && !next.isLevelComplete) {
          next = moveTrain(next, map, cargoTypes, {
            softBump: kidsModeRef.current,
            cargoTypes,
            bonusTypes,
            cargoById,
            bonusById,
            levelIndex: levelIndexRef.current,
            kidsMode: kidsModeRef.current,
            nowMs: performance.now(),
          });
          newProgress -= 1;
        }

        const updated = { ...next, moveProgress: newProgress };
        stateRef.current = updated;

        if (next !== current) {
          collectedCargoSetRef.current = new Set(updated.collectedCargoKeys);
          collectedBonusSetRef.current = new Set(updated.collectedBonusKeys);
        }

        if (needsHudUpdate(current, updated)) {
          setState(updated);
        }
      }

      // Redraw every frame while the train is animating; otherwise only when
      // something visually changed (reset, pause/showPath toggle, assets
      // loaded, game over/complete). Avoids a full canvas redraw at 60fps
      // while paused or sitting on an end-of-round overlay.
      if (running || needsRedrawRef.current) {
        drawFrame();
        needsRedrawRef.current = false;
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [map, cargoTypes, bonusTypes, engines, walls, systemAssets]);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#fdfaf6] text-blue-950 p-4">
      <div className="mb-4 flex items-center justify-between w-full max-w-2xl">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight">{map.name}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-blue-900/60 font-mono">
            <span>{t('play.score')}: {state?.score ?? 0}</span>
            <span>{t('play.cargo')}: {state?.collectedCount}/{state?.totalCargoCount}</span>
            <span>{t('play.bonus')}: {state?.collectedBonusCount}/{state?.totalBonusCount}</span>
          </div>
        </div>
        
        <div className="flex-1 max-w-xs mx-8 flex items-center gap-3">
          <Gauge size={16} className="text-blue-900/40" />
          <input 
            type="range" 
            min="50" 
            max="500" 
            step="10"
            value={550 - tickRate} 
            onChange={(e) => setTickRate(550 - parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-950"
          />
          <span className="text-[10px] font-mono text-blue-900/40 w-8">{t('play.speed')}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded-lg bg-white border border-blue-950 text-blue-950 hover:bg-blue-50 transition-colors"
          >
            {isPaused ? <PlayIcon size={20} /> : <div className="w-5 h-5 flex gap-1 justify-center items-center"><div className="w-1.5 h-4 bg-blue-950"></div><div className="w-1.5 h-4 bg-blue-950"></div></div>}
          </button>
          {map.generatedPath && (
            <button 
              onClick={() => setShowPath(!showPath)}
              className={`p-2 rounded-lg border transition-colors ${showPath ? 'bg-blue-950 text-white border-blue-950' : 'bg-white border-blue-950 text-blue-950 hover:bg-blue-50'}`}
              title={showPath ? t('play.hide_path_hint') : t('play.show_path_hint')}
            >
              {showPath ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          )}
          <button 
            onClick={initGame}
            className="p-2 rounded-lg bg-white border border-blue-950 text-blue-950 hover:bg-blue-50 transition-colors"
          >
            <RotateCcw size={20} />
          </button>
          <button 
            onClick={onExit}
            className="px-4 py-2 sketch-button bg-red-50 text-red-600 border-red-600"
          >
            {t('play.exit')}
          </button>
        </div>
      </div>

      <div className="relative sketch-border overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={map.width * GRID_SIZE}
          height={map.height * GRID_SIZE}
          className="block"
        />

        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              key={countdown}
              className="play-countdown font-black select-none"
              style={{ fontSize: '10rem', lineHeight: 1, color: countdown === 0 ? '#16a34a' : '#172554' }}
            >
              {countdown === 0 ? t('play.go') : countdown}
            </span>
          </div>
        )}

        {scorePopups.map((popup) => (
          <div
            key={popup.id}
            className={`score-popup-floater absolute pointer-events-none font-black text-lg drop-shadow-sm ${popup.points < 0 ? 'text-red-600' : 'text-yellow-600'}`}
            style={{
              left: popup.x * GRID_SIZE + GRID_SIZE / 2,
              top: popup.y * GRID_SIZE,
              animationDuration: `${SCORE_POPUP_DURATION_MS}ms`,
            }}
            onAnimationEnd={() => dismissScorePopup(popup.id)}
          >
            {popup.points < 0 ? popup.points : `+${popup.points}`}
            {popup.comboMultiplier > 1 ? ` x${popup.comboMultiplier}` : ''}
          </div>
        ))}

        {state?.bumpMessage === 'gate' && kidsMode && (
          <div className="play-gate-hint absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-yellow-100 border-2 border-yellow-500 rounded-xl text-sm font-bold text-blue-950 shadow-sm pointer-events-none">
            {t('play.gate_hint')}
          </div>
        )}

        {state?.isGameOver && (
          <div className="play-overlay-fade-in absolute inset-0 bg-white/90 flex flex-col items-center justify-center backdrop-blur-[2px]">
            <h3 className="text-4xl font-bold text-red-600 mb-2">{t('play.crashed')}</h3>
            <p className="text-blue-900/60 mb-6">{t('play.destroyed')}</p>
            <button
              onClick={initGame}
              className="sketch-button bg-blue-950 text-white font-bold"
            >
              {t('play.try_again')}
            </button>
          </div>
        )}

        {state?.isLevelComplete && (
          <div className="play-overlay-fade-in absolute inset-0 bg-white/90 flex flex-col items-center justify-center backdrop-blur-[2px]">
            <Trophy size={64} className="text-yellow-600 mb-4" />
            <h3 className="text-4xl font-bold text-blue-950 mb-2">{t('play.level_clear')}</h3>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3].map((star) => (
                <Star
                  key={star}
                  size={28}
                  className={star <= (state?.starsEarned ?? 0) ? 'text-yellow-500 fill-yellow-500' : 'text-blue-900/20'}
                />
              ))}
            </div>
            <p className="text-blue-900/60 mb-2">{t('play.success')}</p>
            <p className="text-sm font-mono text-blue-900/50 mb-6">
              {t('play.final_score')}: {state?.score ?? 0}
              {(state?.finishBonus ?? 0) > 0 ? ` (${t('play.finish_bonus')}: +${state?.finishBonus})` : ''}
            </p>
            <div className="flex gap-4">
              {hasMoreLevels ? (
                <button
                  onClick={onNextLevel}
                  className="sketch-button bg-blue-950 text-white font-bold"
                >
                  {t('play.next_level')}
                </button>
              ) : (
                <button
                  onClick={onExit}
                  className="sketch-button bg-blue-950 text-white font-bold"
                >
                  {t('play.main_menu')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="mt-8 grid grid-cols-3 gap-2 md:hidden">
        <div />
        <button onClick={() => setDirection('UP')} className="sketch-button bg-white"><ArrowUp /></button>
        <div />
        <button onClick={() => setDirection('LEFT')} className="sketch-button bg-white"><ArrowLeft /></button>
        <button onClick={() => setDirection('DOWN')} className="sketch-button bg-white"><ArrowDown /></button>
        <button onClick={() => setDirection('RIGHT')} className="sketch-button bg-white"><ArrowRight /></button>
      </div>

      <div className="mt-6 text-blue-900/40 text-sm font-mono">
        {t('play.controls_hint')}
      </div>
    </div>
  );
};

Play.displayName = 'Play';
