const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

export function info(message) {
  console.log(`${BLUE}ℹ${RESET} ${message}`);
}

export function success(message) {
  console.log(`${GREEN}✔${RESET} ${message}`);
}

export function warn(message) {
  console.log(`${YELLOW}⚠${RESET} ${message}`);
}

export function error(message) {
  console.log(`${RED}✖${RESET} ${message}`);
}

export function highlight(message) {
  console.log(`${CYAN}${message}${RESET}`);
}
