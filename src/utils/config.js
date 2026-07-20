import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { findEntry } from './entryMatch.js';

const CONFIG_DIR = join(homedir(), '.dcli');
const CONFIG_PATH = join(CONFIG_DIR, 'refresh.json');

async function ensureConfigDir() {
  await mkdir(CONFIG_DIR, { recursive: true });
}

export function normalizeEntry(entry) {
  if (typeof entry === 'string') return { uri: entry };
  return entry;
}

export async function readConfig() {
  try {
    const data = await readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(data);
    config.databases = (config.databases || []).map(normalizeEntry);
    return config;
  } catch {
    return { databases: [] };
  }
}

export async function writeConfig(config) {
  await ensureConfigDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function addDatabase(uri, name) {
  const config = await readConfig();
  const existing = config.databases.find(e => e.uri === uri);
  if (existing) {
    if (name && existing.name !== name) {
      existing.name = name;
      await writeConfig(config);
      return 'updated';
    }
    return 'exists';
  }
  config.databases.push(name ? { uri, name } : { uri });
  await writeConfig(config);
  return 'added';
}

export async function removeDatabase(target) {
  const config = await readConfig();
  const entry = findEntry(config.databases, target);
  if (!entry) {
    return false;
  }
  const index = config.databases.indexOf(entry);
  if (index === -1) {
    return false;
  }
  config.databases.splice(index, 1);
  await writeConfig(config);
  return true;
}
