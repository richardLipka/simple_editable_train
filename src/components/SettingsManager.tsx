import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EngineType, WallType, CargoType, BonusType, BonusKind, AppConfig, SystemAssets } from '../types';
import { DEFAULT_ENGINES, DEFAULT_WALLS, DEFAULT_CARGO_TYPES, DEFAULT_BONUS_TYPES, EMOJI_LIST, DEFAULT_SYSTEM_ASSETS } from '../constants';
import { fetchPresetsManifest, fetchPresetConfig, PresetEntry } from '../services/configService';
import { Trash2, Plus, Image as ImageIcon, X, Save, Smile, TrainFront, BrickWall, Package, Download, Upload, Pencil, ArrowLeftRight, LayoutGrid, FolderOpen, Loader2, Sparkles, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CargoImageEditor } from './CargoImageEditor';
import { SketchPad } from './SketchPad';
import { CameraCapture } from './CameraCapture';

interface SettingsManagerProps {
  engines: EngineType[];
  walls: WallType[];
  cargoTypes: CargoType[];
  bonusTypes: BonusType[];
  systemAssets: SystemAssets;
  onSaveEngines: (engines: EngineType[]) => void;
  onSaveWalls: (walls: WallType[]) => void;
  onSaveCargo: (cargo: CargoType[]) => void;
  onSaveBonus: (bonus: BonusType[]) => void;
  onSaveSystemAssets: (system: SystemAssets) => void;
  onExit: () => void;
  initialTab?: 'ENGINES' | 'WALLS' | 'CARGO' | 'BONUSES' | 'SYSTEM';
  selectedEngineId?: string;
  onSelectEngine?: (id: string) => void;
  onExportConfig: () => void;
  onImportConfig: (config: unknown) => void;
}

// Compact icon-only action button; the label is shown as a hover tooltip.
const ActionIconButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className="sketch-button flex-1 bg-white text-blue-950 flex items-center justify-center py-2"
  >
    {icon}
  </button>
);

