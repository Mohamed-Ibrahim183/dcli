import { execSync } from 'node:child_process';

export const VALID_SCHEDULES = new Set(['ONLOGON', 'DAILY', 'HOURLY', 'ONCE']);

/** Escape double quotes for schtasks /tr and /tn argument values. */
export function escapeSchtasksQuotes(value) {
  return value.replace(/"/g, '""');
}

export function requireWindows(commandName = 'This command') {
  if (process.platform !== 'win32') {
    const err = new Error(`${commandName} uses Windows Task Scheduler (schtasks) and is only supported on Windows.`);
    err.code = 'UNSUPPORTED_PLATFORM';
    throw err;
  }
}

export function buildSchtasksCreate(taskName, schedule, { at, every, delay }, runCommand) {
  const sch = schedule.toUpperCase();
  const parts = [`schtasks /create`, `/tn "${taskName}"`, `/f`];

  switch (sch) {
    case 'DAILY': {
      parts.push(`/sc DAILY`, `/st ${at || '09:00'}`);
      break;
    }
    case 'HOURLY': {
      parts.push(`/sc HOURLY`, `/mo ${every || '1'}`);
      break;
    }
    case 'ONCE': {
      parts.push(`/sc ONCE`, `/st ${at || '09:00'}`);
      break;
    }
    default: {
      const delayMinutes = Math.max(1, parseInt(delay, 10) || 5);
      parts.push(`/sc ONLOGON`, `/delay ${String(delayMinutes).padStart(4, '0')}:00`);
      break;
    }
  }

  parts.push(`/tr "${escapeSchtasksQuotes(runCommand)}"`);
  return parts.join(' ');
}

export function createScheduledTask(taskName, schedule, scheduleOptions, runCommand) {
  const cmd = buildSchtasksCreate(taskName, schedule, scheduleOptions, runCommand);
  execSync(cmd, { stdio: 'pipe' });
}

export function removeScheduledTask(taskName) {
  execSync(`schtasks /delete /tn "${taskName}" /f`, { stdio: 'pipe' });
}

export function queryScheduledTask(taskName) {
  try {
    const out = execSync(`schtasks /query /tn "${taskName}" /v /fo csv`, { stdio: 'pipe', encoding: 'utf-8' });
    const lines = out.split('\n').filter(Boolean);
    const header = lines[0]?.split(',') || [];
    const values = lines[1]?.split(',') || [];
    const idx = (name) => header.findIndex((h) => h.replace(/"/g, '').trim() === name);
    const get = (name) => (values[idx(name)] || '').replace(/"/g, '').trim();
    return {
      scheduled: true,
      scheduleType: get('Schedule Type') || get('Task To Run'),
      startTime: get('Start Time'),
      repeatInterval: get('Repeat: Every'),
      taskToRun: get('Task To Run'),
    };
  } catch {
    return { scheduled: false };
  }
}

export function scheduleMessage(schedule, { at, every, delay }, actionLabel) {
  const messages = {
    DAILY: `It will run ${actionLabel} daily at ${at || '09:00'}.`,
    HOURLY: `It will run ${actionLabel} every ${every || '1'} hour(s).`,
    ONCE: `It will run ${actionLabel} once at ${at || '09:00'}.`,
    ONLOGON: `It will run ${actionLabel} ${delay || '5'} minute(s) after you log on.`,
  };
  return messages[schedule] || messages.ONLOGON;
}
