// checa a sintaxe de todo o JS do app (ES modules) sem executar nada; uso: node .claude/scripts/check.mjs [arquivos...]
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') || e.name.endsWith('.mjs') ? [join(d, e.name)] : []);
const files = process.argv.length > 2 ? process.argv.slice(2) : [...walk('js'), 'desktop/copy.mjs'];
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: readFileSync(f) });
  if (r.status) { bad++; console.log(`✗ ${f}\n${r.stderr.toString().split('\n').slice(0, 6).join('\n')}`); }
}
console.log(bad ? `${bad} arquivo(s) com erro de sintaxe` : `ok: ${files.length} arquivos`);
process.exit(bad ? 1 : 0);
