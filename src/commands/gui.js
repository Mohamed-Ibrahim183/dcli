import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { writeFile, readFile, mkdir, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, parse, basename, resolve as resolvePath } from 'node:path';
import { execSync } from 'node:child_process';
import { connect, exportDatabase, importDatabase, dropDatabase, extractDbName, pingDatabase, serializeJson, parseJson } from '../utils/mongodb.js';
import { readConfig, addDatabase, removeDatabase } from '../utils/config.js';
import { readCloneConfig, addCloneDatabase, removeCloneDatabase } from '../utils/cloneConfig.js';
import { resolveName, resolveEntryUriAsync } from '../utils/resolve.js';
import { readBackupConfig, writeBackupConfig, DEFAULT_BACKUP_DIR } from '../utils/backupConfig.js';
import { createScheduledTask, removeScheduledTask, queryScheduledTask, scheduleMessage, VALID_SCHEDULES } from '../utils/schedule.js';
import { TASK_NAME as AUTO_BACKUP_TASK, buildRunCommand } from './autoBackup.js';
import { info, success, error } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GUI_DIR = join(__dirname, '..', 'gui');
const HTML_PATH = join(GUI_DIR, 'index.html');
const MAX_BODY_BYTES = 10 * 1024 * 1024;

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
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

function ensureJsonExt(name) {
  return extname(name) ? name : `${name}.json`;
}

