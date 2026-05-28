import { writeFile, mkdir, access } from 'node:fs/promises';
import { join, extname, dirname, basename } from 'node:path';
import { constants } from 'node:fs';
import { connect, exportDatabase, extractDbName } from '../utils/mongodb.js';
import { resolveName } from '../utils/resolve.js';
import { success, error, info, highlight } from '../utils/logger.js';

function ensureJsonExt(name) {
  return extname(name) ? name : `${name}.json`;
}

function filterCollections(data, include, exclude) {
  const entries = Object.entries(data);
  let filtered = entries;

  if (include && include.length > 0) {
    const set = new Set(include);
    filtered = filtered.filter(([name]) => set.has(name));
  }

  if (exclude && exclude.length > 0) {
    const set = new Set(exclude);
    filtered = filtered.filter(([name]) => !set.has(name));
  }

  return Object.fromEntries(filtered);
}

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function getUniquePath(filePath) {
  if (!(await exists(filePath))) return filePath;

  const dir = dirname(filePath);
  const ext = extname(filePath);
  const base = basename(filePath, ext);

  let counter = 1;
  while (true) {
    const candidate = join(dir, `${base} (${counter})${ext}`);
    if (!(await exists(candidate))) return candidate;
    counter++;
  }
}

export async function exportCommand(uri, options) {
  uri = await resolveName(uri);
  const dbName = extractDbName(uri);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputName = options.output || `data-${timestamp}-${dbName}`;
  const format = options.format || 'file';
  const compact = options.compact ? 0 : 2;
  const include = options.include ? (Array.isArray(options.include) ? options.include : [options.include]) : [];
  const exclude = options.exclude ? (Array.isArray(options.exclude) ? options.exclude : [options.exclude]) : [];

  try {
    const client = await connect(uri);
    const rawData = await exportDatabase(client);
    await client.close();

    const data = filterCollections(rawData, include, exclude);

    if (Object.keys(data).length === 0) {
      info('No collections matched the given filters.');
      process.exit(0);
    }

    if (options.dryRun) {
      highlight('── Dry Run ──');
      info(`Database: ${dbName}`);
      info(`Collections: ${Object.keys(data).length}`);
      for (const [name, docs] of Object.entries(data)) {
        info(`  ${name}: ${docs.length} document(s)`);
      }
      info(`Format: ${format === 'all' ? 'file + split' : format}`);
      if (outputName) info(`Output: ${outputName}`);
      return;
    }

    if (format === 'file' || format === 'all') {
      const fileName = await getUniquePath(ensureJsonExt(outputName));
      const exportData = {
        database: dbName,
        exportedAt: new Date().toISOString(),
        data,
      };
      await writeFile(fileName, JSON.stringify(exportData, null, compact), 'utf-8');
      success(`Exported to ${fileName}`);
    }

    if (format === 'split' || format === 'all') {
      const dirName = extname(outputName) ? outputName.replace(/\.[^.]+$/, '') : outputName;
      await mkdir(dirName, { recursive: true });
      for (const [name, docs] of Object.entries(data)) {
        const filePath = await getUniquePath(join(dirName, `${name}.json`));
        await writeFile(filePath, JSON.stringify(docs, null, compact), 'utf-8');
      }
      success(`Exported ${Object.keys(data).length} collection(s) to ${dirName}/`);
    }
  } catch (err) {
    error(`Failed to export database: ${err.message}`);
    process.exit(1);
  }
}
