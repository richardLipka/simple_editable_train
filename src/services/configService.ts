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

// Preset files live on the server and are meant to be edited/replaced there by
// the deployer. Fetch them with caching fully disabled (no-store + a per-request
// cache-busting query) so an updated file is always picked up immediately. Without
// this, a browser or CDN can serve a stale copy: the load "succeeds" but brings in
// old/empty data, while Import-from-file (which reads the chosen local file, never
// the network) keeps working — exactly the symptom that surfaced on deploy.
function noCache(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
}

export async function fetchPresetsManifest(signal?: AbortSignal): Promise<PresetsManifest> {
  const res = await fetch(noCache(`${DATA_BASE}/presets.json`), { signal, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load presets manifest (${res.status})`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.presets)) {
    throw new Error('Invalid presets manifest format');
  }
  return data as PresetsManifest;
}

export async function fetchPresetConfig(file: string, signal?: AbortSignal): Promise<AppConfig> {
  const sanitized = file.replace(/^\/+/, '').replace(/\.\./g, '');
  const res = await fetch(noCache(`${DATA_BASE}/${sanitized}`), { signal, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load preset (${res.status})`);
  }
  const data = await res.json();
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid preset configuration format');
  }
  // Salvage whatever is usable rather than rejecting partially-valid presets.
  return normalizeAppConfig(data);
}