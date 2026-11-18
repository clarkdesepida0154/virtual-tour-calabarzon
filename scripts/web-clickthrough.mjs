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
 * It serves <dist> on http://localhost:8765, walks onboarding → Welcome →
 * sign-in / sign-up validation → guest → Near me (location granted at
 * Calamba) → favorites → Explore + Add FAB → Details (share, directions) →
 * Virtual Tour → Quiz → Map → Progress (favorites) → offline cache → sign in
 * → sign out → session persistence, then a second fresh browser for Skip,
 * "Not now" and a refused location permission. It prints one line per check.
 * Share and "Get directions" are captured by stubbing navigator.share and
 * window.open (a headless browser has no share sheet or Maps app). Signing in uses a confirmed throwaway user created directly
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
/**
 * Clicks the first match that can really receive the click. Needed where a
 * dialog duplicates a label that also sits underneath its backdrop (e.g. the
 * "Sign out" button behind the "Sign out?" confirmation).
 */
async function clickActionable(locator) {
  const count = await locator.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const candidate = locator.nth(index);
    try {
      await candidate.click({ trial: true, timeout: 1500 });
      await candidate.click();
      return;
    } catch {
      // covered or hidden — try the next one
    }
  }
  throw new Error(`no clickable match for ${locator}`);
}

