/**
 * POSTING MAP - Delete & Data Protection Governance Foundation
 * シート保護 & 業務データ保護判定基盤 (Single Source of Truth)
 * 
 * ■ Business Data Protection Rule:
 * 以下の SSOT 業務データシートは、システムによる自動削除 (deleteSheet) および
 * 自動クリア (clearContent / clear) を全面禁止します。
 *   - 保有チラシ枚数
 *   - 名簿
 *   - 受渡要請履歴
 *   - 管理者ID
 * 変更操作は利用者による直接操作、または管理者による明示的な手動操作のみ許可されます。
 */

let protectedSheetCache = null;

/**
 * 保護対象シートの Set キャッシュを返却する（初回のみ構築）
 */
function getProtectedSheetSet() {
  if (protectedSheetCache) {
    return protectedSheetCache;
  }

  protectedSheetCache = new Set();

  // 1. 固定保護対象シート名（第一防壁）
  const staticProtected = [
    "名簿",
    "原本",
    "保有チラシ枚数",
    "受渡要請履歴",
    "管理者ID",
    "__SYSTEM_CACHE__",
    "📥 集計用マスターデータ",
    "郵便番号",
    "区割り",
    "初めての方「使い方ガイド」",
    "📖 らくらくマニュアル",
    "らくらくマニュアル",
    "📄 活動報告書",
    "契約管理"
  ];
  staticProtected.forEach(name => protectedSheetCache.add(name));

  // 2. CONFIG 動的設定値（第二防壁 - 初回のみ取得）
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG.get) {
      const dynamicKeys = [
        "SHEET_GUIDE",
        "SHEET_ROSTER",
        "SHEET_TEMPLATE",
        "SHEET_POSTAL",
        "SHEET_DISTRICT",
        "SHEET_MASTER_EXPORT",
        "SHEET_REPORT",
        "SHEET_MANUAL",
        "SHEET_STORAGE",
        "SHEET_ADMIN"
      ];
      dynamicKeys.forEach(k => {
        const val = CONFIG.get(k);
        if (val) {
          protectedSheetCache.add(val);
        }
      });
    }
  } catch (e) {
    // エラー時はサイレントにスキップ
  }

  // 3. スクリプトプロパティによるカスタム保護シート設定（第三防壁 - 初回のみ取得）
  try {
    const props = PropertiesService.getScriptProperties();
    const customProtected = props.getProperty("PROTECTED_SHEETS");
    if (customProtected) {
      customProtected.split(',').forEach(name => {
        const clean = String(name || "").trim();
        if (clean) protectedSheetCache.add(clean);
      });
    }
  } catch (e) {
    // エラー時は無視
  }

  return protectedSheetCache;
}

/**
 * 指定されたシート名が保護対象（削除不可）かどうか判定する
 * @param {string} sheetName - 判定対象のシート名
 * @return {boolean} - 保護対象であれば true
 */
function isProtectedSheet(sheetName) {
  if (!sheetName) return false;

  if (sheetName.endsWith("の原本") || sheetName === "SYSTEM_INFO") {
    return true;
  }
  if (/^\D+\d{4}-\d{2}$/.test(sheetName)) {
    return true;
  }

  const protectedSet = getProtectedSheetSet();
  return protectedSet.has(sheetName);
}
