const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const GRAY = '\x1b[90m';

const COMMANDS = [
  {
    name: 'export',
    args: '<uri>',
    desc: 'Export a MongoDB database to JSON file(s)',
    options: [
      ['-o, --output <name>', 'Output name (default: data-<timestamp>-<db>)'],
      ['--format <type>', 'Output format: file, split, all (default: file)'],
      ['--compact', 'Minify JSON output (default is prettified)'],
      ['--include <col...>', 'Only export these collections'],
      ['--exclude <col...>', 'Skip these collections'],
      ['--dry-run', 'Preview export without writing files'],
    ],
    examples: [
      '$ dcli export "mongodb://localhost:27017/mydb"',
      '$ dcli export "mongodb://localhost:27017/mydb" -o mydata',
      '$ dcli export "mongodb://localhost:27017/mydb" --format split',
      '$ dcli export "mongodb://localhost:27017/mydb" --format all',
      '$ dcli export "mongodb://localhost:27017/mydb" --include users posts',
      '$ dcli export "mongodb://localhost:27017/mydb" --exclude logs analytics',
      '$ dcli export "mongodb://localhost:27017/mydb" --dry-run',
    ],
  },
  {
    name: 'import',
    args: '<uri>',
    desc: 'Import a database or collection(s) from JSON file(s)',
    options: [
      ['-f, --file <path>', 'File (.json), collection file, or directory of .json files (required)'],
    ],
    examples: [
      '$ dcli import "mongodb://localhost:27017/mydb" -f backup.json',
      '$ dcli import "mongodb://localhost:27017/mydb" -f ./users.json',
      '$ dcli import "mongodb://localhost:27017/mydb" -f ./collections/',
    ],
  },
  {
    name: 'ping',
    args: '[uri]',
    desc: 'Ping databases to prevent idle/inactivity pause',
    options: [
      ['--file <path>', 'Path to a JSON file with database URIs (default: ~/.dcli/refresh.json)'],
    ],
    examples: [
      '$ dcli ping',
      '$ dcli ping "mongodb://localhost:27017/mydb"',
      '$ dcli ping --file my-dbs.json',
    ],
  },
  {
    name: 'info',
    args: '<uri>',
    desc: 'Show database collections and document counts',
    options: [],
    examples: [
      '$ dcli info "mongodb://localhost:27017/mydb"',
    ],
  },
  {
    name: 'add',
    args: '<uri>',
    desc: 'Add a database URI to the auto-ping list',
    options: [
      ['-n, --name <name>', 'Friendly name for this database'],
    ],
    examples: [
      '$ dcli add "mongodb://user:pass@cluster.mongodb.net/mydb"',
      '$ dcli add "mongodb://..." -n dbName',
    ],
  },
  {
    name: 'remove',
    args: '<uri|name>',
    desc: 'Remove a database by URI or friendly name from the ping list',
    options: [],
    examples: [
      '$ dcli remove "mongodb://user:pass@cluster.mongodb.net/mydb"',
      '$ dcli remove dbName',
    ],
  },
  {
    name: 'auto-ping',
    args: '',
    desc: 'Schedule "dcli ping" to run on logon (may need admin)',
    options: [
      ['--remove', 'Remove the scheduled task'],
    ],
    examples: [
      '$ dcli auto-ping',
      '$ dcli auto-ping --remove',
    ],
  },
  {
    name: 'help',
    args: '[command]',
    desc: 'Display help for a specific command',
    options: [],
    examples: [],
  },
];

function label(text) {
  return `${BOLD}${text}${RESET}`;
}

function cmdName(text) {
  return `${YELLOW}${BOLD}${text}${RESET}`;
}

function optFlag(text) {
  return `${GREEN}${text}${RESET}`;
}

function exText(text) {
  return `${GRAY}${text}${RESET}`;
}

function highlight(text) {
  return `${CYAN}${text}${RESET}`;
}

function dimmed(text) {
  return `${DIM}${BLUE}${text}${RESET}`;
}

export function colorizeDefaultHelp(text) {
  const lines = text.split('\n');
  const result = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (/^Usage:/.test(trimmed)) {
      result.push(`${BOLD}${trimmed}${RESET}`);
    } else if (/^(Arguments|Options):$/.test(trimmed)) {
      result.push(`${BOLD}${trimmed}${RESET}`);
    } else if (/^\s{2}-h, --help\s/.test(trimmed)) {
      result.push(`${DIM}${trimmed}${RESET}`);
    } else if (/^\s{2}(-\S, )?--/.test(trimmed) && !/^Usage/.test(trimmed)) {
      const sep = trimmed.slice(2).search(/\s{2,}/);
      if (sep > -1) {
        const flag = trimmed.slice(0, sep + 2);
        const desc = trimmed.slice(sep + 2);
        result.push(`  ${GREEN}${flag.trim()}${RESET}  ${desc}`);
      } else {
        result.push(`  ${GREEN}${trimmed.trim()}${RESET}`);
      }
    } else {
      result.push(trimmed);
    }
  }

  return result.join('\n');
}

export function generateHelp() {
  const lines = [];
  lines.push('');
  lines.push(`  ${highlight('dcli')} ${DIM}— Database CLI / MongoDB data management tool${RESET}`);
  lines.push('');
  lines.push(`  ${label('Usage:')} dcli <command> [options]`);
  lines.push('');
  lines.push(`  ${label('Commands:')}`);
  lines.push('');

  for (const cmd of COMMANDS) {
    const hasOpts = cmd.options.length > 0;
    let display;
    if (hasOpts) {
      const a = cmd.args ? ` ${cmd.args}` : '';
      display = `${cmdName(cmd.name)}${a} [options]`;
    } else if (cmd.args) {
      display = `${cmdName(cmd.name)} ${cmd.args}`;
    } else {
      display = cmdName(cmd.name);
    }

    const prefix = `    ${display}`;
    const strippedLen = prefix.replace(/\x1b\[[0-9;]*m/g, '').length;
    const visualPad = strippedLen < 34 ? 34 - strippedLen : 2;
    lines.push(`${prefix}${' '.repeat(visualPad)}${cmd.desc}`);

    if (hasOpts) {
      lines.push(`      ${label('Options:')}`);
      for (const [flag, desc] of cmd.options) {
        const f = optFlag(`      ${flag}`);
        const fLen = `      ${flag}`.replace(/\x1b\[[0-9;]*m/g, '').length;
        const pad = fLen < 32 ? 32 - fLen : 2;
        lines.push(`${f}${' '.repeat(pad)}${desc}`);
      }
    }

    if (cmd.examples.length) {
      lines.push(`      ${label('Examples:')}`);
      for (const ex of cmd.examples) {
        lines.push(`        ${exText(ex)}`);
      }
    }

    lines.push('');
  }

  lines.push(`  ${dimmed('Config file: ~/.dcli/refresh.json')}`);
  lines.push(`  ${dimmed('Repository: https://github.com/Mohamed-Ibrahim183/dcli')}`);
  lines.push('');

  return lines.join('\n');
}
