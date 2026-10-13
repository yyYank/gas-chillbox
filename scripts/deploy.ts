// push して、既存のウェブアプリのデプロイを新しいバージョンに更新する（URL は変わらない）。
// まだデプロイが無ければ新規に作る。デプロイ ID は手元に保存せず、毎回リモートに聞く。
//
// usage: node scripts/deploy.ts <project-dir>

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/deploy.ts <project-dir>');
  process.exit(1);
}

const clasp = resolve('node_modules/.bin/clasp');
const run = (args, json = false) =>
  execFileSync(clasp, json ? ['--json', '-P', dir, ...args] : ['-P', dir, ...args], {
    encoding: 'utf8',
    stdio: ['inherit', json ? 'pipe' : 'inherit', 'inherit'],
  });
const parse = (out) => {
  const i = out.search(/[[{]/);
  return JSON.parse(out.slice(i));
};

let desc = new Date().toISOString().slice(0, 16).replace('T', ' ');
try {
  desc = execFileSync('git', ['log', '-1', '--format=%h %s'], { encoding: 'utf8' }).trim() || desc;
} catch { /* git 外でも動く */ }

run(['push', '-f']);

// @HEAD（開発用の /dev）以外で、いちばん新しいデプロイを更新対象にする
const deployments = parse(run(['list-deployments'], true));
const target = deployments
  .filter((d) => d.versionNumber)
  .sort((a, b) => b.versionNumber - a.versionNumber)[0];

const args = ['create-deployment', '-d', desc];
if (target) args.push('-i', target.deploymentId);
const res = parse(run(args, true));

console.log(`${target ? '更新' : '新規作成'}: ${res.deploymentId} @${res.versionNumber}  (${desc})`);
console.log(`https://script.google.com/macros/s/${res.deploymentId}/exec`);
