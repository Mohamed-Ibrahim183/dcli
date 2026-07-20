import { execSync } from 'node:child_process';
import { success, error, info } from '../utils/logger.js';
import {
  requireWindows,
  createScheduledTask,
  removeScheduledTask,
  scheduleMessage,
  VALID_SCHEDULES,
} from '../utils/schedule.js';

const taskName = 'DCLI-AutoPing';

export async function autoPingCommand(options) {
  try {
    requireWindows('auto-ping');
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  if (options.remove) {
    try {
      removeScheduledTask(taskName);
      success(`Task "${taskName}" removed.`);
    } catch {
      error(`Failed to remove task. It may not exist or you need administrator privileges.`);
      process.exit(1);
    }
    return;
  }

  try {
    const schedule = (options.schedule || 'ONLOGON').toUpperCase();
    if (!VALID_SCHEDULES.has(schedule)) {
      error(`Invalid schedule "${options.schedule}". Use: ONLOGON, DAILY, HOURLY, or ONCE.`);
      process.exit(1);
    }

    const at = options.at;
    const every = options.every;
    const delay = options.delay || '5';

    createScheduledTask(taskName, schedule, { at, every, delay }, 'cmd /c dcli ping');

    success(`Task "${taskName}" created successfully.`);
    info(scheduleMessage(schedule, { at, every, delay }, '"dcli ping"'));
  } catch (err) {
    error(`Failed to create task: ${err.message.includes('Access is denied') ? 'Please run as Administrator (right-click terminal \u2192 Run as administrator).' : err.message}`);
    process.exit(1);
  }
}
