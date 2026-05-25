import { removeDatabase } from '../utils/config.js';
import { success, warn, error } from '../utils/logger.js';

export async function removeCommand(target) {
  try {
    const removed = await removeDatabase(target);
    if (removed) {
      success(`Database removed from ping list.`);
    } else {
      warn(`No database found matching "${target}" in the ping list.`);
    }
  } catch (err) {
    error(`Failed to remove database: ${err.message}`);
    process.exit(1);
  }
}
