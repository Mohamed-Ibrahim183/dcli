import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { connect, exportDatabase, extractDbName, serializeJson } from '../utils/mongodb.js';
import { readCloneConfig } from '../utils/cloneConfig.js';
import { resolveEntryUriAsync } from '../utils/resolve.js';
import { success, error, info, highlight } from '../utils/logger.js';

function resolveOutputDir(options) {
  const base = options.output || process.cwd();
  if (!options.dated) return base;
  const date = new Date().toISOString().slice(0, 10);
  return join(base, date);
}

export async function autoCloneCommand(options) {
  try {
    const config = await readCloneConfig();
    const databases = config.databases;

    if (databases.length === 0) {
      info('No databases in the clone list. Add some with "dcli clone-add <uri>".');
      process.exit(0);
    }

    const outputDir = resolveOutputDir(options);
    await mkdir(outputDir, { recursive: true });

    highlight(`── Auto Clone: ${databases.length} database(s) ──`);
    if (options.dated) info(`Output folder: ${outputDir}`);

    let cloned = 0;
    let failed = 0;

    for (const entry of databases) {
      const label = entry.name || entry.uri;
      let client;
      try {
        info(`Cloning: ${label}`);
        const uri = await resolveEntryUriAsync(entry);
        client = await connect(uri);
        const dbName = extractDbName(uri);
        const data = await exportDatabase(client);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `clone-${timestamp}-${dbName}.json`;
        const filePath = join(outputDir, fileName);
        const exportData = {
          database: dbName,
          clonedAt: new Date().toISOString(),
          data,
        };
        await writeFile(filePath, serializeJson(exportData), 'utf-8');
        success(`Cloned ${label} → ${fileName} (${Object.keys(data).length} collections)`);
        cloned++;
      } catch (err) {
        error(`Failed to clone ${label}: ${err.message}`);
        failed++;
      } finally {
        if (client) await client.close().catch(() => {});
      }
    }

    highlight(`── Done: ${cloned} cloned, ${failed} failed ──`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    error(`Auto-clone failed: ${err.message}`);
    process.exit(1);
  }
}
