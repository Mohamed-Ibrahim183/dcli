import { connect, extractDbName } from '../utils/mongodb.js';
import { resolveName } from '../utils/resolve.js';
import { info, error, highlight } from '../utils/logger.js';

export async function infoCommand(uri) {
  uri = await resolveName(uri);
  try {
    const client = await connect(uri);
    const db = client.db();
    const dbName = extractDbName(uri);
    const collections = await db.listCollections().toArray();

    highlight(`── ${dbName} ──`);
    info(`Collections: ${collections.length}`);

    let totalDocs = 0;
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      totalDocs += count;
      info(`  ${coll.name}: ${count} document(s)`);
    }

    info(`Total documents: ${totalDocs}`);
    await client.close();
  } catch (err) {
    error(`Failed to get database info: ${err.message}`);
    process.exit(1);
  }
}
