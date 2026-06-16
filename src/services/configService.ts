import { AppConfig } from '../types';
import { normalizeAppConfig } from '../utils/configDefaults';

export interface PresetEntry {
  id: string;
  name: string;
  description?: string;
  file: string;
}

export interface PresetsManifest {
  presets: PresetEntry[];
}

const DATA_BASE = `${import.meta.env.BASE_URL}data`.replace(/\/$/, '');

export function isValidAppConfig(value: unknown): value is AppConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<AppConfig>;
  return (
    typeof config.version === 'string' &&
    Array.isArray(config.maps) &&
    Array.isArray(config.engines) &&
    Array.isArray(config.walls) &&
    Array.isArray(config.cargoTypes) &&
    config.systemAssets !== null &&
    typeof config.systemAssets === 'object'
  );
}

export async function fetchPresetsManifest(): Promise<PresetsManifest> {
  const res = await fetch(`${DATA_BASE}/presets.json`);
  if (!res.ok) {
    throw new Error(`Failed to load presets manifest (${res.status})`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.presets)) {
    throw new Error('Invalid presets manifest format');
  }
  return data as PresetsManifest;
}

export async function fetchPresetConfig(file: string): Promise<AppConfig> {
  const sanitized = file.replace(/^\/+/, '').replace(/\.\./g, '');
  const res = await fetch(`${DATA_BASE}/${sanitized}`);
  if (!res.ok) {
    throw new Error(`Failed to load preset (${res.status})`);
  }
  const data = await res.json();
  if (!isValidAppConfig(data)) {
    throw new Error('Invalid preset configuration format');
  }
  return normalizeAppConfig(data as AppConfig);
}