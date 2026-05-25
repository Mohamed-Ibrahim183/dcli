import { MongoClient } from 'mongodb';

export async function connect(uri) {
  const client = new MongoClient(uri);
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

export async function importDatabase(client, data) {
  const db = client.db();
  const collections = Object.keys(data);

  for (const name of collections) {
    const docs = data[name];
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
