import { readFile, writeFile, readdir } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { join, parse } from 'node:path';
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { connect, exportDatabase, dropDatabase, importDatabase, extractDbName, serializeJson, parseJson } from '../utils/mongodb.js';
import { resolveName } from '../utils/resolve.js';
import { info, warn, success, error } from '../utils/logger.js';

function askQuestion(query) {
  const rl = createInterface({ input, output });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function isFullFormat(data) {
  return data && typeof data === 'object' && 'database' in data && 'data' in data;
}

async function loadCollectionFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const data = parseJson(content);
  const name = parse(filePath).name;
  if (isFullFormat(data)) {
    return { name, data: data.data };
  }
  if (!Array.isArray(data)) {
    throw new Error(`Collection file must be a JSON array of documents: ${filePath}`);
  }
  return { name, data: { [name]: data } };
}

async function loadDirectory(dirPath) {
  const entries = await readdir(dirPath);
  const jsonFiles = entries.filter(e => e.endsWith('.json')).sort();
  const result = {};
  for (const file of jsonFiles) {
    const { data } = await loadCollectionFile(join(dirPath, file));
    Object.assign(result, data);
  }
  return result;
}

export async function importCommand(uri, options) {
  uri = await resolveName(uri);
  const filePath = options.file;

  let client;
  try {
    const isDir = statSync(filePath).isDirectory();
    let dataToRestore;
    let restoreType;

    if (isDir) {
      dataToRestore = await loadDirectory(filePath);
      restoreType = 'directory';
    } else {
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseJson(content);
      if (isFullFormat(parsed)) {
        dataToRestore = parsed.data;
        restoreType = 'full';
      } else {
        if (!Array.isArray(parsed)) {
          throw new Error('Collection file must be a JSON array of documents, or a full export with database/data fields.');
        }
        const name = parse(filePath).name;
        dataToRestore = { [name]: parsed };
        restoreType = 'collection';
      }
    }

    const collectionCount = Object.keys(dataToRestore).length;

    if (restoreType === 'full') {
      const backupName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      warn('This operation will DELETE the current database and restore from file.');
      info(`Source: ${filePath}`);
      info(`Backup will be saved to: ${backupName}`);
      const answer = await askQuestion('Are you sure you want to proceed? (yes/no): ');

      if (answer !== 'yes') {
        info('Restore cancelled.');
        return;
      }

      info('Creating backup of current database...');
      client = await connect(uri);
      const currentData = await exportDatabase(client);
      await writeFile(backupName, serializeJson({
        database: extractDbName(uri),
        exportedAt: new Date().toISOString(),
        data: currentData,
      }), 'utf-8');
      success(`Backup saved to ${backupName}`);

      info('Dropping current database...');
      await dropDatabase(client);
      success('Database dropped.');

      info('Restoring data...');
      await importDatabase(client, dataToRestore);
      success('Database restored successfully.');
    } else {
      warn(`This will REPLACE ${collectionCount} collection(s) from: ${filePath}`);
      const answer = await askQuestion('Are you sure you want to proceed? (yes/no): ');

      if (answer !== 'yes') {
        info('Restore cancelled.');
        return;
      }

      info('Restoring data...');
      client = await connect(uri);
      await importDatabase(client, dataToRestore, { replace: true });
      success(`${collectionCount} collection(s) restored successfully.`);
    }
  } catch (err) {
    error(`Failed to restore data: ${err.message}`);
    process.exit(1);
  } finally {
    if (client) await client.close().catch(() => {});
  }
}
