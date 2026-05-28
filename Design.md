# dcli Design System — CLI Styling Guide

This document describes the visual design used in `dcli`. It can be reused in other CLI projects to maintain consistent styling.

---

## 1. Color Palette (ANSI 16)

All colors use standard ANSI escape codes (works in any terminal).

| Role       | ANSI Code | Name   | Usage                                 |
|------------|-----------|--------|---------------------------------------|
| Info       | `\x1b[34m` | Blue   | `ℹ` icon prefix, informational text   |
| Success    | `\x1b[32m` | Green  | `✔` icon prefix                       |
| Warning    | `\x1b[33m` | Yellow | `⚠` icon prefix                       |
| Error      | `\x1b[31m` | Red    | `✖` icon prefix                       |
| Highlight  | `\x1b[36m` | Cyan   | Section headers, emphasized text      |
| Dim/Gray   | `\x1b[90m` | Bright Black | Examples, secondary info        |
| Bold       | `\x1b[1m`  | —      | Section titles, command names         |
| Dim        | `\x1b[2m`  | —      | Subtle text (taglines, footnotes)     |
| Reset      | `\x1b[0m`  | —      | End all formatting                    |

---

## 2. Logger (`src/utils/logger.js`)

Five functions. Every message follows: **`[icon] [message]`**

```js
info(message)    // Blue "ℹ" + message       → ℹ Pinging 3 database(s)...
success(message) // Green "✔" + message      → ✔ Cloned mydb → file.json
warn(message)    // Yellow "⚠" + message     → ⚠ No databases found
error(message)   // Red "✖" + message        → ✖ Failed to connect
highlight(msg)   // Cyan, no icon, full line → ── Auto Clone: 3 database(s) ──
```

### Logger Implementation (copy-paste template)

```js
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

export function info(message) { console.log(`${BLUE}ℹ${RESET} ${message}`); }
export function success(message) { console.log(`${GREEN}✔${RESET} ${message}`); }
export function warn(message) { console.log(`${YELLOW}⚠${RESET} ${message}`); }
export function error(message) { console.log(`${RED}✖${RESET} ${message}`); }
export function highlight(message) { console.log(`${CYAN}${message}${RESET}`); }
```

---

## 3. Help System (`src/utils/help.js`)

Two separate mechanisms work together:

### 3a. Per-command `--help` (Commander's default, colorized)

`colorizeDefaultHelp()` takes Commander's built-in help text and applies colors:

| Element              | Style                  |
|----------------------|------------------------|
| `Usage:` line        | **Bold**               |
| `Arguments:` / `Options:` headers | **Bold**  |
| `-h, --help` line    | Dim (de-emphasized)    |
| Option flags (`-f, --file <path>`) | Green          |

All other lines pass through unchanged.

### 3b. Root help screen (`dcli --help` / `dcli`)

Fully custom layout built by `generateHelp()`. Structure:

```
  [cyan]dcli[reset] [dim]— Database CLI / MongoDB data management tool[reset]

  [bold]Usage:[reset] dcli <command> [options]

  [bold]Commands:[reset]

    [yellow bold]export[reset] <uri> [options]     Description text...
      [bold]Options:[reset]
      [green]-o, --output <name>[reset]    Explanation text
      [bold]Examples:[reset]
        [gray]$ dcli export "uri"[reset]

    [yellow bold]import[reset] <uri> [options]     Description text...
    ...

  [dim blue]Config file: ~/... [reset]
  [dim blue]Repository: ... [reset]
```

Every command block has the same structure:

1. **Command line**: `[yellow bold]<name>[reset] <args> [options]` + padded description
2. **Options** (if any): `[bold]Options:[reset]` header then `[green]<flag>[reset]` + padded description
3. **Examples** (if any): `[bold]Examples:[reset]` header then `[gray]$ dcli ... [reset]`

Column alignment (spacing, not a table):
- Command name + args padded to **34 visible characters** before description
- Option flags padded to **32 visible characters** before description

---

## 4. Error Handling Pattern

Every command follows this pattern:

```js
try {
  // ... business logic
} catch (err) {
  error(`Failed to <action>: ${err.message}`);
  process.exit(1);
}
```

- Always use `error()` from the logger (red `✖` prefix)
- Always include `err.message` in the output
- Always exit with code `1`

---

## 5. Success / Result Messages

- Add/Remove operations: `success(`Database added to ping list: ${label}`)`
- Update operations: `success(`Name updated to "${name}" for ${uri}`)`
- Already-exists cases: `warn(...)` (not error)
- Section headers in multi-step operations: `highlight(`── Title: N item(s) ──`)`
- Summary at end of batch operations: `highlight(`── Done: N succeeded, M failed ──`)`

---

## 6. Command Registration Pattern (Commander.js)

```js
program
  .command('<name>')
  .description('<short description>')
  .argument('<arg>', '<description>')   // use '[arg]' for optional
  .option('-f, --flag <val>', '<desc>', '<default>')
  .action(importedHandlerFunction);
```

Import the handler in `main.js`:
```js
import { someCommand } from './commands/some.js';
```

---

## 7. Help Entry Registration

Each command needs an entry in the `COMMANDS` array in `help.js`:

```js
{
  name: '<cmd>',
  args: '<uri>',          // omit if none
  desc: '<one-line description>',
  options: [              // empty array if none
    ['-f, --flag <val>', 'Description of flag'],
  ],
  examples: [             // empty array if none
    '$ dcli cmd arg',
  ],
},
```

---

## Summary of Styling Rules

1. **Never use emoji** — use Unicode symbols (`ℹ ✔ ⚠ ✖`) that render in any terminal
2. **Every message has an icon + space prefix**, except `highlight()` which uses full-line cyan
3. **Error messages always include the original `err.message`** and exit with code 1
4. **Commands follow a consistent structure**: try/catch, logger calls, process.exit(1) on failure
5. **Help uses no tables** — alignment is done with padded spaces, stripped of ANSI codes for accurate width
