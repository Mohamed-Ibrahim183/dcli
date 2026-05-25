import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connect, exportDatabase, extractDbName } from '../utils/mongodb.js';
import { success, error } from '../utils/logger.js';

export async function cloneCommand(uri, options) {
  const dbName = extractDbName(uri);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = options.output || `data-${timestamp}-${dbName}.json`;

  try {
    const client = await connect(uri);
    const data = await exportDatabase(client);
    await client.close();

    const exportData = {
      database: dbName,
      exportedAt: new Date().toISOString(),
      data,
    };

    await writeFile(fileName, JSON.stringify(exportData, null, 2), 'utf-8');
    success(`Data exported to ${fileName}`);
  } catch (err) {
    error(`Failed to clone database: ${err.message}`);
    process.exit(1);
  }
}