const db = await connect({ log: () => {} });
const EMAIL = `vtour-ui-check-${Date.now()}@example.com`;
const PASSWORD = 'UiCheck-2026-pass';
let testUserId = null;
let guestKey = null;
let guestKey2 = null;

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
/** Where the test "phone" is: Calamba, Laguna (next to the Rizal Shrine). */
const CALAMBA = { latitude: 14.2117, longitude: 121.1653 };
/** Records what the app hands to the share sheet and to Google Maps. */
const CAPTURE_OUTBOUND = () => {
  window.__shared = [];
  window.__opened = [];
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: (data) => {
      window.__shared.push(data);
      return Promise.resolve();
    },
  });
  window.open = (url) => {
    window.__opened.push(String(url));
    return null;
  };
};
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, geolocation: CALAMBA });
await context.addInitScript(CAPTURE_OUTBOUND);
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
});
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`));

try {
  // 0. Onboarding (first launch only)
  await page.goto(BASE);
  await expectVisible(page, text(page, 'Step inside the region'), 'Onboarding: slide 1 (virtual tours) on first launch');
  await expectVisible(page, page.getByLabel('Slide 1 of 3'), 'Onboarding: page dots say 1 of 3');
  await expectVisible(page, page.getByLabel('Skip the introduction'), 'Onboarding: Skip offered');
  await page.waitForTimeout(800);
  await shot(page, 'onboarding-1');
  await page.getByRole('button', { name: /^Next$/ }).click();
  await expectVisible(page, text(page, 'Read, then test yourself'), 'Onboarding: slide 2 (learn & quiz)');
  await page.waitForTimeout(600);
  await shot(page, 'onboarding-2');
  await page.getByRole('button', { name: /^Next$/ }).click();
  await expectVisible(page, text(page, 'Track where you have been'), 'Onboarding: slide 3 (your journey)');
  await page.waitForTimeout(600);
  await shot(page, 'onboarding-3');
  await page.getByRole('button', { name: /Get started/ }).click();

  // 1. Welcome
  await expectVisible(page, text(page, 'Continue as guest'), 'Welcome: shown after onboarding with Continue as guest');
  await page.reload();
  await expectVisible(page, text(page, 'Continue as guest'), 'Onboarding shown once: a reload goes straight to Welcome');
  const onboardingAgain = await text(page, 'Step inside the region').isVisible().catch(() => false);
  results.push(onboardingAgain ? 'FAIL  onboarding shown again' : 'ok    onboarding not shown again');
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

  // 5. Explore + Near me + favorites + FAB
  await page.getByRole('tab', { name: /Explore/ }).click();
  await expectVisible(page, page.getByLabel('Add a destination'), 'Explore: Add FAB visible');
  await expectVisible(page, text(page, 'See what is near you'), 'Near me: polite invitation shown before any permission dialog');
  const distancesBefore = await text(page, /km away/, false).count();
  results.push(distancesBefore === 0 ? 'ok    Near me: no distances before permission' : `FAIL  ${distancesBefore} distances before permission`);
  await context.grantPermissions(['geolocation'], { origin: BASE }); // the person taps "Allow" in the browser dialog
  await page.getByRole('button', { name: /Allow location/ }).click();
  await expectVisible(page, text(page, /\d km away$/, false), 'Near me: cards show "… km away" once allowed');
  const promptGone = !(await text(page, 'See what is near you').isVisible().catch(() => false));
  results.push(promptGone ? 'ok    Near me: invitation hides after allowing' : 'FAIL  invitation still shown');
  await page.getByRole('button', { name: /Nearest first/ }).click();
  await page.waitForTimeout(500);
  // From Calamba the Rizal Shrine is metres away ("… m away"), so match both units.
  const firstCard = await page.getByRole('button', { name: /m away$/ }).filter({ visible: true }).first().getAttribute('aria-label');
  results.push(/^Rizal Shrine,/.test(firstCard ?? '') ? 'ok    Near me: Nearest first puts Rizal Shrine (Calamba) on top' : `FAIL  nearest first: ${firstCard}`);
  results.push(`info  nearest card: ${firstCard}`);
  await page.waitForTimeout(1200);
  await shot(page, 'explore-nearest');
  await page.getByRole('button', { name: /Nearest first/ }).click();
  await page.waitForTimeout(400);
  const firstAZ = await page.getByRole('button', { name: /m away$/ }).filter({ visible: true }).first().getAttribute('aria-label');
  results.push(/^Aguinaldo Shrine,/.test(firstAZ ?? '') ? 'ok    Near me: toggling off returns to A–Z' : `FAIL  A–Z order: ${firstAZ}`);

  await page.getByLabel('Save Aguinaldo Shrine to favorites').filter({ visible: true }).first().click();
  await expectVisible(page, page.getByLabel('Remove Aguinaldo Shrine from favorites'), 'Favorites: heart on a card fills at once');
  await page.waitForTimeout(1500);
  const favRows = await db.query('select count(*)::int n from public.favorites where device_id = $1', [guestKey]);
  results.push(favRows.rows[0].n === 1 ? 'ok    Favorites: row saved in Supabase under the guest key' : `FAIL  favorites rows: ${favRows.rows[0].n}`);
  await page.getByLabel('Save Corregidor Island to favorites').filter({ visible: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByLabel('Remove Corregidor Island from favorites').filter({ visible: true }).first().click();
  await expectVisible(page, page.getByLabel('Save Corregidor Island to favorites'), 'Favorites: tapping again un-hearts');
  await page.waitForTimeout(1500);
  const favRows2 = await db.query('select count(*)::int n from public.favorites where device_id = $1', [guestKey]);
  results.push(favRows2.rows[0].n === 1 ? 'ok    Favorites: un-heart removes the row' : `FAIL  favorites rows after un-heart: ${favRows2.rows[0].n}`);
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
  await expectVisible(page, page.getByLabel('Remove Aguinaldo Shrine from favorites'), 'Details: heart shows the saved favorite');
  await expectVisible(page, text(page, /km away · straight-line distance/, false), 'Details: distance from the user');
  await page.waitForTimeout(1500);
  await shot(page, 'details-top');
  await page.getByLabel('Share Aguinaldo Shrine').click();
  await page.waitForTimeout(400);
  const shared = await page.evaluate(() => window.__shared.at(-1) ?? null);
  const shareLines = (shared?.text ?? shared?.message ?? '').split('\n');
  results.push(
    shareLines.length === 3 && shareLines[0] === 'Aguinaldo Shrine' && shareLines[2] === 'Kawit • Cavite'
      ? 'ok    Share: name, one-line description, "Kawit • Cavite"'
      : `FAIL  Share payload: ${JSON.stringify(shared)}`,
  );
  results.push(`info  shared one-liner: ${shareLines[1]}`);
  const falseAlarm = await text(page, 'Sharing isn’t available on this device.').isVisible().catch(() => false);
  results.push(falseAlarm ? 'FAIL  Share: "not available" toast after a successful share' : 'ok    Share: no error toast after a successful share');
  await page.getByRole('button', { name: /Get directions/ }).first().click();
  await page.waitForTimeout(400);
  const opened = await page.evaluate(() => window.__opened.at(-1) ?? null);
  results.push(
    /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=14\.\d+,120\.\d+$/.test(opened ?? '')
      ? `ok    Directions: Google Maps universal link (${opened.split('=').pop()})`
      : `FAIL  Directions URL: ${opened}`,
  );
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
  await expectVisible(page, text(page, 'You’ve toured it virtually — visit it in person'), 'Tour: completion invites a real visit');
  await page.getByRole('button', { name: /Get directions/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(300);
  const openedFromTour = await page.evaluate(() => window.__opened.at(-1) ?? null);
  results.push(/google\.com\/maps\/dir\/\?api=1&destination=/.test(openedFromTour ?? '') ? 'ok    Tour: Get directions opens Google Maps' : `FAIL  tour directions: ${openedFromTour}`);
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
  await expectVisible(page, text(page, '1 saved place for your next visit'), 'Progress: Favorites section counts 1 saved place');
  await expectVisible(page, page.getByRole('button', { name: /^Aguinaldo Shrine, Kawit • Cavite$/ }), 'Progress: favorite listed with its place');
  await page.waitForTimeout(1200);
  await shot(page, 'progress-guest');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(500);
  await shot(page, 'progress-guest-scrolled');

  // 11b. Offline: saved catalogue instead of an error
  await page.getByRole('tab', { name: /Explore/ }).click();
  await context.setOffline(true);
  await page.getByRole('button', { name: /^Nature filter$/ }).first().click();
  await expectVisible(page, text(page, 'Offline — showing saved data'), 'Offline: banner instead of the error state');
  await expectVisible(page, page.getByRole('button', { name: /^Pagsanjan Falls,/ }), 'Offline: filters still work on the saved catalogue');
  const offlineError = await text(page, 'No connection').isVisible().catch(() => false);
  results.push(offlineError ? 'FAIL  error state shown while offline' : 'ok    Offline: no error state while saved data exists');
  await page.waitForTimeout(800);
  await shot(page, 'explore-offline');
  await page.getByRole('button', { name: /^Pagsanjan Falls,/ }).first().click();
  const detailsOffline = await page.getByRole('heading', { name: 'Pagsanjan Falls' }).filter({ visible: true }).first().isVisible().catch(() => false);
  results.push(`info  offline Details for a never-opened place: ${detailsOffline ? 'shown' : 'error state (expected: only fetched details are saved)'}`);
  await page.getByLabel('Go back').filter({ visible: true }).first().click();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Try to reconnect' }).filter({ visible: true }).first().click();
  await page.waitForTimeout(2500);
  const bannerGone = !(await text(page, 'Offline — showing saved data').filter({ visible: true }).first().isVisible().catch(() => false));
  results.push(bannerGone ? 'ok    Offline: Retry after reconnecting hides the banner' : 'FAIL  banner still shown online');
  await page.getByRole('button', { name: /^Nature filter$/ }).first().click();

  // 12. Sign in from the Progress tab with a confirmed throwaway user
  await page.getByRole('tab', { name: /Progress/ }).click();
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
  await page.waitForTimeout(400);
  await clickActionable(page.getByRole('button', { name: /^Sign out$/ }).filter({ visible: true }));
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

  // 15. A second, fresh browser: Skip, "Not now", and a refused permission
  const fresh = await browser.newContext({ viewport: { width: 412, height: 915 } });
  await fresh.addInitScript(CAPTURE_OUTBOUND);
  const second = await fresh.newPage();
  await second.goto(BASE);
  await second.getByLabel('Skip the introduction').click();
  await expectVisible(second, text(second, 'Continue as guest'), 'Onboarding: Skip goes straight to Welcome');
  await text(second, 'Continue as guest').click();
  guestKey2 = await second.evaluate(() => localStorage.getItem('vtour.deviceId'));
  await second.getByRole('tab', { name: /Explore/ }).click();
  await expectVisible(second, text(second, 'See what is near you'), 'Near me (fresh install): invitation shown');
  await second.getByRole('button', { name: /^Not now$/ }).click();
  await second.waitForTimeout(400);
  const stillPrompt = await text(second, 'See what is near you').isVisible().catch(() => false);
  results.push(stillPrompt ? 'FAIL  "Not now" did not hide the invitation' : 'ok    Near me: "Not now" hides the invitation');
  await second.reload();
  await second.getByRole('tab', { name: /Explore/ }).click();
  await second.getByLabel('Add a destination').waitFor({ timeout: 15000 });
  const promptAfterReload = await text(second, 'See what is near you').isVisible().catch(() => false);
  results.push(promptAfterReload ? 'FAIL  invitation back after reload' : 'ok    Near me: "Not now" is remembered');
  // No permission granted: the browser refuses, and the feature simply hides.
  await second.getByRole('button', { name: /Nearest first/ }).click();
  await second.waitForTimeout(1500);
  const chipLeft = await second.getByRole('button', { name: /Nearest first/ }).isVisible().catch(() => false);
  const kmShown = await text(second, /km away/, false).count();
  results.push(!chipLeft && kmShown === 0 ? 'ok    Near me: refused permission hides the feature (no chip, no distances)' : `FAIL  after refusal: chip ${chipLeft}, distances ${kmShown}`);
  await fresh.close();
} catch (error) {
  results.push(`FAIL  aborted: ${error.message.split('\n').slice(0, 4).join(' | ')}`);
  await shot(page, 'aborted').catch(() => {});
} finally {
  // Clean-up: guest + test user progress rows, and the test user.
  for (const key of [guestKey, guestKey2, testUserId].filter(Boolean)) {
    await db.query('delete from public.quiz_attempts where device_id = $1', [key]);
    await db.query('delete from public.destination_completions where device_id = $1', [key]);
    await db.query('delete from public.favorites where device_id = $1', [key]);
  }
  if (testUserId) await db.query('delete from auth.users where id = $1', [testUserId]);
  const left = await db.query(
    `select (select count(*) from public.quiz_attempts)::int a, (select count(*) from public.destination_completions)::int c,
            (select count(*) from public.favorites)::int f, (select count(*) from auth.users)::int u`,
  );
  results.push(`info  after clean-up: attempts ${left.rows[0].a}, completions ${left.rows[0].c}, favorites ${left.rows[0].f}, auth users ${left.rows[0].u}`);
  await db.end();
  await browser.close();
  server.close();
}

console.log(results.join('\n'));
const relevantErrors = consoleErrors.filter((line) => !/favicon|Download the React DevTools/.test(line));
console.log(`\nconsole errors (${relevantErrors.length}):`);
for (const line of [...new Set(relevantErrors)].slice(0, 20)) console.log(`  - ${line}`);
console.log(`\n${results.filter((line) => line.startsWith('ok')).length} ok, ${results.filter((line) => line.startsWith('FAIL')).length} failed`);
