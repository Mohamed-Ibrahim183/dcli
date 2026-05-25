import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.dlib');
const CONFIG_PATH = join(CONFIG_DIR, 'refresh.json');

const DEFAULT_CONFIG = { databases: [] };

async function ensureConfigDir() {
  await mkdir(CONFIG_DIR, { recursive: true });
}

export async function readConfig() {
  try {
    const data = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(config) {
  ensureConfigDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function addDatabase(uri) {
  const config = await readConfig();
  if (config.databases.includes(uri)) {
    return false;
  }
  config.databases.push(uri);
  await writeConfig(config);
  return true;
}

export async function removeDatabase(uri) {
  const config = await readConfig();
  const index = config.databases.indexOf(uri);
  if (index === -1) {
    return false;
  }
  config.databases.splice(index, 1);
  await writeConfig(config);
  return true;
}
