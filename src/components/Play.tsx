
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMap, GameState, Direction, CargoType, CargoConfig, EngineType, WallType, SystemAssets } from '../types';
import { GRID_SIZE, TICK_RATE, DEFAULT_CARGO_TYPES } from '../constants';
import { Trophy, RotateCcw, Play as PlayIcon, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Download, Gauge, Eye, EyeOff } from 'lucide-react';
import { generateOpenSCAD } from '../services/openscadService';
import { motion, AnimatePresence } from 'motion/react';

interface PlayProps {
  map: GameMap;
  cargoTypes: CargoType[];
  engines: EngineType[];
  walls: WallType[];
  systemAssets: SystemAssets;
  onExit: () => void;
  onNextLevel: () => void;
  hasMoreLevels: boolean;
}

export const Play: React.FC<PlayProps> = ({ map, cargoTypes, engines, walls, systemAssets, onExit, onNextLevel, hasMoreLevels }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<GameState | null>(null);
  const [showPath, setShowPath] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [tickRate, setTickRate] = useState(TICK_RATE);
  const tickRateRef = useRef(TICK_RATE);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTickRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});

  // Preload images
  useEffect(() => {
    const allAssets = [
      ...cargoTypes.map(c => c.cargoImage),
      ...cargoTypes.map(c => c.carriageImage),
      ...engines.map(e => e.image),
      ...walls.map(w => w.image),
      systemAssets.startImage,
      systemAssets.gateOpenImage,
      systemAssets.gateClosedImage,
      systemAssets.randomCargoImage,
    ].filter(Boolean) as string[];

    allAssets.forEach(src => {
      if (!imageCache.current[src]) {
        const img = new Image();
        img.src = src;
        imageCache.current[src] = img;
      }
    });
  }, [cargoTypes, engines, walls]);

  // Keep ref in sync with state for the animation loop
  useEffect(() => {
    tickRateRef.current = tickRate;
  }, [tickRate]);

  const initGame = useCallback(() => {
    let totalCargo = 0;
    map.grid.forEach(row => row.forEach(cell => {
      if (cell === 'CARGO') totalCargo++;
    }));

    setState({
      currentLevelIndex: 0,
      score: 0,
      isGameOver: false,
      isLevelComplete: false,
      train: [{ ...map.startPos }],
      lastTrain: [{ ...map.startPos }],
      moveProgress: 0,
      direction: map.startDir,
      nextDirection: map.startDir,
      carriages: [],
      collectedCount: 0,
      totalCargoCount: totalCargo,
      collectedCargoKeys: [],
    });
    setIsPaused(false);
    lastTickRef.current = performance.now();
  }, [map]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!state) return;
    const { direction } = state;
    switch (e.key) {
      case 'ArrowUp': if (direction !== 'DOWN') setState(s => s ? { ...s, nextDirection: 'UP' } : null); break;
      case 'ArrowDown': if (direction !== 'UP') setState(s => s ? { ...s, nextDirection: 'DOWN' } : null); break;
      case 'ArrowLeft': if (direction !== 'RIGHT') setState(s => s ? { ...s, nextDirection: 'LEFT' } : null); break;
      case 'ArrowRight': if (direction !== 'LEFT') setState(s => s ? { ...s, nextDirection: 'RIGHT' } : null); break;
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
  }, [state]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const moveTrainLogic = useCallback((s: GameState): GameState => {
    if (s.isGameOver || s.isLevelComplete) return s;

    const newDirection = s.nextDirection;
    const head = s.train[0];
    let newHead = { ...head };

    if (newDirection === 'UP') newHead.y -= 1;
    if (newDirection === 'DOWN') newHead.y += 1;
    if (newDirection === 'LEFT') newHead.x -= 1;
    if (newDirection === 'RIGHT') newHead.x += 1;

    // Check bounds
    if (newHead.x < 0 || newHead.x >= map.width || newHead.y < 0 || newHead.y >= map.height) {
      return { ...s, isGameOver: true };
    }

    const cell = map.grid[newHead.y][newHead.x];

    // Check collisions
    if (cell === 'WALL') return { ...s, isGameOver: true };
    if (s.train.some(p => p.x === newHead.x && p.y === newHead.y)) return { ...s, isGameOver: true };
    
    if (cell === 'GATE') {
      if (s.collectedCount === s.totalCargoCount) {
        return { ...s, isLevelComplete: true };
      } else {
        return { ...s, isGameOver: true }; // Hit gate before it's open
      }
    }

    let newTrain = [newHead, ...s.train];
    let newCarriages = [...s.carriages];
    let newCollectedCount = s.collectedCount;
    let newScore = s.score;
    let newCollectedCargoKeys = [...s.collectedCargoKeys];

    const cargoKey = `${newHead.x},${newHead.y}`;
    const isActuallyCargo = cell === 'CARGO' && !s.collectedCargoKeys.includes(cargoKey);

    if (isActuallyCargo) {
      newCollectedCount++;
      newScore += 100;
      newCollectedCargoKeys.push(cargoKey);
      
      // Find which cargo it was
      const config = map.cargoConfigs[cargoKey];
      let cargoId = config?.cargoId;
      if (!cargoId || config.type === 'RANDOM') {
        cargoId = cargoTypes[Math.floor(Math.random() * cargoTypes.length)].id;
      }
      newCarriages.push(cargoId);
    } else {
      newTrain.pop();
    }

    return {
      ...s,
      lastTrain: [...s.train],
      train: newTrain,
      direction: newDirection,
      carriages: newCarriages,
      collectedCount: newCollectedCount,
      score: newScore,
      collectedCargoKeys: newCollectedCargoKeys,
    };
  }, [map, cargoTypes]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fdfaf6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (subtle pencil style)
    ctx.strokeStyle = '#17255411';
    ctx.lineWidth = 1;
    for (let x = 0; x <= map.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * GRID_SIZE, 0);
      ctx.lineTo(x * GRID_SIZE, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= map.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * GRID_SIZE);
      ctx.lineTo(canvas.width, y * GRID_SIZE);
      ctx.stroke();
    }

    // Draw Map
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        // Draw generated path if enabled
        if (showPath && map.generatedPath) {
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
        }

        const cell = map.grid[y][x];
        const px = x * GRID_SIZE;
        const py = y * GRID_SIZE;

        if (cell === 'WALL') {
          const wallId = map.wallConfigs?.[`${x},${y}`];
          const wall = walls.find(w => w.id === wallId);
          
          if (wall?.image && imageCache.current[wall.image]) {
            ctx.drawImage(imageCache.current[wall.image], px, py, GRID_SIZE, GRID_SIZE);
          } else {
            ctx.fillStyle = '#172554';
            ctx.fillRect(px, py, GRID_SIZE, GRID_SIZE);
            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.fillText(wall?.emoji || '🧱', px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 12);
          }
        } else if (cell === 'GATE') {
          const isOpen = state.collectedCount === state.totalCargoCount;
          const gateImage = isOpen ? systemAssets.gateOpenImage : systemAssets.gateClosedImage;
          const gateEmoji = isOpen ? systemAssets.gateOpenEmoji : systemAssets.gateClosedEmoji;

          if (gateImage && imageCache.current[gateImage]) {
            ctx.drawImage(imageCache.current[gateImage], px, py, GRID_SIZE, GRID_SIZE);
          } else {
            ctx.fillStyle = isOpen ? '#172554' : '#17255444';
            ctx.beginPath();
            ctx.roundRect(px + 4, py + 4, GRID_SIZE - 8, GRID_SIZE - 8, 8);
            ctx.fill();
            ctx.strokeStyle = '#172554';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = isOpen ? 'white' : '#172554';
            ctx.font = '40px serif';
            ctx.textAlign = 'center';
            ctx.fillText(gateEmoji, px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 14);
          }
        }
      }
    }

    // Draw Cargo
    Object.entries(map.cargoConfigs).forEach(([key, config]) => {
      const [x, y] = key.split(',').map(Number);
      const isCollected = state.collectedCargoKeys.includes(key);
      if (!isCollected) {
        const px = x * GRID_SIZE;
        const py = y * GRID_SIZE;
        const cargoConfig = config as CargoConfig;
        const cargo = cargoConfig.type === 'SPECIFIC' ? cargoTypes.find(c => c.id === cargoConfig.cargoId) : null;
        
        const cargoImage = cargo?.cargoImage || (cargoConfig.type === 'RANDOM' ? systemAssets.randomCargoImage : null);
        const cargoEmoji = cargo?.cargoEmoji || (cargoConfig.type === 'RANDOM' ? systemAssets.randomCargoEmoji : '🎁');

        if (cargoImage && imageCache.current[cargoImage]) {
          ctx.drawImage(imageCache.current[cargoImage], px, py, GRID_SIZE, GRID_SIZE);
        } else {
          ctx.font = '40px serif';
          ctx.textAlign = 'center';
          ctx.fillText(cargoEmoji, px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 14);
        }
      }
    });

    // Draw Train in reverse order (last carriage first, engine last) to ensure correct layering
    for (let i = state.train.length - 1; i >= 0; i--) {
      const p = state.train[i];
      const lastP = state.lastTrain[i] || p;
      const px = (lastP.x + (p.x - lastP.x) * state.moveProgress) * GRID_SIZE;
      const py = (lastP.y + (p.y - lastP.y) * state.moveProgress) * GRID_SIZE;
      
      // Determine direction for this segment based on its actual movement
      let segmentDir: Direction = state.direction;
      if (p.x > lastP.x) segmentDir = 'RIGHT';
      else if (p.x < lastP.x) segmentDir = 'LEFT';
      else if (p.y > lastP.y) segmentDir = 'DOWN';
      else if (p.y < lastP.y) segmentDir = 'UP';
      else if (i > 0) {
        // If not moving (e.g. just spawned), use direction to previous segment
        const prev = state.train[i - 1];
        if (prev.x > p.x) segmentDir = 'RIGHT';
        else if (prev.x < p.x) segmentDir = 'LEFT';
        else if (prev.y > p.y) segmentDir = 'DOWN';
        else if (prev.y < p.y) segmentDir = 'UP';
      }

      // Calculate rotation
      let rotation = 0;
      if (segmentDir === 'UP') rotation = -Math.PI / 2;
      if (segmentDir === 'DOWN') rotation = Math.PI / 2;
      if (segmentDir === 'LEFT') rotation = Math.PI;

      ctx.save();
      ctx.translate(px + GRID_SIZE / 2, py + GRID_SIZE / 2);
      ctx.rotate(rotation);

      if (i === 0) {
        // Head
        const engine = engines.find(e => e.id === map.selectedEngineId) || engines[0];
        if (engine?.image && imageCache.current[engine.image]) {
          ctx.drawImage(imageCache.current[engine.image], -GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
        } else {
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
          ctx.font = '40px serif';
          ctx.textAlign = 'center';
          ctx.fillText(engine?.emoji || '🚂', 0, 14);
        }
      } else {
        // Carriages
        const cargoId = state.carriages[i - 1];
        const cargoType = cargoTypes.find(c => c.id === cargoId);
        
        if (cargoType?.carriageImage && imageCache.current[cargoType.carriageImage]) {
          ctx.drawImage(imageCache.current[cargoType.carriageImage], -GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
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
  }, [map, state, cargoTypes, engines, walls]);

  const animate = useCallback((time: number) => {
    const deltaTime = time - lastTickRef.current;
    lastTickRef.current = time;

    if (!isPaused && state && !state.isGameOver && !state.isLevelComplete) {
      setState(s => {
        if (!s) return s;
        let newProgress = s.moveProgress + (deltaTime / tickRateRef.current);
        
        if (newProgress >= 1) {
          const nextState = moveTrainLogic(s);
          return {
            ...nextState,
            moveProgress: newProgress - 1
          };
        }
        
        return {
          ...s,
          moveProgress: newProgress
        };
      });
    }

    draw();
    requestRef.current = requestAnimationFrame(animate);
  }, [isPaused, state, moveTrainLogic, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#fdfaf6] text-blue-950 p-4">
      <div className="mb-4 flex items-center justify-between w-full max-w-2xl">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight">{map.name}</h2>
          <div className="flex gap-4 text-sm text-blue-900/60 font-mono">
            <span>{t('play.score')}: {state?.score.toString().padStart(6, '0')}</span>
            <span>{t('play.cargo')}: {state?.collectedCount}/{state?.totalCargoCount}</span>
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
            onClick={() => {
              const code = generateOpenSCAD('Train', '🚂');
              const blob = new Blob([code], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'train_carriage.scad';
              a.click();
            }}
            className="p-2 rounded-lg bg-white border border-blue-950 text-blue-950 hover:bg-blue-50 transition-colors"
            title={t('play.export_scad')}
          >
            <Download size={20} />
          </button>
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
              title={showPath ? "Hide Path Hint" : "Show Path Hint"}
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

        <AnimatePresence>
          {state?.isGameOver && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center backdrop-blur-[2px]"
            >
              <h3 className="text-4xl font-bold text-red-600 mb-2">{t('play.crashed')}</h3>
              <p className="text-blue-900/60 mb-6">{t('play.destroyed')}</p>
              <button 
                onClick={initGame}
                className="sketch-button bg-blue-950 text-white font-bold"
              >
                {t('play.try_again')}
              </button>
            </motion.div>
          )}

          {state?.isLevelComplete && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center backdrop-blur-[2px]"
            >
              <Trophy size={64} className="text-yellow-600 mb-4" />
              <h3 className="text-4xl font-bold text-blue-950 mb-2">{t('play.level_clear')}</h3>
              <p className="text-blue-900/60 mb-6">{t('play.success')}</p>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Controls */}
      <div className="mt-8 grid grid-cols-3 gap-2 md:hidden">
        <div />
        <button onClick={() => setState(s => s ? { ...s, nextDirection: 'UP' } : null)} className="sketch-button bg-white"><ArrowUp /></button>
        <div />
        <button onClick={() => setState(s => s ? { ...s, nextDirection: 'LEFT' } : null)} className="sketch-button bg-white"><ArrowLeft /></button>
        <button onClick={() => setState(s => s ? { ...s, nextDirection: 'DOWN' } : null)} className="sketch-button bg-white"><ArrowDown /></button>
        <button onClick={() => setState(s => s ? { ...s, nextDirection: 'RIGHT' } : null)} className="sketch-button bg-white"><ArrowRight /></button>
      </div>

      <div className="mt-6 text-blue-900/40 text-sm font-mono">
        {t('play.controls_hint')}
      </div>
    </div>
  );
};
