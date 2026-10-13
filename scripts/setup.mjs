// GAS プロジェクトを新規作成し、<project>/.clasp.json を書く。
//
// `clasp create-script` は作成直後にリモートの雛形（Code.js / appsscript.json）を
// 手元に pull するので、そのまま src/ で実行すると自分のコードが上書きされる。
// 一時ディレクトリで作成して scriptId だけ受け取り、.clasp.json は自前で書く。
//
// usage: node scripts/setup.mjs <project-dir> <title>

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [dir, title] = process.argv.slice(2);
if (!dir || !title) {
  console.error('usage: node scripts/setup.mjs <project-dir> <title>');
  process.exit(1);
}

const projectDir = resolve(dir);
const configPath = join(projectDir, '.clasp.json');
if (existsSync(configPath)) {
  console.error(`${configPath} はもうあります。作り直すなら消してから実行してください。`);
  process.exit(1);
}

const clasp = resolve('node_modules/.bin/clasp');
const tmp = mkdtempSync(join(tmpdir(), 'clasp-create-'));
try {
  const out = execFileSync(clasp, ['--json', 'create-script', '--type', 'standalone', '--title', title], {
    cwd: tmp,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
  const { scriptId } = JSON.parse(out.slice(out.indexOf('{')));
  if (!scriptId) throw new Error('scriptId を取得できませんでした:\n' + out);

  writeFileSync(configPath, JSON.stringify({ scriptId, rootDir: 'src' }, null, 2) + '\n');
  console.log(`作成しました: ${title} (${scriptId})`);
  console.log(`→ ${configPath}`);
  console.log('次: pnpm run push && pnpm run deploy');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
