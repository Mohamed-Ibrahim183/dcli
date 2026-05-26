import { addCloneDatabase } from '../utils/cloneConfig.js';
import { success, warn, error } from '../utils/logger.js';

export async function cloneAddCommand(uri, options) {
  try {
    const name = options.name;
    const result = await addCloneDatabase(uri, name);
    const label = name ? `${name} (${uri})` : uri;
    if (result === 'added') {
      success(`Database added to clone list: ${label}`);
    } else if (result === 'updated') {
      success(`Name updated to "${name}" for ${uri}`);
    } else {
      warn(`Database is already in the clone list.`);
    }
  } catch (err) {
    error(`Failed to add database: ${err.message}`);
    process.exit(1);
  }
}
