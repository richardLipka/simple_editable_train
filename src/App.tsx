import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMap, CargoType, BonusType, EngineType, WallType, AppConfig, SystemAssets } from './types';
import { INITIAL_MAP, DEFAULT_CARGO_TYPES, DEFAULT_BONUS_TYPES, DEFAULT_ENGINES, DEFAULT_WALLS, DEFAULT_SYSTEM_ASSETS } from './constants';
import { mergeBonusTypes, mergeCargoTypes, sanitizeAppConfig, sanitizeEngines, sanitizeWalls, sanitizeMaps, sanitizeSystemAssets } from './utils/configDefaults';
import { clearImageCache } from './utils/imagePreload';
import { normalizeAssetImage } from './utils/imageEncoding';
import { Play } from './components/Play';
import { Editor } from './components/Editor';
import { SettingsManager } from './components/SettingsManager';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { TrainFront, Map as MapIcon, Plus, Trash2, Play as PlayIcon, ChevronUp, ChevronDown, PackagePlus, Settings, Baby, Info, X, ExternalLink, Github, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import favLogo from './assets/fav_logo.png';

// Re-encode every embedded asset image down to the compact ASSET_SIZE/WebP
// format used by new assets. Legacy configs and the bundled sample can carry
// multi-hundred-KB PNGs that overflow localStorage; this shrinks them on
// import. Images live only in the top-level asset arrays — maps reference
// assets by id — so this is a flat pass. A failure on any single image keeps
// the original rather than dropping it.
async function compressConfigImages(config: AppConfig): Promise<AppConfig> {
  const safe = async (src?: string): Promise<string | undefined> => {
    if (!src || !src.startsWith('data:')) return src;
    try {
      return await normalizeAssetImage(src, { fit: 'contain' });
    } catch {
      return src;
    }
  };
  const s = config.systemAssets;
  const [engines, walls, cargoTypes, bonusTypes, systemImages] = await Promise.all([
    Promise.all(config.engines.map(async (e) => ({ ...e, image: await safe(e.image) }))),
    Promise.all(config.walls.map(async (w) => ({ ...w, image: await safe(w.image) }))),
    Promise.all(config.cargoTypes.map(async (c) => ({
      ...c,
      cargoImage: await safe(c.cargoImage),
      carriageImage: await safe(c.carriageImage),
    }))),
    Promise.all((config.bonusTypes ?? []).map(async (b) => ({ ...b, image: await safe(b.image) }))),
    Promise.all([
      safe(s.startImage), safe(s.gateOpenImage), safe(s.gateClosedImage), safe(s.randomCargoImage),
      safe(s.carObstacleImage), safe(s.roadMidImage), safe(s.roadEdgeImage),
    ]),
  ]);
  const [startImage, gateOpenImage, gateClosedImage, randomCargoImage, carObstacleImage, roadMidImage, roadEdgeImage] = systemImages;
  return {
    ...config,
    engines,
    walls,
    cargoTypes,
    bonusTypes,
    systemAssets: { ...s, startImage, gateOpenImage, gateClosedImage, randomCargoImage, carObstacleImage, roadMidImage, roadEdgeImage },
  };
}

export default function App() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'MENU' | 'PLAY' | 'EDITOR' | 'CARGO_CONFIG' | 'SETTINGS'>('MENU');
  const [maps, setMaps] = useState<GameMap[]>([INITIAL_MAP]);
  const [currentMapIndex, setCurrentMapIndex] = useState(0);
  const [editingMapIndex, setEditingMapIndex] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [mapSearch, setMapSearch] = useState('');
  const [cargoTypes, setCargoTypes] = useState<CargoType[]>(DEFAULT_CARGO_TYPES);
  const [bonusTypes, setBonusTypes] = useState<BonusType[]>(DEFAULT_BONUS_TYPES);
  const [engines, setEngines] = useState<EngineType[]>(DEFAULT_ENGINES);
  const [walls, setWalls] = useState<WallType[]>(DEFAULT_WALLS);
  const [systemAssets, setSystemAssets] = useState<SystemAssets>(DEFAULT_SYSTEM_ASSETS);
  const [kidsMode, setKidsMode] = useState(false);

  // Load persisted config after first paint to avoid startup jank.
  useEffect(() => {
    // Parse one localStorage key in isolation: a corrupt or missing value
    // returns undefined and is logged, so it never blocks the other keys.
    const loadJSON = (key: string): unknown => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : undefined;
      } catch (err) {
        console.warn(`Ignoring corrupt localStorage entry "${key}"`, err);
        return undefined;
      }
    };

    const loadSaved = () => {
      const savedKidsMode = localStorage.getItem('train_logic_kids_mode');
      if (savedKidsMode !== null) {
        setKidsMode(savedKidsMode === 'true');
      }

      const savedMaps = loadJSON('train_logic_maps');
      if (savedMaps !== undefined) {
        const maps = sanitizeMaps(savedMaps);
        setMaps(maps.length ? maps : [INITIAL_MAP]);
      } else {
        setMaps([INITIAL_MAP]);
      }

      const savedCargo = loadJSON('train_logic_cargo');
      if (savedCargo !== undefined) setCargoTypes(mergeCargoTypes(savedCargo));

      const savedBonus = loadJSON('train_logic_bonus');
      if (savedBonus !== undefined) setBonusTypes(mergeBonusTypes(savedBonus));

      const savedEngines = loadJSON('train_logic_engines');
      if (savedEngines !== undefined) setEngines(sanitizeEngines(savedEngines));

      const savedWalls = loadJSON('train_logic_walls');
      if (savedWalls !== undefined) setWalls(sanitizeWalls(savedWalls));

      const savedSystem = loadJSON('train_logic_system');
      if (savedSystem !== undefined) setSystemAssets(sanitizeSystemAssets(savedSystem));
    };

    const id = window.setTimeout(loadSaved, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Persist a value without ever throwing into a React handler. Large base64
  // images can push localStorage past its quota (QuotaExceededError); we log
  // and warn the user rather than crashing the app mid-edit.
  const persist = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`Failed to persist "${key}" to localStorage`, err);
      alert(t('settings.save_error'));
    }
  };

  const saveMaps = (newMaps: GameMap[]) => {
    setMaps(newMaps);
    persist('train_logic_maps', newMaps);
  };

  const saveCargo = (newCargo: CargoType[]) => {
    const merged = mergeCargoTypes(newCargo);
    setCargoTypes(merged);
    persist('train_logic_cargo', merged);
  };

  const saveBonus = (newBonus: BonusType[]) => {
    const merged = mergeBonusTypes(newBonus);
    setBonusTypes(merged);
    persist('train_logic_bonus', merged);
  };

  const saveEngines = (newEngines: EngineType[]) => {
    setEngines(newEngines);
    persist('train_logic_engines', newEngines);
  };

  const saveWalls = (newWalls: WallType[]) => {
    setWalls(newWalls);
    persist('train_logic_walls', newWalls);
  };

  const saveSystemAssets = (newSystem: SystemAssets) => {
    setSystemAssets(newSystem);
    persist('train_logic_system', newSystem);
  };

  const saveKidsMode = (next: boolean) => {
    setKidsMode(next);
    try {
      localStorage.setItem('train_logic_kids_mode', String(next));
    } catch (err) {
      console.error('Failed to persist kids mode', err);
    }
  };

  const toggleKidsMode = () => {
    saveKidsMode(!kidsMode);
  };

  const handleExportConfig = () => {
    const config: AppConfig = {
      version: __APP_VERSION__,
      maps,
      engines,
      walls,
      cargoTypes,
      bonusTypes,
      systemAssets,
      kidsMode,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `train-logic-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = async (raw: unknown) => {
    clearImageCache();
    const { config: sanitized, summary } = sanitizeAppConfig(raw);
    // Shrink any oversized legacy images before they hit localStorage.
    const config = await compressConfigImages(sanitized);

    saveMaps(config.maps.length ? config.maps : [INITIAL_MAP]);
    saveEngines(config.engines);
    saveWalls(config.walls);
    saveCargo(config.cargoTypes);
    saveBonus(config.bonusTypes ?? DEFAULT_BONUS_TYPES);
    saveSystemAssets(config.systemAssets);
    if (typeof config.kidsMode === 'boolean') saveKidsMode(config.kidsMode);

    // Build a human-readable summary of anything that had to be dropped, so the
    // user knows the import was partial rather than silently lossy.
    const issues: string[] = [];
    if (summary.rootInvalid) issues.push(t('settings.import_root_invalid'));
    if (!config.maps.length) issues.push(t('settings.import_no_maps'));
    for (const section of summary.malformedSections) {
      issues.push(t('settings.import_section_malformed', { section }));
    }
    const skippedEntries = Object.entries(summary.skipped).filter(([, n]) => n > 0);
    for (const [section, count] of skippedEntries) {
      issues.push(t('settings.import_skipped', { count, section }));
    }

    if (issues.length) {
      alert(`${t('settings.import_partial')}\n\n- ${issues.join('\n- ')}`);
    } else {
      alert(t('settings.import_success'));
    }
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
      <>
      <LanguageSwitcher />
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
      </>
    );
  }

  if (mode === 'EDITOR' && editingMapIndex !== null) {
    return (
      <>
      <LanguageSwitcher />
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
      </>
    );
  }

  if (mode === 'SETTINGS' || mode === 'CARGO_CONFIG') {
    return (
      <div className="min-h-screen bg-[#fdfaf6] text-blue-950 flex flex-col items-center p-8">
        <LanguageSwitcher />
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

  // Filter maps by name while keeping each map's original index so play/edit/
  // delete/reorder still target the correct entry in the full `maps` array.
  const mapQuery = mapSearch.trim().toLowerCase();
  const visibleMaps = maps
    .map((map, index) => ({ map, index }))
    .filter(({ map }) => map.name.toLowerCase().includes(mapQuery));

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-[#fdfaf6] text-blue-950 flex flex-col items-center p-8">
      <LanguageSwitcher />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl flex flex-col md:flex-1 md:min-h-0"
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
              onClick={() => setShowInfo(true)}
              className="sketch-button flex items-center justify-center bg-white"
              title={t('app.info')}
              aria-label={t('app.info')}
            >
              <Info size={18} />
            </button>
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

        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowInfo(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg sketch-card bg-white border-blue-950 p-8 relative"
              >
                <button
                  onClick={() => setShowInfo(false)}
                  className="absolute top-4 right-4 text-blue-900/40 hover:text-blue-950 transition-colors"
                  aria-label={t('app.info_close')}
                >
                  <X size={20} />
                </button>
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-blue-950 text-white sketch-border">
                    <TrainFront size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter">{t('app.title')}</h2>
                    <p className="text-blue-800/60 font-mono text-xs uppercase tracking-widest">{t('app.subtitle')}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-5 text-sm">
                  <a
                    href="https://home.zcu.cz/~lipka/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-bold text-blue-950 hover:text-blue-700 underline underline-offset-2"
                  >
                    {t('app.info_made_by')}
                    <ExternalLink size={14} />
                  </a>
                  <a
                    href="https://github.com/richardLipka/simple_editable_train"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-950 font-mono underline underline-offset-2"
                  >
                    <Github size={16} />
                    {t('app.info_source')}
                  </a>
                  <a
                    href="https://kiv.zcu.cz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full hover:opacity-80 transition-opacity"
                    aria-label="kiv.zcu.cz"
                  >
                    <img src={favLogo} alt="Fakulta aplikovaných věd ZČU" className="w-full h-auto" />
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {mode === 'MENU' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 md:flex-1 md:min-h-0 md:[grid-template-rows:minmax(0,1fr)]"
            >
              <section className="sketch-card flex flex-col md:min-h-0">
                <h3 className="text-sm font-mono text-blue-900/60 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <MapIcon size={14} />
                  {t('app.level_sequence')}
                </h3>
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-900/40 pointer-events-none" />
                  <input
                    type="text"
                    value={mapSearch}
                    onChange={(e) => setMapSearch(e.target.value)}
                    placeholder={t('app.search_maps')}
                    aria-label={t('app.search_maps')}
                    className="w-full bg-white border-2 border-blue-950/20 rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-blue-950 transition-colors"
                  />
                  {mapSearch && (
                    <button
                      onClick={() => setMapSearch('')}
                      aria-label={t('app.clear_search')}
                      title={t('app.clear_search')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-900/40 hover:text-blue-950"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {visibleMaps.length === 0 ? (
                  <p className="text-sm text-blue-900/50 italic py-8 text-center">{t('app.no_maps_found')}</p>
                ) : (
                  // Fill the available column height and scroll internally, so
                  // the page itself never needs to scroll. On mobile (stacked
                  // layout) fall back to a viewport-relative cap.
                  <div className="flex flex-col gap-4 overflow-y-auto pr-1 max-h-[70vh] md:max-h-none md:flex-1 md:min-h-0">
                    {visibleMaps.map(({ map, index }) => (
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
                          {!mapQuery && (
                            <div className="flex flex-col mr-2">
                              <button onClick={() => moveMap(index, 'UP')} className="p-1 hover:text-blue-950 text-blue-900/40"><ChevronUp size={16} /></button>
                              <button onClick={() => moveMap(index, 'DOWN')} className="p-1 hover:text-blue-950 text-blue-900/40"><ChevronDown size={16} /></button>
                            </div>
                          )}
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
                )}
              </section>

              <section className="flex flex-col gap-6 md:min-h-0 md:overflow-y-auto md:pr-1">
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
                  <button
                    onClick={() => { setCurrentMapIndex(0); setMode('PLAY'); }}
                    className="w-20 h-20 bg-blue-950 text-white sketch-border flex items-center justify-center mb-6 hover:bg-blue-800 transition-colors"
                    aria-label={t('app.start_campaign')}
                  >
                    <PlayIcon size={32} fill="currentColor" />
                  </button>
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
