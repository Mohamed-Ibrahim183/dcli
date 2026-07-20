import { connect, extractDbName, serializeJson } from '../utils/mongodb.js';
import { resolveName } from '../utils/resolve.js';
import { renderTable } from '../utils/table.js';
import { info, error, highlight } from '../utils/logger.js';

function formatDoc(doc, fields) {
  const result = {};
  for (const key of fields) {
    result[key] = formatValue(doc[key]);
  }
  return result;
}

function formatValue(val) {
  if (val == null) return 'null';
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      if (val.length <= 3) return `[${val.map(formatValue).join(', ')}]`;
      return `[${val.length} items]`;
    }
    if (val instanceof Date) return val.toISOString();
    if (Object.keys(val).length > 4) return `{${Object.keys(val).length} keys}`;
    return JSON.stringify(val);
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

export async function viewCommand(uri, collection, options) {
  let client;
  try {
    uri = await resolveName(uri);
    client = await connect(uri);
    const db = client.db();
    const dbName = extractDbName(uri);

    if (!collection) {
      const collections = await db.listCollections().toArray();
      highlight(`── ${dbName} ──`);
      if (collections.length === 0) {
        info('No collections found.');
      } else {
        const rows = collections.map((c, i) => ({
          '#': String(i + 1),
          collection: c.name,
        }));
        console.log(renderTable(rows, { maxColWidth: 60 }));
        info(`${collections.length} collection(s)`);
      }
      return;
    }

    const limit = options.all ? 0 : Math.max(1, parseInt(options.limit, 10) || 10);
    const fields = options.fields ? options.fields.split(',').map(s => s.trim()).filter(Boolean) : null;
    const sortField = options.sort || null;

    const cursor = db.collection(collection).find({});
    if (sortField) cursor.sort({ [sortField]: 1 });
    if (limit > 0) cursor.limit(limit);

    const docs = await cursor.toArray();

    if (docs.length === 0) {
      info(`Collection "${collection}" is empty.`);
      return;
    }

    if (options.json) {
      const output = fields
        ? docs.map(d => {
            const o = {};
            for (const f of fields) o[f] = d[f];
            return o;
          })
        : docs;
      console.log(serializeJson(output));
      return;
    }

    const visibleFields = fields || Object.keys(docs[0]);
    const rows = docs.map(d => formatDoc(d, visibleFields));

    highlight(`── ${dbName}.${collection} ──`);
    console.log(renderTable(rows, { maxColWidth: 60 }));
    info(`${docs.length} document(s)${limit > 0 && docs.length === limit ? ' (limit reached)' : ''}`);
  } catch (err) {
    error(`Failed to view data: ${err.message}`);
    process.exit(1);
  } finally {
    if (client) await client.close().catch(() => {});
  }
}
