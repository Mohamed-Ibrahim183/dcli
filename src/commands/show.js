import { readConfig } from '../utils/config.js';
import { readCloneConfig } from '../utils/cloneConfig.js';
import { info, warn, error, highlight } from '../utils/logger.js';

export async function showCommand(options) {
  const isClone = options.clone;
  const label = isClone ? 'Clone list' : 'Ping list';

  try {
    const config = isClone ? await readCloneConfig() : await readConfig();
    const path = isClone ? '~/.dcli/auto-clone.json' : '~/.dcli/refresh.json';
    const dbs = config.databases || [];

    highlight(`${label} (${path}):`);
    info(`Database entries: ${dbs.length}`);

    if (dbs.length === 0) {
      warn(`No databases in the ${label.toLowerCase()}.`);
      return;
    }

    for (const [i, entry] of dbs.entries()) {
      const num = String(i + 1).padStart(2, ' ');
      const { uri, name } = typeof entry === 'string' ? { uri: entry } : entry;
      console.log(`  ${num}. ${name ? `${name} ` : ''}${uri}`);
    }
  } catch (err) {
    error(`Failed to show ${label.toLowerCase()}: ${err.message}`);
    process.exit(1);
  }
}
