/** Find a config entry by friendly name, full URI, or database name in the URI path. */
export function findEntry(databases, input) {
  return databases.find((e) => {
    if (e.uri === input) return true;
    if (e.name === input) return true;
    try {
      const db = new URL(e.uri).pathname.replace(/^\//, '');
      return Boolean(db) && db === input;
    } catch {
      return false;
    }
  });
}
