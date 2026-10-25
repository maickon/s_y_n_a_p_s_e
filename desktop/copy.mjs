// copia o app web (mesmo código do GitHub Pages) para dist/
import { cpSync, rmSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
for (const f of ['index.html', 'css', 'js', 'vendor', 'hyperframes']) cpSync('../' + f, 'dist/' + f, { recursive: true });