// Compact icon-only upload button; a transparent file input overlays it so the
// whole area opens the file picker. The label is shown as a hover tooltip.
const UploadIconButton: React.FC<{ label: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, onChange }) => (
  <div className="relative flex-1">
    <button type="button" title={label} aria-label={label} className="sketch-button w-full bg-white text-blue-950 flex items-center justify-center py-2">
      <ImageIcon size={14} />
    </button>
    <input type="file" accept="image/*" title={label} onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer" />
  </div>
);

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  engines, 
  walls, 
  cargoTypes,
  bonusTypes,
  systemAssets,
  onSaveEngines, 
  onSaveWalls, 
  onSaveCargo,
  onSaveBonus,
  onSaveSystemAssets,
  onExit,
  initialTab = 'ENGINES',
  selectedEngineId,
  onSelectEngine,
  onExportConfig,
  onImportConfig
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'ENGINES' | 'WALLS' | 'CARGO' | 'BONUSES' | 'SYSTEM'>(initialTab);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<{
    type: 'engine' | 'wall' | 'cargo' | 'carriage' | 'bonus' | 'start' | 'gateOpen' | 'gateClosed' | 'randomCargo' | 'carObstacle' | 'roadMid' | 'roadEdge';
    src: string;
  } | null>(null);
  const [sketching, setSketching] = useState<{
    type: 'engine' | 'wall' | 'cargo' | 'carriage' | 'bonus' | 'start' | 'gateOpen' | 'gateClosed' | 'randomCargo' | 'carObstacle' | 'roadMid' | 'roadEdge';
    initial?: string;
  } | null>(null);
  const [capturing, setCapturing] = useState<{
    type: 'engine' | 'wall' | 'cargo' | 'carriage' | 'bonus' | 'start' | 'gateOpen' | 'gateClosed' | 'randomCargo' | 'carObstacle' | 'roadMid' | 'roadEdge';
  } | null>(null);
  const [pickingEmoji, setPickingEmoji] = useState<'emoji' | 'cargoEmoji' | 'carriageEmoji' | 'startEmoji' | 'gateOpenEmoji' | 'gateClosedEmoji' | 'randomCargoEmoji' | 'carObstacleEmoji' | 'roadMidEmoji' | 'roadEdgeEmoji' | null>(null);

  const [presets, setPresets] = useState<PresetEntry[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetsError, setPresetsError] = useState<string | null>(null);

  // System assets are sourced directly from the App-level prop (the single
  // source of truth, persisted to localStorage). Every edit flushes through
  // this helper immediately, so drawn/uploaded images show up in the level
  // editor and game without needing a separate "save" step.
  const updateSystemAssets = (patch: Partial<SystemAssets>) => {
    onSaveSystemAssets({ ...systemAssets, ...patch });
  };

  const [newEngine, setNewEngine] = useState<Partial<EngineType>>({
    id: '',
    name: '',
    emoji: '🚂',
  });

  const [newWall, setNewWall] = useState<Partial<WallType>>({
    id: '',
    name: '',
    emoji: '🧱',
  });

  const [newCargo, setNewCargo] = useState<Partial<CargoType>>({
    id: '',
    name: '',
    cargoEmoji: '🎁',
    carriageEmoji: '🚃',
    color: '#10b981',
    pointValue: 100,
  });

  const [newBonus, setNewBonus] = useState<Partial<BonusType>>({
    id: '',
    name: '',
    emoji: '🪙',
    kind: 'coin',
    pointValue: 50,
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'engine' | 'wall' | 'cargo' | 'carriage' | 'bonus' | 'start' | 'gateOpen' | 'gateClosed' | 'randomCargo' | 'carObstacle' | 'roadMid' | 'roadEdge') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setEditingImage({ type, src: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    if (editingImage) {
      if (editingImage.type === 'engine') {
        setNewEngine(prev => ({ ...prev, image: croppedImage }));
      } else if (editingImage.type === 'wall') {
        setNewWall(prev => ({ ...prev, image: croppedImage }));
      } else if (editingImage.type === 'cargo') {
        setNewCargo(prev => ({ ...prev, cargoImage: croppedImage }));
      } else if (editingImage.type === 'carriage') {
        setNewCargo(prev => ({ ...prev, carriageImage: croppedImage }));
      } else if (editingImage.type === 'bonus') {
        setNewBonus(prev => ({ ...prev, image: croppedImage }));
      } else if (editingImage.type === 'start') {
        updateSystemAssets({ startImage: croppedImage });
      } else if (editingImage.type === 'gateOpen') {
        updateSystemAssets({ gateOpenImage: croppedImage });
      } else if (editingImage.type === 'gateClosed') {
        updateSystemAssets({ gateClosedImage: croppedImage });
      } else if (editingImage.type === 'randomCargo') {
        updateSystemAssets({ randomCargoImage: croppedImage });
      } else if (editingImage.type === 'carObstacle') {
        updateSystemAssets({ carObstacleImage: croppedImage });
      } else if (editingImage.type === 'roadMid') {
        updateSystemAssets({ roadMidImage: croppedImage });
      } else if (editingImage.type === 'roadEdge') {
        updateSystemAssets({ roadEdgeImage: croppedImage });
      }
      setEditingImage(null);
    }
  };

  const handleAddEngine = () => {
    if (newEngine.id && newEngine.name) {
      if (editingId) {
        onSaveEngines(engines.map(e => e.id === editingId ? (newEngine as EngineType) : e));
      } else {
        onSaveEngines([...engines, newEngine as EngineType]);
      }
      setIsAdding(false);
      setEditingId(null);
      setNewEngine({ id: '', name: '', emoji: '🚂' });
    }
  };

  const handleAddWall = () => {
    if (newWall.id && newWall.name) {
      if (editingId) {
        onSaveWalls(walls.map(w => w.id === editingId ? (newWall as WallType) : w));
      } else {
        onSaveWalls([...walls, newWall as WallType]);
      }
      setIsAdding(false);
      setEditingId(null);
      setNewWall({ id: '', name: '', emoji: '🧱' });
    }
  };

  const handleAddCargo = () => {
    if (newCargo.id && newCargo.name) {
      if (editingId) {
        onSaveCargo(cargoTypes.map(c => c.id === editingId ? (newCargo as CargoType) : c));
      } else {
        onSaveCargo([...cargoTypes, newCargo as CargoType]);
      }
      setIsAdding(false);
      setEditingId(null);
      setNewCargo({ id: '', name: '', cargoEmoji: '🎁', carriageEmoji: '🚃', color: '#10b981', pointValue: 100 });
    }
  };

  const handleAddBonus = () => {
    if (newBonus.id && newBonus.name) {
      if (editingId) {
        onSaveBonus(bonusTypes.map((b) => (b.id === editingId ? (newBonus as BonusType) : b)));
      } else {
        onSaveBonus([...bonusTypes, newBonus as BonusType]);
      }
      setIsAdding(false);
      setEditingId(null);
      setNewBonus({ id: '', name: '', emoji: '🪙', kind: 'coin', pointValue: 50 });
    }
  };

  const handleDeleteBonus = (id: string) => {
    onSaveBonus(bonusTypes.filter((b) => b.id !== id));
  };

  const handleEditBonus = (bonus: BonusType) => {
    setNewBonus(bonus);
    setEditingId(bonus.id);
    setIsAdding(true);
  };

  const handleDeleteEngine = (id: string) => {
    onSaveEngines(engines.filter(e => e.id !== id));
  };

  const handleEditEngine = (engine: EngineType) => {
    setNewEngine(engine);
    setEditingId(engine.id);
    setIsAdding(true);
  };

  const handleDeleteWall = (id: string) => {
    onSaveWalls(walls.filter(w => w.id !== id));
  };

  const handleEditWall = (wall: WallType) => {
    setNewWall(wall);
    setEditingId(wall.id);
    setIsAdding(true);
  };

  const handleDeleteCargo = (id: string) => {
    onSaveCargo(cargoTypes.filter(c => c.id !== id));
  };

  const handleEditCargo = (cargo: CargoType) => {
    setNewCargo(cargo);
    setEditingId(cargo.id);
    setIsAdding(true);
  };

  const handleSwapCargoImages = () => {
    setNewCargo(prev => ({
      ...prev,
      cargoImage: prev.carriageImage,
      carriageImage: prev.cargoImage,
      cargoEmoji: prev.carriageEmoji,
      carriageEmoji: prev.cargoEmoji
    }));
  };

  const handleSaveSystem = () => {
    // System assets persist immediately on each edit; nothing to flush here.
  };

  useEffect(() => {
    const controller = new AbortController();
    setPresetsLoading(true);
    fetchPresetsManifest(controller.signal)
      .then((manifest) => {
        setPresets(manifest.presets);
        if (manifest.presets.length > 0) {
          setSelectedPresetId(manifest.presets[0].id);
        }
        setPresetsError(null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Failed to load presets manifest', err);
        setPresets([]);
        setPresetsError(t('settings.presets_unavailable'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPresetsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const handleLoadPreset = async () => {
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    const controller = new AbortController();
    setPresetLoading(true);
    try {
      const config = await fetchPresetConfig(preset.file, controller.signal);
      onImportConfig(config);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Failed to load preset', err);
      alert(t('settings.preset_load_error'));
    } finally {
      setPresetLoading(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.target?.result as string);
      } catch (err) {
        console.error('Failed to parse config file', err);
        alert(t('settings.import_parse_error'));
        return;
      }
      // Reject only files that are not a JSON object at all; otherwise hand off
      // to the importer, which salvages whatever valid data it can find.
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        alert(t('settings.import_invalid'));
        return;
      }
      onImportConfig(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-5xl"
    >
      {sketching && (
        <SketchPad 
          title={t(`settings.sketch_${sketching.type}`)}
          initialImage={sketching.initial}
          onCancel={() => setSketching(null)}
          onSave={(base64) => {
            if (sketching.type === 'engine') setNewEngine(prev => ({ ...prev, image: base64 }));
            if (sketching.type === 'wall') setNewWall(prev => ({ ...prev, image: base64 }));
            if (sketching.type === 'cargo') setNewCargo(prev => ({ ...prev, cargoImage: base64 }));
            if (sketching.type === 'carriage') setNewCargo(prev => ({ ...prev, carriageImage: base64 }));
            if (sketching.type === 'bonus') setNewBonus(prev => ({ ...prev, image: base64 }));
            if (sketching.type === 'start') updateSystemAssets({ startImage: base64 });
            if (sketching.type === 'gateOpen') updateSystemAssets({ gateOpenImage: base64 });
            if (sketching.type === 'gateClosed') updateSystemAssets({ gateClosedImage: base64 });
            if (sketching.type === 'randomCargo') updateSystemAssets({ randomCargoImage: base64 });
            if (sketching.type === 'carObstacle') updateSystemAssets({ carObstacleImage: base64 });
            if (sketching.type === 'roadMid') updateSystemAssets({ roadMidImage: base64 });
            if (sketching.type === 'roadEdge') updateSystemAssets({ roadEdgeImage: base64 });
            setSketching(null);
          }}
        />
      )}

      {capturing && (
        <CameraCapture
          title={t('camera_capture.title')}
          onCancel={() => setCapturing(null)}
          onCapture={(base64) => {
            // Route the captured photo through the same crop editor that
            // uploaded images use, so the user can frame it before saving.
            setEditingImage({ type: capturing.type, src: base64 });
            setCapturing(null);
          }}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight">{t('settings.title')}</h2>
          <p className="text-blue-900/40 font-mono text-xs uppercase tracking-widest">{t('settings.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <div className="flex gap-2 mr-4 border-r border-blue-950/10 pr-4">
            <button 
              onClick={onExportConfig}
              className="sketch-button bg-white text-blue-950 font-bold flex items-center gap-2 text-sm"
              title={t('settings.export_config')}
            >
              <Download size={18} />
              <span className="hidden sm:inline">{t('settings.export_config')}</span>
            </button>
            <div className="relative">
              <button 
                className="sketch-button bg-white text-blue-950 font-bold flex items-center gap-2 text-sm"
                title={t('settings.import_config')}
              >
                <Upload size={18} />
                <span className="hidden sm:inline">{t('settings.import_config')}</span>
              </button>
              <input 
                type="file" 
                accept=".json"
                onChange={handleImport}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            {presetsLoading ? (
              <div className="sketch-button bg-white text-blue-950/50 font-bold flex items-center gap-2 text-sm cursor-default">
                <Loader2 size={18} className="animate-spin" />
                <span className="hidden sm:inline">{t('settings.presets_loading')}</span>
              </div>
            ) : presets.length > 0 ? (
              <>
                <select
                  value={selectedPresetId}
                  onChange={(e) => setSelectedPresetId(e.target.value)}
                  className="sketch-button bg-white text-blue-950 font-bold text-sm max-w-[12rem] truncate"
                  title={presets.find((p) => p.id === selectedPresetId)?.description}
                >
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleLoadPreset}
                  disabled={presetLoading}
                  className="sketch-button bg-white text-blue-950 font-bold flex items-center gap-2 text-sm disabled:opacity-50"
                  title={t('settings.load_preset')}
                >
                  {presetLoading ? <Loader2 size={18} className="animate-spin" /> : <FolderOpen size={18} />}
                  <span className="hidden sm:inline">{t('settings.load_preset')}</span>
                </button>
              </>
            ) : presetsError ? (
              <span className="text-xs font-mono text-blue-950/40 self-center hidden lg:inline">{presetsError}</span>
            ) : null}
          </div>
            <button 
              onClick={() => {
                if (tab === 'SYSTEM') {
                  handleSaveSystem();
                  onExit();
                } else {
                  setIsAdding(true);
                  setEditingId(null);
                  if (tab === 'ENGINES') setNewEngine({ id: '', name: '', emoji: '🚂' });
                  else if (tab === 'WALLS') setNewWall({ id: '', name: '', emoji: '🧱' });
                  else if (tab === 'BONUSES') setNewBonus({ id: '', name: '', emoji: '🪙', kind: 'coin', pointValue: 50 });
                  else setNewCargo({ id: '', name: '', cargoEmoji: '🎁', carriageEmoji: '🚃', color: '#10b981', pointValue: 100 });
                }
              }}
              className="sketch-button bg-blue-950 text-white font-bold flex items-center gap-2"
            >
              {tab === 'SYSTEM' ? (
                <>
                  <Save size={18} />
                  {t('settings.save_system')}
                </>
              ) : (
                <>
                  <Plus size={18} />
                  {t('settings.add')} {tab === 'ENGINES' ? t('settings.engines') : tab === 'WALLS' ? t('settings.walls') : tab === 'BONUSES' ? t('settings.bonuses') : t('settings.cargo')}
                </>
              )}
            </button>
          <button 
            onClick={onExit}
            className="sketch-button bg-white text-blue-950 font-bold"
          >
            {t('settings.back')}
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => { setTab('ENGINES'); setIsAdding(false); setEditingId(null); }}
          className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${tab === 'ENGINES' ? 'bg-blue-950 text-white' : 'bg-white text-blue-900/40 hover:text-blue-950 border border-blue-950/20'}`}
        >
          <TrainFront size={18} />
          {t('settings.engines')}
        </button>
        <button 
          onClick={() => { setTab('WALLS'); setIsAdding(false); setEditingId(null); }}
          className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${tab === 'WALLS' ? 'bg-blue-950 text-white' : 'bg-white text-blue-900/40 hover:text-blue-950 border border-blue-950/20'}`}
        >
          <BrickWall size={18} />
          {t('settings.walls')}
        </button>
        <button 
          onClick={() => { setTab('CARGO'); setIsAdding(false); setEditingId(null); }}
          className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${tab === 'CARGO' ? 'bg-blue-950 text-white' : 'bg-white text-blue-900/40 hover:text-blue-950 border border-blue-950/20'}`}
        >
          <Package size={18} />
          {t('settings.cargo')}
        </button>
        <button 
          onClick={() => { setTab('BONUSES'); setIsAdding(false); setEditingId(null); }}
          className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${tab === 'BONUSES' ? 'bg-blue-950 text-white' : 'bg-white text-blue-900/40 hover:text-blue-950 border border-blue-950/20'}`}
        >
          <Sparkles size={18} />
          {t('settings.bonuses')}
        </button>
        <button 
          onClick={() => { setTab('SYSTEM'); setIsAdding(false); setEditingId(null); }}
          className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${tab === 'SYSTEM' ? 'bg-blue-950 text-white' : 'bg-white text-blue-900/40 hover:text-blue-950 border border-blue-950/20'}`}
        >
          <LayoutGrid size={18} />
          {t('settings.system')}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="col-span-full sketch-card bg-white border-blue-950 p-8 mb-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    {editingId ? <ImageIcon className="text-blue-950" /> : <Plus className="text-blue-950" />}
                    {editingId ? t('settings.edit') : t('settings.new')} {tab === 'ENGINES' ? t('settings.engines') : tab === 'WALLS' ? t('settings.walls') : tab === 'BONUSES' ? t('settings.bonuses') : t('settings.cargo')} {t('settings.definition')}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.id')}</label>
                      <input 
                        type="text" 
                        placeholder={t('settings.placeholder_id')}
                        disabled={!!editingId}
                        value={tab === 'ENGINES' ? newEngine.id : tab === 'WALLS' ? newWall.id : tab === 'BONUSES' ? newBonus.id : newCargo.id}
                        onChange={e => {
                          if (tab === 'ENGINES') setNewEngine({...newEngine, id: e.target.value});
                          else if (tab === 'WALLS') setNewWall({...newWall, id: e.target.value});
                          else if (tab === 'BONUSES') setNewBonus({...newBonus, id: e.target.value});
                          else setNewCargo({...newCargo, id: e.target.value});
                        }}
                        className="w-full bg-white border border-blue-950/20 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.name')}</label>
                      <input 
                        type="text" 
                        placeholder={t('settings.placeholder_name')}
                        value={tab === 'ENGINES' ? newEngine.name : tab === 'WALLS' ? newWall.name : tab === 'BONUSES' ? newBonus.name : newCargo.name}
                        onChange={e => {
                          if (tab === 'ENGINES') setNewEngine({...newEngine, name: e.target.value});
                          else if (tab === 'WALLS') setNewWall({...newWall, name: e.target.value});
                          else if (tab === 'BONUSES') setNewBonus({...newBonus, name: e.target.value});
                          else setNewCargo({...newCargo, name: e.target.value});
                        }}
                        className="w-full bg-white border border-blue-950/20 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-950 transition-colors"
                      />
                    </div>

                    {tab === 'CARGO' ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.cargo_emoji')}</label>
                            <div className="relative">
                              <input 
                                type="text" 
                                value={newCargo.cargoEmoji}
                                readOnly
                                onClick={() => setPickingEmoji('cargoEmoji')}
                                className="w-full bg-white border border-blue-950/20 rounded-xl px-4 py-3 text-center text-2xl cursor-pointer hover:border-blue-950 transition-colors"
                              />
                              <Smile className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900/40 pointer-events-none" size={18} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.carriage_emoji')}</label>
                            <div className="relative">
                              <input 
                                type="text" 
                                value={newCargo.carriageEmoji}
                                readOnly
                                onClick={() => setPickingEmoji('carriageEmoji')}
                                className="w-full bg-white border border-blue-950/20 rounded-xl px-4 py-3 text-center text-2xl cursor-pointer hover:border-blue-950 transition-colors"
                              />
                              <Smile className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900/40 pointer-events-none" size={18} />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.theme_color')}</label>
                          <input 
                            type="color" 
                            value={newCargo.color}
                            onChange={e => setNewCargo({...newCargo, color: e.target.value})}
                            className="w-full h-[54px] bg-white border border-blue-950/20 rounded-xl p-1 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.point_value')}</label>
                          <input
                            type="number"
                            min={1}
                            value={newCargo.pointValue ?? 100}
                            onChange={(e) => setNewCargo({ ...newCargo, pointValue: Number(e.target.value) })}
                            className="w-full bg-white border border-blue-950/20 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-950 transition-colors"
                          />
                        </div>
                      </>
                    ) : tab === 'BONUSES' ? (
                      <>
                        <div>
                          <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.fallback_emoji')}</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={newBonus.emoji}
                              readOnly
                              onClick={() => setPickingEmoji('emoji')}
                              className="w-full bg-white border border-blue-950/20 rounded-xl px-4 py-3 text-center text-2xl cursor-pointer hover:border-blue-950 transition-colors"
                            />
                            <Smile className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900/40 pointer-events-none" size={18} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.bonus_kind')}</label>
                          <select
                            value={newBonus.kind}
                            onChange={(e) => setNewBonus({ ...newBonus, kind: e.target.value as BonusKind })}
                            className="w-full bg-white border border-blue-950/20 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-950 transition-colors"
                          >
                            <option value="coin">{t('settings.kind_coin')}</option>
                            <option value="star">{t('settings.kind_star')}</option>
                            <option value="gem">{t('settings.kind_gem')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.point_value')}</label>
                          <input
                            type="number"
                            min={1}
                            value={newBonus.pointValue ?? 50}
                            onChange={(e) => setNewBonus({ ...newBonus, pointValue: Number(e.target.value) })}
                            className="w-full bg-white border border-blue-950/20 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-950 transition-colors"
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="block text-xs font-mono text-blue-900/40 uppercase mb-2">{t('settings.fallback_emoji')}</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={tab === 'ENGINES' ? newEngine.emoji : tab === 'BONUSES' ? newBonus.emoji : newWall.emoji}
                            readOnly
                            onClick={() => setPickingEmoji('emoji')}
                            className="w-full bg-white border border-blue-950/20 rounded-xl px-4 py-3 text-center text-2xl cursor-pointer hover:border-blue-950 transition-colors"
                          />
                          <Smile className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-900/40 pointer-events-none" size={18} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  {tab === 'CARGO' ? (
                    <div className="grid grid-cols-2 gap-8 relative">
                      <button 
                        onClick={handleSwapCargoImages}
                        className="absolute left-1/2 top-[135px] -translate-x-1/2 z-10 w-10 h-10 bg-blue-950 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform border-4 border-white"
                        title={t('settings.swap_images')}
                      >
                        <ArrowLeftRight size={20} />
                      </button>
                      <div className="space-y-4">
                        <label className="block text-xs font-mono text-blue-900/40 uppercase">{t('settings.cargo_icon')}</label>
                        <div className="flex gap-2">
                          <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, 'cargo')} />
                          <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'cargo' })} />
                          <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'cargo', initial: newCargo.cargoImage })} />
                        </div>
                        <div className="aspect-square bg-white border-2 border-dashed border-blue-950/20 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                          {newCargo.cargoImage ? (
                            <img src={newCargo.cargoImage} alt="Cargo" className="w-full h-full object-contain" />
                          ) : (
                            <div className="text-center p-4">
                              <ImageIcon className="mx-auto mb-2 text-blue-900/20" size={32} />
                              <p className="text-[10px] text-blue-900/40">{t('settings.upload_image_placeholder')}</p>
                            </div>
                          )}
                          {newCargo.cargoImage && (
                            <button 
                              onClick={() => setNewCargo({...newCargo, cargoImage: undefined})}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                    <div className="space-y-4">
                      <label className="block text-xs font-mono text-blue-900/40 uppercase">{t('settings.carriage_icon')}</label>
                      <div className="flex gap-2">
                        <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, 'carriage')} />
                        <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'carriage' })} />
                        <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'carriage', initial: newCargo.carriageImage })} />
                      </div>
                      <div className="aspect-square bg-white border-2 border-dashed border-blue-950/20 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                        {newCargo.carriageImage ? (
                          <img src={newCargo.carriageImage} alt="Carriage" className="w-full h-full object-contain" />
                        ) : (
                          <div className="text-center p-4">
                            <ImageIcon className="mx-auto mb-2 text-blue-900/20" size={32} />
                            <p className="text-[10px] text-blue-900/40">{t('settings.carriage_visual')}</p>
                          </div>
                        )}
                        {newCargo.carriageImage && (
                          <button 
                            onClick={() => setNewCargo({...newCargo, carriageImage: undefined})}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    </div>
                  ) : tab === 'BONUSES' ? (
                    <div className="space-y-4">
                      <label className="block text-xs font-mono text-blue-900/40 uppercase">{t('settings.custom_asset')}</label>
                      <div className="flex gap-2">
                        <UploadIconButton label={t('settings.upload')} onChange={(e) => handleImageUpload(e, 'bonus')} />
                        <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'bonus' })} />
                        <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'bonus', initial: newBonus.image })} />
                      </div>
                      <div className="aspect-square max-w-[200px] bg-white border-2 border-dashed border-blue-950/20 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                        {newBonus.image ? (
                          <img src={newBonus.image} alt="Bonus" className="w-full h-full object-contain" />
                        ) : (
                          <div className="text-center p-4 text-4xl">{newBonus.emoji}</div>
                        )}
                        {newBonus.image && (
                          <button
                            onClick={() => setNewBonus({ ...newBonus, image: undefined })}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="block text-xs font-mono text-blue-900/40 uppercase">{t('settings.custom_asset')}</label>
                      <div className="flex gap-2">
                        <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, tab === 'ENGINES' ? 'engine' : 'wall')} />
                        <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: tab === 'ENGINES' ? 'engine' : 'wall' })} />
                        <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: tab === 'ENGINES' ? 'engine' : 'wall', initial: tab === 'ENGINES' ? newEngine.image : newWall.image })} />
                      </div>
                      <div className="aspect-square max-w-[200px] bg-white border-2 border-dashed border-blue-950/20 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                        {(tab === 'ENGINES' ? newEngine.image : newWall.image) ? (
                          <img src={tab === 'ENGINES' ? newEngine.image : newWall.image} alt="Asset" className="w-full h-full object-contain" />
                        ) : (
                          <div className="text-center p-4">
                            <ImageIcon className="mx-auto mb-2 text-blue-900/20" size={32} />
                            <p className="text-[10px] text-blue-900/40">{t('settings.upload_image_placeholder')}</p>
                          </div>
                        )}
                        {(tab === 'ENGINES' ? newEngine.image : newWall.image) && (
                          <button 
                            onClick={() => tab === 'ENGINES' ? setNewEngine({...newEngine, image: undefined}) : setNewWall({...newWall, image: undefined})}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => setIsAdding(false)}
                      className="flex-1 py-4 sketch-button bg-white text-blue-900/40 font-bold"
                    >
                      {t('settings.cancel')}
                    </button>
                    <button 
                      onClick={tab === 'ENGINES' ? handleAddEngine : tab === 'WALLS' ? handleAddWall : tab === 'BONUSES' ? handleAddBonus : handleAddCargo}
                      disabled={
                        tab === 'ENGINES' ? (!newEngine.id || !newEngine.name) : 
                        tab === 'WALLS' ? (!newWall.id || !newWall.name) : 
                        tab === 'BONUSES' ? (!newBonus.id || !newBonus.name) :
                        (!newCargo.id || !newCargo.name)
                      }
                      className="flex-1 py-4 sketch-button bg-blue-950 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold flex items-center justify-center gap-2"
                    >
                      <Save size={20} />
                      {editingId ? t('settings.update') : t('settings.save')} {tab === 'ENGINES' ? t('settings.engines') : tab === 'WALLS' ? t('settings.walls') : tab === 'BONUSES' ? t('settings.bonuses') : t('settings.cargo')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {tab !== 'SYSTEM' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tab === 'ENGINES' ? engines.map((e, idx) => (
            <motion.div 
              layout
              key={e.id} 
              className={`group relative sketch-card bg-white border transition-all ${selectedEngineId === e.id ? 'border-blue-950 shadow-lg' : 'border-blue-950/20'}`}
            >
              {selectedEngineId === e.id && (
                <div className="absolute -top-3 -right-3 bg-blue-950 text-white px-3 py-1 rounded-full text-[10px] font-black italic tracking-tighter z-10 shadow-lg">
                  {t('settings.selected')}
                </div>
              )}
              <div className="flex items-start justify-between mb-6">
                <div 
                  className="flex items-center gap-4 cursor-pointer flex-1"
                  onClick={() => onSelectEngine?.(e.id)}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl relative overflow-hidden transition-all ${selectedEngineId === e.id ? 'bg-blue-50' : 'bg-white'}`}>
                    {e.image ? (
                      <img src={e.image} alt={e.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      e.emoji
                    )}
                  </div>
                  <div>
                    <h4 className={`font-bold text-lg transition-colors ${selectedEngineId === e.id ? 'text-blue-950 underline underline-offset-4' : ''}`}>{e.name}</h4>
                    <p className="text-xs font-mono text-blue-900/40 uppercase tracking-tighter">{e.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleEditEngine(e)}
                    className="p-2 text-blue-900/40 hover:text-blue-950 transition-colors"
                  >
                    <ImageIcon size={18} />
                  </button>
                  {idx >= DEFAULT_ENGINES.length && (
                    <button 
                      onClick={() => handleDeleteEngine(e.id)}
                      className="p-2 text-blue-900/40 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
              {selectedEngineId !== e.id && (
                <button 
                  onClick={() => onSelectEngine?.(e.id)}
                  className="w-full py-2 bg-white border border-blue-950 text-blue-950 text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest"
                >
                  {t('settings.select_for_game')}
                </button>
              )}
            </motion.div>
          )) : tab === 'WALLS' ? walls.map((w, idx) => (
            <motion.div 
              layout
              key={w.id} 
              className="group relative sketch-card bg-white border border-blue-950/20 p-6 transition-all"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-3xl relative overflow-hidden">
                    {w.image ? (
                      <img src={w.image} alt={w.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      w.emoji
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{w.name}</h4>
                    <p className="text-xs font-mono text-blue-900/40 uppercase tracking-tighter">{w.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleEditWall(w)}
                    className="p-2 text-blue-900/40 hover:text-blue-950 transition-colors"
                  >
                    <ImageIcon size={18} />
                  </button>
                  {idx >= DEFAULT_WALLS.length && (
                    <button 
                      onClick={() => handleDeleteWall(w.id)}
                      className="p-2 text-blue-900/40 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )) : tab === 'BONUSES' ? bonusTypes.map((b, idx) => (
            <motion.div
              layout
              key={b.id}
              className="group relative sketch-card bg-white border border-blue-950/20 p-6 transition-all"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-yellow-50 flex items-center justify-center text-3xl relative overflow-hidden">
                    {b.image ? (
                      <img src={b.image} alt={b.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      b.emoji
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{b.name}</h4>
                    <p className="text-xs font-mono text-blue-900/40 uppercase tracking-tighter">{b.id} · +{b.pointValue ?? 50}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditBonus(b)}
                    className="p-2 text-blue-900/40 hover:text-blue-950 transition-colors"
                  >
                    <ImageIcon size={18} />
                  </button>
                  {idx >= DEFAULT_BONUS_TYPES.length && (
                    <button
                      onClick={() => handleDeleteBonus(b.id)}
                      className="p-2 text-blue-900/40 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )) : cargoTypes.map((c, idx) => (
            <motion.div 
              layout
              key={c.id} 
              className="group relative sketch-card bg-white border border-blue-950/20 p-6 transition-all"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl relative overflow-hidden" style={{ backgroundColor: `${c.color}22` }}>
                    {c.cargoImage ? (
                      <img src={c.cargoImage} alt={c.name} className="w-full h-full object-contain p-2" />
                    ) : (
                      c.cargoEmoji
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{c.name}</h4>
                    <p className="text-xs font-mono text-blue-900/40 uppercase tracking-tighter">{c.id} · +{c.pointValue ?? 100}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleEditCargo(c)}
                    className="p-2 text-blue-900/40 hover:text-blue-950 transition-colors"
                  >
                    <ImageIcon size={18} />
                  </button>
                  {idx >= DEFAULT_CARGO_TYPES.length && (
                    <button 
                      onClick={() => handleDeleteCargo(c.id)}
                      className="p-2 text-blue-900/40 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: `${c.color}44` }}>
                  {c.carriageImage ? (
                    <img src={c.carriageImage} alt="Carriage" className="w-full h-full object-contain p-1" />
                  ) : (
                    c.carriageEmoji
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-mono text-blue-900/60 uppercase">{t('settings.carriage_visual')}</p>
                  <p className="text-xs text-blue-900/40">{t('settings.custom_asset')}</p>
                </div>
              </div>
            </motion.div>
            ))}
          </div>
        )}

        {tab === 'SYSTEM' && (
        <div className="space-y-12">
          <div className="sketch-card bg-blue-50/30 border-blue-950/10 mb-8">
            <p className="text-sm text-blue-900/60 leading-relaxed italic">
              {t('settings.system_desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Start Position */}
            <div className="sketch-card bg-white border-blue-950/20 p-6">
              <h4 className="text-xs font-mono text-blue-900/40 uppercase mb-4">{t('settings.start_icon')}</h4>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center text-5xl relative overflow-hidden border-2 border-blue-950/10">
                  {systemAssets.startImage ? (
                    <img src={systemAssets.startImage} alt="Start" className="w-full h-full object-contain p-2" />
                  ) : (
                    systemAssets.startEmoji
                  )}
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-2">
                    <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'start' })} />
                    <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, 'start')} />
                    <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'start', initial: systemAssets.startImage })} />
                    <ActionIconButton icon={<Smile size={14} />} label={t('settings.emoji')} onClick={() => setPickingEmoji('startEmoji')} />
                  </div>
                </div>
              </div>
            </div>

            {/* Random Cargo */}
            <div className="sketch-card bg-white border-blue-950/20 p-6">
              <h4 className="text-xs font-mono text-blue-900/40 uppercase mb-4">{t('settings.random_cargo_icon')}</h4>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center text-5xl relative overflow-hidden border-2 border-blue-950/10">
                  {systemAssets.randomCargoImage ? (
                    <img src={systemAssets.randomCargoImage} alt="Random Cargo" className="w-full h-full object-contain p-2" />
                  ) : (
                    systemAssets.randomCargoEmoji
                  )}
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-2">
                    <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'randomCargo' })} />
                    <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, 'randomCargo')} />
                    <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'randomCargo', initial: systemAssets.randomCargoImage })} />
                    <ActionIconButton icon={<Smile size={14} />} label={t('settings.emoji')} onClick={() => setPickingEmoji('randomCargoEmoji')} />
                  </div>
                </div>
              </div>
            </div>

            {/* Gate Open */}
            <div className="sketch-card bg-white border-blue-950/20 p-6">
              <h4 className="text-xs font-mono text-blue-900/40 uppercase mb-4">{t('settings.gate_open_icon')}</h4>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center text-5xl relative overflow-hidden border-2 border-blue-950/10">
                  {systemAssets.gateOpenImage ? (
                    <img src={systemAssets.gateOpenImage} alt="Gate Open" className="w-full h-full object-contain p-2" />
                  ) : (
                    systemAssets.gateOpenEmoji
                  )}
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-2">
                    <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'gateOpen' })} />
                    <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, 'gateOpen')} />
                    <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'gateOpen', initial: systemAssets.gateOpenImage })} />
                    <ActionIconButton icon={<Smile size={14} />} label={t('settings.emoji')} onClick={() => setPickingEmoji('gateOpenEmoji')} />
                  </div>
                </div>
              </div>
            </div>

            {/* Gate Closed */}
            <div className="sketch-card bg-white border-blue-950/20 p-6">
              <h4 className="text-xs font-mono text-blue-900/40 uppercase mb-4">{t('settings.gate_closed_icon')}</h4>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center text-5xl relative overflow-hidden border-2 border-blue-950/10">
                  {systemAssets.gateClosedImage ? (
                    <img src={systemAssets.gateClosedImage} alt="Gate Closed" className="w-full h-full object-contain p-2" />
                  ) : (
                    systemAssets.gateClosedEmoji
                  )}
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-2">
                    <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'gateClosed' })} />
                    <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, 'gateClosed')} />
                    <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'gateClosed', initial: systemAssets.gateClosedImage })} />
                    <ActionIconButton icon={<Smile size={14} />} label={t('settings.emoji')} onClick={() => setPickingEmoji('gateClosedEmoji')} />
                  </div>
                </div>
              </div>
            </div>

            {/* Car Obstacle */}
            <div className="sketch-card bg-white border-blue-950/20 p-6">
              <h4 className="text-xs font-mono text-blue-900/40 uppercase mb-4">{t('settings.car_obstacle_icon')}</h4>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-red-50 flex items-center justify-center text-5xl relative overflow-hidden border-2 border-blue-950/10">
                  {systemAssets.carObstacleImage ? (
                    <img src={systemAssets.carObstacleImage} alt="Car" className="w-full h-full object-contain p-2" />
                  ) : (
                    systemAssets.carObstacleEmoji ?? '🚗'
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'carObstacle' })} />
                    <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, 'carObstacle')} />
                    <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'carObstacle', initial: systemAssets.carObstacleImage })} />
                    <ActionIconButton icon={<Smile size={14} />} label={t('settings.emoji')} onClick={() => setPickingEmoji('carObstacleEmoji')} />
                  </div>
                  <p className="text-[10px] text-blue-900/40">{t('settings.car_obstacle_hint')}</p>
                </div>
              </div>
            </div>

            {/* Road Middle */}
            <div className="sketch-card bg-white border-blue-950/20 p-6">
              <h4 className="text-xs font-mono text-blue-900/40 uppercase mb-4">{t('settings.road_mid_icon')}</h4>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-gray-50 flex items-center justify-center text-5xl relative overflow-hidden border-2 border-blue-950/10">
                  {systemAssets.roadMidImage ? (
                    <img src={systemAssets.roadMidImage} alt="Road Mid" className="w-full h-full object-contain p-2" />
                  ) : (
                    systemAssets.roadMidEmoji ?? '🛣️'
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'roadMid' })} />
                    <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, 'roadMid')} />
                    <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'roadMid', initial: systemAssets.roadMidImage })} />
                    <ActionIconButton icon={<Smile size={14} />} label={t('settings.emoji')} onClick={() => setPickingEmoji('roadMidEmoji')} />
                  </div>
                  <p className="text-[10px] text-blue-900/40">{t('settings.road_mid_hint')}</p>
                </div>
              </div>
            </div>

            {/* Road Edge */}
            <div className="sketch-card bg-white border-blue-950/20 p-6">
              <h4 className="text-xs font-mono text-blue-900/40 uppercase mb-4">{t('settings.road_edge_icon')}</h4>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-gray-50 flex items-center justify-center text-5xl relative overflow-hidden border-2 border-blue-950/10">
                  {systemAssets.roadEdgeImage ? (
                    <img src={systemAssets.roadEdgeImage} alt="Road Edge" className="w-full h-full object-contain p-2" />
                  ) : (
                    systemAssets.roadEdgeEmoji ?? '🛣️'
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <ActionIconButton icon={<Camera size={14} />} label={t('settings.camera')} onClick={() => setCapturing({ type: 'roadEdge' })} />
                    <UploadIconButton label={t('settings.upload')} onChange={e => handleImageUpload(e, 'roadEdge')} />
                    <ActionIconButton icon={<Pencil size={14} />} label={t('settings.draw')} onClick={() => setSketching({ type: 'roadEdge', initial: systemAssets.roadEdgeImage })} />
                    <ActionIconButton icon={<Smile size={14} />} label={t('settings.emoji')} onClick={() => setPickingEmoji('roadEdgeEmoji')} />
                  </div>
                  <p className="text-[10px] text-blue-900/40">{t('settings.road_edge_hint')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {editingImage && (
          <CargoImageEditor 
            image={editingImage.src}
            onCropComplete={handleCropComplete}
            onCancel={() => setEditingImage(null)}
          />
        )}

        {pickingEmoji && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl sketch-card bg-white border-blue-950 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-blue-950/20 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{t('settings.select_fallback_emoji')}</h3>
                  <p className="text-xs text-blue-900/40 font-mono uppercase">Choosing for {tab === 'ENGINES' ? t('settings.engines') : tab === 'WALLS' ? t('settings.walls') : t('settings.cargo')}</p>
                </div>
                <button 
                  onClick={() => setPickingEmoji(null)}
                  className="p-2 hover:bg-blue-50 rounded-xl transition-colors text-blue-950"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {EMOJI_LIST.map(group => (
                  <div key={group.category}>
                    <h4 className="text-xs font-mono text-blue-900/40 uppercase tracking-widest mb-4">{group.category}</h4>
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                      {group.emojis.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            if (tab === 'ENGINES') {
                              setNewEngine(prev => ({ ...prev, emoji }));
                            } else if (tab === 'WALLS') {
                              setNewWall(prev => ({ ...prev, emoji }));
                            } else if (tab === 'BONUSES') {
                              setNewBonus(prev => ({ ...prev, emoji }));
                            } else if (tab === 'SYSTEM') {
                              if (pickingEmoji === 'startEmoji') updateSystemAssets({ startEmoji: emoji });
                              else if (pickingEmoji === 'gateOpenEmoji') updateSystemAssets({ gateOpenEmoji: emoji });
                              else if (pickingEmoji === 'gateClosedEmoji') updateSystemAssets({ gateClosedEmoji: emoji });
                              else if (pickingEmoji === 'randomCargoEmoji') updateSystemAssets({ randomCargoEmoji: emoji });
                              else if (pickingEmoji === 'carObstacleEmoji') updateSystemAssets({ carObstacleEmoji: emoji });
                              else if (pickingEmoji === 'roadMidEmoji') updateSystemAssets({ roadMidEmoji: emoji });
                              else if (pickingEmoji === 'roadEdgeEmoji') updateSystemAssets({ roadEdgeEmoji: emoji });
                            } else {
                              setNewCargo(prev => ({
                                ...prev,
                                [pickingEmoji === 'cargoEmoji' ? 'cargoEmoji' : 'carriageEmoji']: emoji
                              }));
                            }
                            setPickingEmoji(null);
                          }}
                          className="aspect-square flex items-center justify-center text-2xl hover:bg-blue-50 rounded-xl transition-all hover:scale-110 active:scale-95"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
