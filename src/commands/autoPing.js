import { execSync } from 'node:child_process';
import { success, error, info } from '../utils/logger.js';

const taskName = 'DCLI-AutoPing';

export async function autoPingCommand(options) {
  if (options.remove) {
    try {
      execSync(`schtasks /delete /tn "${taskName}" /f`, { stdio: 'pipe' });
      success(`Task "${taskName}" removed.`);
    } catch {
      error(`Failed to remove task. It may not exist or you need administrator privileges.`);
    }
    return;
  }

  try {
    const createCmd = [
      `schtasks /create`,
      `/tn "${taskName}"`,
      `/sc ONLOGON`,
      `/delay 0000:05`,
      `/tr "cmd /c dcli ping"`,
      `/f`,
    ].join(' ');

    execSync(createCmd, { stdio: 'pipe' });
    success(`Task "${taskName}" created successfully.`);
    info(`It will run "dcli ping" 5 minutes after you log on.`);
  } catch (err) {
    error(`Failed to create task: ${err.message.includes('Access is denied') ? 'Please run as Administrator (right-click terminal → Run as administrator).' : err.message}`);
    process.exit(1);
  }
}
