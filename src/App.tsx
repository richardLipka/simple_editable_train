import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMap, CargoType, BonusType, EngineType, WallType, AppConfig, SystemAssets } from './types';
import { INITIAL_MAP, DEFAULT_CARGO_TYPES, DEFAULT_BONUS_TYPES, DEFAULT_ENGINES, DEFAULT_WALLS, DEFAULT_SYSTEM_ASSETS } from './constants';
import { mergeBonusTypes, mergeCargoTypes, normalizeAppConfig, normalizeMap } from './utils/configDefaults';
import { clearImageCache } from './utils/imagePreload';
import { Play } from './components/Play';
import { Editor } from './components/Editor';
import { SettingsManager } from './components/SettingsManager';
import { TrainFront, Map as MapIcon, Plus, Trash2, Play as PlayIcon, ChevronUp, ChevronDown, PackagePlus, Settings, Baby } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'MENU' | 'PLAY' | 'EDITOR' | 'CARGO_CONFIG' | 'SETTINGS'>('MENU');
  const [maps, setMaps] = useState<GameMap[]>([INITIAL_MAP]);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [editingMapIndex, setEditingMapIndex] = useState<number | null>(null);
  const [cargoTypes, setCargoTypes] = useState<CargoType[]>(DEFAULT_CARGO_TYPES);
  const [bonusTypes, setBonusTypes] = useState<BonusType[]>(DEFAULT_BONUS_TYPES);
  const [engines, setEngines] = useState<EngineType[]>(DEFAULT_ENGINES);
  const [walls, setWalls] = useState<WallType[]>(DEFAULT_WALLS);
  const [systemAssets, setSystemAssets] = useState<SystemAssets>(DEFAULT_SYSTEM_ASSETS);
  const [kidsMode, setKidsMode] = useState(false);

  // Load persisted config after first paint to avoid startup jank
  useEffect(() => {
    const loadSaved = () => {
      const savedKidsMode = localStorage.getItem('train_logic_kids_mode');
      if (savedKidsMode !== null) {
        setKidsMode(savedKidsMode === 'true');
      }
      const savedMaps = localStorage.getItem('train_logic_maps');
      if (savedMaps) {
        setMaps(JSON.parse(savedMaps).map(normalizeMap));
      } else {
        setMaps([INITIAL_MAP]);
      }

      const savedCargo = localStorage.getItem('train_logic_cargo');
      if (savedCargo) {
        setCargoTypes(mergeCargoTypes(JSON.parse(savedCargo)));
      }

      const savedBonus = localStorage.getItem('train_logic_bonus');
      if (savedBonus) {
        setBonusTypes(mergeBonusTypes(JSON.parse(savedBonus)));
      }

      const savedEngines = localStorage.getItem('train_logic_engines');
      if (savedEngines) {
        setEngines(JSON.parse(savedEngines));
      }

      const savedWalls = localStorage.getItem('train_logic_walls');
      if (savedWalls) {
        setWalls(JSON.parse(savedWalls));
      }

      const savedSystem = localStorage.getItem('train_logic_system');
      if (savedSystem) {
        setSystemAssets(JSON.parse(savedSystem));
      }
    };

    const id = window.setTimeout(loadSaved, 0);
    return () => window.clearTimeout(id);
  }, []);

  const saveMaps = (newMaps: GameMap[]) => {
    setMaps(newMaps);
    localStorage.setItem('train_logic_maps', JSON.stringify(newMaps));
  };

  const saveCargo = (newCargo: CargoType[]) => {
    const merged = mergeCargoTypes(newCargo);
    setCargoTypes(merged);
    localStorage.setItem('train_logic_cargo', JSON.stringify(merged));
  };

  const saveBonus = (newBonus: BonusType[]) => {
    const merged = mergeBonusTypes(newBonus);
    setBonusTypes(merged);
    localStorage.setItem('train_logic_bonus', JSON.stringify(merged));
  };

  const saveEngines = (newEngines: EngineType[]) => {
    setEngines(newEngines);
    localStorage.setItem('train_logic_engines', JSON.stringify(newEngines));
  };

  const saveWalls = (newWalls: WallType[]) => {
    setWalls(newWalls);
    localStorage.setItem('train_logic_walls', JSON.stringify(newWalls));
  };

  const saveSystemAssets = (newSystem: SystemAssets) => {
    setSystemAssets(newSystem);
    localStorage.setItem('train_logic_system', JSON.stringify(newSystem));
  };

  const toggleKidsMode = () => {
    setKidsMode((prev) => {
      const next = !prev;
      localStorage.setItem('train_logic_kids_mode', String(next));
      return next;
    });
  };

  const handleExportConfig = () => {
    const config: AppConfig = {
      version: '1.0',
      maps,
      engines,
      walls,
      cargoTypes,
      bonusTypes,
      systemAssets,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `train-logic-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (config: AppConfig) => {
    if (!config || typeof config !== 'object') return;

    clearImageCache();
    const normalized = normalizeAppConfig(config);
    saveMaps(normalized.maps);
    saveEngines(normalized.engines);
    saveWalls(normalized.walls);
    saveCargo(normalized.cargoTypes);
    saveBonus(normalized.bonusTypes ?? DEFAULT_BONUS_TYPES);
    saveSystemAssets(normalized.systemAssets);

    alert(t('settings.import_success') || 'Configuration imported successfully!');
  };

  const handleCreateMap = () => {
    const newMap: GameMap = {
      ...INITIAL_MAP,
      id: `level-${Date.now()}`,
      name: `${t('editor.new_level_prefix')} ${maps.length + 1}`,
      grid: Array(15).fill(null).map(() => Array(20).fill('EMPTY')),
      cargoConfigs: {},
      bonusConfigs: {},
      wallConfigs: {},
    };
    saveMaps([...maps, newMap]);
    setEditingMapIndex(maps.length);
    setMode('EDITOR');
  };

  const handleDeleteMap = (index: number) => {
    if (maps.length <= 1) return;
    const newMaps = maps.filter((_, i) => i !== index);
    saveMaps(newMaps);
  };

  const moveMap = (index: number, direction: 'UP' | 'DOWN') => {
    const newMaps = [...maps];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= maps.length) return;
    [newMaps[index], newMaps[targetIndex]] = [newMaps[targetIndex], newMaps[index]];
    saveMaps(newMaps);
  };

  if (mode === 'PLAY') {
    return (
      <Play 
        key={maps[currentMapIndex].id}
        map={maps[currentMapIndex]} 
        cargoTypes={cargoTypes}
        bonusTypes={bonusTypes}
        engines={engines}
        walls={walls}
        systemAssets={systemAssets}
        kidsMode={kidsMode}
        levelIndex={currentMapIndex}
        onExit={() => setMode('MENU')}
        onNextLevel={() => {
          if (currentMapIndex < maps.length - 1) {
            setCurrentMapIndex(currentMapIndex + 1);
          } else {
            setMode('MENU');
          }
        }}
        hasMoreLevels={currentMapIndex < maps.length - 1}
      />
    );
  }

  if (mode === 'EDITOR' && editingMapIndex !== null) {
    return (
      <Editor 
        map={maps[editingMapIndex]}
        cargoTypes={cargoTypes}
        bonusTypes={bonusTypes}
        engines={engines}
        walls={walls}
        systemAssets={systemAssets}
        onSave={(updatedMap) => {
          const newMaps = [...maps];
          newMaps[editingMapIndex] = updatedMap;
          saveMaps(newMaps);
          setMode('MENU');
        }}
        onExit={() => setMode('MENU')}
      />
    );
  }

  if (mode === 'SETTINGS' || mode === 'CARGO_CONFIG') {
    return (
      <div className="min-h-screen bg-[#fdfaf6] text-blue-950 flex flex-col items-center p-8">
        <SettingsManager 
          engines={engines}
          walls={walls}
          cargoTypes={cargoTypes}
          bonusTypes={bonusTypes}
          systemAssets={systemAssets}
          onSaveEngines={saveEngines}
          onSaveWalls={saveWalls}
          onSaveCargo={saveCargo}
          onSaveBonus={saveBonus}
          onSaveSystemAssets={saveSystemAssets}
          onExit={() => setMode('MENU')}
          initialTab={mode === 'CARGO_CONFIG' ? 'CARGO' : 'ENGINES'}
          selectedEngineId={maps[currentMapIndex]?.selectedEngineId}
          onSelectEngine={(id) => {
            const newMaps = [...maps];
            newMaps[currentMapIndex] = { ...newMaps[currentMapIndex], selectedEngineId: id };
            saveMaps(newMaps);
          }}
          onExportConfig={handleExportConfig}
          onImportConfig={handleImportConfig}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] text-blue-950 flex flex-col items-center p-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-950 text-white sketch-border">
              <TrainFront size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter">{t('app.title')}</h1>
              <p className="text-blue-800/60 font-mono text-xs uppercase tracking-widest">{t('app.subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setMode('SETTINGS')}
              className="sketch-button flex items-center gap-2 text-sm bg-white"
            >
              <Settings size={18} />
              {t('app.settings')}
            </button>
            <button 
              onClick={() => setMode('CARGO_CONFIG')}
              className="sketch-button flex items-center gap-2 text-sm bg-white"
            >
              <PackagePlus size={18} />
              {t('app.cargo_types')}
            </button>
            <button 
              onClick={handleCreateMap}
              className="sketch-button flex items-center gap-2 text-sm bg-blue-950 text-white"
            >
              <Plus size={18} />
              {t('app.new_map')}
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {mode === 'MENU' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              <section className="sketch-card">
                <h3 className="text-sm font-mono text-blue-900/60 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <MapIcon size={14} />
                  {t('app.level_sequence')}
                </h3>
                <div className="flex flex-col gap-4">
                  {maps.map((map, index) => (
                    <div 
                      key={map.id}
                      className="group flex items-center justify-between p-4 bg-white border-2 border-blue-950/20 rounded-xl hover:border-blue-950 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-blue-900/20">{index + 1}</span>
                        <div>
                          <h4 className="font-bold text-lg">{map.name}</h4>
                          <p className="text-xs text-blue-800/60 font-mono">{map.width}x{map.height} {t('app.grid')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex flex-col mr-2">
                          <button onClick={() => moveMap(index, 'UP')} className="p-1 hover:text-blue-950 text-blue-900/40"><ChevronUp size={16} /></button>
                          <button onClick={() => moveMap(index, 'DOWN')} className="p-1 hover:text-blue-950 text-blue-900/40"><ChevronDown size={16} /></button>
                        </div>
                        <button 
                          onClick={() => { setCurrentMapIndex(index); setMode('PLAY'); }}
                          className="p-2 bg-blue-950 text-white rounded-lg hover:scale-110 transition-transform"
                        >
                          <PlayIcon size={18} fill="currentColor" />
                        </button>
                        <button 
                          onClick={() => { setEditingMapIndex(index); setMode('EDITOR'); }}
                          className="p-2 bg-white border border-blue-950 text-blue-950 rounded-lg hover:bg-blue-50"
                        >
                          <MapIcon size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteMap(index)}
                          className="p-2 bg-red-50 text-white rounded-lg hover:bg-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-6">
                <div className="sketch-card bg-white">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg border-2 transition-colors ${kidsMode ? 'bg-yellow-100 border-yellow-500 text-yellow-700' : 'bg-blue-50 border-blue-950/20 text-blue-900/50'}`}>
                        <Baby size={22} />
                      </div>
                      <div>
                        <span className="font-bold text-lg block">{t('app.kids_mode')}</span>
                        <span className="text-sm text-blue-900/60">{t('app.kids_mode_desc')}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={kidsMode}
                      onClick={toggleKidsMode}
                      className={`relative w-14 h-8 rounded-full border-2 transition-colors shrink-0 ${kidsMode ? 'bg-yellow-400 border-yellow-600' : 'bg-blue-100 border-blue-950/20'}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white border-2 border-blue-950/20 transition-transform ${kidsMode ? 'translate-x-6' : ''}`}
                      />
                    </button>
                  </label>
                </div>

                <div className="sketch-card flex flex-col items-center text-center bg-blue-50/30">
                  <div className="w-20 h-20 bg-blue-950 text-white sketch-border flex items-center justify-center mb-6">
                    <PlayIcon size={32} fill="currentColor" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{t('app.start_campaign')}</h3>
                  <p className="text-blue-900/60 text-sm mb-8 leading-relaxed">
                    {t('app.campaign_desc')}
                  </p>
                  <button 
                    onClick={() => { setCurrentMapIndex(0); setMode('PLAY'); }}
                    className="sketch-button w-full py-4 bg-blue-950 text-white font-bold"
                  >
                    {t('app.play_now')}
                  </button>
                </div>

                <div className="sketch-card bg-white">
                  <h4 className="text-xs font-mono text-blue-900/60 uppercase tracking-widest mb-4">{t('app.instructions')}</h4>
                  <ul className="text-sm text-blue-900/80 space-y-3">
                    <li className="flex gap-3"><span className="text-blue-950 font-bold">1.</span> {t('app.instr_1')}</li>
                    <li className="flex gap-3"><span className="text-blue-950 font-bold">2.</span> {t('app.instr_2')}</li>
                    <li className="flex gap-3"><span className="text-blue-950 font-bold">3.</span> {t('app.instr_3')}</li>
                    <li className="flex gap-3"><span className="text-blue-950 font-bold">4.</span> {t('app.instr_4')}</li>
                  </ul>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
