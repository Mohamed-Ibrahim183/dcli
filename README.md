# dcli — Database CLI

**dcli** (short for **D**atabase **CLI**) is a command-line tool for MongoDB data management. Designed for terminal use.

## Features

- **export** — Export a MongoDB database to JSON file(s)
- **import** — Import a database or specific collection(s) from JSON file(s)
- **ping** — Ping databases to prevent idle/inactivity pause
- **info** — Show database collections and document counts
- **add** — Register a database URI in the auto-ping list (with optional name)
- **remove** — Remove a database by URI or friendly name
- **auto-ping** — Schedule `dcli ping` to run automatically on Windows logon

## Installation

```bash
npm install -g dcli
```

```bash
git clone https://github.com/Mohamed-Ibrahim183/dcli
cd dcli
npm install
npm link
```

## Usage

### export

Export a MongoDB database to JSON file(s). Output is prettified by default.

```bash
dcli export "mongodb://localhost:27017/mydb"
```

| Option | Description |
|--------|-------------|
| `-o, --output <name>` | Output name (without or with `.json` extension) |
| `--format <type>` | `file` (single JSON), `split` (per collection), `all` (both) |
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

Restore from a full file, single collection file, or directory.

| `-f` path | Behavior |
|-----------|----------|
| Full `.json` file | Restore entire DB (backup + confirmation + drop) |
| Single collection `.json` | Restore that collection only |
| Directory of `.json` files | Restore each file as a collection |

```bash
dcli import "mongodb://localhost:27017/mydb" -f backup.json
dcli import "mongodb://..." -f ./users.json
dcli import "mongodb://..." -f ./collections/
```

### ping

Ping databases to prevent inactivity pause.

```bash
dcli ping                          # ping all from config
dcli ping "mongodb://..."          # ping a raw URI
dcli ping dbName                   # ping by friendly name from config
dcli ping --file my-dbs.json       # ping all from a custom file
```

### info

Show collections and document counts.

```bash
dcli info "mongodb://localhost:27017/mydb"
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

Schedule `dcli ping` to run automatically 5 minutes after Windows logon.
Requires administrator privileges to create the task.

```bash
dcli auto-ping           # create the task (run terminal as Admin)
dcli auto-ping --remove  # remove the task (run terminal as Admin)
```

## Config File

`~/.dcli/refresh.json`:

```json
{
  "databases": [
    { "uri": "mongodb://cluster0.example.mongodb.net/mydb", "name": "dbName" },
    "mongodb://backup.example.mongodb.net/otherdb"
  ]
}
```

Entries can be objects with `uri` and optional `name`, or plain strings (backward compatible).

## Export Format

Single file:

```json
{
  "database": "mydb",
  "exportedAt": "2026-05-25T14:30:00.000Z",
  "data": {
    "users": [ { "_id": "...", "name": "Alice" } ],
    "posts": [ { "_id": "...", "title": "Hello" } ]
  }
}
```

Split (per collection in a folder):

```
folder/
├── users.json     [ { "_id": "...", ... }, ... ]
├── posts.json     [ { "_id": "...", ... }, ... ]
```

## Dependencies

- [commander](https://github.com/tj/commander.js) — CLI framework
- [mongodb](https://github.com/mongodb/node-mongodb-native) — MongoDB driver
