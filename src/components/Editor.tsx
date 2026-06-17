
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMap, CellType, Direction, CargoType, CargoConfig, BonusType, BonusConfig, EngineType, WallType, SystemAssets, CarObstacleDef } from '../types';
import { computeCarPath } from '../game/trainMovement';
import { GRID_SIZE } from '../constants';
import { collectGameAssetUrls, createIdMap } from '../utils/assetMaps';
import { createGridBackground } from '../utils/canvasBackground';
import { getImageCache, preloadImages } from '../utils/imagePreload';
import {
  Save, Trash2, ArrowLeft, Package, LogOut, Play,
  MousePointer2, Box, Circle, Triangle, Eraser, BrickWall,
  Wand2, Eye, EyeOff, Route, Layout, Sparkles, Car
} from 'lucide-react';

type ShapeTool = 'POINT' | 'RECT' | 'TRI' | 'CIRC';
type EditorTool = CellType | 'PATH' | 'CAR';

interface EditorProps {
  map: GameMap;
  cargoTypes: CargoType[];
  bonusTypes: BonusType[];
  engines: EngineType[];
  walls: WallType[];
  systemAssets: SystemAssets;
  onSave: (map: GameMap) => void;
  onExit: () => void;
}

export const Editor: React.FC<EditorProps> = ({ map: initialMap, cargoTypes, bonusTypes, engines, walls, systemAssets, onSave, onExit }) => {
  const { t } = useTranslation();
  const [map, setMap] = useState<GameMap>({ ...initialMap });
  const [selectedTool, setSelectedTool] = useState<EditorTool>('WALL');
  const [shapeTool, setShapeTool] = useState<ShapeTool>('POINT');
  const [selectedCargoId, setSelectedCargoId] = useState<string | 'RANDOM'>('RANDOM');
  const [selectedBonusId, setSelectedBonusId] = useState<string>(bonusTypes[0]?.id || 'coin');
  const [selectedWallId, setSelectedWallId] = useState<string>(walls[0]?.id || 'brick');
  const [showPath, setShowPath] = useState(true);
  const [genStep, setGenStep] = useState<'PATH' | 'FILL'>('PATH');
  const [genSettings, setGenSettings] = useState({
    maneuverSpace: 0.4, // 0 to 1, how much space to keep empty
    cargoDensity: 0.1,
    pathComplexity: 0.3, // 0 to 1, how much randomness in path
  });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPathIndex, setDraggedPathIndex] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingCarStart, setPendingCarStart] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (selectedTool === 'PATH') setShowPath(true);
    setPendingCarStart(null);
  }, [selectedTool]);

  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = getImageCache();
  const wallById = useMemo(() => createIdMap(walls), [walls]);
  const cargoById = useMemo(() => createIdMap(cargoTypes), [cargoTypes]);
  const bonusById = useMemo(() => createIdMap(bonusTypes), [bonusTypes]);
  const selectedEngine = useMemo(
    () => engines.find((e) => e.id === map.selectedEngineId) || engines[0],
    [engines, map.selectedEngineId],
  );
  const gridBackground = useMemo(
    () => createGridBackground(map.width * GRID_SIZE, map.height * GRID_SIZE, map.width, map.height),
    [map.width, map.height],
  );

  useEffect(() => {
    preloadImages(
      collectGameAssetUrls(cargoTypes, engines, walls, systemAssets, bonusTypes, {
        includeCarriageImages: false,
      }),
    ).then(() => draw());
  }, [cargoTypes, engines, walls, systemAssets]);

  const [hoveredTurnIndex, setHoveredTurnIndex] = useState<number | null>(null);
  const lastClickTime = useRef<number>(0);
  const lastClickPos = useRef<{ x: number, y: number } | null>(null);
  // Last grid cell processed during a drag, so we can skip mousemoves that
  // stay within the same cell (each processed move triggers a full Editor
  // re-render + canvas redraw).
  const lastDragCellRef = useRef<{ x: number, y: number } | null>(null);

  const simplifyPath = useCallback((path: {x: number, y: number}[]) => {
    const simplified = [];
    for (let j = 0; j < path.length; j++) {
      const curr = path[j];
      const last = simplified[simplified.length - 1];
      if (last && last.x === curr.x && last.y === curr.y) continue;
      simplified.push(curr);
    }
    return simplified;
  }, []);

  const updatePathWithElbows = useCallback((path: {x: number, y: number}[], i: number, pos: {x: number, y: number}, avoid?: {x: number, y: number}) => {
    if (i <= 0 || i >= path.length - 1) return path;
    const prev = path[i - 1];
    const next = path[i + 1];

    // Ensure orthogonality by inserting elbows if needed
    const newSegment = [prev];
    
    // First elbow (between prev and pos)
    if (pos.x !== prev.x && pos.y !== prev.y) {
      const elbow1 = { x: pos.x, y: prev.y };
      const elbow2 = { x: prev.x, y: pos.y };
      // If we have an avoid point, try to use the other elbow
      if (avoid && elbow1.x === avoid.x && elbow1.y === avoid.y) {
        newSegment.push(elbow2);
      } else {
        newSegment.push(elbow1);
      }
    }
    
    newSegment.push(pos);
    
    // Second elbow (between pos and next)
    if (next.x !== pos.x && next.y !== pos.y) {
      const elbow1 = { x: next.x, y: pos.y };
      const elbow2 = { x: pos.x, y: next.y };
      // If we have an avoid point, try to use the other elbow
      if (avoid && elbow1.x === avoid.x && elbow1.y === avoid.y) {
        newSegment.push(elbow2);
      } else {
        newSegment.push(elbow1);
      }
    }
    
    newSegment.push(next);

    const newPath = [
      ...path.slice(0, i - 1),
      ...newSegment,
      ...path.slice(i + 2)
    ];

    const simplified = simplifyPath(newPath);

    // Check for self-crossing (duplicates)
    const seen = new Set();
    for (const p of simplified) {
      const key = `${p.x},${p.y}`;
      if (seen.has(key)) return null; // Invalid path
      seen.add(key);
    }

    return simplified;
  }, [simplifyPath]);

  const getTurns = useCallback((path: {x: number, y: number}[]) => {
    if (!path || path.length < 2) return [];
    const turns: {x: number, y: number, index: number}[] = [];
    // Show all intermediate points as nodes
    for (let i = 1; i < path.length - 1; i++) {
      turns.push({ ...path[i], index: i });
    }
    return turns;
  }, []);

  const generatePath = () => {
    const width = map.width;
    const height = map.height;
    
    // 1. Find existing start and gate if present
    let startX = -1;
    let startY = -1;
    let gatePos: { x: number, y: number } | null = null;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (map.grid[y][x] === 'START') {
          startX = x;
          startY = y;
        } else if (map.grid[y][x] === 'GATE') {
          gatePos = { x, y };
        }
      }
    }

    // 2. Fallback to defaults if not found (avoiding edges)
    if (startX === -1) {
      startX = Math.max(1, Math.min(width - 2, Math.floor(width / 2)));
      startY = Math.max(1, Math.min(height - 2, Math.floor(height / 2)));
    }

    if (!gatePos) {
      const innerEdges = [];
      // Inner boundary: x=1 or x=width-2 or y=1 or y=height-2
      for (let x = 1; x < width - 1; x++) { 
        innerEdges.push({ x, y: 1 }); 
        innerEdges.push({ x, y: height - 2 }); 
      }
      for (let y = 2; y < height - 2; y++) { 
        innerEdges.push({ x: 1, y }); 
        innerEdges.push({ x: width - 2, y }); 
      }
      gatePos = innerEdges.length > 0 ? innerEdges[Math.floor(Math.random() * innerEdges.length)] : { x: 1, y: 1 };
    }

    const finalGatePos = gatePos;

    // 3. Randomized DFS to find a simple path (no self-crossing, orthogonal)
    const path: { x: number, y: number }[] = [];
    const visited = new Set<string>();

    const dfs = (curr: {x: number, y: number}): boolean => {
      path.push(curr);
      visited.add(`${curr.x},${curr.y}`);

      if (curr.x === finalGatePos.x && curr.y === finalGatePos.y) return true;

      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 }
      ].filter(n => 
        n.x > 0 && n.x < width - 1 && n.y > 0 && n.y < height - 1 &&
        !visited.has(`${n.x},${n.y}`)
      );

      // Shuffle neighbors for randomness
      for (let i = neighbors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
      }

      // Heuristic: sort neighbors by distance to gate to guide the search
      neighbors.sort((a, b) => {
        const distA = Math.abs(a.x - finalGatePos.x) + Math.abs(a.y - finalGatePos.y);
        const distB = Math.abs(b.x - finalGatePos.x) + Math.abs(b.y - finalGatePos.y);
        return distA - distB;
      });

      // Add some randomness to the heuristic based on pathComplexity
      if (Math.random() < genSettings.pathComplexity) {
        if (neighbors.length > 1 && Math.random() < 0.5) {
          const idx = 1 + Math.floor(Math.random() * (neighbors.length - 1));
          [neighbors[0], neighbors[idx]] = [neighbors[idx], neighbors[0]];
        }
      }

      for (const next of neighbors) {
        if (dfs(next)) return true;
      }

      path.pop();
      // We don't remove from visited to ensure we don't cross the path we've already tried
      return false;
    };

    dfs({ x: startX, y: startY });

    const newGrid = [...map.grid.map(row => [...row])];
    // Clear old start/gate
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (newGrid[y][x] === 'START' || newGrid[y][x] === 'GATE') newGrid[y][x] = 'EMPTY';
      }
    }
    newGrid[startY][startX] = 'START';
    newGrid[finalGatePos.y][finalGatePos.x] = 'GATE';

    setMap(prev => ({
      ...prev,
      grid: newGrid,
      startPos: { x: startX, y: startY },
      generatedPath: path,
      pathAnchors: []
    }));
    setShowPath(true);
  };

  const fillMap = () => {
    if (!map.generatedPath || map.generatedPath.length < 2) return;

    const width = map.width;
    const height = map.height;
    const newGrid = [...map.grid.map(row => [...row])];
    const newWallConfigs = { ...map.wallConfigs };
    const newCargoConfigs = { ...map.cargoConfigs };

    const path = map.generatedPath;
    const startX = path[0].x;
    const startY = path[0].y;
    const gatePos = path[path.length - 1];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (newGrid[y][x] === 'START' || newGrid[y][x] === 'GATE') continue;
        
        const isOnPath = path.some(p => p.x === x && p.y === y);
        const distToPath = Math.min(...path.map(p => Math.abs(p.x - x) + Math.abs(p.y - y)));
        
        if (isOnPath) {
          if (Math.random() < genSettings.cargoDensity) {
            newGrid[y][x] = 'CARGO';
            newCargoConfigs[`${x},${y}`] = { type: 'RANDOM' };
          } else {
            newGrid[y][x] = 'EMPTY';
            delete newCargoConfigs[`${x},${y}`];
            delete newWallConfigs[`${x},${y}`];
          }
        } else {
          // Maneuver space logic: closer to path = more likely to be empty
          const wallProb = Math.min(1, (distToPath - 1) / (5 * genSettings.maneuverSpace + 1));
          if (Math.random() < wallProb) {
            newGrid[y][x] = 'WALL';
            newWallConfigs[`${x},${y}`] = walls[Math.floor(Math.random() * walls.length)].id;
            delete newCargoConfigs[`${x},${y}`];
          } else {
            newGrid[y][x] = 'EMPTY';
            delete newCargoConfigs[`${x},${y}`];
            delete newWallConfigs[`${x},${y}`];
          }
        }
      }
    }

    setMap(prev => ({
      ...prev,
      grid: newGrid,
      wallConfigs: newWallConfigs,
      cargoConfigs: newCargoConfigs as Record<string, CargoConfig>
    }));
  };

  const surroundWithWalls = () => {
    const width = map.width;
    const height = map.height;
    const newGrid = [...map.grid.map(row => [...row])];
    const newWallConfigs = { ...map.wallConfigs };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          if (newGrid[y][x] !== 'START' && newGrid[y][x] !== 'GATE') {
            newGrid[y][x] = 'WALL';
            newWallConfigs[`${x},${y}`] = selectedWallId;
          }
        }
      }
    }

    setMap(prev => ({
      ...prev,
      grid: newGrid,
      wallConfigs: newWallConfigs
    }));
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(gridBackground, 0, 0);

    // Draw generated path if enabled
    if (showPath && map.generatedPath) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
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

      // Draw turns
      const turns = getTurns(map.generatedPath);
      turns.forEach(turn => {
        const px = turn.x * GRID_SIZE + GRID_SIZE / 2;
        const py = turn.y * GRID_SIZE + GRID_SIZE / 2;
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Draw anchors
      if (map.pathAnchors) {
        ctx.fillStyle = '#3b82f6';
        map.pathAnchors.forEach(anchor => {
          const px = anchor.x * GRID_SIZE + GRID_SIZE / 2;
          const py = anchor.y * GRID_SIZE + GRID_SIZE / 2;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // Draw Map
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = map.grid[y][x];
        const px = x * GRID_SIZE;
        const py = y * GRID_SIZE;

        if (cell === 'WALL') {
          const wallId = map.wallConfigs?.[`${x},${y}`];
          const wall = wallId ? wallById.get(wallId) : undefined;

          if (wall?.image && imageCache[wall.image]?.complete) {
            ctx.drawImage(imageCache[wall.image], px + 1, py + 1, GRID_SIZE - 2, GRID_SIZE - 2);
          } else {
            ctx.fillStyle = '#172554';
            ctx.fillRect(px + 4, py + 4, GRID_SIZE - 8, GRID_SIZE - 8);
            ctx.strokeStyle = '#172554';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 2, py + 2, GRID_SIZE - 4, GRID_SIZE - 4);
            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.fillText(wall?.emoji || '🧱', px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 12);
          }
        } else if (cell === 'GATE') {
          if (systemAssets.gateClosedImage && imageCache[systemAssets.gateClosedImage]?.complete) {
            ctx.drawImage(imageCache[systemAssets.gateClosedImage], px, py, GRID_SIZE, GRID_SIZE);
          } else {
            ctx.fillStyle = '#172554';
            ctx.beginPath();
            ctx.roundRect(px + 4, py + 4, GRID_SIZE - 8, GRID_SIZE - 8, 8);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(systemAssets.gateClosedEmoji || 'EXIT', px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 8);
          }
        } else if (cell === 'START') {
          const px = x * GRID_SIZE;
          const py = y * GRID_SIZE;

          if (systemAssets.startImage && imageCache[systemAssets.startImage]?.complete) {
            ctx.drawImage(imageCache[systemAssets.startImage], px, py, GRID_SIZE, GRID_SIZE);
          } else if (systemAssets.startEmoji) {
            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.fillText(systemAssets.startEmoji, px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 12);
          }

          ctx.save();
          ctx.translate(px + GRID_SIZE / 2, py + GRID_SIZE / 2);
          if (map.startDir === 'UP') ctx.rotate(-Math.PI / 2);
          if (map.startDir === 'DOWN') ctx.rotate(Math.PI / 2);
          if (map.startDir === 'LEFT') ctx.rotate(Math.PI);

          if (selectedEngine?.image && imageCache[selectedEngine.image]?.complete) {
            ctx.drawImage(imageCache[selectedEngine.image], -GRID_SIZE / 2 + 1, -GRID_SIZE / 2 + 1, GRID_SIZE - 2, GRID_SIZE - 2);
          } else {
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-GRID_SIZE / 2 + 1, -GRID_SIZE / 2 + 1, GRID_SIZE - 2, GRID_SIZE - 2);
            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.fillText(selectedEngine?.emoji || '🚂', 0, 12);
          }
          ctx.restore();
        } else if (cell === 'CARGO') {
          const config = map.cargoConfigs[`${x},${y}`];
          const cargo =
            config?.type === 'SPECIFIC' && config.cargoId
              ? cargoById.get(config.cargoId)
              : null;
          
          const cargoImage = cargo?.cargoImage || (config?.type === 'RANDOM' ? systemAssets.randomCargoImage : null);
          const cargoEmoji = cargo?.cargoEmoji || (config?.type === 'RANDOM' ? systemAssets.randomCargoEmoji : '❓');

          if (cargoImage && imageCache[cargoImage]?.complete) {
            ctx.drawImage(imageCache[cargoImage], px + 4, py + 4, GRID_SIZE - 8, GRID_SIZE - 8);
          } else {
            ctx.fillStyle = '#3f3f46';
            ctx.fillRect(px + 1, py + 1, GRID_SIZE - 2, GRID_SIZE - 2);
            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'white';
            ctx.fillText(cargoEmoji, px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 12);
          }
        } else if (cell === 'BONUS') {
          const config = map.bonusConfigs?.[`${x},${y}`];
          const bonus = config ? bonusById.get(config.bonusId) : bonusTypes[0];
          const bonusImage = bonus?.image;
          const bonusEmoji = bonus?.emoji ?? '⭐';

          if (bonusImage && imageCache[bonusImage]?.complete) {
            ctx.drawImage(imageCache[bonusImage], px + 4, py + 4, GRID_SIZE - 8, GRID_SIZE - 8);
          } else {
            ctx.fillStyle = '#fef3c7';
            ctx.fillRect(px + 1, py + 1, GRID_SIZE - 2, GRID_SIZE - 2);
            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#92400e';
            ctx.fillText(bonusEmoji, px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 12);
          }
        }
      }
    }

    // Draw car obstacle roads (before markers so markers sit on top)
    for (const car of (map.carObstacles ?? [])) {
      const path = computeCarPath(car);
      if (path.length < 2) continue;
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

        let angle = 0;
        if (isEdge) {
          if (isH) angle = i === 0 ? Math.PI : 0;
          else angle = i === 0 ? -Math.PI / 2 : Math.PI / 2;
        } else if (!isH) {
          angle = Math.PI / 2;
        }
        ctx.save();
        ctx.translate(px + GRID_SIZE / 2, py + GRID_SIZE / 2);
        ctx.rotate(angle);
        if (img) {
          ctx.drawImage(img, -GRID_SIZE / 2, -GRID_SIZE / 2, GRID_SIZE, GRID_SIZE);
        } else {
          const emoji = isEdge ? (systemAssets.roadEdgeEmoji ?? '🛣️') : (systemAssets.roadMidEmoji ?? '🛣️');
          ctx.font = '32px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(emoji, 0, 0);
        }
        ctx.restore();
      }

      // Car silhouette at start position
      const sp = car.startPos;
      const carImg = systemAssets.carObstacleImage && imageCache[systemAssets.carObstacleImage]?.complete
        ? imageCache[systemAssets.carObstacleImage] : null;
      ctx.save();
      ctx.translate(sp.x * GRID_SIZE + GRID_SIZE / 2, sp.y * GRID_SIZE + GRID_SIZE / 2);
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

      // End-point marker
      const ep = car.endPos;
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ep.x * GRID_SIZE + GRID_SIZE / 2, ep.y * GRID_SIZE + GRID_SIZE / 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Pending car-start highlight
    if (pendingCarStart) {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.35)';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(pendingCarStart.x * GRID_SIZE, pendingCarStart.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      ctx.strokeRect(pendingCarStart.x * GRID_SIZE, pendingCarStart.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      ctx.setLineDash([]);
    }

    // Draw Preview
    if (isDragging && dragStart && dragCurrent) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
      ctx.lineWidth = 2;

      const x1 = Math.min(dragStart.x, dragCurrent.x);
      const y1 = Math.min(dragStart.y, dragCurrent.y);
      const x2 = Math.max(dragStart.x, dragCurrent.x);
      const y2 = Math.max(dragStart.y, dragCurrent.y);

      if (shapeTool === 'RECT') {
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
            if (x === x1 || x === x2 || y === y1 || y === y2) {
              ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
              ctx.strokeRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }
          }
        }
      } else if (shapeTool === 'CIRC') {
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const radiusX = (x2 - x1) / 2;
        const radiusY = (y2 - y1) / 2;
        
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
            const dx = (x - centerX) / (radiusX || 1);
            const dy = (y - centerY) / (radiusY || 1);
            const dist = dx * dx + dy * dy;
            // Draw only the boundary of the circle
            if (dist <= 1.2 && dist >= 0.6) {
              ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
              ctx.strokeRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }
          }
        }
      } else if (shapeTool === 'TRI') {
        for (let y = y1; y <= y2; y++) {
          const rowProgress = (y - y1) / (y2 - y1 || 1);
          const width = (x2 - x1) * rowProgress;
          const startX = x1 + (x2 - x1 - width) / 2;
          const endX = startX + width;
          
          for (let x = x1; x <= x2; x++) {
            const isBase = y === y2;
            const isLeftEdge = x === Math.floor(startX);
            const isRightEdge = x === Math.ceil(endX);
            
            if ((isBase || isLeftEdge || isRightEdge) && x >= Math.floor(startX) && x <= Math.ceil(endX)) {
              ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
              ctx.strokeRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }
          }
        }
      }
    }
  }, [map, wallById, cargoById, bonusById, bonusTypes, selectedEngine, gridBackground, isDragging, dragStart, dragCurrent, shapeTool, showPath, systemAssets, pendingCarStart]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getGridPos = (e: React.MouseEvent | MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE);
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE);
    return { x, y };
  };

  const applyTool = (
    x: number,
    y: number,
    grid: CellType[][],
    configs: { [key: string]: CargoConfig },
    bonusConfigs: Record<string, BonusConfig>,
    wallConfigs: Record<string, string>,
  ) => {
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) return;

    if (selectedTool === 'PATH') {
      // Never use edge squares for path
      if (x <= 0 || x >= map.width - 1 || y <= 0 || y >= map.height - 1) return;
      setMap(prev => {
        const path = [...(prev.generatedPath || [])];
        if (path.length === 0) return { ...prev, generatedPath: [{ x, y }] };
        
        const last = path[path.length - 1];
        if (last.x === x && last.y === y) {
          // Only remove on click, not on drag move to same cell
          if (!isDragging || (dragStart?.x === x && dragStart?.y === y)) {
            return { ...prev, generatedPath: path.slice(0, -1) };
          }
          return prev;
        }

        const exists = path.some(p => p.x === x && p.y === y);
        if (exists) return prev;

        const dx = Math.abs(x - last.x);
        const dy = Math.abs(y - last.y);
        // Only allow orthogonal adjacency
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
          return { ...prev, generatedPath: [...path, { x, y }] };
        }
        return prev;
      });
      return;
    }

    if (selectedTool === 'EMPTY') {
      grid[y][x] = 'EMPTY';
      delete configs[`${x},${y}`];
      delete bonusConfigs[`${x},${y}`];
      delete wallConfigs[`${x},${y}`];
      return;
    }

    grid[y][x] = selectedTool as CellType;
    if (selectedTool === 'CARGO') {
      configs[`${x},${y}`] = {
        type: selectedCargoId === 'RANDOM' ? 'RANDOM' : 'SPECIFIC',
        cargoId: selectedCargoId === 'RANDOM' ? undefined : selectedCargoId,
      };
      delete bonusConfigs[`${x},${y}`];
      delete wallConfigs[`${x},${y}`];
    } else if (selectedTool === 'BONUS') {
      bonusConfigs[`${x},${y}`] = { bonusId: selectedBonusId };
      delete configs[`${x},${y}`];
      delete wallConfigs[`${x},${y}`];
    } else if (selectedTool === 'WALL') {
      wallConfigs[`${x},${y}`] = selectedWallId;
      delete configs[`${x},${y}`];
      delete bonusConfigs[`${x},${y}`];
    } else if (selectedTool === 'GATE') {
      for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
          if (grid[r][c] === 'GATE') grid[r][c] = 'EMPTY';
        }
      }
      grid[y][x] = 'GATE';
      delete configs[`${x},${y}`];
      delete bonusConfigs[`${x},${y}`];
      delete wallConfigs[`${x},${y}`];
    } else if (selectedTool === 'START') {
      for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
          if (grid[r][c] === 'START') grid[r][c] = 'EMPTY';
        }
      }
      grid[y][x] = 'START';
      setMap(prev => ({ ...prev, startPos: { x, y } }));
      delete configs[`${x},${y}`];
      delete bonusConfigs[`${x},${y}`];
      delete wallConfigs[`${x},${y}`];
    } else {
      delete configs[`${x},${y}`];
      delete bonusConfigs[`${x},${y}`];
      delete wallConfigs[`${x},${y}`];
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getGridPos(e);
    if (!pos) return;

    lastDragCellRef.current = pos;

    const now = Date.now();
    const isDoubleClick = now - lastClickTime.current < 300 && 
                         lastClickPos.current?.x === pos.x && 
                         lastClickPos.current?.y === pos.y;
    lastClickTime.current = now;
    lastClickPos.current = pos;

    // Two-click placement for car obstacles
    if (selectedTool === 'CAR') {
      if (!pendingCarStart) {
        setPendingCarStart(pos);
      } else {
        const sameAxis = pos.x === pendingCarStart.x || pos.y === pendingCarStart.y;
        const notSameCell = pos.x !== pendingCarStart.x || pos.y !== pendingCarStart.y;
        if (sameAxis && notSameCell) {
          const newCar: CarObstacleDef = { id: `car_${Date.now()}`, startPos: pendingCarStart, endPos: pos };
          setMap(prev => ({ ...prev, carObstacles: [...(prev.carObstacles ?? []), newCar] }));
        }
        setPendingCarStart(null);
      }
      return;
    }

    if (selectedTool === 'PATH' && map.generatedPath) {
      const turns = getTurns(map.generatedPath);
      const clickedTurn = turns.find(t => t.x === pos.x && t.y === pos.y);
      
      if (isDoubleClick) {
        if (clickedTurn) {
          // Remove node on double click
          const newPath = [...map.generatedPath];
          newPath.splice(clickedTurn.index, 1);
          setMap(prev => ({ ...prev, generatedPath: simplifyPath(newPath) }));
          setDraggedPathIndex(null);
          setIsDragging(false);
          return;
        } else {
          // Check if double clicking on a straight segment to add a node
          for (let i = 0; i < map.generatedPath.length - 1; i++) {
            const p1 = map.generatedPath[i];
            const p2 = map.generatedPath[i+1];
            const minX = Math.min(p1.x, p2.x);
            const maxX = Math.max(p1.x, p2.x);
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);
            
            if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
              // Ensure we are not on the edge
              if (pos.x <= 0 || pos.x >= map.width - 1 || pos.y <= 0 || pos.y >= map.height - 1) continue;
              
              const newPath = [...map.generatedPath];
              newPath.splice(i + 1, 0, pos);
              setMap(prev => ({ ...prev, generatedPath: simplifyPath(newPath) }));
              setDraggedPathIndex(i + 1);
              setIsDragging(true);
              setDragStart(pos);
              setDragCurrent(pos);
              return;
            }
          }
        }
      }

      if (clickedTurn) {
        setIsDragging(true);
        setDragStart(pos);
        setDragCurrent(pos);
        setDraggedPathIndex(clickedTurn.index);
        return;
      }

      // Allow dragging ANY point on the path to "bend" it
      // If it's not a node, we insert it first
      for (let i = 0; i < map.generatedPath.length - 1; i++) {
        const p1 = map.generatedPath[i];
        const p2 = map.generatedPath[i+1];
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);
        
        if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
          const newPath = [...map.generatedPath];
          newPath.splice(i + 1, 0, pos);
          const simplified = simplifyPath(newPath);
          const newIdx = simplified.findIndex(p => p.x === pos.x && p.y === pos.y);
          setMap(prev => ({ ...prev, generatedPath: simplified }));
          if (newIdx !== -1) {
            setDraggedPathIndex(newIdx);
            setIsDragging(true);
            setDragStart(pos);
            setDragCurrent(pos);
          }
          return;
        }
      }

      // Single click behavior for PATH tool (add/remove points)
      if (!isDoubleClick && shapeTool === 'POINT') {
        const newGrid = [...map.grid.map(row => [...row])];
        const newConfigs = { ...map.cargoConfigs };
        const newBonusConfigs = { ...(map.bonusConfigs ?? {}) };
        const newWallConfigs = { ...map.wallConfigs };
        applyTool(pos.x, pos.y, newGrid, newConfigs, newBonusConfigs, newWallConfigs);
      }

      setIsDragging(true);
      setDragStart(pos);
      setDragCurrent(pos);
      return;
    }

    setIsDragging(true);
    setDragStart(pos);
    setDragCurrent(pos);

    if (shapeTool === 'POINT') {
      const newGrid = [...map.grid.map(row => [...row])];
      const newConfigs = { ...map.cargoConfigs };
      const newBonusConfigs = { ...(map.bonusConfigs ?? {}) };
      const newWallConfigs = { ...map.wallConfigs };
      applyTool(pos.x, pos.y, newGrid, newConfigs, newBonusConfigs, newWallConfigs);
      if (selectedTool !== 'PATH') {
        setMap(prev => ({
          ...prev,
          grid: newGrid,
          cargoConfigs: newConfigs,
          bonusConfigs: newBonusConfigs,
          wallConfigs: newWallConfigs,
          ...(selectedTool === 'EMPTY' && {
            carObstacles: (prev.carObstacles ?? []).filter(
              (car) => !computeCarPath(car).some((p) => p.x === pos.x && p.y === pos.y),
            ),
          }),
        }));
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getGridPos(e);
    if (!pos) return;

    // Update hovered path point for cursor
    if (selectedTool === 'PATH' && map.generatedPath) {
      const index = map.generatedPath.findIndex(p => p.x === pos.x && p.y === pos.y);
      setHoveredTurnIndex(index !== -1 ? index : null);
    } else {
      setHoveredTurnIndex(null);
    }

    if (isDragging) {
      // Skip moves that stay in the same grid cell — nothing changes at cell
      // granularity, so this avoids a full re-render + redraw per pixel.
      if (
        lastDragCellRef.current &&
        lastDragCellRef.current.x === pos.x &&
        lastDragCellRef.current.y === pos.y
      ) {
        return;
      }
      lastDragCellRef.current = pos;

      setDragCurrent(pos);

      if (draggedPathIndex !== null && map.generatedPath) {
        // Ensure we don't drag to edge
        if (pos.x <= 0 || pos.x >= map.width - 1 || pos.y <= 0 || pos.y >= map.height - 1) return;
        
        const simplified = updatePathWithElbows(map.generatedPath, draggedPathIndex, pos);
        if (simplified) {
          const newIdx = simplified.findIndex(p => p.x === pos.x && p.y === pos.y);
          setMap(prevMap => ({ ...prevMap, generatedPath: simplified }));
          if (newIdx !== -1) setDraggedPathIndex(newIdx);
        }
        return;
      }

      if (shapeTool === 'POINT' && (selectedTool === 'WALL' || selectedTool === 'EMPTY' || selectedTool === 'CARGO' || selectedTool === 'BONUS' || selectedTool === 'PATH')) {
        const newGrid = [...map.grid.map(row => [...row])];
        const newConfigs = { ...map.cargoConfigs };
        const newBonusConfigs = { ...(map.bonusConfigs ?? {}) };
        const newWallConfigs = { ...map.wallConfigs };
        applyTool(pos.x, pos.y, newGrid, newConfigs, newBonusConfigs, newWallConfigs);
        if (selectedTool !== 'PATH') {
          setMap(prev => ({
            ...prev,
            grid: newGrid,
            cargoConfigs: newConfigs,
            bonusConfigs: newBonusConfigs,
            wallConfigs: newWallConfigs,
            ...(selectedTool === 'EMPTY' && {
              carObstacles: (prev.carObstacles ?? []).filter(
                (car) => !computeCarPath(car).some((p) => p.x === pos.x && p.y === pos.y),
              ),
            }),
          }));
        }
      }
    }
  };

  const handleMouseUp = useCallback(() => {
    lastDragCellRef.current = null;
    if (!isDragging || !dragStart || !dragCurrent) {
      setIsDragging(false);
      setDraggedPathIndex(null);
      return;
    }

    setDraggedPathIndex(null);

    if (shapeTool !== 'POINT') {
      const newGrid = [...map.grid.map(row => [...row])];
      const newConfigs = { ...map.cargoConfigs };
      const newBonusConfigs = { ...(map.bonusConfigs ?? {}) };
      const newWallConfigs = { ...map.wallConfigs };

      const x1 = Math.min(dragStart.x, dragCurrent.x);
      const y1 = Math.min(dragStart.y, dragCurrent.y);
      const x2 = Math.max(dragStart.x, dragCurrent.x);
      const y2 = Math.max(dragStart.y, dragCurrent.y);

      if (shapeTool === 'RECT') {
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
            if (x === x1 || x === x2 || y === y1 || y === y2) {
              applyTool(x, y, newGrid, newConfigs, newBonusConfigs, newWallConfigs);
            }
          }
        }
      } else if (shapeTool === 'CIRC') {
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;
        const radiusX = (x2 - x1) / 2;
        const radiusY = (y2 - y1) / 2;
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
            const dx = (x - centerX) / (radiusX || 1);
            const dy = (y - centerY) / (radiusY || 1);
            const dist = dx * dx + dy * dy;
            if (dist <= 1.2 && dist >= 0.6) {
              applyTool(x, y, newGrid, newConfigs, newBonusConfigs, newWallConfigs);
            }
          }
        }
      } else if (shapeTool === 'TRI') {
        for (let y = y1; y <= y2; y++) {
          const rowProgress = (y - y1) / (y2 - y1 || 1);
          const width = (x2 - x1) * rowProgress;
          const startX = x1 + (x2 - x1 - width) / 2;
          const endX = startX + width;
          for (let x = x1; x <= x2; x++) {
            const isBase = y === y2;
            const isLeftEdge = x === Math.floor(startX);
            const isRightEdge = x === Math.ceil(endX);
            if ((isBase || isLeftEdge || isRightEdge) && x >= Math.floor(startX) && x <= Math.ceil(endX)) {
              applyTool(x, y, newGrid, newConfigs, newBonusConfigs, newWallConfigs);
            }
          }
        }
      }

      setMap(prev => ({ ...prev, grid: newGrid, cargoConfigs: newConfigs, bonusConfigs: newBonusConfigs, wallConfigs: newWallConfigs }));
    }

    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  }, [isDragging, dragStart, dragCurrent, shapeTool, selectedTool, selectedCargoId, map, applyTool]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  return (
    <div className="flex h-full bg-[#fdfaf6] text-blue-950">
      {/* Sidebar */}
      <div className="w-80 border-r border-blue-950/20 p-6 flex flex-col gap-6 bg-white">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={onExit} className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-950">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">{t('editor.title')}</h2>
        </div>

        <section>
          <label className="text-xs font-mono text-blue-900/40 uppercase tracking-widest mb-2 block">{t('editor.level_name')}</label>
          <input 
            type="text" 
            value={map.name}
            onChange={e => setMap(prev => ({ ...prev, name: e.target.value }))}
            className="w-full bg-white border border-blue-950/20 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-950"
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-mono text-blue-900/40 uppercase tracking-widest">{t('editor.generate')}</label>
            <div className="flex gap-1">
              <button 
                onClick={() => setGenStep('PATH')}
                className={`p-1.5 rounded transition-colors ${genStep === 'PATH' ? 'bg-blue-950 text-white' : 'hover:bg-blue-50 text-blue-900/60'}`}
                title={t('editor.path_design')}
              >
                <Route size={14} />
              </button>
              <button 
                onClick={() => setGenStep('FILL')}
                className={`p-1.5 rounded transition-colors ${genStep === 'FILL' ? 'bg-blue-950 text-white' : 'hover:bg-blue-50 text-blue-900/60'}`}
                title={t('editor.fill_map')}
              >
                <Layout size={14} />
              </button>
              <div className="w-px h-4 bg-blue-950/10 mx-1 self-center" />
              <button 
                onClick={() => setShowPath(!showPath)}
                className="p-1 hover:bg-blue-50 rounded text-blue-900/60"
                title={showPath ? t('editor.hide_path') : t('editor.show_path')}
              >
                {showPath ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          
          <div className="space-y-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
            {genStep === 'PATH' ? (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-blue-900/60 uppercase">
                    <span>{t('editor.path_complexity')}</span>
                    <span>{Math.round(genSettings.pathComplexity * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.1"
                    value={genSettings.pathComplexity}
                    onChange={e => setGenSettings(prev => ({ ...prev, pathComplexity: parseFloat(e.target.value) }))}
                    className="w-full accent-blue-950"
                  />
                </div>
                <button 
                  onClick={generatePath}
                  className="w-full py-2 bg-blue-950 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-900 transition-colors"
                >
                  <Wand2 size={14} />
                  {t('editor.generate_path')}
                </button>
                {map.generatedPath && map.generatedPath.length > 0 && (
                  <button 
                    onClick={() => setMap(prev => ({ ...prev, generatedPath: [], pathAnchors: [] }))}
                    className="w-full py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                    {t('editor.clear_path')}
                  </button>
                )}
                <p className="text-[10px] text-blue-900/40 italic">
                  {t('editor.path_tip')}
                </p>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-blue-900/60 uppercase">
                    <span>{t('editor.maneuver_space')}</span>
                    <span>{Math.round(genSettings.maneuverSpace * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.1"
                    value={genSettings.maneuverSpace}
                    onChange={e => setGenSettings(prev => ({ ...prev, maneuverSpace: parseFloat(e.target.value) }))}
                    className="w-full accent-blue-950"
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-blue-900/60 uppercase">
                    <span>{t('editor.cargo_density')}</span>
                    <span>{Math.round(genSettings.cargoDensity * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="0.5" step="0.05"
                    value={genSettings.cargoDensity}
                    onChange={e => setGenSettings(prev => ({ ...prev, cargoDensity: parseFloat(e.target.value) }))}
                    className="w-full accent-blue-950"
                  />
                </div>

                <button 
                  onClick={fillMap}
                  disabled={!map.generatedPath || map.generatedPath.length < 2}
                  className="w-full py-2 bg-blue-950 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-900 transition-colors disabled:opacity-50"
                >
                  <Layout size={14} />
                  {t('editor.fill_with_walls')}
                </button>
              </>
            )}
          </div>
        </section>

        <section>
          <label className="text-xs font-mono text-blue-900/40 uppercase tracking-widest mb-2 block">{t('editor.drawing_mode')}</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'POINT', icon: <MousePointer2 size={16} />, title: t('editor.freehand') },
              { id: 'RECT', icon: <Box size={16} />, title: t('editor.rectangle') },
              { id: 'TRI', icon: <Triangle size={16} />, title: t('editor.triangle') },
              { id: 'CIRC', icon: <Circle size={16} />, title: t('editor.circle') },
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => setShapeTool(tool.id as ShapeTool)}
                title={tool.title}
                className={`flex items-center justify-center p-2 rounded-lg border transition-all ${
                  shapeTool === tool.id 
                    ? 'bg-blue-950 text-white border-blue-950' 
                    : 'bg-white text-blue-950 border-blue-950/20 hover:border-blue-950'
                }`}
              >
                {tool.icon}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="text-xs font-mono text-blue-900/40 uppercase tracking-widest mb-2 block">{t('editor.tools')}</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'WALL', icon: <BrickWall size={18} />, label: t('editor.wall') },
              { id: 'EMPTY', icon: <Eraser size={18} />, label: t('editor.eraser') },
              { id: 'GATE', icon: <LogOut size={18} />, label: t('editor.gate') },
              { id: 'CARGO', icon: <Package size={18} />, label: t('editor.cargo') },
              { id: 'BONUS', icon: <Sparkles size={18} />, label: t('editor.bonus') },
              { id: 'START', icon: <Play size={18} />, label: t('editor.start') },
              { id: 'PATH', icon: <Route size={18} />, label: t('editor.path') },
              { id: 'CAR', icon: <Car size={18} />, label: 'Car' },
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id as EditorTool)}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                  selectedTool === tool.id 
                    ? 'bg-blue-950 text-white border-blue-950' 
                    : 'bg-white text-blue-950 border-blue-950/20 hover:border-blue-950'
                }`}
              >
                {tool.icon}
                <span className="text-sm font-medium">{tool.label}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedTool === 'WALL' && (
          <section className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-blue-900/40 uppercase tracking-widest block">{t('editor.wall_style')}</label>
              <button 
                onClick={surroundWithWalls}
                className="text-[10px] font-bold text-blue-950 hover:underline flex items-center gap-1"
                title={t('editor.surround_title')}
              >
                <BrickWall size={12} />
                {t('editor.surround')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
              {walls.map(w => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWallId(w.id)}
                  className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 ${
                    selectedWallId === w.id ? 'bg-blue-950 text-white border-blue-950' : 'bg-white border-blue-950/20'
                  }`}
                >
                  <div className="w-6 h-6 flex items-center justify-center overflow-hidden rounded">
                    {w.image ? (
                      <img src={w.image} alt={w.name} className="w-full h-full object-contain" />
                    ) : (
                      <span>{w.emoji}</span>
                    )}
                  </div>
                  <span>{w.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {selectedTool === 'BONUS' && (
          <section className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-xs font-mono text-blue-900/40 uppercase tracking-widest mb-2 block">{t('editor.bonus_type')}</label>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
              {bonusTypes.map((bonus) => (
                <button
                  key={bonus.id}
                  onClick={() => setSelectedBonusId(bonus.id)}
                  className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 ${
                    selectedBonusId === bonus.id ? 'bg-blue-950 text-white border-blue-950' : 'bg-white border-blue-950/20'
                  }`}
                >
                  <div className="w-6 h-6 flex items-center justify-center overflow-hidden rounded">
                    {bonus.image ? (
                      <img src={bonus.image} alt={bonus.name} className="w-full h-full object-contain" />
                    ) : (
                      <span>{bonus.emoji}</span>
                    )}
                  </div>
                  <span>{bonus.name}</span>
                  <span className="ml-auto text-xs opacity-70">+{bonus.pointValue ?? 50}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {selectedTool === 'CARGO' && (
          <section className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-xs font-mono text-blue-900/40 uppercase tracking-widest mb-2 block">{t('editor.cargo_type')}</label>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
              <button
                onClick={() => setSelectedCargoId('RANDOM')}
                className={`p-2 rounded-lg border text-left text-sm ${
                  selectedCargoId === 'RANDOM' ? 'bg-blue-950 text-white border-blue-950' : 'bg-white border-blue-950/20'
                }`}
              >
                🎲 {t('editor.random_cargo')}
              </button>
              {cargoTypes.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCargoId(c.id)}
                  className={`p-2 rounded-lg border text-left text-sm flex items-center gap-2 ${
                    selectedCargoId === c.id ? 'bg-blue-950 text-white border-blue-950' : 'bg-white border-blue-950/20'
                  }`}
                >
                  <div className="w-6 h-6 flex items-center justify-center overflow-hidden rounded">
                    {c.cargoImage ? (
                      <img src={c.cargoImage} alt={c.name} className="w-full h-full object-contain" />
                    ) : (
                      <span>{c.cargoEmoji}</span>
                    )}
                  </div>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <button 
            onClick={() => onSave(map)}
            className="w-full sketch-button bg-blue-950 text-white py-3 font-bold flex items-center justify-center gap-2"
          >
            <Save size={18} />
            {t('editor.save_map')}
          </button>
          
          {showClearConfirm ? (
            <div className="flex gap-2 animate-in fade-in zoom-in duration-200">
              <button 
                onClick={() => {
                  setMap(prev => ({
                    ...prev,
                    grid: Array(prev.height).fill(null).map(() => Array(prev.width).fill('EMPTY')),
                    cargoConfigs: {},
                    bonusConfigs: {},
                    wallConfigs: {},
                    carObstacles: [],
                    generatedPath: [],
                    pathAnchors: []
                  }));
                  setShowClearConfirm(false);
                }}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold text-xs"
              >
                {t('settings.save')}
              </button>
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-blue-50 text-blue-950 py-3 rounded-lg font-bold text-xs"
              >
                {t('settings.cancel')}
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowClearConfirm(true)}
              className="w-full sketch-button bg-white text-red-600 border-red-600 py-3 font-bold flex items-center justify-center gap-2"
            >
              <Trash2 size={18} />
              {t('editor.clear_all')}
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 p-8 flex items-center justify-center overflow-auto bg-[#f9f7f2]">
        <div className="relative sketch-border overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={map.width * GRID_SIZE}
            height={map.height * GRID_SIZE}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredTurnIndex(null)}
            className={`block ${hoveredTurnIndex !== null ? 'cursor-move' : 'cursor-crosshair'}`}
          />
        </div>
      </div>
    </div>
  );
};
