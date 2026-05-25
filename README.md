# dlib — Database CLI

**dlib** (short for **D**atabase **CLI**) is a command-line tool for MongoDB data management. It is designed to be used from the terminal, not imported in code.

## Features

- **clone** — Export all collections from a MongoDB cluster to a JSON file
- **restore** — Restore a database from a JSON file with automatic backup before deletion
- **refresh** — Periodically ping databases to prevent automatic pause/inactivity timeout
- **add** — Register a database URI in the auto-refresh list
- **remove** — Remove a database URI from the auto-refresh list

## Installation

```bash
npm install -g dlib
```

Or link locally for development:

```bash
git clone <repo-url>
cd dlib
npm install
npm link
```

## Usage

### Clone

Export all collections from a MongoDB database to a JSON file.

```bash
dlib clone "mongodb://localhost:27017/mydb"
```

Optional custom output file:

```bash
dlib clone "mongodb://localhost:27017/mydb" -o backup.json
```

Default filename: `data-<timestamp>-<database>.json`

### Restore

Restore a database from a JSON file. The command will:
1. Warn you that the database will be deleted
2. Create a timestamped backup of the current data
3. Ask for confirmation (`yes/no`)
4. Drop the database
5. Import the data from the specified file

```bash
dlib restore "mongodb://localhost:27017/mydb" -f backup.json
```

### Refresh

Automatically ping configured databases every 5 minutes to prevent them from being paused due to inactivity.

```bash
dlib refresh
```

Use a custom database list file:

```bash
dlib refresh --file my-dbs.json
```

The custom file should have the same format:

```json
{
  "databases": [
    "mongodb://..."
  ]
}
```

### Add

Add a database URI to the auto-refresh list (stored in `~/.dlib/refresh.json`):

```bash
dlib add "mongodb://localhost:27017/mydb"
```

### Remove

Remove a database URI from the auto-refresh list:

```bash
dlib remove "mongodb://localhost:27017/mydb"
```

## Config File

The refresh list is stored at `~/.dlib/refresh.json`:

```json
{
  "databases": [
    "mongodb://cluster0.example.mongodb.net/mydb"
  ]
}
```

## JSON Export Format

```json
{
  "database": "mydb",
  "exportedAt": "2026-05-25T14:30:00.000Z",
  "data": {
    "users": [
      { "_id": "...", "name": "Alice" }
    ],
    "posts": [
      { "_id": "...", "title": "Hello" }
    ]
  }
}
```

## Dependencies

- [commander](https://github.com/tj/commander.js) — CLI framework
- [mongodb](https://github.com/mongodb/node-mongodb-native) — MongoDB Node.js driver
