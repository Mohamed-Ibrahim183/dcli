import { readConfig } from './config.js';
import { readCloneConfig } from './cloneConfig.js';

export async function resolveName(input) {
  const config = await readConfig();
  const entry = config.databases.find(e => e.name === input);
  if (entry) return entry.uri;

  const cloneConfig = await readCloneConfig();
  const cloneEntry = cloneConfig.databases.find(e => e.name === input);
  if (cloneEntry) return cloneEntry.uri;

  return input;
}
