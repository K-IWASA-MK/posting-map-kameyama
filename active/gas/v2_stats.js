/**
 * GAS v2 - 集計・報告モジュール
 * - 配布枚数の集計
 * - 各種報告用シートの作成・出力
 */

/**
 * 【新・戦略エンジン】全体数と個人ランキングを集計する
 */
function aggregateTotalVolumes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const guideSheet = ss.getSheetByName(CONFIG.get("SHEET_GUIDE"));

  // 1. 配布実績サマリーの動的取得 (SSOT)
  const summary = (typeof SystemSummaryService !== 'undefined')
    ? SystemSummaryService.getInstance().getSystemSummary()
    : { total: 0, done: 0, percent: 0 };

  const totalPoints = summary.total || 0;
  const totalUnitsDone = summary.done || 0;
  const progressPercent = totalPoints > 0 ? (totalUnitsDone / totalPoints) * 100 : 0;

  // 2. ランキングと総配布枚数の取得
  const rankingList = getRankingDataCore();
  const top10Ranking = rankingList.slice(0, 10);
  const grandTotalVolume = rankingList.reduce((sum, entry) => sum + (entry.count || 0), 0);

  if (guideSheet) {
    // 1. 全体進捗表示 (H5セル) - パーセントのみ
    guideSheet
      .getRange("H5:K5")
      .merge()
      .setValue(`全体進捗: ${progressPercent.toFixed(1)}%`);

    // 2. 総配布枚数表示 (H6セル)
    guideSheet
      .getRange("H6:K6")
      .merge()
      .setValue(`総配布枚数: ${grandTotalVolume.toLocaleString()} 枚`);

    // 3. ランキング表示 (M列などに反映)
    guideSheet.getRange("M10:O20").clearContent();
    guideSheet.getRange("M9").setValue("🏆 配布枚数ランキング");

    top10Ranking.forEach((entry, index) => {
      const row = 10 + index;
      guideSheet.getRange(row, 13).setValue(`${index + 1}位`);
      guideSheet.getRange(row, 14).setValue(entry.name);
      guideSheet.getRange(row, 15).setValue(`${entry.count.toLocaleString()} 枚`);
    });

    ss.toast(`集計完了: 進捗 ${progressPercent.toFixed(1)}%`, "システム更新");
  }
}

function updateSheetSummary(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return;
  const data = sheet.getRange(2, 4, last - 1, 3).getValues();
  let total = 0;
  data.forEach((row) => {
    if (row[0] === true && typeof row[2] === "number") total += row[2];
  });
  sheet.getRange("H1").setValue(total);
}

function createManualSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet =
    ss.getSheetByName(CONFIG.get("SHEET_MANUAL")) ||
    ss.insertSheet(CONFIG.get("SHEET_MANUAL"));
  sheet.clear();
  sheet
    .getRange("B2")
    .setValue("ポスティング報告 らくらくガイド")
    .setFontSize(24)
    .setFontWeight("bold");
  ss.toast("マニュアル作成完了。");
}


/**
 * 全エリアのシートをスキャンして個人ランキングを集計し、キャッシュに保存する
 */
function refreshRankingCache() {
  const rankingList = getRankingDataCore();

  const jsonResult = JSON.stringify(rankingList);
  const cache = CacheService.getScriptCache();
  cache.put("RANKING_FAST_CACHE", jsonResult, 1800);
  PropertiesService.getScriptProperties().setProperty("RANKING_CACHE", jsonResult);

  return rankingList;
}
