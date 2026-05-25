import { connect, pingDatabase, extractDbName } from '../utils/mongodb.js';
import { readConfig } from '../utils/config.js';
import { info, success, warn, error } from '../utils/logger.js';

const PING_INTERVAL_MS = 5 * 60 * 1000;

async function pingUri(uri) {
  try {
    const client = await connect(uri);
    await pingDatabase(client);
    await client.close();
    return true;
  } catch {
    return false;
  }
}

export async function refreshCommand(options) {
  let uris;

  if (options.file) {
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(options.file, 'utf-8');
      const parsed = JSON.parse(content);
      uris = parsed.databases || [];
    } catch (err) {
      error(`Failed to read file ${options.file}: ${err.message}`);
      process.exit(1);
    }
  } else {
    const config = await readConfig();
    uris = config.databases;
  }

  if (uris.length === 0) {
    warn('No databases configured for refresh. Use "dlib add <uri>" to add one.');
    process.exit(0);
  }

  info(`Starting auto-refresh for ${uris.length} database(s) (every ${PING_INTERVAL_MS / 60000} minutes)...`);
  info('Press Ctrl+C to stop.\n');

  async function tick() {
    for (const uri of uris) {
      const dbName = extractDbName(uri);
      const ok = await pingUri(uri);
      if (ok) {
        success(`Pinged ${dbName} successfully`);
      } else {
        error(`Failed to ping ${dbName}`);
      }
    }
    console.log('');
  }

  await tick();
  setInterval(tick, PING_INTERVAL_MS);
}
