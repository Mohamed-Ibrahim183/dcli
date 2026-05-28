import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { writeFile, readFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, parse } from 'node:path';
import { execSync } from 'node:child_process';
import { connect, exportDatabase, importDatabase, dropDatabase, extractDbName, pingDatabase } from '../utils/mongodb.js';
import { readConfig, addDatabase, removeDatabase } from '../utils/config.js';
import { readCloneConfig, addCloneDatabase, removeCloneDatabase } from '../utils/cloneConfig.js';
import { info, success, error } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GUI_DIR = join(__dirname, '..', 'gui');
const HTML_PATH = join(GUI_DIR, 'index.html');

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

async function handleApi(req, res) {
  const method = req.method;
  const path = req.url.split('?')[0];
  const body = method === 'POST' || method === 'DELETE' ? await parseBody(req) : {};

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
      const client = await connect(uri);
      const dbName = extractDbName(uri);
      const rawData = await exportDatabase(client);
      await client.close();

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
      const fmt = format || 'file';
      const indent = compact ? 0 : 2;
      const files = [];

      if (fmt === 'file' || fmt === 'all') {
        const fileName = `${outputName}.json`;
        const exportData = { database: dbName, exportedAt: new Date().toISOString(), data };
        await writeFile(fileName, JSON.stringify(exportData, null, indent), 'utf-8');
        files.push(fileName);
      }
      if (fmt === 'split' || fmt === 'all') {
        const dirName = extname(outputName) ? outputName.replace(/\.[^.]+$/, '') : outputName;
        await mkdir(dirName, { recursive: true });
        for (const [name, docs] of Object.entries(data)) {
          const fp = join(dirName, `${name}.json`);
          await writeFile(fp, JSON.stringify(docs, null, indent), 'utf-8');
          files.push(fp);
        }
      }

      return sendJson(res, { success: true, message: `Exported ${Object.keys(data).length} collection(s) to ${files.join(', ')}`, files });
    }

    // Action: Import
    if (method === 'POST' && path === '/api/action/import') {
      const { uri, file, confirm } = body;

      if (!file) return sendJson(res, { success: false, error: 'File path is required' }, 400);

      const isDir = statSync(file).isDirectory();

      if (isDir) {
        const entries = await readdir(file);
        const jsonFiles = entries.filter(e => e.endsWith('.json')).sort();
        const dataToRestore = {};
        for (const f of jsonFiles) {
          const content = await readFile(join(file, f), 'utf-8');
          const parsed = JSON.parse(content);
          const name = parse(f).name;
          const docs = Array.isArray(parsed) ? parsed : [];
          dataToRestore[name] = docs;
        }
        const client = await connect(uri);
        await importDatabase(client, dataToRestore);
        await client.close();
        return sendJson(res, { success: true, message: `Restored ${Object.keys(dataToRestore).length} collection(s) from ${file}` });
      }

      const content = await readFile(file, 'utf-8');
      const parsed = JSON.parse(content);
      const isFull = parsed && typeof parsed === 'object' && 'database' in parsed && 'data' in parsed;

      if (isFull) {
        if (!confirm) return sendJson(res, { success: false, confirm: true, message: 'This will delete current data. Check the confirmation box.' });

        const client = await connect(uri);
        const currentData = await exportDatabase(client);
        const backupName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        await writeFile(backupName, JSON.stringify({ database: extractDbName(uri), exportedAt: new Date().toISOString(), data: currentData }, null, 2), 'utf-8');
        await dropDatabase(client);
        await importDatabase(client, parsed.data);
        await client.close();
        return sendJson(res, { success: true, message: `Database restored from ${file}. Backup saved to ${backupName}` });
      }

      const name = parse(file).name;
      const docs = Array.isArray(parsed) ? parsed : [];
      const client = await connect(uri);
      await importDatabase(client, { [name]: docs });
      await client.close();
      return sendJson(res, { success: true, message: `Restored collection "${name}" (${docs.length} documents) from ${file}` });
    }

    // Action: Ping
    if (method === 'POST' && path === '/api/action/ping') {
      const { uri } = body;
      let entries;

      if (uri) {
        const config = await readConfig();
        const named = config.databases.find(e => e.name === uri);
        entries = named ? [named] : [{ uri }];
      } else {
        const config = await readConfig();
        entries = config.databases;
      }

      if (entries.length === 0) {
        return sendJson(res, { success: true, results: [], message: 'No databases to ping' });
      }

      const results = [];
      for (const entry of entries) {
        const label = entry.name || extractDbName(entry.uri) || entry.uri;
        try {
          const client = await connect(entry.uri);
          await pingDatabase(client);
          await client.close();
          results.push({ uri: entry.uri, ok: true, message: `Pinged ${label} successfully` });
        } catch {
          results.push({ uri: entry.uri, ok: false, message: `Failed to ping ${label}` });
        }
      }
      return sendJson(res, { success: true, results });
    }

    // Action: Info
    if (method === 'POST' && path === '/api/action/info') {
      const { uri } = body;
      const client = await connect(uri);
      const db = client.db();
      const dbName = extractDbName(uri);
      const collections = await db.listCollections().toArray();
      const collInfo = [];
      let totalDocs = 0;
      for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        totalDocs += count;
        collInfo.push({ name: coll.name, count });
      }
      await client.close();
      return sendJson(res, { success: true, message: `── ${dbName} ── Collections: ${collections.length}`, dbName, collections: collInfo, totalDocs });
    }

    // Auto-ping
    if (method === 'GET' && path === '/api/auto-ping') {
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
      const schedule = (body.schedule || 'ONLOGON').toUpperCase();
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
        ONLOGON: `Auto-ping task created. It will run "dcli ping" ${delay ? `${delay} minute(s) after` : ''} you log on.`,
      };
      return sendJson(res, { success: true, message: messages[schedule] || messages.ONLOGON });
    }
    if (method === 'DELETE' && path === '/api/auto-ping') {
      execSync('schtasks /delete /tn "DCLI-AutoPing" /f', { stdio: 'pipe' });
      return sendJson(res, { success: true, message: 'Auto-ping task removed.' });
    }

    // Action: Auto-clone
    if (method === 'POST' && path === '/api/action/auto-clone') {
      const config = await readCloneConfig();
      const databases = config.databases;
      if (databases.length === 0) {
        return sendJson(res, { success: true, results: [], cloned: 0, failed: 0, message: 'No databases in clone list' });
      }
      const outputDir = body.output || process.cwd();
      await mkdir(outputDir, { recursive: true });
      const results = [];
      let cloned = 0;
      let failed = 0;
      for (const entry of databases) {
        const label = entry.name || entry.uri;
        try {
          const client = await connect(entry.uri);
          const dbName = extractDbName(entry.uri);
          const data = await exportDatabase(client);
          await client.close();
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `clone-${timestamp}-${dbName}.json`;
          const filePath = join(outputDir, fileName);
          await writeFile(filePath, JSON.stringify({ database: dbName, clonedAt: new Date().toISOString(), data }, null, 2), 'utf-8');
          results.push({ uri: entry.uri, ok: true, message: `Cloned ${label} -> ${fileName} (${Object.keys(data).length} collections)` });
          cloned++;
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
  const port = options.port || 3456;

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

  server.listen(port, () => {
    success(`GUI opened at http://localhost:${port}`);
    try {
      execSync(`start http://localhost:${port}`, { stdio: 'ignore' });
    } catch {
      info(`Open http://localhost:${port} in your browser`);
    }
  });
}
