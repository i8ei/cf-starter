import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const mode = process.argv[2] === 'remote' ? '--remote' : '--local';
const wranglerPath = resolve(process.cwd(), 'wrangler.jsonc');
const raw = readFileSync(wranglerPath, 'utf8');

function stripLineComments(input) {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') i++;
      out += '\n';
      continue;
    }

    out += ch;
  }

  return out;
}

const sanitized = stripLineComments(raw).replace(/,\s*([}\]])/g, '$1');
const config = JSON.parse(sanitized);

const dbName = config?.d1_databases?.[0]?.database_name;
if (!dbName) {
  console.error('d1_databases[0].database_name not found in wrangler.jsonc');
  process.exit(1);
}

const args = ['d1', 'migrations', 'apply', dbName, mode];
const result = spawnSync('wrangler', args, { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
