import { removeDatabase } from '../utils/config.js';
import { success, warn, error } from '../utils/logger.js';

export async function removeCommand(uri) {
  try {
    const removed = await removeDatabase(uri);
    if (removed) {
      success(`Database removed from refresh list.`);
    } else {
      warn(`Database not found in the refresh list.`);
    }
  } catch (err) {
    error(`Failed to remove database: ${err.message}`);
    process.exit(1);
  }
}
