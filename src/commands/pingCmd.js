import { connect, pingDatabase, extractDbName } from '../utils/mongodb.js';
import { readConfig, normalizeEntry } from '../utils/config.js';
import { resolveName, resolveEntryUriAsync } from '../utils/resolve.js';
import { info, success, warn, error } from '../utils/logger.js';

async function pingUri(uri) {
  let client;
  try {
    client = await connect(uri);
    await pingDatabase(client);
    return true;
  } catch (err) {
    error(`Ping error: ${err.message}`);
    return false;
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

function displayName(entry) {
  return entry.name || extractDbName(entry.uri) || entry.uri;
}

async function withResolvedUri(entry) {
  return { ...entry, uri: await resolveEntryUriAsync(entry) };
}

export async function pingCommand(uri, options) {
  let entries;

  if (uri) {
    const resolved = await resolveName(uri);
    const label = /^mongodb(\+srv)?:\/\//i.test(uri) ? undefined : uri;
    entries = [{ uri: resolved, name: label }];
  } else if (options.file) {
    try {
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(options.file, 'utf-8');
      const parsed = JSON.parse(content);
      entries = await Promise.all((parsed.databases || []).map(normalizeEntry).map(withResolvedUri));
    } catch (err) {
      error(`Failed to read file ${options.file}: ${err.message}`);
      process.exit(1);
    }
  } else {
    const config = await readConfig();
    entries = await Promise.all(config.databases.map(withResolvedUri));
  }

  if (entries.length === 0) {
    warn('No databases configured for ping. Use "dcli add <uri>" to add one.');
    process.exit(0);
  }

  info(`Pinging ${entries.length} database(s)...`);

  let failed = 0;
  for (const entry of entries) {
    const label = displayName(entry);
    const ok = await pingUri(entry.uri);
    if (ok) {
      success(`Pinged ${label} successfully`);
    } else {
      error(`Failed to ping ${label}`);
      failed++;
    }
  }

  if (failed > 0) process.exit(1);
}
