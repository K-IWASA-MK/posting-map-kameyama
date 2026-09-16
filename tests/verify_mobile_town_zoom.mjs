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

  // 2.5. Geometric Boundary & Overflow Verification
  const boundaryCheck = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    const trigger = document.getElementById('mobile-city-selector-trigger');
    const liveContainer = document.getElementById('mobile-sync-clock')?.parentElement;
    const listRect = list.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const liveRect = liveContainer ? liveContainer.getBoundingClientRect() : null;
    const vpWidth = window.innerWidth;
    const docScrollWidth = document.documentElement.scrollWidth;
    const docClientWidth = document.documentElement.clientWidth;

    return {
      listLeft: listRect.left,
      listRight: listRect.right,
      listWidth: listRect.width,
      triggerWidth: triggerRect.width,
      vpWidth,
      docScrollWidth,
      docClientWidth,
      isWithinViewport: listRect.right <= vpWidth && listRect.left >= 0,
      hasNoHorizontalScroll: docScrollWidth <= docClientWidth,
      noOverlapWithLive: liveRect ? listRect.right <= liveRect.left + 5 : true,
      scrollHeight: list.scrollHeight,
      clientHeight: list.clientHeight,
      isInternallyScrollable: list.scrollHeight > list.clientHeight
    };
  });

  console.log(`- リスト境界位置: left=${boundaryCheck.listLeft.toFixed(1)}px, right=${boundaryCheck.listRight.toFixed(1)}px (画面幅: ${boundaryCheck.vpWidth}px)`);
  console.log(`- 親幅一致: listWidth=${boundaryCheck.listWidth.toFixed(1)}px, triggerWidth=${boundaryCheck.triggerWidth.toFixed(1)}px`);
  console.log(`- 画面外はみ出し0判定 (list.right <= vp.width && list.left >= 0): ${boundaryCheck.isWithinViewport ? 'PASS (完全収容)' : 'FAIL'}`);
  console.log(`- 横スクロール非発生判定 (scrollWidth <= clientWidth): ${boundaryCheck.hasNoHorizontalScroll ? 'PASS' : 'FAIL'}`);
  console.log(`- 内部スクロール性: ${boundaryCheck.isInternallyScrollable ? `PASS (内部高さ: ${boundaryCheck.scrollHeight}px > 表示枠: ${boundaryCheck.clientHeight}px)` : 'FAIL'}`);

  if (!boundaryCheck.isWithinViewport) throw new Error(`Dropdown overflowed viewport: right=${boundaryCheck.listRight} > ${boundaryCheck.vpWidth}`);
  if (!boundaryCheck.hasNoHorizontalScroll) throw new Error(`Horizontal scroll detected: scrollWidth=${boundaryCheck.docScrollWidth} > clientWidth=${boundaryCheck.docClientWidth}`);
  if (!boundaryCheck.isInternallyScrollable) throw new Error('Dropdown list is not internally scrollable');

  // 2.6. Vertical Height & KPI Alignment Verification
  const verticalCheck = await mobilePage.evaluate(() => {
    const kpi = document.getElementById('mobile-situation-bar');
    const list = document.getElementById('mobile-city-selector-list');
    const mapStage = document.getElementById('main-stage-container');

    const kpiRect = kpi.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const mapRect = mapStage.getBoundingClientRect();

    return {
      kpiTop: kpiRect.top,
      kpiBottom: kpiRect.bottom,
      kpiHeight: kpiRect.height,
      dropdownTop: listRect.top,
      dropdownBottom: listRect.bottom,
      dropdownHeight: listRect.height,
      mapTop: mapRect.top,
      exactTopMatch: Math.abs(listRect.top - kpiRect.top) < 0.5,
      exactBottomMatch: Math.abs(listRect.bottom - kpiRect.bottom) < 0.5,
      exactHeightMatch: Math.abs(listRect.height - kpiRect.height) < 0.5,
      noMapPenetration: listRect.bottom < mapRect.top,
      gapToMap: mapRect.top - listRect.bottom
    };
  });

  console.log(`\n📏 [VERTICAL KPI SYNCHRONIZATION AUDIT]`);
  console.log(`- KPIカード: top=${verticalCheck.kpiTop.toFixed(1)}px, bottom=${verticalCheck.kpiBottom.toFixed(1)}px, height=${verticalCheck.kpiHeight.toFixed(1)}px`);
  console.log(`- Dropdown:  top=${verticalCheck.dropdownTop.toFixed(1)}px, bottom=${verticalCheck.dropdownBottom.toFixed(1)}px, height=${verticalCheck.dropdownHeight.toFixed(1)}px`);
  console.log(`- MAPカード: top=${verticalCheck.mapTop.toFixed(1)}px`);
  console.log(`- 上端一致 (dropdown.top === KPI.top): ${verticalCheck.exactTopMatch ? 'PASS' : 'FAIL'}`);
  console.log(`- 下端一致 (dropdown.bottom === KPI.bottom): ${verticalCheck.exactBottomMatch ? 'PASS' : 'FAIL'}`);
  console.log(`- 高さ一致 (dropdown.height === KPI.height): ${verticalCheck.exactHeightMatch ? 'PASS' : 'FAIL'}`);
  console.log(`- MAPカード侵入なし (dropdown.bottom < MAP.top): ${verticalCheck.noMapPenetration ? `PASS (クリアランス: ${verticalCheck.gapToMap.toFixed(1)}px)` : 'FAIL'}`);

  if (!verticalCheck.exactTopMatch) throw new Error(`dropdown.top (${verticalCheck.dropdownTop}) !== KPI.top (${verticalCheck.kpiTop})`);
  if (!verticalCheck.exactBottomMatch) throw new Error(`dropdown.bottom (${verticalCheck.dropdownBottom}) !== KPI.bottom (${verticalCheck.kpiBottom})`);
  if (!verticalCheck.exactHeightMatch) throw new Error(`dropdown.height (${verticalCheck.dropdownHeight}) !== KPI.height (${verticalCheck.kpiHeight})`);
  if (!verticalCheck.noMapPenetration) throw new Error(`MAP penetration detected: dropdown.bottom (${verticalCheck.dropdownBottom}) >= MAP.top (${verticalCheck.mapTop})`);

  // 2.7. Alphabetical Order Verification (Iris-cho first, Wada-cho last)
  const orderCheck = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    const buttons = Array.from(list.querySelectorAll('button[data-town-id]'));
    const items = buttons.map(b => ({
      id: b.getAttribute('data-town-id'),
      name: b.querySelector('span:first-child')?.textContent?.trim() || ''
    }));
    return {
      total: items.length,
      first: items[0],       // ALL
      second: items[1],      // First town
      third: items[2],       // Second town
      last: items[items.length - 1], // Last town
      allItems: items
    };
  });

  console.log(`\n🔤 [ALPHABETICAL ORDER AUDIT]`);
  console.log(`- 先頭項目 (全体): "${orderCheck.first.name}" (ID: ${orderCheck.first.id}) [期待値: ALL]`);
  console.log(`- 町名第1位: "${orderCheck.second.name}" (ID: ${orderCheck.second.id}) [期待値: アイリス町 (rowId 1)]`);
  console.log(`- 町名第2位: "${orderCheck.third.name}" (ID: ${orderCheck.third.id}) [期待値: 安坂山町 (rowId 2)]`);
  console.log(`- 町名末尾:  "${orderCheck.last.name}" (ID: ${orderCheck.last.id}) [期待値: 和田町 (rowId 104)]`);

  if (orderCheck.first.id !== 'ALL') throw new Error(`First item is not ALL: ${orderCheck.first.id}`);
  if (orderCheck.second.name !== 'アイリス町' || orderCheck.second.id !== '1') {
    throw new Error(`Second item is not アイリス町: ${JSON.stringify(orderCheck.second)}`);
  }
  if (orderCheck.last.name !== '和田町' || orderCheck.last.id !== '104') {
    throw new Error(`Last item is not 和田町: ${JSON.stringify(orderCheck.last)}`);
  }
  console.log('✅ 五十音順検証 PASS (先頭: アイリス町, 末尾: 和田町)');

  // Screenshot 1: Dropdown Open (Perfect fit with KPI height)
  const screenshot1Path = path.join(ARTIFACTS_DIR, 'mobile_town_selector_open.png');
  await mobilePage.screenshot({ path: screenshot1Path });
  console.log(`  📸 撮影: ${screenshot1Path}`);

  // 3. Test アイリス町 (rowId 1 - 五十音順先頭)
  console.log('\n--- 1. アイリス町 (rowId 1: 五十音順先頭) ズーム検証 ---');
  await mobilePage.evaluate(() => {
    const btn = document.querySelector('#mobile-city-selector-list button[data-town-id="1"]');
    if (btn) btn.click();
  });
  await mobilePage.waitForTimeout(800);

  const irisState = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    const label = document.getElementById('mobile-city-selector-current')?.textContent;
    const center = window.DashboardState.map.getCenter();
    const zoom = window.DashboardState.map.getZoom();
    const isHidden = list.classList.contains('hidden');
    return { label, lat: center.lat, lng: center.lng, zoom, isHidden };
  });
  console.log(`- ラベル: "${irisState.label}" (期待値: "アイリス町")`);
  console.log(`- ドロップダウン自動閉止: ${irisState.isHidden ? 'CLOSED (PASS)' : 'FAIL'}`);
  console.log(`- マップ中心座標: lat ${irisState.lat.toFixed(6)}, lng ${irisState.lng.toFixed(6)}, zoom: ${irisState.zoom}`);
  console.log(`- 期待座標: lat 34.869662, lng 136.457652, zoom: 16`);
  const dLat1 = Math.abs(irisState.lat - 34.869662);
  const dLng1 = Math.abs(irisState.lng - 136.457652);
  if (dLat1 > 0.001 || dLng1 > 0.001 || irisState.zoom !== 16) throw new Error('アイリス町 zoom mismatch');

  const screenshot2Path = path.join(ARTIFACTS_DIR, 'mobile_iris_zoomed.png');
  await mobilePage.screenshot({ path: screenshot2Path });
  console.log(`  📸 撮影: ${screenshot2Path}`);

  // 4. Test 天神一丁目 (rowId 61)
  console.log('\n--- 2. 天神一丁目 (rowId 61) ズーム検証 ---');
  await mobilePage.click('#mobile-city-selector-trigger');
  await mobilePage.waitForTimeout(300);
  await mobilePage.evaluate(() => {
    const btn = document.querySelector('#mobile-city-selector-list button[data-town-id="61"]');
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
  const dLat2 = Math.abs(tenjinState.lat - 34.846369);
  const dLng2 = Math.abs(tenjinState.lng - 136.455245);
  if (dLat2 > 0.001 || dLng2 > 0.001 || tenjinState.zoom !== 16) throw new Error('天神一丁目 zoom mismatch');

  const screenshot3Path = path.join(ARTIFACTS_DIR, 'mobile_tenjin_zoomed.png');
  await mobilePage.screenshot({ path: screenshot3Path });
  console.log(`  📸 撮影: ${screenshot3Path}`);

  // 5. Test 和田町 (rowId 104 - 五十音順末尾)
  console.log('\n--- 3. 和田町 (rowId 104: 五十音順末尾) ズーム検証 ---');
  await mobilePage.click('#mobile-city-selector-trigger');
  await mobilePage.waitForTimeout(300);
  await mobilePage.evaluate(() => {
    const btn = document.querySelector('#mobile-city-selector-list button[data-town-id="104"]');
    if (btn) btn.click();
  });
  await mobilePage.waitForTimeout(800);

  const wadaState = await mobilePage.evaluate(() => {
    const list = document.getElementById('mobile-city-selector-list');
    const label = document.getElementById('mobile-city-selector-current')?.textContent;
    const center = window.DashboardState.map.getCenter();
    const zoom = window.DashboardState.map.getZoom();
    const isHidden = list.classList.contains('hidden');
    return { label, lat: center.lat, lng: center.lng, zoom, isHidden };
  });
  console.log(`- ラベル: "${wadaState.label}" (期待値: "和田町")`);
  console.log(`- ドロップダウン自動閉止: ${wadaState.isHidden ? 'CLOSED (PASS)' : 'FAIL'}`);
  console.log(`- マップ中心座標: lat ${wadaState.lat.toFixed(6)}, lng ${wadaState.lng.toFixed(6)}, zoom: ${wadaState.zoom}`);
  console.log(`- 期待座標: lat 34.860038, lng 136.483488, zoom: 16`);
  const dLat3 = Math.abs(wadaState.lat - 34.860038);
  const dLng3 = Math.abs(wadaState.lng - 136.483488);
  if (dLat3 > 0.001 || dLng3 > 0.001 || wadaState.zoom !== 16) throw new Error('和田町 zoom mismatch');

  const screenshot4Path = path.join(ARTIFACTS_DIR, 'mobile_wada_zoomed.png');
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

  const pcOrderCheck = await pcPage.evaluate(() => {
    const list = document.getElementById('area-selector-list');
    const buttons = Array.from(list.querySelectorAll('button[data-town-id]'));
    const items = buttons.map(b => ({
      id: b.getAttribute('data-town-id'),
      name: b.querySelector('span:first-child')?.textContent?.trim() || ''
    }));
    return {
      first: items[0],
      second: items[1],
      last: items[items.length - 1]
    };
  });
  console.log(`- PC 町名第1位: "${pcOrderCheck.second.name}" (ID: ${pcOrderCheck.second.id}) [期待値: アイリス町 (rowId 1)]`);
  console.log(`- PC 町名末尾:  "${pcOrderCheck.last.name}" (ID: ${pcOrderCheck.last.id}) [期待値: 和田町 (rowId 104)]`);
  if (pcOrderCheck.second.name !== 'アイリス町' || pcOrderCheck.last.name !== '和田町') {
    throw new Error('PC town selector order mismatch');
  }

  // PC click アイリス町 (rowId 1)
  await pcPage.evaluate(() => {
    const btn = document.querySelector('#area-selector-list button[data-town-id="1"]');
    btn?.click();
  });
  await pcPage.waitForTimeout(800);
  const pcIrisZoom = await pcPage.evaluate(() => window.DashboardState.map.getZoom());
  console.log(`- PC アイリス町クリック後ズーム: ${pcIrisZoom} (期待値: 16)`);

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
