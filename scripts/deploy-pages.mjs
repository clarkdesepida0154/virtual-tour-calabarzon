/**
 * Builds the web demo for GitHub Pages and publishes it to the gh-pages branch.
 *
 *   node scripts/deploy-pages.mjs            # build + force-push gh-pages
 *   node scripts/deploy-pages.mjs --build    # build only (dist-pages/)
 *
 * The site lives at https://<owner>.github.io/virtual-tour-calabarzon/, so the
 * export gets the base URL /virtual-tour-calabarzon (app.config.js reads
 * WEB_BASE_URL). 404.html is a copy of index.html (Pages' SPA fallback) and
 * .nojekyll keeps Pages from dropping the _expo folder. The bundle holds only
 * the public EXPO_PUBLIC_* values (the publishable key is safe in clients);
 * the script refuses to publish if a Google API key or DB URL slipped in.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = '/virtual-tour-calabarzon';
const out = 'dist-pages';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });

rmSync(out, { recursive: true, force: true });
run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', out, '--clear'], { env: { ...process.env, WEB_BASE_URL: BASE } });
cpSync(join(out, 'index.html'), join(out, '404.html'));
writeFileSync(join(out, '.nojekyll'), '');

// Safety scan of everything we are about to publish.
const bad = [/AIza[0-9A-Za-z_-]{30,}/, /sb_secret_[A-Za-z0-9_-]{10,}/, /postgres(ql)?:\/\/[^\s"']*:[^\s"'@]+@/];
let scanned = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|json|map|txt|css)$/.test(name)) {
      scanned++;
      const text = readFileSync(p, 'utf8');
      for (const re of bad) if (re.test(text)) throw new Error(`Refusing to publish: ${re} found in ${p}`);
    }
  }
})(out);
console.log(`Safety scan clean (${scanned} text files).`);

if (process.argv.includes('--build')) process.exit(0);

const remote = execFileSync('git', ['remote', 'get-url', 'origin']).toString().trim();
const tmp = mkdtempSync(join(tmpdir(), 'pages-'));
cpSync(out, tmp, { recursive: true });
const git = (...a) => execFileSync('git', a, { cwd: tmp, stdio: 'inherit' });
git('init', '-q', '-b', 'gh-pages');
git('add', '-A');
git('-c', 'user.name=Pages Deploy', '-c', 'user.email=noreply@users.noreply.github.com', 'commit', '-q', '-m', 'Deploy web demo');
git('push', '-f', remote, 'gh-pages');
rmSync(tmp, { recursive: true, force: true });
console.log('Published to gh-pages.');
