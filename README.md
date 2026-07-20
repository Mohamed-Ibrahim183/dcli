# dcli — Database CLI

**dcli** (short for **D**atabase **CLI**) is a command-line tool for MongoDB data management. Designed for terminal use. Requires **Node.js 18+**.

## Features

- **export** — Export a MongoDB database to JSON file(s) (BSON Extended JSON; preserves ObjectId/Date)
- **import** — Import a database or specific collection(s) from JSON file(s)
- **ping** — Ping databases to prevent idle/inactivity pause
- **info** — Show database collections and document counts
- **add** — Register a database URI in the auto-ping list (with optional name)
- **remove** — Remove a database by URI or friendly name
- **auto-ping** — Schedule `dcli ping` via Windows Task Scheduler (ONLOGON, DAILY, HOURLY, ONCE)
- **view** — Browse collections and documents in a styled table
- **show** — Display the auto-ping or auto-clone database list
- **clone-add** — Register a database URI in the auto-clone list
- **clone-remove** — Remove a database from the auto-clone list
- **clone** — Clone a single database by friendly name (or URI) to JSON
- **auto-clone** — Clone all databases in the clone list to JSON files
- **gui** — Launch the local web GUI in your browser

## Installation

```bash
npm install -g @mohamed1_1ibrahim/dcli
```

```bash
git clone https://github.com/Mohamed-Ibrahim183/dcli
cd dcli
npm install
npm link
```

Many commands accept a **friendly name** from your ping or clone list in place of a URI (ping list is checked first, then clone list). When the stored URI has no database in the path (common with Atlas), dcli lists databases on the cluster and picks the best match — exact name, close spelling (e.g. `quran-hafez` → `quran-hafaza`), or the only database on the cluster.

## Usage

### export

Export a MongoDB database to JSON file(s). Output uses BSON Extended JSON (prettified by default) so types like `ObjectId` and `Date` round-trip on import.

```bash
dcli export "mongodb://localhost:27017/mydb"
dcli export dbName
```

Default output name: `data-<timestamp>-<db>.json`.

| Option | Description |
|--------|-------------|
| `-o, --output <name>` | Output name (without or with `.json` extension) |
| `--format <type>` | `file` (single JSON), `split` (per collection), `all` (both). Default: `file` |
| `--compact` | Minify JSON output (default is prettified) |
| `--include <collections...>` | Only export these collections |
| `--exclude <collections...>` | Skip these collections |
| `--dry-run` | Preview without writing files |

If the output file already exists, it auto-increments — `file.json` → `file (1).json` → `file (2).json`.

```bash
dcli export "mongodb://..." -o mydata
dcli export "mongodb://..." --format split
dcli export "mongodb://..." --format all --compact
dcli export "mongodb://..." --include users posts
dcli export "mongodb://..." --exclude logs analytics
dcli export "mongodb://..." --dry-run
```

### import

Restore from a full file, single collection file, or directory. Asks for confirmation before writing.

| `-f` path | Behavior |
|-----------|----------|
| Full `.json` file | Backup current DB → drop database → restore |
| Single collection `.json` | Replace that collection (drop + insert) |
| Directory of `.json` files | Replace each file as a collection |

```bash
dcli import "mongodb://localhost:27017/mydb" -f backup.json
dcli import "mongodb://..." -f ./users.json
dcli import "mongodb://..." -f ./collections/
dcli import dbName -f backup.json
```

### ping

Ping databases to prevent inactivity pause. Exits with code `1` if any ping fails.

```bash
dcli ping                          # ping all from config
dcli ping "mongodb://..."          # ping a raw URI
dcli ping dbName                   # ping by friendly name (ping list, then clone list)
dcli ping --file my-dbs.json       # ping all from a custom file
```

### info

Show collections and document counts.

```bash
dcli info "mongodb://localhost:27017/mydb"
dcli info dbName
```

### add / remove

Manage the auto-ping list (`~/.dcli/refresh.json`).

```bash
dcli add "mongodb://..." -n dbName          # add with friendly name
dcli add "mongodb://..." -n dbName          # updates name if URI already exists
dcli remove "mongodb://user:pass@..."       # remove by URI
dcli remove dbName                          # remove by friendly name
```

### auto-ping

