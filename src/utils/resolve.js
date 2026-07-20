import { readConfig } from './config.js';
import { readCloneConfig } from './cloneConfig.js';
import { connect, listUserDatabases } from './mongodb.js';

/** True when the URI path already includes a database name. */
export function uriHasDatabase(uri) {
  try {
    return Boolean(new URL(uri).pathname.replace(/^\//, ''));
  } catch {
    return false;
  }
}

/**
 * If the URI has no database path, insert dbName into it.
 * Atlas-style URIs often omit the DB; the friendly name is used instead.
 */
export function withDatabase(uri, dbName) {
  if (!dbName || uriHasDatabase(uri)) return uri;
  try {
    const url = new URL(uri);
    url.pathname = `/${dbName}`;
    return url.href;
  } catch {
    return uri;
  }
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[-_]/g, '');
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Pick the best database name on a cluster for a friendly-name hint.
 * Order: exact → case-insensitive → normalized → prefix → fuzzy → single DB fallback.
 */
export function matchDatabaseName(hint, dbNames) {
  if (dbNames.length === 0) return null;
  if (!hint) return dbNames.length === 1 ? dbNames[0] : null;

  if (dbNames.includes(hint)) return hint;

  const lower = hint.toLowerCase();
  const ci = dbNames.find((d) => d.toLowerCase() === lower);
  if (ci) return ci;

  const normHint = normalizeName(hint);
  const normMatch = dbNames.find((d) => normalizeName(d) === normHint);
  if (normMatch) return normMatch;

  const prefix = dbNames.find((d) =>
    d.startsWith(hint) || hint.startsWith(d) ||
    normalizeName(d).startsWith(normHint) || normHint.startsWith(normalizeName(d))
  );
  if (prefix) return prefix;

  let best = null;
  let bestDist = Infinity;
  for (const d of dbNames) {
    const dist = levenshtein(normHint, normalizeName(d));
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  const threshold = Math.max(2, Math.floor(normHint.length * 0.3));
  if (best && bestDist <= threshold) return best;

  if (dbNames.length === 1) return dbNames[0];

  return null;
}

/** Build a usable URI from a config entry (injects friendly name as DB when needed). */
export function resolveEntryUri(entry, fallbackName) {
  const name = entry.name || fallbackName;
  return withDatabase(entry.uri, name);
}

async function discoverDatabaseUri(entry, hint) {
  if (uriHasDatabase(entry.uri)) return entry.uri;

  let client;
  try {
    client = await connect(entry.uri);
    const dbNames = await listUserDatabases(client);
    const matched = matchDatabaseName(hint, dbNames);
    if (!matched) {
      const available = dbNames.join(', ') || '(none)';
      if (!hint) {
        throw new Error(
          `URI has no database path and this entry has no name. ` +
          `Add a name with -n or include /dbname in the URI. ` +
          `Available on cluster: ${available}`
        );
      }
      throw new Error(
        `Could not find a database matching "${hint}" on the cluster. ` +
        `Available: ${available}`
      );
    }
    return withDatabase(entry.uri, matched);
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

function findEntry(databases, input) {
  return databases.find((e) => {
    if (e.name === input) return true;
    try {
      const db = new URL(e.uri).pathname.replace(/^\//, '');
      return Boolean(db) && db === input;
    } catch {
      return false;
    }
  });
}

/**
 * Resolve a friendly name or URI to a connection URI with a database selected.
 * Searches ~/.dcli/refresh.json then ~/.dcli/auto-clone.json.
 * When the stored URI has no database path, lists databases on the cluster and
 * picks the best match (exact, fuzzy, or the only database on the cluster).
 */
export async function resolveName(input) {
  const config = await readConfig();
  let entry = findEntry(config.databases, input);
  if (entry) return discoverDatabaseUri(entry, input);

  const cloneConfig = await readCloneConfig();
  entry = findEntry(cloneConfig.databases, input);
  if (entry) return discoverDatabaseUri(entry, input);

  if (/^mongodb(\+srv)?:\/\//i.test(input)) return input;

  throw new Error(
    `Database "${input}" not found in ping or clone lists ` +
    `(searched ~/.dcli/refresh.json and ~/.dcli/auto-clone.json). ` +
    `Add it with "dcli add <uri> -n ${input}" or pass a full MongoDB URI.`
  );
}

/** Resolve a config entry URI, including cluster database discovery. */
export async function resolveEntryUriAsync(entry, fallbackName) {
  const hint = entry.name || fallbackName;
  if (uriHasDatabase(entry.uri)) return entry.uri;
  return discoverDatabaseUri(entry, hint);
}
