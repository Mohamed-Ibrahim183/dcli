# dcli — Database CLI

**dcli** (short for **D**atabase **CLI**) is a command-line tool for MongoDB data management. Designed for terminal use.

## Features

- **export** — Export a MongoDB database to JSON file(s)
- **import** — Import a database or specific collection(s) from JSON file(s)
- **ping** — Ping databases to prevent idle/inactivity pause
- **info** — Show database collections and document counts
- **add** — Register a database URI in the auto-ping list
- **remove** — Remove a database URI from the auto-ping list

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

Export a MongoDB database to JSON file(s).

```bash
dcli export "mongodb://localhost:27017/mydb"
```

| Option | Description |
|--------|-------------|
| `-o, --output <name>` | Output name |
| `--format <type>` | `file` (single JSON), `split` (per collection), `all` (both) |
| `--pretty` | Prettify JSON output |
| `--include <col...>` | Only export these collections |
| `--exclude <col...>` | Skip these collections |
| `--dry-run` | Preview without writing files |

```bash
dcli export "mongodb://..." -o mydata
dcli export "mongodb://..." --format split --pretty
dcli export "mongodb://..." --include users posts
dcli export "mongodb://..." --exclude logs analytics
dcli export "mongodb://..." --dry-run
```

### import

Restore from a full file, single collection file, or directory.

```bash
dcli import "mongodb://localhost:27017/mydb" -f backup.json
dcli import "mongodb://..." -f ./users.json
dcli import "mongodb://..." -f ./collections/
```

Full file restores the entire DB (backup + confirmation + drop).
Single collection files restore only that collection.

### ping

Ping databases to prevent inactivity pause.

```bash
dcli ping
dcli ping "mongodb://localhost:27017/mydb"
dcli ping --file my-dbs.json
```

### info

Show collections and document counts.

```bash
dcli info "mongodb://localhost:27017/mydb"
```

### add / remove

Manage the auto-ping list (`~/.dcli/refresh.json`):

```bash
dcli add "mongodb://user:pass@cluster.mongodb.net/mydb"
dcli remove "mongodb://user:pass@cluster.mongodb.net/mydb"
```

## Config File

`~/.dcli/refresh.json`:

```json
{
  "databases": [
    "mongodb://cluster0.example.mongodb.net/mydb"
  ]
}
```

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
