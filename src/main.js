import { Command } from 'commander';
import { cloneCommand } from './commands/clone.js';
import { restoreCommand } from './commands/restore.js';
import { refreshCommand } from './commands/refresh.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('dlib')
  .description('Database CLI - MongoDB data management tool')
  .version(packageJson.version);

program
  .command('clone')
  .description('Clone MongoDB data to a JSON file')
  .argument('<uri>', 'MongoDB connection URI')
  .option('-o, --output <file>', 'Output file name')
  .action(cloneCommand);

program
  .command('restore')
  .description('Restore data from a JSON file to MongoDB (with backup)')
  .argument('<uri>', 'MongoDB connection URI')
  .requiredOption('-f, --file <file>', 'Input JSON file to restore from')
  .action(restoreCommand);

program
  .command('refresh')
  .description('Auto-ping databases to prevent idle/inactivity pause')
  .option('--file <path>', 'Path to a JSON file with databases list')
  .action(refreshCommand);

program
  .command('add')
  .description('Add a database URI to the auto-refresh list')
  .argument('<uri>', 'MongoDB connection URI')
  .action(addCommand);

program
  .command('remove')
  .description('Remove a database URI from the auto-refresh list')
  .argument('<uri>', 'MongoDB connection URI')
  .action(removeCommand);

program.parse();
