const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function visualLen(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function truncate(str, maxLen) {
  if (!str) return '';
  const s = String(str);
  const len = visualLen(s);
  if (len <= maxLen) return s;
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, '');
  return stripped.slice(0, maxLen - 1) + '…';
}

function padAnsi(str, width) {
  const len = visualLen(str);
  const padding = Math.max(0, width - len);
  return str + ' '.repeat(padding);
}

function repeatChar(char, count) {
  return char.repeat(Math.max(0, count));
}

export function renderTable(rows, { maxColWidth = 50 } = {}) {
  if (!rows || rows.length === 0) return '';

  const keys = Object.keys(rows[0]);
  const colWidths = keys.map(k => {
    const headerLen = visualLen(k);
    let max = headerLen;
    for (const row of rows) {
      const val = row[k] == null ? '' : String(row[k]);
      const len = Math.min(visualLen(val), maxColWidth);
      if (len > max) max = len;
    }
    return Math.min(max, maxColWidth);
  });

  const border = (left, sep, right, fill) => {
    const parts = keys.map((k, i) => repeatChar(fill, colWidths[i] + 2));
    return `${CYAN}${left}${parts.join(sep)}${right}${RESET}`;
  };

  const dataRow = (row) => {
    const cells = keys.map((k, i) => {
      const val = row[k] == null ? '' : truncate(String(row[k]), colWidths[i]);
      return ` ${padAnsi(val, colWidths[i])} `;
    });
    return `${CYAN}│${RESET}${cells.join(`${CYAN}│${RESET}`)}${CYAN}│${RESET}`;
  };

  const headerRow = () => {
    const cells = keys.map((k, i) => {
      return ` ${CYAN}${BOLD}${padAnsi(k, colWidths[i])}${RESET} `;
    });
    return `${CYAN}│${RESET}${cells.join(`${CYAN}│${RESET}`)}${CYAN}│${RESET}`;
  };

  const lines = [];
  lines.push(border('┌', '┬', '┐', '─'));
  lines.push(headerRow());
  lines.push(border('├', '┼', '┤', '─'));
  for (const row of rows) {
    lines.push(dataRow(row));
  }
  lines.push(border('└', '┴', '┘', '─'));

  return lines.join('\n');
}
