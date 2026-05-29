import { connect, pingDatabase, extractDbName } from '../utils/mongodb.js';
import { readConfig, normalizeEntry } from '../utils/config.js';
import { info, success, warn, error } from '../utils/logger.js';

async function pingUri(uri) {
  try {
    const client = await connect(uri);
    await pingDatabase(client);
    await client.close();
    return true;
  } catch (err) {
    error(`Ping error: ${err.message}`);
    return false;
  }
}

function displayName(entry) {
  return entry.name || extractDbName(entry.uri) || entry.uri;
}

export async function pingCommand(uri, options) {
  let entries;

  if (uri) {
    const config = await readConfig();
    const named = config.databases.find(e => e.name === uri);
    entries = named ? [named] : [{ uri }];
  } else if (options.file) {
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(options.file, 'utf-8');
      const parsed = JSON.parse(content);
      entries = (parsed.databases || []).map(normalizeEntry);
    } catch (err) {
      error(`Failed to read file ${options.file}: ${err.message}`);
      process.exit(1);
    }
  } else {
    const config = await readConfig();
    entries = config.databases;
  }

  if (entries.length === 0) {
    warn('No databases configured for ping. Use "dcli add <uri>" to add one.');
    process.exit(0);
  }

  info(`Pinging ${entries.length} database(s)...`);

  for (const entry of entries) {
    const label = displayName(entry);
    const ok = await pingUri(entry.uri);
    if (ok) {
      success(`Pinged ${label} successfully`);
    } else {
      error(`Failed to ping ${label}`);
    }
  }
}
