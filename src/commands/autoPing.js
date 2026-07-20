import { execSync } from 'node:child_process';
import { success, error, info } from '../utils/logger.js';

const taskName = 'DCLI-AutoPing';
const VALID_SCHEDULES = new Set(['ONLOGON', 'DAILY', 'HOURLY', 'ONCE']);

function requireWindows() {
  if (process.platform !== 'win32') {
    error('auto-ping uses Windows Task Scheduler (schtasks) and is only supported on Windows.');
    process.exit(1);
  }
}

export async function autoPingCommand(options) {
  requireWindows();

  if (options.remove) {
    try {
      execSync(`schtasks /delete /tn "${taskName}" /f`, { stdio: 'pipe' });
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

    let parts = [`schtasks /create`, `/tn "${taskName}"`, `/f`];

    switch (schedule) {
      case 'DAILY': {
        const time = at || '09:00';
        parts.push(`/sc DAILY`, `/st ${time}`);
        break;
      }
      case 'HOURLY': {
        const interval = every || '1';
        parts.push(`/sc HOURLY`, `/mo ${interval}`);
        break;
      }
      case 'ONCE': {
        const time = at || '09:00';
        parts.push(`/sc ONCE`, `/st ${time}`);
        break;
      }
      default: {
        const delayMinutes = Math.max(1, parseInt(delay, 10) || 5);
        parts.push(`/sc ONLOGON`, `/delay ${String(delayMinutes).padStart(4, '0')}:00`);
        break;
      }
    }

    parts.push(`/tr "cmd /c dcli ping"`);
    const createCmd = parts.join(' ');

    execSync(createCmd, { stdio: 'pipe' });

    const messages = {
      DAILY: `It will run "dcli ping" daily at ${at || '09:00'}.`,
      HOURLY: `It will run "dcli ping" every ${every || '1'} hour(s).`,
      ONCE: `It will run "dcli ping" once at ${at || '09:00'}.`,
      ONLOGON: `It will run "dcli ping" ${delay} minute(s) after you log on.`,
    };

    success(`Task "${taskName}" created successfully.`);
    info(messages[schedule]);
  } catch (err) {
    error(`Failed to create task: ${err.message.includes('Access is denied') ? 'Please run as Administrator (right-click terminal \u2192 Run as administrator).' : err.message}`);
    process.exit(1);
  }
}
