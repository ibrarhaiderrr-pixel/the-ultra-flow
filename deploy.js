// deploy.js — website + poore project ka backup GitHub par bhejta hai.
// Chalane ka tareeqa (is folder ke andar):  node deploy.js
// Zaroorat: GitHub CLI installed ho aur login ho  ->  "C:\Program Files\GitHub CLI\gh.exe" auth login --web
// - public/        -> website (Vercel isay khud live kar deta hai)
// - admin-backend/ -> admin panel ka code (sirf backup; live karne ke liye "npx wrangler deploy")
// - docs/, PROJECT-GUIDE.md (README.md ban kar), deploy.js
// Secrets (.dev.vars, ADMIN-PASSWORD.txt), node_modules aur badi files kabhi upload nahi hoti.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const GH = 'C:\\Program Files\\GitHub CLI\\gh.exe';
const REPO = 'ibrarhaiderrr-pixel/the-ultra-flow';
const ROOT = __dirname;
const SKIP = new Set(['node_modules', '.wrangler', '.dev.vars', 'ADMIN-PASSWORD.txt', 'package-lock.json']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap(f => {
    if (SKIP.has(f)) return [];
    const p = path.join(dir, f);
    return fs.statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const files = [
  ...walk(path.join(ROOT, 'public')),
  ...walk(path.join(ROOT, 'admin-backend', 'src')),
  ...walk(path.join(ROOT, 'admin-backend', 'public')),
  ...['schema.sql', 'wrangler.toml', 'package.json', '.gitignore'].map(f => path.join(ROOT, 'admin-backend', f)),
  ...walk(path.join(ROOT, 'docs')),
  path.join(ROOT, 'deploy.js'),
].filter(f => fs.existsSync(f)).map(f => ({ local: f, remote: rel(f) }));
files.push({ local: path.join(ROOT, 'PROJECT-GUIDE.md'), remote: 'README.md' });

function remoteSha(remote) {
  try {
    return execFileSync(GH, ['api', `repos/${REPO}/contents/${remote}`, '--jq', '.sha'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { return null; }
}
const gitSha = buf => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

let uploaded = 0, same = 0;
for (const { local, remote } of files) {
  const buf = fs.readFileSync(local);
  if (buf.length > 20 * 1024 * 1024) { console.log('Skipped (too big):', remote); continue; }
  const sha = remoteSha(remote);
  if (sha === gitSha(buf)) { same++; continue; }
  const body = { message: `Update ${remote}`, content: buf.toString('base64'), branch: 'main' };
  if (sha) body.sha = sha;
  const tmp = path.join(os.tmpdir(), 'gh_upload.json');
  fs.writeFileSync(tmp, JSON.stringify(body));
  execFileSync(GH, ['api', '-X', 'PUT', `repos/${REPO}/contents/${remote}`, '--input', tmp], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('Uploaded:', remote);
  uploaded++;
}
console.log(`DONE — ${uploaded} uploaded, ${same} already up to date.`);
