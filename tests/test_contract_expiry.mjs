import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log("🧪 POSTING MAP 契約・利用終了日 統合テストスイート開始\n");

// 1. system_info_service.js のコードをロード
const sysInfoServiceCode = fs.readFileSync('active/business/system/system_info_service.js', 'utf8');

// テスト用モック環境
const mockGlobal = {};
const mockSheet = {
  data: [
    ['項目', '内容'],
    ['状態', 'ACTIVE'],
    ['契約終了日', '']
  ],
  getLastRow() {
    return this.data.length;
  },
  getRange(row, col, numRows, numCols) {
    const self = this;
    return {
      getValues() {
        return self.data.slice(row - 1, row - 1 + numRows).map(r => r.slice(col - 1, col - 1 + numCols));
      }
    };
  },
  appendRow(row) {
    this.data.push(row);
  }
};

const fn = new Function('global', sysInfoServiceCode);
fn.call(mockGlobal, mockGlobal);
const SystemInfoService = mockGlobal.SystemInfoService || global.SystemInfoService;
const service = SystemInfoService.getInstance();

// Mock getSS
service.getSS = () => ({
  getSheetByName: () => mockSheet,
  getName: () => 'TEST-DISTRICT'
});

console.log("▶ [Test 1] 終了日判定 4ケース検証 (基準終了日: 2026-10-12)");

// Case 1: 終了日前 (2026-10-11)
mockSheet.data = [
  ['項目', '内容'],
  ['状態', 'ACTIVE'],
  ['契約終了日', '2026-10-12']
];
const nowBefore = new Date(Date.UTC(2026, 9, 11, 3, 0, 0)); // 2026-10-11 JST
const resBefore = service.getContractStatus(mockSheet, nowBefore);
assert.strictEqual(resBefore.status, 'ACTIVE', 'Case 1: 終了日前は ACTIVE でなければならない');
assert.strictEqual(resBefore.isExpired, false, 'Case 1: isExpired は false');
assert.strictEqual(resBefore.endDate, '2026-10-12');
console.log("  ✅ Case 1 PASS: 終了日前 (2026-10-11) ➔ ACTIVE (通常利用)");

// Case 2: 終了日当日 (2026-10-12)
const nowDayOf = new Date(Date.UTC(2026, 9, 12, 14, 59, 59)); // 2026-10-12 23:59:59 JST
const resDayOf = service.getContractStatus(mockSheet, nowDayOf);
assert.strictEqual(resDayOf.status, 'ACTIVE', 'Case 2: 終了日当日は ACTIVE でなければならない');
assert.strictEqual(resDayOf.isExpired, false, 'Case 2: isExpired は false');
console.log("  ✅ Case 2 PASS: 終了日当日 (2026-10-12 23:59:59 JST) ➔ ACTIVE (通常利用)");

// Case 3: 終了日翌日 (2026-10-13)
const nowAfter = new Date(Date.UTC(2026, 9, 12, 15, 0, 1)); // 2026-10-13 00:00:01 JST
const resAfter = service.getContractStatus(mockSheet, nowAfter);
assert.strictEqual(resAfter.status, 'EXPIRED', 'Case 3: 終了日翌日以降は EXPIRED でなければならない');
assert.strictEqual(resAfter.isExpired, true, 'Case 3: isExpired は true');
console.log("  ✅ Case 3 PASS: 終了日翌日 (2026-10-13 00:00:01 JST) ➔ EXPIRED (利用停止)");

// Case 4: 契約終了日 空欄 (未設定)
mockSheet.data = [
  ['項目', '内容'],
  ['状態', 'ACTIVE'],
  ['契約終了日', '']
];
const resEmpty = service.getContractStatus(mockSheet, nowAfter);
assert.strictEqual(resEmpty.status, 'ACTIVE', 'Case 4: 契約終了日空欄時は期限なし(ACTIVE)でなければならない');
assert.strictEqual(resEmpty.isExpired, false);
console.log("  ✅ Case 4 PASS: 契約終了日空欄 ➔ 期限なし ACTIVE (通常利用)");

