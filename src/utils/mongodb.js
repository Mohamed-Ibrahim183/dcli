import { setServers } from 'node:dns';
import { resolveSrv } from 'node:dns/promises';
import { MongoClient } from 'mongodb';
import { EJSON } from 'bson';

export async function connect(uri) {
  if (uri.startsWith('mongodb+srv://')) {
    const hostname = new URL(uri).hostname;
    try {
      await resolveSrv(`_mongodb._tcp.${hostname}`);
    } catch {
      setServers(['8.8.8.8', '1.1.1.1']);
    }
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  return client;
}

export function extractDbName(uri) {
  try {
    const url = new URL(uri);
    const db = url.pathname.replace(/^\//, '');
    return db || 'test';
  } catch {
    return 'test';
  }
}

/** Serialize documents with BSON Extended JSON so ObjectId/Date round-trip. */
export function serializeJson(value, compact = false) {
  return EJSON.stringify(value, undefined, compact ? 0 : 2);
}

/** Parse JSON/EJSON; plain JSON backups remain loadable. */
export function parseJson(text) {
  return EJSON.parse(text);
}

export async function exportDatabase(client) {
  const db = client.db();
  const collections = await db.listCollections().toArray();
  const data = {};

  for (const collection of collections) {
    const name = collection.name;
    const docs = await db.collection(name).find({}).toArray();
    data[name] = docs;
  }

  return data;
}

export async function importDatabase(client, data, { replace = false } = {}) {
  const db = client.db();
  const collections = Object.keys(data);

  for (const name of collections) {
    const docs = data[name];
    if (replace) {
      try {
        await db.collection(name).drop();
      } catch {
        // Collection may not exist yet
      }
    }
    if (docs.length > 0) {
      await db.collection(name).insertMany(docs);
    }
  }
}

export async function dropDatabase(client) {
  const db = client.db();
  await db.dropDatabase();
}

export async function pingDatabase(client) {
  const db = client.db();
  await db.command({ ping: 1 });
}
