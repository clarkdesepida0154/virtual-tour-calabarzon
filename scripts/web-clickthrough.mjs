/**
 * Headless click-through of the app's main flows on the exported WEB build.
 *
 *   npx expo export --platform web --output-dir <dist>
 *   node scripts/web-clickthrough.mjs <dist> [screenshots dir]
 *
 * Needs Playwright with a Chromium build (not a project dependency):
 *   PLAYWRIGHT_MODULE    path to the `playwright` package (default: "playwright")
 *   PLAYWRIGHT_CHROMIUM  optional path to a chrome / headless-shell executable
 *
 * It serves <dist> on http://localhost:8765, walks Welcome → sign-in / sign-up
 * validation → guest → Explore + Add FAB → Details → Virtual Tour → Quiz →
 * Map → Progress → sign in → sign out → session persistence, and prints one
 * line per check. Signing in uses a confirmed throwaway user created directly
 * in auth.users through SUPABASE_DB_URL (setup-script privilege). Every
 * progress row and the test user are deleted at the end, also on failure.
 *
 * Web cannot show native Google Maps: the Map tab is checked against its web
 * stand-in (DestinationMap.web.tsx).
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = fileURLToPath(new URL('..', import.meta.url));
const [, , DIST, SHOTS = join(PROJECT, '.cache', 'clickthrough')] = process.argv;
if (!DIST) {
  console.error('Usage: node scripts/web-clickthrough.mjs <exported web dir> [screenshots dir]');
  process.exit(1);
}
mkdirSync(SHOTS, { recursive: true });
const require = createRequire(join(PROJECT, 'package.json'));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { connect } = require(join(PROJECT, 'scripts/lib/db.js'));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  let file = join(DIST, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(8765, resolve));
const BASE = 'http://localhost:8765';

let step = 0;
const results = [];
const consoleErrors = [];
async function shot(page, name) {
  step += 1;
  await page.screenshot({ path: join(SHOTS, `${String(step).padStart(2, '0')}-${name}.png`) });
}
async function expectVisible(page, locator, label) {
  try {
    await locator.filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    results.push(`ok    ${label}`);
    return true;
  } catch {
    results.push(`FAIL  ${label}`);
    return false;
  }
}
const text = (page, value, exact = true) => page.getByText(value, { exact });

const db = await connect({ log: () => {} });
const EMAIL = `vtour-ui-check-${Date.now()}@example.com`;
const PASSWORD = 'UiCheck-2026-pass';
let testUserId = null;
let guestKey = null;

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
});
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`));

try {
  // 1. Welcome
  await page.goto(BASE);
  await expectVisible(page, text(page, 'Continue as guest'), 'Welcome: shown on first launch with Continue as guest');
  await expectVisible(page, text(page, 'Create an account'), 'Welcome: Create an account');
  await expectVisible(page, text(page, 'Sign in'), 'Welcome: Sign in');
  await page.waitForTimeout(800);
  await shot(page, 'welcome');

  // 2. Sign in: inline validation
  await text(page, 'Sign in').first().click();
  await expectVisible(page, text(page, 'Sign In'), 'Sign In screen opens');
  await page.getByRole('button', { name: /^Sign in$/ }).last().click();
  await expectVisible(page, text(page, 'Enter your email address.'), 'Sign In: empty submit shows inline email error');
  await expectVisible(page, text(page, 'Enter your password.'), 'Sign In: empty submit shows inline password error');
  await page.locator('input:visible').nth(0).fill('not-an-email'); await page.locator('input:visible').nth(1).focus();
  await expectVisible(page, text(page, 'That doesn’t look like an email address.'), 'Sign In: bad email flagged');
  await shot(page, 'sign-in-validation');
  await page.getByLabel('Go back').filter({ visible: true }).first().click();

  // 3. Sign up: validation and a server error banner
  await text(page, 'Create an account').first().click();
  await expectVisible(page, text(page, 'Create an Account'), 'Sign Up screen opens');
  const fields = page.locator('input:visible');
  await fields.nth(0).fill('someone@example.com');
  await fields.nth(1).fill('short');
  await fields.nth(2).fill('different');
  await page.getByRole('button', { name: /Create account/ }).click();
  await expectVisible(page, text(page, 'Use at least 8 characters.'), 'Sign Up: short password flagged');
  await expectVisible(page, text(page, 'The two passwords don’t match.'), 'Sign Up: mismatched confirmation flagged');
  await shot(page, 'sign-up-validation');
  await fields.nth(1).fill('LongEnough123');
  await fields.nth(2).fill('LongEnough123');
  await page.getByRole('button', { name: /Create account/ }).click();
  const banner = page.getByRole('alert');
  if (await expectVisible(page, banner, 'Sign Up: Supabase refusal shown as a friendly banner')) {
    results.push(`info  banner text: "${(await banner.first().innerText()).trim()}"`);
  }
  await shot(page, 'sign-up-server-error');
  await page.getByLabel('Go back').filter({ visible: true }).first().click();

  // 4. Continue as guest -> tabs
  await text(page, 'Continue as guest').click();
  await expectVisible(page, page.getByRole('tab', { name: /Map/ }), 'Guest: app opens with the Map tab');
  await expectVisible(page, page.getByRole('tab', { name: /Progress/ }), 'Guest: Progress tab present');
  const addTab = await page.getByRole('tab', { name: /^Add/ }).count();
  results.push(addTab === 0 ? 'ok    Add tab removed' : 'FAIL  Add tab still present');
  guestKey = await page.evaluate(() => localStorage.getItem('vtour.deviceId'));
  results.push(guestKey ? `ok    guest device UUID persisted (${guestKey.slice(0, 8)}…)` : 'FAIL  no guest device id');
  await page.waitForTimeout(1500);
  await shot(page, 'home');

  // 5. Explore + FAB
  await page.getByRole('tab', { name: /Explore/ }).click();
  await expectVisible(page, page.getByLabel('Add a destination'), 'Explore: Add FAB visible');
  await page.waitForTimeout(1200);
  await shot(page, 'explore-fab');
  await page.getByLabel('Add a destination').click();
  await expectVisible(page, text(page, 'Add a Destination'), 'FAB opens the Add form');
  await page.getByLabel('Go back').filter({ visible: true }).first().click();
  await expectVisible(page, page.getByLabel('Add a destination'), 'Back from Add returns to Explore');

  // 6. Details
  await page.getByRole('button', { name: /^Aguinaldo Shrine/ }).first().click();
  await expectVisible(page, text(page, 'Start Virtual Tour'), 'Details: Start Virtual Tour button');
  await expectVisible(page, page.getByRole('button', { name: /^Quiz$/ }), 'Details: Quiz button');
  await expectVisible(page, text(page, 'View on the map'), 'Details: map preview card');
  await expectVisible(page, text(page, 'Manage this entry'), 'Details: Edit / Delete kept under Manage this entry');
  await page.waitForTimeout(1500);
  await shot(page, 'details-top');
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(600);
  await shot(page, 'details-scrolled');

  // 7. Virtual tour
  await text(page, 'Start Virtual Tour').click();
  await expectVisible(page, text(page, 'A virtual tour'), 'Tour: intro step');
  const tabBarVisible = await page.getByRole('tab', { name: /Explore/ }).isVisible().catch(() => false);
  results.push(tabBarVisible ? 'FAIL  tab bar visible during tour' : 'ok    tab bar hidden during tour');
  await page.waitForTimeout(1500);
  await shot(page, 'tour-intro');
  await text(page, 'Begin the tour').click();
  await expectVisible(page, text(page, 'Through the lens'), 'Tour: gallery step');
  await expectVisible(page, text(page, /Photo: .*Wikimedia Commons/, false), 'Tour: gallery shows the photo credit');
  await expectVisible(page, text(page, /Plate 1 of 3/, false), 'Tour: 3 gallery plates');
  await page.waitForTimeout(1200);
  await shot(page, 'tour-gallery-1');
  await page.getByLabel('Next photo').click();
  await expectVisible(page, text(page, /Plate 2 of 3/, false), 'Tour: next photo arrow pages the gallery');
  await page.waitForTimeout(900);
  await shot(page, 'tour-gallery-2');
  await text(page, 'Continue').click();
  await expectVisible(page, text(page, 'Chapter I'), 'Tour: History chapter');
  await page.waitForTimeout(1200);
  await shot(page, 'tour-history');
  await text(page, 'Continue').click();
  await expectVisible(page, text(page, 'Cultural Significance'), 'Tour: Cultural Significance chapter');
  await page.waitForTimeout(800);
  await shot(page, 'tour-culture');
  await page.getByLabel('Previous step').click();
  await expectVisible(page, text(page, 'Chapter I'), 'Tour: Back returns to History');
  await text(page, 'Continue').click();
  await text(page, 'Finish the tour').click();
  await expectVisible(page, text(page, 'Tour complete'), 'Tour: completion step');
  await shot(page, 'tour-complete');
  await text(page, 'Mark as Visited').click();
  await expectVisible(page, text(page, 'Added to your visited places'), 'Tour: Mark as Visited shows completed state');
  await page.waitForTimeout(600);
  await shot(page, 'tour-visited');
  await text(page, 'Take the Quiz').click();

  // 8. Quiz
  await expectVisible(page, text(page, 'Start the quiz'), 'Quiz: intro card');
  await shot(page, 'quiz-intro');
  await text(page, 'Start the quiz').click();
  const correctSlots = [];
  for (let question = 0; question < 5; question += 1) {
    await expectVisible(page, text(page, `Question ${question + 1} of 5`), `Quiz: question ${question + 1} shown`);
    const options = page.getByRole('button', { name: /^Option [A-D]:/ });
    // Pick B on odd questions, A on even ones, to get a mix of right and wrong.
    await options.nth(question % 2).click();
    const feedback = page.getByText(/Correct — well done!|Not quite\./);
    await feedback.first().waitFor({ timeout: 5000 });
    const labels = await options.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
    correctSlots.push(labels.findIndex((label) => /Correct answer\.|Your answer, correct\./.test(label)));
    const disabled = await options.evaluateAll((nodes) => nodes.every((node) => node.getAttribute('aria-disabled') === 'true'));
    if (question === 0) {
      results.push(disabled ? 'ok    Quiz: options lock after picking' : 'FAIL  Quiz: options still enabled after picking');
      await page.waitForTimeout(700);
      await shot(page, 'quiz-answered');
    }
    await text(page, question === 4 ? 'See my score' : 'Next question').click();
  }
  results.push(`info  correct answer positions this attempt (0=A): ${correctSlots.join(', ')}`);
  await expectVisible(page, text(page, 'Score saved to your progress'), 'Quiz: attempt saved to Supabase');
  const scoreLabel = await page.getByRole('progressbar').first().getAttribute('aria-label');
  results.push(`info  score screen: ${scoreLabel}`);
  await page.waitForTimeout(900);
  await shot(page, 'quiz-result');

  // Retake: options shuffled again
  await text(page, 'Retake the quiz').click();
  await expectVisible(page, text(page, 'Question 1 of 5'), 'Quiz: Retake restarts at question 1');
  await page.getByLabel('Close the quiz').click();
  await page.waitForTimeout(500);
  if (await text(page, 'Leave the quiz?').isVisible().catch(() => false)) await text(page, 'Leave').click();

  // 9. Details shows visited + best score
  await expectVisible(page, text(page, 'Visited'), 'Details: Visited badge after the tour');
  await expectVisible(page, page.getByLabel(/Best quiz score \d out of 5/), 'Details: best-score badge after the quiz');
  await page.waitForTimeout(800);
  await shot(page, 'details-progress');

  // 10. Map from Details
  await text(page, 'View on the map').click();
  await expectVisible(page, page.getByLabel(/^Open Aguinaldo Shrine/), 'Map: opened centred on the destination with its callout');
  await expectVisible(page, page.getByLabel(/Historical Site, \d+ on the map/), 'Map: legend chip row with counts');
  const pinCount = await page.getByRole('button', { name: /, (Historical Site|Church & Religious|Museum & Art|Natural Wonder|Heritage Town & Culture)$/ }).count();
  results.push(pinCount === 26 ? 'ok    Map: 26 pins plotted' : `FAIL  Map: ${pinCount} pins plotted`);
  await page.waitForTimeout(1000);
  await shot(page, 'map-focused');
  await page.getByLabel(/Natural Wonder, \d+ on the map/).click();
  const naturePins = await page.getByRole('button', { name: /, Natural Wonder$/ }).count();
  const otherPins = await page.getByRole('button', { name: /, Historical Site$/ }).count();
  results.push(naturePins > 0 && otherPins === 0 ? `ok    Map: legend filter shows only Nature (${naturePins})` : `FAIL  Map legend filter (${naturePins}/${otherPins})`);
  await shot(page, 'map-filtered');
  await page.getByLabel(/Natural Wonder, \d+ on the map/).click();
  await page.getByRole('button', { name: /^Corregidor Island, Historical Site$/ }).click();
  await page.waitForTimeout(400);
  await page.getByLabel(/^Open Corregidor Island/).click();
  await expectVisible(page, page.getByRole('heading', { name: 'Corregidor Island' }), 'Map: callout opens Details');
  await page.getByLabel('Go back').filter({ visible: true }).first().click();

  // 11. Progress tab
  await page.getByRole('tab', { name: /Progress/ }).click();
  await expectVisible(page, page.getByLabel(/1 of 26 destinations visited/), 'Progress: 1/26 ring');
  await expectVisible(page, page.getByLabel(/Quizzes taken: 1/), 'Progress: 1 quiz taken');
  await expectVisible(page, page.getByLabel(/Cavite: 1 of 5 visited/), 'Progress: province breakdown');
  await expectVisible(page, text(page, 'Guest'), 'Progress: shows Guest');
  await expectVisible(page, page.getByRole('button', { name: /Create an account/ }), 'Progress: guest nudge to create an account');
  await page.waitForTimeout(1200);
  await shot(page, 'progress-guest');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(500);
  await shot(page, 'progress-guest-scrolled');

  // 12. Sign in from the Progress tab with a confirmed throwaway user
  const created = await db.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       $1, extensions.crypt($2, extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
     returning id`,
    [EMAIL, PASSWORD],
  );
  testUserId = created.rows[0].id;
  await page.mouse.wheel(0, -2000);
  await page.getByRole('button', { name: /^Sign in$/ }).first().click();
  await page.locator('input:visible').nth(0).fill(EMAIL);
  await page.locator('input:visible').nth(1).fill('wrong-password');
  await page.getByRole('button', { name: /^Sign in$/ }).last().click();
  await expectVisible(page, text(page, /don’t match an account/, false), 'Sign In: wrong password shows a friendly error');
  await page.locator('input:visible').nth(1).fill(PASSWORD);
  await page.getByRole('button', { name: /^Sign in$/ }).last().click();
  await expectVisible(page, page.getByLabel(`Signed in as ${EMAIL}`), 'Signed in: Progress header shows the email');
  await expectVisible(page, page.getByLabel(/0 of 26 destinations visited/), 'Signed in: progress is keyed to the account (0/26)');
  await page.waitForTimeout(800);
  await shot(page, 'progress-signed-in');

  // 13. Sign out -> Welcome
  await page.getByRole('button', { name: /Sign out/ }).first().click();
  await page.getByRole('button', { name: /^Sign out$/ }).last().click();
  await expectVisible(page, text(page, 'Continue as guest'), 'Sign out returns to Welcome');
  await shot(page, 'after-sign-out');

  // 14. Reload: session persistence (sign in again, reload, still signed in)
  await text(page, 'Sign in').first().click();
  await page.locator('input:visible').nth(0).fill(EMAIL);
  await page.locator('input:visible').nth(1).fill(PASSWORD);
  await page.getByRole('button', { name: /^Sign in$/ }).last().click();
  await page.getByRole('tab', { name: /Progress/ }).waitFor({ timeout: 15000 });
  await page.reload();
  await page.getByRole('tab', { name: /Progress/ }).click();
  await expectVisible(page, page.getByLabel(`Signed in as ${EMAIL}`), 'Session persists across a reload (AsyncStorage)');
} catch (error) {
  results.push(`FAIL  aborted: ${error.message.split('\n')[0]}`);
  await shot(page, 'aborted').catch(() => {});
} finally {
  // Clean-up: guest + test user progress rows, and the test user.
  for (const key of [guestKey, testUserId].filter(Boolean)) {
    await db.query('delete from public.quiz_attempts where device_id = $1', [key]);
    await db.query('delete from public.destination_completions where device_id = $1', [key]);
  }
  if (testUserId) await db.query('delete from auth.users where id = $1', [testUserId]);
  const left = await db.query(
    `select (select count(*) from public.quiz_attempts)::int a, (select count(*) from public.destination_completions)::int c,
            (select count(*) from auth.users)::int u`,
  );
  results.push(`info  after clean-up: attempts ${left.rows[0].a}, completions ${left.rows[0].c}, auth users ${left.rows[0].u}`);
  await db.end();
  await browser.close();
  server.close();
}

console.log(results.join('\n'));
const relevantErrors = consoleErrors.filter((line) => !/favicon|Download the React DevTools/.test(line));
console.log(`\nconsole errors (${relevantErrors.length}):`);
for (const line of [...new Set(relevantErrors)].slice(0, 20)) console.log(`  - ${line}`);
console.log(`\n${results.filter((line) => line.startsWith('ok')).length} ok, ${results.filter((line) => line.startsWith('FAIL')).length} failed`);
