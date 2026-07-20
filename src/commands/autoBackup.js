import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readCloneConfig } from '../utils/cloneConfig.js';
import { readBackupConfig, writeBackupConfig, DEFAULT_BACKUP_DIR } from '../utils/backupConfig.js';
import {
  requireWindows,
  createScheduledTask,
  removeScheduledTask,
  queryScheduledTask,
  scheduleMessage,
  VALID_SCHEDULES,
} from '../utils/schedule.js';
import { success, error, info, warn } from '../utils/logger.js';

const TASK_NAME = 'DCLI-AutoBackup';

function escapeForSchtasks(path) {
  return path.replace(/"/g, '""');
}

function buildRunCommand(outputDir) {
  const out = escapeForSchtasks(outputDir);
  return `cmd /c dcli auto-clone -o "${out}" --dated`;
}

export async function autoBackupCommand(options) {
  try {
    requireWindows('auto-backup');
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  if (options.remove) {
    try {
      removeScheduledTask(TASK_NAME);
      success(`Task "${TASK_NAME}" removed.`);
    } catch {
      error('Failed to remove task. It may not exist or you need administrator privileges.');
      process.exit(1);
    }
    return;
  }

  if (options.status) {
    const config = await readBackupConfig();
    const task = queryScheduledTask(TASK_NAME);
    const cloneConfig = await readCloneConfig();
    info(`Backup output: ${config.output}`);
    const sched = config.schedule;
    let schedDetail = sched;
    if (sched === 'DAILY' || sched === 'ONCE') schedDetail += ` at ${config.at}`;
    else if (sched === 'HOURLY') schedDetail += ` every ${config.every || '1'} hour(s)`;
    else if (sched === 'ONLOGON') schedDetail += ` ${config.delay || '5'} min after logon`;
    info(`Schedule: ${schedDetail}`);
    info(`Databases in clone list: ${cloneConfig.databases.length}`);
    info(`Task scheduled: ${task.scheduled ? 'yes' : 'no'}`);
    if (task.scheduled && task.startTime) info(`Next run time: ${task.startTime}`);
    return;
  }

  try {
    const saved = await readBackupConfig();
    const schedule = (options.schedule || saved.schedule || 'DAILY').toUpperCase();
    if (!VALID_SCHEDULES.has(schedule)) {
      error(`Invalid schedule "${options.schedule}". Use: ONLOGON, DAILY, HOURLY, or ONCE.`);
      process.exit(1);
    }

    const at = options.at || saved.at || '02:00';
    const every = options.every ?? saved.every;
    const delay = options.delay ?? saved.delay;
    const outputDir = resolve(options.output || saved.output || DEFAULT_BACKUP_DIR);
    await mkdir(outputDir, { recursive: true });

    const cloneConfig = await readCloneConfig();
    if (cloneConfig.databases.length === 0) {
      warn('No databases in the clone list yet. Add some with: dcli clone-add "mongodb://..." -n dbName');
    }

    await writeBackupConfig({ output: outputDir, at, schedule, every, delay });

    const runCommand = buildRunCommand(outputDir);
    createScheduledTask(TASK_NAME, schedule, {
      at,
      every,
      delay,
    }, runCommand);

    success(`Task "${TASK_NAME}" created successfully.`);
    info(scheduleMessage(schedule, { at, every, delay }, '"dcli auto-clone"'));
    info(`Backups save to: ${outputDir}\\YYYY-MM-DD\\`);
    info(`Uses databases from ~/.dcli/auto-clone.json (${cloneConfig.databases.length} configured).`);
  } catch (err) {
    error(`Failed to create task: ${err.message.includes('Access is denied') ? 'Please run as Administrator (right-click terminal \u2192 Run as administrator).' : err.message}`);
    process.exit(1);
  }
}

export { TASK_NAME, buildRunCommand, queryScheduledTask as queryAutoBackupTask };
