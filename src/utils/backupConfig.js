import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.dcli');
const CONFIG_PATH = join(CONFIG_DIR, 'auto-backup.json');

export const DEFAULT_BACKUP_DIR = join(CONFIG_DIR, 'backups');

export function defaultBackupConfig() {
  return {
    output: DEFAULT_BACKUP_DIR,
    at: '02:00',
    schedule: 'DAILY',
    every: '1',
    delay: '5',
  };
}

async function ensureConfigDir() {
  await mkdir(CONFIG_DIR, { recursive: true });
}

export async function readBackupConfig() {
  try {
    const data = await readFile(CONFIG_PATH, 'utf-8');
    return { ...defaultBackupConfig(), ...JSON.parse(data) };
  } catch {
    return defaultBackupConfig();
  }
}

export async function writeBackupConfig(config) {
  await ensureConfigDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