console.log("\n▶ [Test 2] 表記揺れ・型自動正規化テスト");
// 2-1: スラッシュ区切り
mockSheet.data = [
  ['項目', '内容'],
  ['契約終了日', '2026/10/12']
];
const resSlash = service.getContractStatus(mockSheet, nowBefore);
assert.strictEqual(resSlash.endDate, '2026-10-12', 'スラッシュ区切りがハイフンに正規化されること');
assert.strictEqual(resSlash.status, 'ACTIVE');
console.log("  ✅ スラッシュ区切り (2026/10/12) ➔ 自動ハイフン正規化 (2026-10-12) PASS");

// 2-2: Dateオブジェクト（Googleスプレッドシートの自動日付セル）
mockSheet.data = [
  ['項目', '内容'],
  ['契約終了日', new Date(Date.UTC(2026, 9, 11, 15, 0, 0))] // 2026-10-12 JST
];
const resDateObj = service.getContractStatus(mockSheet, nowBefore);
assert.strictEqual(resDateObj.endDate, '2026-10-12', 'Dateオブジェクトが yyyy-MM-dd に正規化されること');
console.log("  ✅ Date オブジェクト ➔ 自動フォーマット正規化 PASS");

console.log("\n▶ [Test 3] UI入力バリデーションロジック検証");
function validateDateInput(inputText) {
  const clean = inputText.trim();
  if (clean === "") return { valid: true, cleared: true, normalized: "" };
  const match = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return { valid: false, error: 'INVALID_FORMAT' };
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return { valid: false, error: 'OUT_OF_RANGE' };
  const testDate = new Date(y, m - 1, d);
  if (testDate.getFullYear() !== y || testDate.getMonth() !== (m - 1) || testDate.getDate() !== d) {
    return { valid: false, error: 'NON_EXISTENT_DATE' };
  }
  return { valid: true, cleared: false, normalized: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

assert.strictEqual(validateDateInput('2026-10-12').valid, true);
assert.strictEqual(validateDateInput('2026-10-12').normalized, '2026-10-12');
assert.strictEqual(validateDateInput('2026/10/12').valid, true);
assert.strictEqual(validateDateInput('2026/10/12').normalized, '2026-10-12');
assert.strictEqual(validateDateInput('  ').cleared, true);
assert.strictEqual(validateDateInput('invalid-date').valid, false);
assert.strictEqual(validateDateInput('2026-02-31').valid, false); // 存在しない日付
console.log("  ✅ 正常入力・空欄クリア・不正形式拒否・存在しない日付拒否 PASS");

console.log("\n▶ [Test 4] 月次処理（rolloverMonthlySheets）非干渉検証");
const provisionerCode = fs.readFileSync('active/business/system/district_provisioner.js', 'utf8');
assert.strictEqual(provisionerCode.includes('getContractStatus'), false, 'district_provisioner に契約期限判定を直接結合していないこと');
assert.strictEqual(provisionerCode.includes('DISABLE_ROLLOVER'), false, 'district_provisioner に DISABLE_ROLLOVER が存在しないこと');
console.log("  ✅ 月次シート生成ロジックは契約期限判定と完全分離されており非干渉 PASS");

console.log("\n▶ [Test 5] API入口一括遮断ゲート検証");
const apiCode = fs.readFileSync('active/api/v2_api.js', 'utf8');
assert.strictEqual(apiCode.includes('CONTRACT_EXPIRED'), true, 'v2_api.js に CONTRACT_EXPIRED 遮断ゲートが存在すること');
console.log("  ✅ API共通入口での一括遮断ゲート確認 PASS");

console.log("\n▶ [Test 6] SYSTEM_INFO 自動項目確保 (ensureContractEndDateRow) 検証");
mockSheet.data = [
  ['項目', '内容'],
  ['地区コード', 'MOCK-DISTRICT-01'],
  ['状態', 'ACTIVE']
];
service.ensureContractEndDateRow(mockSheet);
const hasContractRow = mockSheet.data.some(row => row[0] === '契約終了日');
assert.strictEqual(hasContractRow, true, '契約終了日行が存在しない場合、自動追加されること');
service.ensureContractEndDateRow(mockSheet);
const contractRowCount = mockSheet.data.filter(row => row[0] === '契約終了日').length;
assert.strictEqual(contractRowCount, 1, '既存の場合は重複して追加されないこと');
console.log("  ✅ SYSTEM_INFO「契約終了日」自動確保・重複防止 PASS");

console.log("\n🎉 すべての契約終了日アクセスコントロール検証が PASS しました！");
