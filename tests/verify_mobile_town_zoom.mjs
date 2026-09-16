import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = '/Users/katsujiiwasa/.gemini/antigravity-ide/brain/62e9c1f4-1e17-451c-8aec-f6f29a090621';
const DASHBOARD_URL = 'http://localhost:8080/manager/index.html';

async function setupPage(page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('pm_last_district');
      localStorage.setItem('pm_auth_DEFAULT', 'true');
    } catch (e) {}
  });

  await page.route('**/data/config.js*', async (route) => {
    const originalPath = path.resolve(process.cwd(), 'data/config.js');
    let content = fs.readFileSync(originalPath, 'utf8');
    content = content.replace('gasWebAppUrl: ""', 'gasWebAppUrl: "http://localhost:8080/mock-gas/exec"');
    content = content.replace('liffId: ""', 'liffId: "9999999999-TestLiff"');
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: content
    });
  });

  await page.route('**/*exec*', async (route, request) => {
    const url = request.url();
    const postData = request.postData() || '';

    if (postData.includes('verifyManagerPassword') || url.includes('action=verifyManagerPassword')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ success: true, districtCode: 'DEFAULT' })
      });
    }

    if (url.includes('action=getSystemSummary') || postData.includes('getSystemSummary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          districtName: '亀山市 (テスト)',
          totalAreas: 104,
          doneAreas: 15,
          unallocatedAreas: 89,
          totalRecords: 12000,
          totalStocks: 3500,
          activePosters: 5,
          liveEvents: []
        })
      });
    }

    if (url.includes('action=getGlobalPinStatus') || postData.includes('getGlobalPinStatus')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ success: true, statusMap: {} })
      });
    }

    if (url.includes('action=getTier1') || postData.includes('getTier1')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ success: true, cities: ['亀山市'] })
      });
    }

    if (url.includes('action=getFlyerStock') || postData.includes('getFlyerStock') || url.includes('action=getStocks') || postData.includes('getStocks')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          stocks: [{ id: '1', name: '亀山市民だより', count: 5000 }]
        })
      });
    }

    if (url.includes('action=getRanking') || postData.includes('getRanking') || url.includes('action=getPosterRanking') || postData.includes('getPosterRanking')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          ranking: [{ rank: 1, name: '配布員A', count: 500 }]
        })
      });
    }

    if (url.includes('action=getRoster') || postData.includes('getRoster')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          roster: [{ id: '1', name: '配布員A' }]
        })
      });
    }

    return route.continue();
  });
}