Schedule `dcli ping` with Windows Task Scheduler (`schtasks`). **Windows only.** Creating/removing the task usually requires administrator privileges. The scheduled command is `dcli ping`, so `dcli` must be on the system PATH used by Task Scheduler.

```bash
dcli auto-ping                       # ONLOGON, 5 min delay (default)
dcli auto-ping --remove              # remove the task
dcli auto-ping --schedule DAILY --at 09:00
dcli auto-ping --schedule HOURLY --every 2
dcli auto-ping --schedule ONCE --at 18:00
dcli auto-ping --schedule ONLOGON --delay 10
```

| Option | Description |
|--------|-------------|
| `--remove` | Remove the scheduled task |
| `--schedule <type>` | `ONLOGON`, `DAILY`, `HOURLY`, or `ONCE` (default: `ONLOGON`) |
| `--at <time>` | Time for `DAILY`/`ONCE` schedules (24h, e.g. `09:00`) |
| `--every <n>` | Interval in hours for `HOURLY` (default: 1) |
| `--delay <n>` | Delay in minutes for `ONLOGON` (default: 5) |

### view

Browse collections and documents in a styled table.

```bash
dcli view "mongodb://localhost:27017/mydb"              # list collections
dcli view "mongodb://localhost:27017/mydb" users         # browse documents
dcli view dbName users --limit 5
dcli view "mongodb://..." users --fields name,email --sort name
dcli view "mongodb://..." users --all --json
```

| Option | Description |
|--------|-------------|
| `--limit <n>` | Maximum documents (default: 10) |
| `--fields <fields>` | Comma-separated fields to display (only these columns) |
| `--sort <field>` | Sort ascending by field |
| `--all` | Show all documents (no limit) |
| `--json` | Output raw JSON instead of a table |

### show

Display the auto-ping or auto-clone database list.

```bash
dcli show              # show ping list (~/.dcli/refresh.json)
dcli show --clone      # show clone list (~/.dcli/auto-clone.json)
```

### clone-add / clone-remove

Manage the auto-clone list (`~/.dcli/auto-clone.json`).

```bash
dcli clone-add "mongodb://..." -n dbName
dcli clone-remove dbName
```

### clone

Clone a single database from the clone list to a JSON file (`clone-<timestamp>-<db>.json`). Accepts a friendly name or URI that exists in the clone list.

```bash
dcli clone dbName
dcli clone dbName -o ./backups
```

### auto-clone

Clone all databases in the clone list to JSON files.

```bash
dcli auto-clone
dcli auto-clone -o ./backups
```

### gui

Launch the web GUI bound to **localhost** only (default port `3456`).

```bash
dcli gui
dcli gui -p 8080
```

## Config Files

**Ping list** — `~/.dcli/refresh.json`:

```json
{
  "databases": [
    { "uri": "mongodb://cluster0.example.mongodb.net/mydb", "name": "dbName" },
    "mongodb://backup.example.mongodb.net/otherdb"
  ]
}
```

**Clone list** — `~/.dcli/auto-clone.json` (same format as above).

Entries can be objects with `uri` and optional `name`, or plain strings (backward compatible). Friendly names resolve from the ping list first, then the clone list. When a URI has no `/dbname` path segment, dcli discovers the target database on the cluster automatically.

## Export Format

Single file (BSON Extended JSON):

```json
{
  "database": "mydb",
  "exportedAt": "2026-05-25T14:30:00.000Z",
  "data": {
    "users": [ { "_id": { "$oid": "..." }, "name": "Alice", "createdAt": { "$date": "..." } } ],
    "posts": [ { "_id": { "$oid": "..." }, "title": "Hello" } ]
  }
}
```

Clone files use the same shape with `clonedAt` instead of `exportedAt` and are import-compatible.

Split (per collection in a folder):

```
folder/
├── users.json     [ { "_id": { "$oid": "..." }, ... }, ... ]
├── posts.json     [ { "_id": { "$oid": "..." }, ... }, ... ]
```

Older plain-JSON exports (string `_id` values) still import, but BSON types are only preserved for Extended JSON files.

## Dependencies

- [commander](https://github.com/tj/commander.js) — CLI framework
- [mongodb](https://github.com/mongodb/node-mongodb-native) — MongoDB driver
- [bson](https://github.com/mongodb/js-bson) — Extended JSON serialization
