import { removeCloneDatabase } from '../utils/cloneConfig.js';
import { success, warn, error } from '../utils/logger.js';

export async function cloneRemoveCommand(target) {
  try {
    const removed = await removeCloneDatabase(target);
    if (removed) {
      success(`Database removed from clone list.`);
    } else {
      warn(`No database found matching "${target}" in the clone list.`);
    }
  } catch (err) {
    error(`Failed to remove database: ${err.message}`);
    process.exit(1);
  }
}
