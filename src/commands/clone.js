import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { connect, exportDatabase, extractDbName, serializeJson } from '../utils/mongodb.js';
import { readCloneConfig } from '../utils/cloneConfig.js';
import { success, error, info, highlight } from '../utils/logger.js';

export async function cloneCommand(name, options) {
  let client;
  try {
    const config = await readCloneConfig();
    const entry = config.databases.find(e => (e.name && e.name === name) || e.uri === name);

    if (!entry) {
      error(`Database "${name}" not found in clone list.`);
      info('Use "dcli clone-add <uri> -n <name>" to add it first.');
      process.exit(1);
    }

    const uri = entry.uri;
    const label = entry.name || uri;

    const outputDir = options.output || process.cwd();
    await mkdir(outputDir, { recursive: true });

    highlight(`Cloning: ${label}`);
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
  } catch (err) {
    error(`Clone failed: ${err.message}`);
    process.exit(1);
  } finally {
    if (client) await client.close().catch(() => {});
  }
}
