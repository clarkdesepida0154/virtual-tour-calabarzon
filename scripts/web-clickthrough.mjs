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
 * window.open (a headless browser has no share sheet or Maps app).
 *
 * Run 5 adds: narration (window.speechSynthesis is stubbed with one en-US
 * voice — no audio is produced), Settings, dark mode (the page background is
 * sampled from screenshots on five screens), the Filipino UI (known strings
 * asserted) and Photo Credits. The original flows run first, unchanged. Signing in uses a confirmed throwaway user created directly
 * in auth.users through SUPABASE_DB_URL (setup-script privilege). Every
 * progress row and the test user are deleted at the end, also on failure.
 *
 * Run 6 adds (after every earlier flow, signed in as the throwaway user):
 * the 360° Street View link (Details + tour Gallery card), star ratings
 * (tap, upsert, average, Explore card), badges (Cavite visits written to the
 * database → once-only celebration → grid), the certificate (light + dark
 * parchment, typed name, share), Heritage Insights, the field-trip planner
 * (select → suggested order → reorder → Google Maps URL → save / delete) and
 * an auto-generated starter quiz for a destination added through the form
 * (deleted again).
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
const appVersion = require(join(PROJECT, 'app.json')).expo.version;

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
/** Run 6: the destination the click-through adds through the form (deleted again). */
const AUTO_NAME = `UI check Casa Tejeros ${Date.now()}`;
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
  // A fake text-to-speech engine with one English voice, so the narration
  // button appears and its Listen / Stop cycle can be driven.
  window.__spoken = [];
  window.__cancelled = 0;
  let current = null;
  const voice = { lang: 'en-US', name: 'Test voice', voiceURI: 'test-en-us', localService: true, default: true };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: () => [voice],
      speak(utterance) {
        current = utterance;
        window.__spoken.push(utterance.text);
        this.speaking = true;
        setTimeout(() => utterance.onstart?.(new Event('start')), 30);
      },
      cancel() {
        window.__cancelled += 1;
        this.speaking = false;
        const ending = current;
        current = null;
        if (ending) setTimeout(() => ending.onend?.(new Event('end')), 0);
      },
      pause() {},
      resume() {},
      addEventListener() {},
      removeEventListener() {},
    },
  });
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

  // A confirmed throwaway account (created directly in auth.users). Sign-up
  // with its address must be refused by Supabase whether or not "Confirm
  // email" is on; sign-in uses it later.
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

  // 3. Sign up: validation and a server error banner
  await text(page, 'Create an account').first().click();
  await expectVisible(page, text(page, 'Create an Account'), 'Sign Up screen opens');
  const fields = page.locator('input:visible');
  await fields.nth(0).fill(EMAIL);
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
  // Narration (museum audio guide)
  const listen = page.getByRole('button', { name: 'Listen to this chapter read aloud' }).filter({ visible: true });
  await expectVisible(page, listen, 'Narration: Listen button on the History chapter');
  await listen.first().click();
  await expectVisible(page, page.getByRole('button', { name: 'Stop the narration' }), 'Narration: turns into Stop while reading');
  const spoken = await page.evaluate(() => window.__spoken.at(-1) ?? '');
  results.push(/^History\. /.test(spoken) && spoken.length > 200 ? `ok    Narration: reads the chapter (${spoken.length} characters)` : `FAIL  narration text: ${spoken.slice(0, 60)}`);
  await page.waitForTimeout(500);
  await shot(page, 'tour-history-narrating');
  await page.getByRole('button', { name: 'Stop the narration' }).filter({ visible: true }).first().click();
  await expectVisible(page, listen, 'Narration: Stop returns to Listen');
  await listen.first().click();
  await page.waitForTimeout(300);
  const cancelledBefore = await page.evaluate(() => window.__cancelled);
  await page.waitForTimeout(900);
  await shot(page, 'tour-history');
  await text(page, 'Continue').click();
  await expectVisible(page, text(page, 'Cultural Significance'), 'Tour: Cultural Significance chapter');
  const cancelledAfter = await page.evaluate(() => window.__cancelled);
  results.push(cancelledAfter > cancelledBefore ? 'ok    Narration: leaving the step stops the reading' : 'FAIL  narration kept going after leaving the step');
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

  // 11c. Settings: dark mode, Filipino, Photo Credits — then back to the defaults
  const sharp = require('sharp');
  /** Average colour of a strip down the left edge of the screen (the page background). */
  const backgroundOf = async (target) => {
    const image = await target.screenshot({ clip: { x: 2, y: 420, width: 6, height: 40 } });
    const { data } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 3) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = data.length / 3;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / n };
  };
  const openSettings = async () => {
    await page.getByRole('tab', { name: /Progress|Progreso/ }).click();
    await page.waitForTimeout(400);
    // Home's gear stays mounted behind the Progress tab: click the one that can be clicked.
    await clickActionable(page.getByLabel(/^(Open settings|Buksan ang mga setting)$/).filter({ visible: true }));
  };

  await openSettings();
  await expectVisible(page, page.getByRole('heading', { name: 'Settings' }), 'Settings: opens from the Progress gear');
  for (const section of ['Appearance', 'Language', 'Narration', 'About', 'Legal']) {
    await expectVisible(page, page.getByRole('heading', { name: section }), `Settings: ${section} section`);
  }
  await expectVisible(page, text(page, `Version ${appVersion}`), `Settings: shows the app version from the app config (${appVersion})`);
  await expectVisible(page, text(page, 'Destination write-ups and quizzes stay in English.'), 'Settings: content-stays-English note');
  const lightBg = await backgroundOf(page);
  await page.waitForTimeout(600);
  await shot(page, 'settings-light');

  // Photo Credits (live captions)
  await page.getByRole('button', { name: 'Photo credits' }).filter({ visible: true }).first().click();
  await expectVisible(page, page.getByRole('heading', { name: 'Photo Credits' }), 'Credits: Photo Credits screen opens');
  await expectVisible(page, text(page, '78 photographs'), 'Credits: counts all 78 photographs');
  await expectVisible(page, text(page, /Wikimedia Commons and is used under/, false), 'Credits: Commons framing sentence on top');
  const creditLines = await text(page, /^Photo: .+via Wikimedia Commons$/, false).count();
  results.push(creditLines >= 9 ? `ok    Credits: credit lines rendered (${creditLines} in view)` : `FAIL  only ${creditLines} credit lines`);
  await page.waitForTimeout(600);
  await shot(page, 'credits');
  await page.getByLabel('Go back').filter({ visible: true }).first().click();

  // Dark mode, applied instantly
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.waitForTimeout(500);
  const darkBg = await backgroundOf(page);
  results.push(
    darkBg.luminance < 40 && lightBg.luminance > 200
      ? `ok    Dark mode: Settings background ${JSON.stringify(lightBg).slice(0, 30)}… → rgb(${darkBg.r},${darkBg.g},${darkBg.b})`
      : `FAIL  dark mode background light ${lightBg.luminance.toFixed(0)} → dark ${darkBg.luminance.toFixed(0)}`,
  );
  results.push(darkBg.r > darkBg.b ? 'ok    Dark mode: warm dark (not pure black / not blue-grey)' : `FAIL  dark background not warm: ${JSON.stringify(darkBg)}`);
  await shot(page, 'settings-dark');
  await page.getByLabel('Go back').filter({ visible: true }).first().click();
  for (const [tab, name] of [['Home', 'home-dark'], ['Explore', 'explore-dark'], ['Map', 'map-dark'], ['Progress', 'progress-dark']]) {
    await page.getByRole('tab', { name: new RegExp(tab) }).click();
    await page.waitForTimeout(1500);
    const bg = await backgroundOf(page);
    results.push(bg.luminance < 60 ? `ok    Dark mode: ${tab} renders dark (luminance ${bg.luminance.toFixed(0)})` : `FAIL  ${tab} not dark (luminance ${bg.luminance.toFixed(0)})`);
    await shot(page, name);
  }
  await page.getByRole('tab', { name: /Explore/ }).click();
  await page.getByRole('button', { name: /^Aguinaldo Shrine,/ }).filter({ visible: true }).first().click();
  await expectVisible(page, text(page, 'Start Virtual Tour'), 'Dark mode: Details opens');
  await page.waitForTimeout(1500);
  await shot(page, 'details-dark');
  await text(page, 'Start Virtual Tour').filter({ visible: true }).first().click();
  await expectVisible(page, text(page, 'A virtual tour'), 'Dark mode: tour opens on the gallery wall');
  await page.waitForTimeout(1200);
  await shot(page, 'tour-dark');
  await page.getByLabel('Close the tour').click();
  await page.getByLabel('Go back').filter({ visible: true }).first().click();

  // Filipino UI, applied instantly
  await openSettings();
  await page.getByRole('radio', { name: 'Filipino' }).click();
  await expectVisible(page, page.getByRole('heading', { name: 'Mga Setting' }), 'Filipino: Settings heading switches to "Mga Setting"');
  await expectVisible(page, page.getByRole('heading', { name: 'Itsura' }), 'Filipino: section titles translated (Itsura)');
  await expectVisible(page, text(page, 'Nananatiling English ang mga paglalarawan ng destinasyon at ang mga quiz.'), 'Filipino: content note translated');
  await shot(page, 'settings-fil');
  await page.getByLabel('Bumalik').filter({ visible: true }).first().click();
  await expectVisible(page, page.getByRole('tab', { name: /Tuklasin/ }), 'Filipino: tab bar says Tuklasin / Progreso');
  await expectVisible(page, page.getByRole('heading', { name: 'Progreso' }), 'Filipino: Progress title is "Progreso"');
  await expectVisible(page, page.getByRole('heading', { name: 'Mga Paborito' }), 'Filipino: Favorites section is "Mga Paborito"');
  await page.getByRole('tab', { name: /Tuklasin/ }).click();
  await expectVisible(page, text(page, 'Kategorya'), 'Filipino: Explore filter label "Kategorya"');
  await expectVisible(page, text(page, '26 destinasyon'), 'Filipino: result count "26 destinasyon"');
  await expectVisible(page, page.getByRole('button', { name: /Pinakamalapit muna/ }), 'Filipino: "Pinakamalapit muna" sort chip');
  await page.waitForTimeout(1200);
  await shot(page, 'explore-fil');
  await page.getByRole('button', { name: /^Aguinaldo Shrine,/ }).filter({ visible: true }).first().click();
  await expectVisible(page, text(page, 'Simulan ang Tour'), 'Filipino: Details action "Simulan ang Tour"');
  await expectVisible(page, page.getByRole('heading', { name: 'Kasaysayan' }), 'Filipino: History section is "Kasaysayan"');
  const englishContent = await text(page, /ancestral home of General Emilio Aguinaldo/, false).count();
  results.push(englishContent > 0 ? 'ok    Filipino: destination write-up stays English (by design)' : 'FAIL  destination content missing');
  await page.waitForTimeout(1000);
  await shot(page, 'details-fil');
  await page.getByLabel('Bumalik').filter({ visible: true }).first().click();

  // Back to the defaults (English, Light) for the remaining flows
  await openSettings();
  await page.getByRole('radio', { name: 'English' }).click();
  await page.getByRole('radio', { name: 'Light' }).click();
  await expectVisible(page, page.getByRole('heading', { name: 'Settings' }), 'Settings: back to English');
  const restoredBg = await backgroundOf(page);
  results.push(restoredBg.luminance > 200 ? 'ok    Settings: back to the light theme' : 'FAIL  light theme not restored');
  const saved = await page.evaluate(() => localStorage.getItem('vtour.preferences'));
  results.push(/"theme":"light"/.test(saved ?? '') && /"locale":"en"/.test(saved ?? '') ? 'ok    Settings: choices saved on the device' : `FAIL  saved preferences: ${saved}`);
  await page.getByLabel('Go back').filter({ visible: true }).first().click();

  // 12. Sign in from the Progress tab with a confirmed throwaway user
  await page.getByRole('tab', { name: /Progress/ }).click();
  await page.mouse.wheel(0, -2000);
  await page.getByRole('button', { name: /^Sign in$/ }).first().click();
  // Wait for the Sign In screen before typing (otherwise a hidden tab's search box can be filled).
  await page.getByRole('heading', { name: 'Sign In' }).filter({ visible: true }).first().waitFor({ timeout: 15000 });
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
  await page.waitForTimeout(400);
  await clickActionable(text(page, 'Sign in').filter({ visible: true }));
  await page.locator('input:visible').nth(0).fill(EMAIL);
  await page.locator('input:visible').nth(1).fill(PASSWORD);
  await page.getByRole('button', { name: /^Sign in$/ }).last().click();
  await page.getByRole('tab', { name: /Progress/ }).waitFor({ timeout: 15000 });
  await page.reload();
  await page.getByRole('tab', { name: /Progress/ }).click();
  await expectVisible(page, page.getByLabel(`Signed in as ${EMAIL}`), 'Session persists across a reload (AsyncStorage)');

  // ===========================================================================
  // Run 6 feature modules (signed in as the throwaway account). The legacy
  // flows above ran first, unchanged.
  // ===========================================================================
  results.push('info  --- Run 6 feature modules ---');
  const goTab = async (name) => {
    await page.getByRole('tab', { name }).click();
    await page.waitForTimeout(500);
  };
  const lastOpened = () => page.evaluate(() => window.__opened.at(-1) ?? null);

  // R6-1. 360° view on Details and on the tour's Gallery step
  await goTab(/Explore/);
  await page.getByRole('button', { name: /^Aguinaldo Shrine,/ }).filter({ visible: true }).first().click();
  await expectVisible(page, page.getByRole('button', { name: /View in 360°/ }), '360°: "View in 360°" on Details');
  await page.getByRole('button', { name: /View in 360°/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(300);
  const pano = await lastOpened();
  results.push(
    /^https:\/\/www\.google\.com\/maps\/@\?api=1&map_action=pano&viewpoint=14\.445,120\.9069$/.test(pano ?? '')
      ? `ok    360°: Details opens the Street View pano URL (${pano.split('viewpoint=')[1]})`
      : `FAIL  360° URL: ${pano}`,
  );
  await text(page, 'Start Virtual Tour').filter({ visible: true }).first().click();
  await text(page, 'Begin the tour').filter({ visible: true }).first().click();
  const tourPano = page.getByLabel('View Aguinaldo Shrine in 360 degrees in Google Street View');
  await expectVisible(page, tourPano, '360°: "View in 360°" card on the tour Gallery step');
  await page.waitForTimeout(900);
  await shot(page, 'r6-tour-360');
  await tourPano.filter({ visible: true }).first().click();
  await page.waitForTimeout(300);
  results.push(/map_action=pano&viewpoint=14\.445,120\.9069$/.test((await lastOpened()) ?? '') ? 'ok    360°: tour card opens the same pano URL' : `FAIL  tour 360 URL: ${await lastOpened()}`);
  await text(page, 'Continue').filter({ visible: true }).first().click();
  await expectVisible(page, text(page, 'Chapter I'), '360°: the tour still goes Gallery → Chapter I (no extra step)');
  await page.getByLabel('Close the tour').click();

  // R6-2. Star ratings on Details, then on the Explore card
  const rate4 = page.getByRole('radio', { name: 'Rate 4 stars out of 5' }).filter({ visible: true });
  await expectVisible(page, page.getByRole('heading', { name: 'Rate this destination' }), 'Ratings: "Rate this destination" on Details');
  await expectVisible(page, text(page, 'No ratings yet — be the first.'), 'Ratings: empty state before the first rating');
  await rate4.first().scrollIntoViewIfNeeded();
  await rate4.first().click();
  await expectVisible(page, text(page, 'Your rating: 4 of 5'), 'Ratings: own rating highlighted after a tap');
  await expectVisible(page, page.getByLabel('Rated 4.0 out of 5 from 1 ratings'), 'Ratings: average 4.0 from 1 rating');
  await page.waitForTimeout(800);
  await shot(page, 'r6-rating');
  await page.getByRole('radio', { name: 'Rate 5 stars out of 5' }).filter({ visible: true }).first().click();
  await expectVisible(page, text(page, 'Your rating: 5 of 5'), 'Ratings: tapping again changes the rating');
  await page.waitForTimeout(1500);
  const ratingRows = await db.query('select stars from public.ratings where device_id = $1', [testUserId]);
  results.push(
    ratingRows.rows.length === 1 && ratingRows.rows[0].stars === 5
      ? 'ok    Ratings: one row in Supabase, upserted to 5 stars'
      : `FAIL  rating rows: ${JSON.stringify(ratingRows.rows)}`,
  );
  await expectVisible(page, page.getByLabel('Rated 5.0 out of 5 from 1 ratings'), 'Ratings: average follows the edit (5.0)');
  await clickActionable(page.getByLabel('Go back').filter({ visible: true }));
  await goTab(/Explore/);
  await expectVisible(page, page.getByRole('button', { name: /^Aguinaldo Shrine,/ }).getByLabel('Rated 5.0 out of 5 from 1 ratings'), 'Ratings: Explore card shows ★ 5.0 (1)');
  await page.waitForTimeout(800);
  await shot(page, 'r6-explore-rating');

  // R6-3. Badges: five Cavite visits (written straight to the database) earn
  // First Journey + Cavite Explorer; the celebration fires once.
  await db.query(
    `insert into public.destination_completions (destination_id, device_id, completed_at)
       select id, $1, now() - (row_number() over (order by name)) * interval '1 hour' from public.destinations where province = 'Cavite'`,
    [testUserId],
  );
  await page.reload();
  await goTab(/Progress/);
  await expectVisible(page, page.getByLabel('New badge earned: First Journey'), 'Badges: celebration banner for the newly earned badge');
  await expectVisible(page, text(page, '+1 more badge'), 'Badges: banner counts the second new badge');
  await page.waitForTimeout(400);
  await shot(page, 'r6-badge-celebration');
  await page.getByLabel('Dismiss').filter({ visible: true }).first().click();
  const seenStored = await page.evaluate((key) => localStorage.getItem(`vtour.badgesSeen.${key}`), testUserId);
  results.push(/first-journey/.test(seenStored ?? '') && /explorer-cavite/.test(seenStored ?? '') ? 'ok    Badges: "seen" saved on the device' : `FAIL  seen badges: ${seenStored}`);
  await page.reload();
  await goTab(/Progress/);
  await page.waitForTimeout(3000);
  const bannerAgain = await page.getByLabel('New badge earned: First Journey').isVisible().catch(() => false);
  results.push(bannerAgain ? 'FAIL  celebration shown again' : 'ok    Badges: celebration does not fire twice');
  await expectVisible(page, page.getByRole('button', { name: /^Badges: 2 of 10 earned/ }), 'Badges: Progress entry card says 2 of 10');
  await page.getByRole('button', { name: /^Badges: 2 of 10 earned/ }).filter({ visible: true }).first().click();
  await expectVisible(page, page.getByRole('heading', { name: 'Badges' }), 'Badges: grid screen opens');
  await expectVisible(page, page.getByLabel(/^First Journey\. Earned .*\d{4}\./), 'Badges: First Journey earned with its date');
  await expectVisible(page, page.getByLabel(/^Cavite Explorer\. Earned /), 'Badges: Cavite Explorer earned');
  await expectVisible(page, page.getByLabel(/^Laguna Explorer\. Locked, 0 of 6\./), 'Badges: Laguna Explorer locked, 0 of 6');
  const tileCount = await page.getByLabel(/\. (Earned|Locked)/).count();
  results.push(tileCount >= 10 ? `ok    Badges: all 10 tiles rendered (${tileCount} labels)` : `FAIL  badge tiles: ${tileCount}`);
  await page.waitForTimeout(800);
  await shot(page, 'r6-badges');

  // R6-4. Certificate (from the Cavite badge), editable name, share, dark parchment
  await page.getByRole('button', { name: /View certificate/ }).filter({ visible: true }).first().click();
  await expectVisible(page, text(page, 'Cavite Heritage Explorer'), 'Certificate: Cavite Heritage Explorer');
  await expectVisible(page, text(page, 'This certifies that'), 'Certificate: heritage wording');
  await expectVisible(page, text(page, EMAIL.split('@')[0]), 'Certificate: holder defaults to the email prefix');
  await expectVisible(page, text(page, 'all 5 destinations of Cavite'), 'Certificate: covers all 5 Cavite destinations');
  await page.locator('input:visible').last().fill('Juana Dela Cruz');
  await expectVisible(page, text(page, 'Juana Dela Cruz'), 'Certificate: typed name appears on the certificate');
  const certName = await page.evaluate(() => localStorage.getItem('vtour.certificateName'));
  results.push(certName === 'Juana Dela Cruz' ? 'ok    Certificate: name saved on the device' : `FAIL  certificate name stored: ${certName}`);
  await page.waitForTimeout(800);
  await shot(page, 'r6-certificate');
  await page.getByRole('button', { name: /Share as image/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(500);
  const certShare = await page.evaluate(() => window.__shared.at(-1) ?? null);
  results.push(/Cavite Heritage Explorer/.test(JSON.stringify(certShare)) ? 'ok    Certificate: share hands off (web: text; phone: image)' : `FAIL  certificate share: ${JSON.stringify(certShare)}`);
  const sampleCertificate = async () => {
    const box = await page.getByLabel(/^Certificate of completion for /).filter({ visible: true }).first().boundingBox();
    const image = await page.screenshot({ clip: { x: box.x + box.width / 2 - 3, y: box.y + 20, width: 6, height: 6 } });
    const { data } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return { r: data[0], g: data[1], b: data[2] };
  };
  const lightParchment = await sampleCertificate();
  await clickActionable(page.getByLabel('Go back').filter({ visible: true }));
  await page.waitForTimeout(300);
  await clickActionable(page.getByLabel('Go back').filter({ visible: true }));
  await openSettings();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await clickActionable(page.getByLabel('Go back').filter({ visible: true }));
  await goTab(/Progress/);
  await page.getByRole('button', { name: /View certificate/ }).filter({ visible: true }).first().click();
  await expectVisible(page, text(page, 'Cavite Heritage Explorer'), 'Certificate: opens from the Progress province row');
  await page.waitForTimeout(800);
  const darkParchment = await sampleCertificate();
  const cream = (c) => c.r > 225 && c.g > 215 && c.b > 190 && c.r >= c.b;
  results.push(
    cream(lightParchment) && cream(darkParchment)
      ? `ok    Certificate: cream parchment in light and dark (rgb ${darkParchment.r},${darkParchment.g},${darkParchment.b})`
      : `FAIL  parchment light ${JSON.stringify(lightParchment)} dark ${JSON.stringify(darkParchment)}`,
  );
  await shot(page, 'r6-certificate-dark');
  await clickActionable(page.getByLabel('Go back').filter({ visible: true }));
  await openSettings();
  await page.getByRole('radio', { name: 'Light' }).click();
  await clickActionable(page.getByLabel('Go back').filter({ visible: true }));

  // R6-5. Heritage Insights (Progress header icon and the Home card)
  await goTab(/Progress/);
  await clickActionable(page.getByLabel('Open community insights').filter({ visible: true }));
  await expectVisible(page, page.getByRole('heading', { name: 'Heritage Insights' }), 'Insights: opens from the Progress header');
  for (const section of ['Most visited', 'Top rated', 'Toughest quizzes', 'Visits by province', 'Visits by category']) {
    await expectVisible(page, page.getByRole('heading', { name: section }), `Insights: ${section} section`);
  }
  await expectVisible(page, page.getByLabel(/^Number 1: Aguinaldo Shrine, 2 visits$/), 'Insights: most visited ranks Aguinaldo Shrine first (2 visits)');
  await expectVisible(page, page.getByLabel(/^Number 1: Aguinaldo Shrine, 5\.0 out of 5 from 1 ratings$/), 'Insights: top rated shows the 5.0 rating');
  await expectVisible(page, page.getByLabel(/^Cavite: 6 visits$/), 'Insights: visits by province (Cavite 6)');
  await page.waitForTimeout(800);
  await shot(page, 'r6-insights');
  await clickActionable(page.getByLabel('Go back').filter({ visible: true }));
  await goTab(/Home/);
  await expectVisible(page, page.getByRole('button', { name: /^Community insights\./ }), 'Insights: Home card');
  await page.getByRole('button', { name: /^Community insights\./ }).filter({ visible: true }).first().click();
  await expectVisible(page, page.getByRole('heading', { name: 'Heritage Insights' }), 'Insights: Home card opens the screen');
  await clickActionable(page.getByLabel('Go back').filter({ visible: true }));
  await expectVisible(page, page.getByRole('button', { name: /^Plan a field trip\./ }), 'Planner: Home card');

  // R6-6. Field trip planner: select → suggested order → reorder → Google Maps URL → save / delete
  await goTab(/Map/);
  await page.getByRole('button', { name: 'Plan a field trip', exact: true }).filter({ visible: true }).first().click();
  await expectVisible(page, page.getByRole('heading', { name: 'Plan a field trip' }), 'Planner: opens from the Map header');
  await expectVisible(page, text(page, '0 of 8 stops'), 'Planner: counter starts at 0 of 8');
  await expectVisible(page, text(page, 'Google Maps takes up to 8 stops'), 'Planner: counter explains the 8-stop limit');
  await expectVisible(page, text(page, 'Start from my location'), 'Planner: "Start from my location" offered when location is allowed');
  for (const name of ['Lucban Heritage Town', 'Aguinaldo Shrine', 'Rizal Shrine', 'Pila Heritage Town']) {
    await page.getByRole('checkbox', { name: new RegExp(`^${name}`) }).filter({ visible: true }).first().click();
  }
  await expectVisible(page, text(page, '4 of 8 stops'), 'Planner: selecting 4 stops updates the counter');
  await page.getByPlaceholder('Search destinations', { exact: true }).fill('Taal');
  await page.waitForTimeout(300);
  const filtered = await page.getByRole('checkbox').filter({ visible: true }).count();
  results.push(filtered >= 1 && filtered <= 3 ? `ok    Planner: search narrows the list (${filtered} for "Taal")` : `FAIL  planner search: ${filtered}`);
  await page.getByPlaceholder('Search destinations', { exact: true }).fill('');
  await page.waitForTimeout(800);
  await shot(page, 'r6-planner-select');
  await page.getByRole('button', { name: /Plan the route \(4 stops\)/ }).click();
  await expectVisible(page, page.getByRole('heading', { name: 'Suggested order' }), 'Planner: "Suggested order" (nearest neighbour)');
  const stopOrder = async () =>
    page.getByLabel(/^Stop \d: /).filter({ visible: true }).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label').replace(/^Stop \d: /, '')));
  const suggested = await stopOrder();
  results.push(
    JSON.stringify(suggested) === JSON.stringify(['Lucban Heritage Town & Pahiyas Festival', 'Pila Heritage Town', 'Rizal Shrine', 'Aguinaldo Shrine'])
      ? 'ok    Planner: nearest-neighbour order from Lucban → Pila → Rizal Shrine → Aguinaldo'
      : `FAIL  suggested order: ${suggested.join(' → ')}`,
  );
  await expectVisible(page, text(page, /^Total ≈ \d+(\.\d)? km$/, false), 'Planner: total straight-line distance');
  await expectVisible(page, text(page, 'Straight-line distance — approximate'), 'Planner: distance labelled approximate');
  await expectVisible(page, text(page, /^About .+ of driving$/, false), 'Planner: rough time estimate');
  await expectVisible(page, page.getByLabel('Route map with 4 numbered stops'), 'Planner: route map with numbered stops');
  await page.waitForTimeout(900);
  await shot(page, 'r6-planner-plan');
  await page.getByLabel('Move Pila Heritage Town down').filter({ visible: true }).first().click();
  await expectVisible(page, page.getByRole('heading', { name: 'Your order' }), 'Planner: manual reorder switches to "Your order"');
  const reordered = await stopOrder();
  results.push(reordered[1] === 'Rizal Shrine' && reordered[2] === 'Pila Heritage Town' ? 'ok    Planner: Move down swaps the stops' : `FAIL  reordered: ${reordered.join(' → ')}`);
  await page.getByRole('button', { name: /Open in Google Maps/ }).click();
  await page.waitForTimeout(300);
  const route = await lastOpened();
  results.push(
    route ===
      'https://www.google.com/maps/dir/?api=1&origin=14.11485%2C121.55369&destination=14.445%2C120.9069&waypoints=14.21368%2C121.16683%7C14.23378%2C121.36444&travelmode=driving'
      ? 'ok    Planner: Google Maps dir URL with origin, encoded waypoints (in the new order) and destination'
      : `FAIL  planner URL: ${route}`,
  );
  await page.getByRole('button', { name: /Save plan/ }).click();
  await page.waitForTimeout(800);
  await page.locator('input:visible').last().fill('UI check trip');
  await clickActionable(page.getByRole('button', { name: /^Save$/ }).filter({ visible: true }));
  await expectVisible(page, text(page, 'Plan saved on this phone'), 'Planner: plan saved');
  const storedPlans = await page.evaluate(() => localStorage.getItem('vtour.tripPlans'));
  results.push(/UI check trip/.test(storedPlans ?? '') ? 'ok    Planner: saved in AsyncStorage (vtour.tripPlans)' : `FAIL  stored plans: ${storedPlans}`);
  await page.getByRole('button', { name: /Edit stops/ }).click();
  await expectVisible(page, page.getByRole('button', { name: /^Open the plan UI check trip, 4 stops$/ }), 'Planner: saved plan listed');
  await page.getByLabel('Delete the plan UI check trip').click();
  await page.waitForTimeout(800);
  await clickActionable(page.getByRole('button', { name: /^Delete$/ }).filter({ visible: true }));
  await page.waitForTimeout(600);
  const planGone = !(await page.getByRole('button', { name: /^Open the plan UI check trip/ }).isVisible().catch(() => false));
  results.push(planGone ? 'ok    Planner: saved plan deleted' : 'FAIL  plan still listed after delete');
  await clickActionable(page.getByLabel('Go back').filter({ visible: true }));

  // R6-7. Auto-generated starter quiz for a destination added in the app (then deleted)
  await goTab(/Explore/);
  await page.getByLabel('Add a destination').click();
  await expectVisible(page, text(page, 'Add a Destination'), 'Auto quiz: Add form opens');
  const formInputs = page.locator('input:visible');
  await formInputs.nth(0).fill(AUTO_NAME);
  await page.locator('textarea:visible').first().fill(
    'A restored estate house where revolutionary leaders gathered in 1897. The convention held here elected new officers and changed the course of the uprising in the province.',
  );
  await page.getByRole('button', { name: /^Category: / }).filter({ visible: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('radio', { name: 'Historical Site', exact: true }).filter({ visible: true }).last().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Province: / }).filter({ visible: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('radio', { name: 'Cavite', exact: true }).filter({ visible: true }).last().click();
  await page.waitForTimeout(300);
  const textInputs = page.locator('input:visible:not([readonly])');
  await textInputs.nth(1).fill('Rosario');
  await textInputs.nth(2).fill('Tejeros, Rosario, Cavite');
  await page.getByRole('button', { name: /Add destination$/ }).filter({ visible: true }).first().click();
  await expectVisible(page, page.getByRole('heading', { name: AUTO_NAME }), 'Auto quiz: new destination saved and opened');
  await page.waitForTimeout(1500);
  const autoRows = await db.query(
    `select q.source, (select count(*) from public.quiz_options o where o.question_id = q.id and o.is_correct)::int correct
       from public.quiz_questions q join public.destinations d on d.id = q.destination_id where d.name = $1`,
    [AUTO_NAME],
  );
  results.push(
    autoRows.rows.length === 5 && autoRows.rows.every((row) => row.source === 'auto' && row.correct === 1)
      ? 'ok    Auto quiz: 5 auto questions (one correct option each) written on create'
      : `FAIL  auto quiz rows: ${JSON.stringify(autoRows.rows)}`,
  );
  await page.getByRole('button', { name: /^Quiz$/ }).filter({ visible: true }).first().click();
  await expectVisible(page, page.getByLabel('Auto-generated starter quiz, built from the details entered for this place'), 'Auto quiz: intro shows the "Auto-generated starter quiz" badge');
  await expectVisible(page, text(page, 'Every answer comes from the details entered for this place'), 'Auto quiz: evidence line adapted');
  await page.waitForTimeout(600);
  await shot(page, 'r6-auto-quiz');
  await text(page, 'Start the quiz').click();
  await expectVisible(page, text(page, 'Question 1 of 5'), 'Auto quiz: plays in the normal quiz engine');
  await expectVisible(page, text(page, `In which province is ${AUTO_NAME}?`), 'Auto quiz: first question asks for the province');
  await page.getByLabel('Close the quiz').click();
  await page.waitForTimeout(400);
  if (await text(page, 'Leave the quiz?').isVisible().catch(() => false)) await text(page, 'Leave').click();
  await page.getByRole('button', { name: /Delete$/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(800);
  await clickActionable(page.getByRole('button', { name: /^Delete$/ }).filter({ visible: true }));
  await page.waitForTimeout(1500);
  const leftAuto = await db.query(
    `select (select count(*) from public.destinations where name = $1)::int d,
            (select count(*) from public.quiz_questions where source = 'auto')::int q`,
    [AUTO_NAME],
  );
  results.push(leftAuto.rows[0].d === 0 && leftAuto.rows[0].q === 0 ? 'ok    Auto quiz: test destination deleted, its quiz cascaded away' : `FAIL  leftovers: ${JSON.stringify(leftAuto.rows[0])}`);

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
    await db.query('delete from public.ratings where device_id = $1', [key]);
  }
  // Run 6: the destination added through the form (its quiz cascades with it).
  await db.query("delete from public.destinations where name like 'UI check Casa Tejeros%'");
  if (testUserId) await db.query('delete from auth.users where id = $1', [testUserId]);
  // Never leave an account behind, even if a sign-up unexpectedly succeeded.
  await db.query("delete from auth.users where email = $1 or email = 'someone@example.com'", [EMAIL]);
  const left = await db.query(
    `select (select count(*) from public.quiz_attempts)::int a, (select count(*) from public.destination_completions)::int c,
            (select count(*) from public.favorites)::int f, (select count(*) from auth.users)::int u,
            (select count(*) from public.ratings)::int r, (select count(*) from public.destinations)::int d,
            (select count(*) from public.quiz_questions)::int q`,
  );
  results.push(`info  after clean-up: attempts ${left.rows[0].a}, completions ${left.rows[0].c}, favorites ${left.rows[0].f}, ratings ${left.rows[0].r}, auth users ${left.rows[0].u}, destinations ${left.rows[0].d}, questions ${left.rows[0].q}`);
  await db.end();
  await browser.close();
  server.close();
}

console.log(results.join('\n'));
const relevantErrors = consoleErrors.filter((line) => !/favicon|Download the React DevTools/.test(line));
console.log(`\nconsole errors (${relevantErrors.length}):`);
for (const line of [...new Set(relevantErrors)].slice(0, 20)) console.log(`  - ${line}`);
console.log(`\n${results.filter((line) => line.startsWith('ok')).length} ok, ${results.filter((line) => line.startsWith('FAIL')).length} failed`);
