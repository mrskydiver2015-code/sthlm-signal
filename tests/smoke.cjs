const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

// Test the real static app. THREE_JS_FIXTURE optionally supplies the exact r128 CDN
// asset, previously downloaded with verified TLS, for environments with browser CA issues.
const root = path.resolve(__dirname, '..');
const server = http.createServer(async (req, res) => {
  const file = { '/': 'index.html', '/config.js': 'config.js', '/urban.js':'urban.js' }[req.url];
  if (!file) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : 'text/html; charset=utf-8');
  res.end(await fs.readFile(path.join(root, file)));
});
let browser;
const errors = [];
async function pageFor(options = {}, legacy = false) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if(message.type()==='error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()); });
  if (process.env.THREE_JS_FIXTURE) {
    await page.route('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', route => route.fulfill({
      path: process.env.THREE_JS_FIXTURE, contentType: 'application/javascript',
    }));
    // Optional typography is outside the offline functional check.
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
  }
  if (legacy) await page.route('**/config.js', route => route.fulfill({
    body: 'window.STHLM_CONFIG={externalAuthEnabled:true};', contentType: 'application/javascript',
  }));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#skipBtn').click();
  return page;
}
async function login(page, name = 'Testare') {
  assert.equal(await page.locator('#obGoogle').count(), 0);
  await page.locator('#devUsername').fill('   ');
  await page.getByRole('button', { name: 'Logga in lokalt' }).click();
  assert.equal(await page.evaluate(() => state.playing), false);
  await page.locator('#devUsername').fill(name);
  await page.locator('#devUsername').press('Enter');
  await page.waitForFunction(() => state.playing && player);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sthlmSignalDevUser')).username), name);
  // Move beyond the camera transition without depending on wall-clock frame rate.
  await frames(page, 12);
}
async function frames(page, count = 4) {
  const frame = await page.evaluate(() => renderer.info.render.frame);
  await page.waitForFunction(f => renderer.info.render.frame >= f, frame + count);
}
async function direction(page, yaw, code, forward, right) {
  await page.evaluate(y => { resetInput(); player.group.position.set(0, 0, -14); cam.yaw = y; }, yaw);
  await page.keyboard.down(code);
  await frames(page);
  await page.keyboard.up(code);
  const { x, z } = await page.evaluate(() => ({ x: player.group.position.x, z: player.group.position.z + 14 }));
  const f = x * Math.sin(yaw) + z * Math.cos(yaw);
  const r = -x * Math.cos(yaw) + z * Math.sin(yaw);
  assert(forward ? f * forward > .05 : Math.abs(f) < .01, `${code}: forward at yaw ${yaw}`);
  assert(right ? r * right > .05 : Math.abs(r) < .01, `${code}: right at yaw ${yaw}`);
}
async function graphics(page, mobile) {
  const result = await page.evaluate(() => {
    let casters = 0, receivers = 0, obsolete = 0;
    scene.traverse(o => {
      if (!o.isMesh) return;
      casters += Number(o.castShadow); receivers += Number(o.receiveShadow);
      for (const m of [].concat(o.material)) obsolete += Number(!!(m.isMeshLambertMaterial || m.isMeshPhongMaterial));
    });
    return {
      aces: renderer.toneMapping === THREE.ACESFilmicToneMapping,
      shadows: renderer.shadowMap.enabled && renderer.shadowMap.type === THREE.PCFSoftShadowMap,
      environment: !!scene.environment, casters, receivers, obsolete,
      ratio: renderer.getPixelRatio(), shadowSize: moon.shadow.mapSize.x,
      shadowProjection: moon.shadow.camera.projectionMatrix.elements[0],
      triangles: renderer.info.render.triangles, calls: renderer.info.render.calls,
      contextLost: renderer.getContext().isContextLost(),
    };
  });
  assert(result.aces && result.shadows && result.environment && !result.contextLost);
  assert(result.casters > 0 && result.receivers > 0 && result.triangles > 1000);
  assert.equal(result.obsolete, 0);
  assert.equal(result.shadowSize, mobile ? 512 : 1024);
  assert(Math.abs(result.shadowProjection - 2 / 48) < 1e-6);
  assert(result.ratio <= (mobile ? 1.25 : 2));
  console.log(mobile ? 'Mobile graphics:' : 'Desktop graphics:', result);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({
    ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const desktop = await pageFor({ viewport: { width: 1000, height: 700 } });
  const username = '<b>Testare</b>';
  await login(desktop, username);
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    await direction(desktop, yaw, 'KeyA', 0, -1);
    await direction(desktop, yaw, 'KeyD', 0, 1);
    await direction(desktop, yaw, 'KeyW', 1, 0);
    await direction(desktop, yaw, 'KeyS', -1, 0);
  }
  await direction(desktop, Math.PI, 'ArrowLeft', 0, -1);
  await direction(desktop, Math.PI, 'ArrowRight', 0, 1);
  await desktop.keyboard.down('KeyW');
  await desktop.evaluate(() => dispatchEvent(new Event('blur')));
  assert.equal(await desktop.evaluate(() => Object.keys(keys).length), 0);
  await desktop.keyboard.up('KeyW');
  await desktop.locator('#btnHelp').click();
  await desktop.keyboard.down('ArrowUp');
  assert.equal(await desktop.evaluate(() => !!keys.ArrowUp), false);
  await desktop.keyboard.up('ArrowUp');
  await desktop.keyboard.press('Escape');
  // A focused HUD button must not disable WASD after closing its panel.
  await direction(desktop, Math.PI, 'KeyW', 1, 0);
  await desktop.mouse.move(500, 350);
  const yaw = await desktop.evaluate(() => cam.yaw);
  await desktop.mouse.down(); await desktop.mouse.move(560, 350); await desktop.mouse.up();
  assert(await desktop.evaluate(y => cam.yaw < y && lookPointer === null, yaw));
  await desktop.evaluate(() => { cam.yaw=0; player.group.position.set(0,0,-14); });
  await frames(desktop,45);
  await graphics(desktop, false);
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  await desktop.screenshot({ path: path.join(root, 'test-results/desktop.png') });
  await desktop.reload(); await desktop.locator('#skipBtn').click();
  assert.equal(await desktop.locator('#uiRoot h2').textContent(), username);
  assert.equal(await desktop.locator('#uiRoot h2 b').count(), 0);
  await desktop.locator('#obGo').click();
  assert(await desktop.evaluate(() => state.playing));
  console.log('PASS desktop: four camera headings, WASD/arrows, focus, mouse drag, mock login and reload.');
  await desktop.context().close();

  const mobile = await pageFor({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await login(mobile);
  await mobile.evaluate(() => { player.group.position.set(0, 0, -14); cam.yaw = Math.PI; });
  const cdp = await mobile.context().newCDPSession(mobile);
  const touch = async (type, points) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    // CDP can acknowledge before the compositor delivers coalesced pointer moves.
    await frames(mobile, 2);
  };
  const finger = (id, x, y) => ({ id, x, y });
  await touch('touchStart', [finger(1, 80, 700)]);
  const offset = await mobile.evaluate(() => {
    const rect = jk.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  assert(Math.abs(offset.x - 80) < 1 && Math.abs(offset.y - 700) < 1, 'Joystick knob must be under the finger');
  await touch('touchMove', [finger(1, 35, 700)]); await frames(mobile);
  assert(await mobile.evaluate(() => player.group.position.x < -.05), 'Left joystick must move screen-left');
  await touch('touchStart', [finger(1, 35, 700), finger(2, 290, 600)]);
  await touch('touchMove', [finger(1, 35, 700), finger(2, 330, 600)]);
  assert(await mobile.evaluate(() => joy.active && cam.yaw < Math.PI), 'Move and look simultaneously');
  // For CDP touchEnd, list the finger being released.
  await touch('touchEnd', [finger(2, 330, 600)]);
  assert(await mobile.evaluate(() => joy.active && lookPointer === null), 'Releasing look preserves movement');
  await touch('touchCancel', []);
  assert(await mobile.evaluate(() => !joy.active && joy.dx === 0 && joystickPointer === null));
  for (const [x, y, axis, sign] of [[125,700,'x',1],[80,655,'z',-1],[80,745,'z',1]]) {
    await mobile.evaluate(() => { player.group.position.set(0,0,-14); cam.yaw=Math.PI; });
    await touch('touchStart', [finger(1,80,700)]);
    await touch('touchMove', [finger(1,x,y)]); await frames(mobile,4);
    const delta=await mobile.evaluate(a => player.group.position[a] + (a==='z'?14:0), axis);
    assert(delta*sign>.05, 'Joystick right/forward/backward direction');
    await touch('touchEnd', []);
  }
  await touch('touchStart', [finger(1, 80, 700)]);
  await touch('touchMove', [finger(1, 125, 700)]);
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.waitForFunction(() => !joy.active);
  await touch('touchCancel', []);
  assert(await mobile.evaluate(() => ['scene', 'joyZone', 'lookZone'].every(id => getComputedStyle(document.getElementById(id)).touchAction === 'none')));
  assert(await mobile.evaluate(() => scrollX === 0 && scrollY === 0 && visualViewport.scale === 1));
  await graphics(mobile, true);
  await mobile.screenshot({ path: path.join(root, 'test-results/mobile.png') });
  console.log('PASS mobile: joystick placement/direction, simultaneous touch, independent release, cancel, resize, no zoom/scroll.');
  await mobile.context().close();

  const legacy = await pageFor({}, true);
  assert.equal(await legacy.locator('#obGoogle').count(), 1);
  assert.equal(await legacy.locator('#devUsername').count(), 0);
  await legacy.locator('#obGoogle').click();
  assert.equal(await legacy.locator('#uiRoot h2').textContent(), 'Inte ansluten ännu');
  await legacy.context().close();
  assert.deepEqual(errors, [], 'No browser JavaScript errors');
  console.log('PASS provider flag and all browser error checks.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.close();
});