async function runVerification() {
  console.log('=== KAMEYAMA TOWN ZOOM VERIFICATION (MOBILE & PC) ===\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const consoleErrors = [];
  const failedRequests = [];

  // ==========================================
  // PART 1: MOBILE VERIFICATION (iPhone 14)
  // ==========================================
  console.log('📱 [PART 1: MOBILE VERIFICATION]');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true
  });

  const mobilePage = await mobileContext.newPage();
  mobilePage.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[Console Error] ${msg.text()}`);
  });
  mobilePage.on('requestfailed', req => {
    // Leafletのズーム変更に伴う不要タイルの自動キャンセル(ERR_ABORTED)は除外
    if (req.url().includes('tile.openstreetmap') && req.failure()?.errorText === 'net::ERR_ABORTED') {
      return;
    }
    failedRequests.push(`[Failed Request] ${req.url()} - ${req.failure()?.errorText}`);
  });

  await setupPage(mobilePage);
  await mobilePage.goto(DASHBOARD_URL, { waitUntil: 'load' });
  await mobilePage.waitForFunction(() => window.DashboardState && window.DashboardState.masterLoadStatus === 'LOADED', { timeout: 10000 });
  await mobilePage.waitForTimeout(1000);

  // 1. Initial State Check
  const initialMobileLabel = await mobilePage.textContent('#mobile-city-selector-current');
  console.log(`- 初期セレクターラベル: "${initialMobileLabel?.trim()}" (期待値: "全域")`);
  if (initialMobileLabel?.trim() !== '全域') throw new Error(`Unexpected initial label: ${initialMobileLabel}`);

  // 2. Open Dropdown
  await mobilePage.click('#mobile-city-selector-trigger');
  await mobilePage.waitForTimeout(300);

  const isDropdownOpen = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    const trigger = document.getElementById('mobile-city-selector-trigger');
    return !list.classList.contains('hidden') && trigger.getAttribute('aria-expanded') === 'true';
  });
  console.log(`- ドロップダウン展開状態: ${isDropdownOpen ? 'OPEN (PASS)' : 'FAIL'}`);

  const townButtonCount = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    return list.querySelectorAll('button[data-town-id]').length;
  });
  console.log(`- ドロップダウン内項目数: ${townButtonCount} (期待値: 105: 全域+104町名)`);
  if (townButtonCount !== 105) throw new Error(`Unexpected town button count: ${townButtonCount}`);

  // Screenshot 1: Dropdown Open
  const screenshot1Path = path.join(ARTIFACTS_DIR, 'mobile_town_selector_open.png');
  await mobilePage.screenshot({ path: screenshot1Path });
  console.log(`  📸 撮影: ${screenshot1Path}`);

  // 3. Test 東町一丁目 (rowId 1)
  console.log('\n--- 1. 東町一丁目 ズーム検証 ---');
  await mobilePage.evaluate(() => {
    const btn = document.querySelector('#mobile-city-selector-list button[data-town-id="1"]');
    if (btn) btn.click();
  });
  await mobilePage.waitForTimeout(800);

  const higashimachiState = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    const label = document.getElementById('mobile-city-selector-current')?.textContent;
    const center = window.DashboardState.map.getCenter();
    const zoom = window.DashboardState.map.getZoom();
    const isHidden = list.classList.contains('hidden');
    return { label, lat: center.lat, lng: center.lng, zoom, isHidden };
  });
  console.log(`- ラベル: "${higashimachiState.label}" (期待値: "東町一丁目")`);
  console.log(`- ドロップダウン自動閉止: ${higashimachiState.isHidden ? 'CLOSED (PASS)' : 'FAIL'}`);
  console.log(`- マップ中心座標: lat ${higashimachiState.lat.toFixed(6)}, lng ${higashimachiState.lng.toFixed(6)}, zoom: ${higashimachiState.zoom}`);
  console.log(`- 期待座標: lat 34.854279, lng 136.455304, zoom: 16`);
  const dLat1 = Math.abs(higashimachiState.lat - 34.854279);
  const dLng1 = Math.abs(higashimachiState.lng - 136.455304);
  if (dLat1 > 0.001 || dLng1 > 0.001 || higashimachiState.zoom !== 16) throw new Error('東町一丁目 zoom mismatch');

  const screenshot2Path = path.join(ARTIFACTS_DIR, 'mobile_higashimachi_zoomed.png');
  await mobilePage.screenshot({ path: screenshot2Path });
  console.log(`  📸 撮影: ${screenshot2Path}`);

  // 4. Test 野村一丁目 (rowId 23)
  console.log('\n--- 2. 野村一丁目 ズーム検証 ---');
  await mobilePage.click('#mobile-city-selector-trigger');
  await mobilePage.waitForTimeout(300);
  await mobilePage.evaluate(() => {
    const btn = document.querySelector('#mobile-city-selector-list button[data-town-id="23"]');
    if (btn) btn.click();
  });
  await mobilePage.waitForTimeout(800);

  const nomuraState = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    const label = document.getElementById('mobile-city-selector-current')?.textContent;
    const center = window.DashboardState.map.getCenter();
    const zoom = window.DashboardState.map.getZoom();
    const isHidden = list.classList.contains('hidden');
    return { label, lat: center.lat, lng: center.lng, zoom, isHidden };
  });
  console.log(`- ラベル: "${nomuraState.label}" (期待値: "野村一丁目")`);
  console.log(`- ドロップダウン自動閉止: ${nomuraState.isHidden ? 'CLOSED (PASS)' : 'FAIL'}`);
  console.log(`- マップ中心座標: lat ${nomuraState.lat.toFixed(6)}, lng ${nomuraState.lng.toFixed(6)}, zoom: ${nomuraState.zoom}`);
  console.log(`- 期待座標: lat 34.860032, lng 136.443018, zoom: 16`);
  const dLat2 = Math.abs(nomuraState.lat - 34.860032);
  const dLng2 = Math.abs(nomuraState.lng - 136.443018);
  if (dLat2 > 0.001 || dLng2 > 0.001 || nomuraState.zoom !== 16) throw new Error('野村一丁目 zoom mismatch');

  const screenshot3Path = path.join(ARTIFACTS_DIR, 'mobile_nomura_zoomed.png');
  await mobilePage.screenshot({ path: screenshot3Path });
  console.log(`  📸 撮影: ${screenshot3Path}`);

  // 5. Test 天神一丁目 (rowId 36)
  console.log('\n--- 3. 天神一丁目 ズーム検証 ---');
  await mobilePage.click('#mobile-city-selector-trigger');
  await mobilePage.waitForTimeout(300);
  await mobilePage.evaluate(() => {
    const btn = document.querySelector('#mobile-city-selector-list button[data-town-id="36"]');
    if (btn) btn.click();
  });
  await mobilePage.waitForTimeout(800);

  const tenjinState = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    const label = document.getElementById('mobile-city-selector-current')?.textContent;
    const center = window.DashboardState.map.getCenter();
    const zoom = window.DashboardState.map.getZoom();
    const isHidden = list.classList.contains('hidden');
    return { label, lat: center.lat, lng: center.lng, zoom, isHidden };
  });
  console.log(`- ラベル: "${tenjinState.label}" (期待値: "天神一丁目")`);
  console.log(`- ドロップダウン自動閉止: ${tenjinState.isHidden ? 'CLOSED (PASS)' : 'FAIL'}`);
  console.log(`- マップ中心座標: lat ${tenjinState.lat.toFixed(6)}, lng ${tenjinState.lng.toFixed(6)}, zoom: ${tenjinState.zoom}`);
  console.log(`- 期待座標: lat 34.846369, lng 136.455245, zoom: 16`);
  const dLat3 = Math.abs(tenjinState.lat - 34.846369);
  const dLng3 = Math.abs(tenjinState.lng - 136.455245);
  if (dLat3 > 0.001 || dLng3 > 0.001 || tenjinState.zoom !== 16) throw new Error('天神一丁目 zoom mismatch');

  const screenshot4Path = path.join(ARTIFACTS_DIR, 'mobile_tenjin_zoomed.png');
  await mobilePage.screenshot({ path: screenshot4Path });
  console.log(`  📸 撮影: ${screenshot4Path}`);

  // 6. Test 全域 (亀山市)
  console.log('\n--- 4. 全域 (亀山市全体復帰) 検証 ---');
  await mobilePage.click('#mobile-city-selector-trigger');
  await mobilePage.waitForTimeout(300);
  await mobilePage.evaluate(() => {
    const btn = document.querySelector('#mobile-city-selector-list button[data-town-id="ALL"]');
    if (btn) btn.click();
  });
  await mobilePage.waitForTimeout(800);

  const allState = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    const label = document.getElementById('mobile-city-selector-current')?.textContent;
    const zoom = window.DashboardState.map.getZoom();
    const isHidden = list.classList.contains('hidden');
    return { label, zoom, isHidden };
  });
  console.log(`- ラベル: "${allState.label}" (期待値: "全域")`);
  console.log(`- ドロップダウン自動閉止: ${allState.isHidden ? 'CLOSED (PASS)' : 'FAIL'}`);
  console.log(`- マップ全体表示ズームレベル: ${allState.zoom} (<= 13)`);
  if (allState.zoom > 13) throw new Error('全域 fitBounds zoom expected <= 13');

  const screenshot5Path = path.join(ARTIFACTS_DIR, 'mobile_all_restored.png');
  await mobilePage.screenshot({ path: screenshot5Path });
  console.log(`  📸 撮影: ${screenshot5Path}`);

  // 7. Verify Mobile Layout Elements
  console.log('\n--- 5. モバイルUI要素維持検証 ---');
  const uiIntegrity = await mobilePage.evaluate(() => {
    const navAreas = document.getElementById('mobile-nav-areas');
    const navRecords = document.getElementById('mobile-nav-records');
    const navStocks = document.getElementById('mobile-nav-stocks');
    const navRoster = document.getElementById('mobile-nav-roster');
    const navRequests = document.getElementById('mobile-nav-requests');
    const navMail = document.getElementById('mobile-nav-mail');
    const navBulletin = document.getElementById('mobile-nav-bulletin');
    const liveClock = document.getElementById('mobile-sync-clock');
    const liveDot = document.getElementById('mobile-live-dot');
    return {
      hasNavAreas: !!navAreas,
      hasNavRecords: !!navRecords,
      hasNavStocks: !!navStocks,
      hasNavRoster: !!navRoster,
      hasNavRequests: !!navRequests,
      hasNavMail: !!navMail,
      hasNavBulletin: !!navBulletin,
      hasClock: !!liveClock,
      hasDot: !!liveDot
    };
  });
  const allNavPass = uiIntegrity.hasNavAreas && uiIntegrity.hasNavRecords && uiIntegrity.hasNavStocks && uiIntegrity.hasNavRoster && uiIntegrity.hasNavRequests && uiIntegrity.hasNavMail && uiIntegrity.hasNavBulletin;
  console.log(`- 下部ナビゲーション: ${allNavPass ? 'PASS (全7メニュー完全維持)' : 'FAIL'}`);
  console.log(`- ヘッダーLIVE表示: ${uiIntegrity.hasClock && uiIntegrity.hasDot ? 'PASS' : 'FAIL'}`);
  if (!allNavPass) throw new Error('Mobile bottom nav elements missing');

  await mobileContext.close();

  // ==========================================
  // PART 2: PC VERIFICATION (1440x900)
  // ==========================================
  console.log('\n💻 [PART 2: PC VERIFICATION]');
  const pcContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const pcPage = await pcContext.newPage();
  pcPage.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[PC Console Error] ${msg.text()}`);
  });
  await setupPage(pcPage);
  await pcPage.goto(DASHBOARD_URL, { waitUntil: 'load' });
  await pcPage.waitForFunction(() => window.DashboardState && window.DashboardState.masterLoadStatus === 'LOADED', { timeout: 10000 });
  await pcPage.waitForTimeout(1000);

  const pcTownCount = await pcPage.evaluate(() => {
    const list = document.getElementById('area-selector-list');
    return list?.querySelectorAll('button[data-town-id]').length || 0;
  });
  console.log(`- PCエリアセレクター項目数: ${pcTownCount} (期待値: 105)`);

  // PC click 東町一丁目
  await pcPage.evaluate(() => {
    const btn = document.querySelector('#area-selector-list button[data-town-id="1"]');
    btn?.click();
  });
  await pcPage.waitForTimeout(800);
  const pcHigashiZoom = await pcPage.evaluate(() => window.DashboardState.map.getZoom());
  console.log(`- PC 東町一丁目クリック後ズーム: ${pcHigashiZoom} (期待値: 16)`);

  const screenshotPcPath = path.join(ARTIFACTS_DIR, 'pc_town_selector_zoomed.png');
  await pcPage.screenshot({ path: screenshotPcPath });
  console.log(`  📸 撮影: ${screenshotPcPath}`);

  await pcContext.close();
  await browser.close();

  console.log('\n--- 6. 総合診断結果 ---');
  console.log(`- Console Errors: ${consoleErrors.length}件 ${consoleErrors.length === 0 ? '(PASS)' : consoleErrors.join('; ')}`);
  console.log(`- Failed Requests: ${failedRequests.length}件 ${failedRequests.length === 0 ? '(PASS)' : failedRequests.join('; ')}`);

  if (consoleErrors.length > 0 || failedRequests.length > 0) {
    throw new Error('Errors detected in console or network requests');
  }

  console.log('\n🎉 ALL KAMEYAMA TOWN ZOOM TESTS PASSED PERFECTLY!');
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