async function handleApi(req, res) {
  const method = req.method;
  const path = req.url.split('?')[0];
  let body = {};
  try {
    body = method === 'POST' || method === 'DELETE' ? await parseBody(req) : {};
  } catch (err) {
    return sendJson(res, { error: err.message }, 413);
  }

  try {
    // Ping list
    if (method === 'GET' && path === '/api/ping-list') {
      const config = await readConfig();
      return sendJson(res, { databases: config.databases });
    }
    if (method === 'POST' && path === '/api/ping-add') {
      const result = await addDatabase(body.uri, body.name);
      const msg = result === 'added' ? `Added to ping list: ${body.name || body.uri}` : result === 'updated' ? `Name updated for ${body.uri}` : `Already in ping list`;
      return sendJson(res, { success: true, message: msg });
    }
    if (method === 'POST' && path === '/api/ping-remove') {
      const removed = await removeDatabase(body.uri);
      return sendJson(res, { success: removed, message: removed ? 'Removed from ping list' : 'Not found in ping list' });
    }

    // Clone list
    if (method === 'GET' && path === '/api/clone-list') {
      const config = await readCloneConfig();
      return sendJson(res, { databases: config.databases });
    }
    if (method === 'POST' && path === '/api/clone-add') {
      const result = await addCloneDatabase(body.uri, body.name);
      const msg = result === 'added' ? `Added to clone list: ${body.name || body.uri}` : result === 'updated' ? `Name updated for ${body.uri}` : `Already in clone list`;
      return sendJson(res, { success: true, message: msg });
    }
    if (method === 'POST' && path === '/api/clone-remove') {
      const removed = await removeCloneDatabase(body.uri);
      return sendJson(res, { success: removed, message: removed ? 'Removed from clone list' : 'Not found in clone list' });
    }

    // Action: Export
    if (method === 'POST' && path === '/api/action/export') {
      const { uri, output, format, compact, include, exclude, dryRun } = body;
      if (!uri) return sendJson(res, { success: false, error: 'URI is required' }, 400);

      const fmt = format || 'file';
      if (!['file', 'split', 'all'].includes(fmt)) {
        return sendJson(res, { success: false, error: 'Invalid format. Use: file, split, or all.' }, 400);
      }

      const resolvedUri = await resolveName(uri);
      const client = await connect(resolvedUri);
      try {
        const dbName = extractDbName(resolvedUri);
        const rawData = await exportDatabase(client);

        let data = rawData;
        if (include && include.length > 0) {
          const set = new Set(include);
          data = Object.fromEntries(Object.entries(data).filter(([k]) => set.has(k)));
        }
        if (exclude && exclude.length > 0) {
          const set = new Set(exclude);
          data = Object.fromEntries(Object.entries(data).filter(([k]) => !set.has(k)));
        }

        if (Object.keys(data).length === 0) {
          return sendJson(res, { success: true, message: 'No collections matched the filters' });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputName = output || `data-${timestamp}-${dbName}`;

        if (dryRun) {
          const preview = Object.entries(data).map(([name, docs]) => `${name}: ${docs.length} document(s)`);
          return sendJson(res, {
            success: true,
            dryRun: true,
            message: `Dry run: ${Object.keys(data).length} collection(s) would be exported (${fmt})`,
            database: dbName,
            output: outputName,
            collections: preview,
          });
        }

        const files = [];

        if (fmt === 'file' || fmt === 'all') {
          const fileName = await getUniquePath(ensureJsonExt(outputName));
          const exportData = { database: dbName, exportedAt: new Date().toISOString(), data };
          await writeFile(fileName, serializeJson(exportData, !!compact), 'utf-8');
          files.push(fileName);
        }
        if (fmt === 'split' || fmt === 'all') {
          const dirName = extname(outputName) ? outputName.replace(/\.[^.]+$/, '') : outputName;
          await mkdir(dirName, { recursive: true });
          for (const [name, docs] of Object.entries(data)) {
            const fp = await getUniquePath(join(dirName, `${name}.json`));
            await writeFile(fp, serializeJson(docs, !!compact), 'utf-8');
            files.push(fp);
          }
        }

        return sendJson(res, { success: true, message: `Exported ${Object.keys(data).length} collection(s) to ${files.join(', ')}`, files });
      } finally {
        await client.close().catch(() => {});
      }
    }

    // Action: Import
    if (method === 'POST' && path === '/api/action/import') {
      const { uri, file, confirm } = body;

      if (!uri) return sendJson(res, { success: false, error: 'URI is required' }, 400);
      if (!file) return sendJson(res, { success: false, error: 'File path is required' }, 400);

      const isDir = statSync(file).isDirectory();
      const resolvedUri = await resolveName(uri);
      const client = await connect(resolvedUri);
      try {
        if (isDir) {
          const entries = await readdir(file);
          const jsonFiles = entries.filter(e => e.endsWith('.json')).sort();
          const dataToRestore = {};
          for (const f of jsonFiles) {
            const content = await readFile(join(file, f), 'utf-8');
            const parsed = parseJson(content);
            const name = parse(f).name;
            if (parsed && typeof parsed === 'object' && 'database' in parsed && 'data' in parsed) {
              Object.assign(dataToRestore, parsed.data);
            } else if (Array.isArray(parsed)) {
              dataToRestore[name] = parsed;
            } else {
              return sendJson(res, { success: false, error: `Invalid collection file: ${f}` }, 400);
            }
          }
          await importDatabase(client, dataToRestore, { replace: true });
          return sendJson(res, { success: true, message: `Restored ${Object.keys(dataToRestore).length} collection(s) from ${file}` });
        }

        const content = await readFile(file, 'utf-8');
        const parsed = parseJson(content);
        const isFull = parsed && typeof parsed === 'object' && 'database' in parsed && 'data' in parsed;

        if (isFull) {
          if (!confirm) return sendJson(res, { success: false, confirm: true, message: 'This will delete current data. Check the confirmation box.' });

          const currentData = await exportDatabase(client);
          const backupName = await getUniquePath(`backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
          await writeFile(backupName, serializeJson({ database: extractDbName(resolvedUri), exportedAt: new Date().toISOString(), data: currentData }), 'utf-8');
          await dropDatabase(client);
          await importDatabase(client, parsed.data);
          return sendJson(res, { success: true, message: `Database restored from ${file}. Backup saved to ${backupName}` });
        }

        if (!Array.isArray(parsed)) {
          return sendJson(res, { success: false, error: 'Collection file must be a JSON array of documents' }, 400);
        }

        const name = parse(file).name;
        await importDatabase(client, { [name]: parsed }, { replace: true });
        return sendJson(res, { success: true, message: `Restored collection "${name}" (${parsed.length} documents) from ${file}` });
      } finally {
        await client.close().catch(() => {});
      }
    }

    // Action: Ping
    if (method === 'POST' && path === '/api/action/ping') {
      const { uri } = body;
      let entries;

      if (uri) {
        const resolved = await resolveName(uri);
        const label = /^mongodb(\+srv)?:\/\//i.test(uri) ? extractDbName(resolved) : uri;
        entries = [{ uri: resolved, name: label }];
      } else {
        const config = await readConfig();
        entries = await Promise.all(
          config.databases.map(async (e) => ({ ...e, uri: await resolveEntryUriAsync(e) }))
        );
      }

      if (entries.length === 0) {
        return sendJson(res, { success: true, results: [], message: 'No databases to ping' });
      }

      const results = [];
      for (const entry of entries) {
        const label = entry.name || extractDbName(entry.uri) || entry.uri;
        try {
          const client = await connect(entry.uri);
          try {
            await pingDatabase(client);
            results.push({ uri: entry.uri, ok: true, message: `Pinged ${label} successfully` });
          } finally {
            await client.close().catch(() => {});
          }
        } catch {
          results.push({ uri: entry.uri, ok: false, message: `Failed to ping ${label}` });
        }
      }
      return sendJson(res, { success: true, results });
    }

    // Action: Info
    if (method === 'POST' && path === '/api/action/info') {
      const { uri } = body;
      if (!uri) return sendJson(res, { success: false, error: 'URI is required' }, 400);
      const resolvedUri = await resolveName(uri);
      const client = await connect(resolvedUri);
      try {
        const db = client.db();
        const dbName = extractDbName(resolvedUri);
        const collections = await db.listCollections().toArray();
        const collInfo = [];
        let totalDocs = 0;
        for (const coll of collections) {
          const count = await db.collection(coll.name).countDocuments();
          totalDocs += count;
          collInfo.push({ name: coll.name, count });
        }
        return sendJson(res, { success: true, message: `── ${dbName} ── Collections: ${collections.length}`, dbName, collections: collInfo, totalDocs });
      } finally {
        await client.close().catch(() => {});
      }
    }

    // Auto-ping
    if (method === 'GET' && path === '/api/auto-ping') {
      if (process.platform !== 'win32') {
        return sendJson(res, { scheduled: false, unsupported: true, message: 'auto-ping is Windows-only' });
      }
      try {
        const out = execSync(`schtasks /query /tn "DCLI-AutoPing" /v /fo csv`, { stdio: 'pipe', encoding: 'utf-8' });
        const lines = out.split('\n').filter(Boolean);
        const header = lines[0]?.split(',') || [];
        const values = lines[1]?.split(',') || [];
        const idx = (name) => header.findIndex(h => h.replace(/"/g, '').trim() === name);
        const get = (name) => (values[idx(name)] || '').replace(/"/g, '').trim();
        return sendJson(res, {
          scheduled: true,
          scheduleType: get('Schedule Type') || get('Task To Run'),
          startTime: get('Start Time'),
          repeatInterval: get('Repeat: Every'),
        });
      } catch {
        return sendJson(res, { scheduled: false });
      }
    }
    if (method === 'POST' && path === '/api/auto-ping') {
      if (process.platform !== 'win32') {
        return sendJson(res, { success: false, error: 'auto-ping is only supported on Windows' }, 400);
      }
      const schedule = (body.schedule || 'ONLOGON').toUpperCase();
      if (!VALID_SCHEDULES.has(schedule)) {
        return sendJson(res, { success: false, error: 'Invalid schedule. Use: ONLOGON, DAILY, HOURLY, or ONCE.' }, 400);
      }
      const at = body.at;
      const every = body.every;
      const delay = body.delay || '5';

      let parts = ['schtasks /create', '/tn "DCLI-AutoPing"', '/f'];

      switch (schedule) {
        case 'DAILY': {
          const time = at || '09:00';
          parts.push(`/sc DAILY`, `/st ${time}`);
          break;
        }
        case 'HOURLY': {
          const interval = every || '1';
          parts.push(`/sc HOURLY`, `/mo ${interval}`);
          break;
        }
        case 'ONCE': {
          const time = at || '09:00';
          parts.push(`/sc ONCE`, `/st ${time}`);
          break;
        }
        default: {
          const delayMinutes = Math.max(1, parseInt(delay, 10) || 5);
          parts.push(`/sc ONLOGON`, `/delay ${String(delayMinutes).padStart(4, '0')}:00`);
          break;
        }
      }

      parts.push(`/tr "cmd /c dcli ping"`);
      execSync(parts.join(' '), { stdio: 'pipe' });

      const messages = {
        DAILY: `Auto-ping task created. It will run "dcli ping" daily at ${at || '09:00'}.`,
        HOURLY: `Auto-ping task created. It will run "dcli ping" every ${every || '1'} hour(s).`,
        ONCE: `Auto-ping task created. It will run "dcli ping" once at ${at || '09:00'}.`,
        ONLOGON: `Auto-ping task created. It will run "dcli ping" ${delay} minute(s) after you log on.`,
      };
      return sendJson(res, { success: true, message: messages[schedule] });
    }
    if (method === 'DELETE' && path === '/api/auto-ping') {
      if (process.platform !== 'win32') {
        return sendJson(res, { success: false, error: 'auto-ping is only supported on Windows' }, 400);
      }
      execSync('schtasks /delete /tn "DCLI-AutoPing" /f', { stdio: 'pipe' });
      return sendJson(res, { success: true, message: 'Auto-ping task removed.' });
    }

    // Auto-backup
    if (method === 'GET' && path === '/api/auto-backup') {
      if (process.platform !== 'win32') {
        return sendJson(res, { scheduled: false, unsupported: true, message: 'auto-backup is Windows-only' });
      }
      const config = await readBackupConfig();
      const task = queryScheduledTask(AUTO_BACKUP_TASK);
      const cloneConfig = await readCloneConfig();
      return sendJson(res, {
        ...task,
        output: config.output,
        at: config.at,
        schedule: config.schedule,
        every: config.every,
        delay: config.delay,
        cloneCount: cloneConfig.databases.length,
      });
    }
    if (method === 'POST' && path === '/api/auto-backup') {
      if (process.platform !== 'win32') {
        return sendJson(res, { success: false, error: 'auto-backup is only supported on Windows' }, 400);
      }
      const schedule = (body.schedule || 'DAILY').toUpperCase();
      if (!VALID_SCHEDULES.has(schedule)) {
        return sendJson(res, { success: false, error: 'Invalid schedule. Use: ONLOGON, DAILY, HOURLY, or ONCE.' }, 400);
      }
      const saved = await readBackupConfig();
      const at = body.at || saved.at || '02:00';
      const every = body.every ?? saved.every;
      const delay = body.delay ?? saved.delay;
      const outputDir = resolvePath(body.output || saved.output || DEFAULT_BACKUP_DIR);
      await mkdir(outputDir, { recursive: true });
      await writeBackupConfig({ output: outputDir, at, schedule, every, delay });
      createScheduledTask(AUTO_BACKUP_TASK, schedule, {
        at,
        every,
        delay,
      }, buildRunCommand(outputDir));
      const msg = `${scheduleMessage(schedule, { at, every, delay }, '"dcli auto-clone"')} Backups save to ${outputDir}\\YYYY-MM-DD\\`;
      return sendJson(res, { success: true, message: msg, output: outputDir, at, schedule, every, delay });
    }
    if (method === 'DELETE' && path === '/api/auto-backup') {
      if (process.platform !== 'win32') {
        return sendJson(res, { success: false, error: 'auto-backup is only supported on Windows' }, 400);
      }
      removeScheduledTask(AUTO_BACKUP_TASK);
      return sendJson(res, { success: true, message: 'Auto-backup task removed.' });
    }

    // Action: Auto-clone
    if (method === 'POST' && path === '/api/action/auto-clone') {
      const config = await readCloneConfig();
      const databases = config.databases;
      if (databases.length === 0) {
        return sendJson(res, { success: true, results: [], cloned: 0, failed: 0, message: 'No databases in clone list' });
      }
      const baseOutput = body.output || process.cwd();
      const outputDir = body.dated
        ? join(baseOutput, new Date().toISOString().slice(0, 10))
        : baseOutput;
      await mkdir(outputDir, { recursive: true });
      const results = [];
      let cloned = 0;
      let failed = 0;
      for (const entry of databases) {
        const label = entry.name || entry.uri;
        try {
          const uri = await resolveEntryUriAsync(entry);
          const client = await connect(uri);
          try {
            const dbName = extractDbName(uri);
            const data = await exportDatabase(client);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `clone-${timestamp}-${dbName}.json`;
            const filePath = await getUniquePath(join(outputDir, fileName));
            await writeFile(filePath, serializeJson({ database: dbName, clonedAt: new Date().toISOString(), data }), 'utf-8');
            results.push({ uri: entry.uri, ok: true, message: `Cloned ${label} -> ${basename(filePath)} (${Object.keys(data).length} collections)` });
            cloned++;
          } finally {
            await client.close().catch(() => {});
          }
        } catch (err) {
          results.push({ uri: entry.uri, ok: false, message: `Failed to clone ${label}: ${err.message}` });
          failed++;
        }
      }
      return sendJson(res, { success: true, results, cloned, failed });
    }

    sendJson(res, { error: 'Not found' }, 404);
  } catch (err) {
    sendJson(res, { error: err.message }, 500);
  }
}

export async function guiCommand(options) {
  const port = Number(options.port) || 3456;

  try {
    statSync(HTML_PATH);
  } catch {
    error(`GUI files not found at ${GUI_DIR}`);
    process.exit(1);
  }

  const html = readFileSync(HTML_PATH, 'utf-8');

  const server = createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
      return handleApi(req, res);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });

  server.on('error', (err) => {
    error(`Failed to start GUI: ${err.message}`);
    process.exit(1);
  });

  server.listen(port, '127.0.0.1', () => {
    success(`GUI opened at http://127.0.0.1:${port}`);
    try {
      execSync(`start http://127.0.0.1:${port}`, { stdio: 'ignore' });
    } catch {
      info(`Open http://127.0.0.1:${port} in your browser`);
    }
  });
}
