import { addDatabase } from '../utils/config.js';
import { success, warn, error } from '../utils/logger.js';

export async function addCommand(uri, options) {
  try {
    const name = options.name;
    const result = await addDatabase(uri, name);
    const label = name ? `${name} (${uri})` : uri;
    if (result === 'added') {
      success(`Database added to ping list: ${label}`);
    } else if (result === 'updated') {
      success(`Name updated to "${name}" for ${uri}`);
    } else {
      warn(result === 'exists' && name ? `Database already exists${name ? ' with a different name' : ''}.` : `Database is already in the ping list.`);
    }
  } catch (err) {
    error(`Failed to add database: ${err.message}`);
    process.exit(1);
  }
}
