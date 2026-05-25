import { addDatabase } from '../utils/config.js';
import { success, warn, error } from '../utils/logger.js';

export async function addCommand(uri) {
  try {
    const added = await addDatabase(uri);
    if (added) {
      success(`Database added to refresh list.`);
    } else {
      warn(`Database is already in the refresh list.`);
    }
  } catch (err) {
    error(`Failed to add database: ${err.message}`);
    process.exit(1);
  }
}
