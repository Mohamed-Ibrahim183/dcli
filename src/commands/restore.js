import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { connect, exportDatabase, dropDatabase, importDatabase, extractDbName } from '../utils/mongodb.js';
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

export async function restoreCommand(uri, options) {
  const filePath = options.file;

  try {
    const backupName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    warn('This operation will DELETE the current database and restore from file.');
    info(`Source file: ${filePath}`);
    info(`A backup of the current data will be saved to: ${backupName}`);
    const answer = await askQuestion('Are you sure you want to proceed? (yes/no): ');

    if (answer !== 'yes') {
      info('Restore cancelled.');
      return;
    }

    info('Creating backup of current database...');
    const client = await connect(uri);
    const currentData = await exportDatabase(client);
    await writeFile(backupName, JSON.stringify({
      database: extractDbName(uri),
      exportedAt: new Date().toISOString(),
      data: currentData,
    }, null, 2), 'utf-8');
    success(`Backup saved to ${backupName}`);

    info('Dropping current database...');
    await dropDatabase(client);
    success('Database dropped.');

    info('Restoring data from file...');
    const fileContent = await readFile(filePath, 'utf-8');
    const { data } = JSON.parse(fileContent);
    await importDatabase(client, data);
    await client.close();

    success('Database restored successfully.');
  } catch (err) {
    error(`Failed to restore database: ${err.message}`);
    process.exit(1);
  }
}
