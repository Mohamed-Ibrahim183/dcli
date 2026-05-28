import { Command } from 'commander';
import { exportCommand } from './commands/exportCmd.js';
import { importCommand } from './commands/importCmd.js';
import { pingCommand } from './commands/pingCmd.js';
import { infoCommand } from './commands/info.js';
import { addCommand } from './commands/add.js';
import { removeCommand } from './commands/remove.js';
import { autoPingCommand } from './commands/autoPing.js';
import { cloneAddCommand } from './commands/cloneAdd.js';
import { cloneRemoveCommand } from './commands/cloneRemove.js';
import { autoCloneCommand } from './commands/autoClone.js';
import { cloneCommand } from './commands/clone.js';
import { viewCommand } from './commands/view.js';
import { showCommand } from './commands/show.js';
import { guiCommand } from './commands/gui.js';
import { generateHelp, colorizeDefaultHelp } from './utils/help.js';
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
  .name('dcli')
  .description('Database CLI — MongoDB data management tool')
  .version(packageJson.version);

program
  .command('export')
  .description('Export a MongoDB database to JSON file(s)')
  .argument('<uri>', 'MongoDB connection URI or friendly name from config')
  .option('-o, --output <name>', 'Output name (default: data-<timestamp>-<db>)')
  .option('--format <type>', 'Output format: file, split, all (default: file)', 'file')
  .option('--compact', 'Minify JSON output (default is prettified)')
  .option('--include <collections...>', 'Only export these collections')
  .option('--exclude <collections...>', 'Skip these collections')
  .option('--dry-run', 'Preview export without writing files')
  .action(exportCommand);

program
  .command('import')
  .description('Import a database or collection(s) from JSON file(s)')
  .argument('<uri>', 'MongoDB connection URI or friendly name from config')
  .requiredOption('-f, --file <path>', 'File (.json), collection file, or directory of .json files')
  .action(importCommand);

program
  .command('ping')
  .description('Ping databases to prevent idle/inactivity pause')
  .argument('[uri]', 'URI or friendly name from config (optional, uses config if omitted)')
  .option('--file <path>', 'Path to a JSON file with database URIs (default: ~/.dcli/refresh.json)')
  .action(pingCommand);

program
  .command('info')
  .description('Show database collections and document counts')
  .argument('<uri>', 'MongoDB connection URI or friendly name from config')
  .action(infoCommand);

program
  .command('add')
  .description('Add a database URI to the auto-ping list')
  .argument('<uri>', 'MongoDB connection URI')
  .option('-n, --name <name>', 'Friendly name for this database')
  .action(addCommand);

program
  .command('remove')
  .description('Remove a database by URI or friendly name from the ping list')
  .argument('<uri>', 'URI or friendly name of the database')
  .action(removeCommand);

program
  .command('auto-ping')
  .description('Schedule "dcli ping" to run automatically (customizable)')
  .option('--remove', 'Remove the scheduled task')
  .option('--schedule <type>', 'Schedule type: ONLOGON, DAILY, HOURLY, ONCE (default: ONLOGON)')
  .option('--at <time>', 'Time for DAILY/ONCE schedules (24h format, e.g. 09:00)')
  .option('--every <n>', 'Interval in hours for HOURLY schedule (default: 1)')
  .option('--delay <n>', 'Delay in minutes for ONLOGON schedule (default: 5)')
  .action(autoPingCommand);

program
  .command('clone-add')
  .description('Add a database URI to the auto-clone list')
  .argument('<uri>', 'MongoDB connection URI')
  .option('-n, --name <name>', 'Friendly name for this database')
  .action(cloneAddCommand);

program
  .command('clone-remove')
  .description('Remove a database by URI or friendly name from the clone list')
  .argument('<uri>', 'URI or friendly name of the database')
  .action(cloneRemoveCommand);

program
  .command('clone')
  .description('Clone a database by its friendly name from the clone list')
  .argument('<name>', 'Friendly name or URI of the database in the clone list')
  .option('-o, --output <dir>', 'Output directory (default: current directory)')
  .action(cloneCommand);

program
  .command('auto-clone')
  .description('Clone all databases in the clone list to JSON files')
  .option('-o, --output <dir>', 'Output directory (default: current directory)')
  .action(autoCloneCommand);

program
  .command('view')
  .description('Browse collections and documents in a styled table')
  .argument('<uri>', 'MongoDB connection URI or friendly name from config')
  .argument('[collection]', 'Collection to query (lists collections if omitted)')
  .option('--limit <n>', 'Maximum documents to show (default: 10)', '10')
  .option('--fields <fields>', 'Comma-separated list of fields to display')
  .option('--sort <field>', 'Sort by field (ascending)')
  .option('--all', 'Show all documents (no limit)')
  .option('--json', 'Output raw JSON instead of a table')
  .action(viewCommand);

program
  .command('show')
  .description('Show the auto-ping or auto-clone database list')
  .option('--clone', 'Show the auto-clone list instead of the ping list')
  .action(showCommand);

program
  .command('gui')
  .description('Open the dcli graphical interface in your browser')
  .option('-p, --port <number>', 'Port to run the GUI on (default: 3456)', '3456')
  .action(guiCommand);

program.helpInformation = generateHelp;

const origHelpInfo = Command.prototype.helpInformation;
for (const cmd of program.commands) {
  const orig = origHelpInfo.bind(cmd);
  cmd.helpInformation = () => colorizeDefaultHelp(orig());
}

program.parse();
