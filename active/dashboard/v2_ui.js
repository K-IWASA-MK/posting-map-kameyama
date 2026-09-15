/**
 * GAS v2 - UI・イベント管理モジュール
 * - メニュー作成 (onOpen)
 * - イベントトリガー (onEdit)
 * - シートデザイン・整形ロジック
 * - 診断機能
 */

// =============================
// ⑤ メニュー & 初期化
// =============================

function onOpen() {
  // スプレッドシートIDをスクリプトプロパティに自動保存（Webアプリからの動的書き込みに必要）
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", ss.getId());
    }
  } catch (e) {
  }

  try {
    if (typeof SystemInfoService !== 'undefined' && SystemInfoService.getInstance) {
      SystemInfoService.getInstance().ensureContractEndDateRow();
    }
  } catch (e) {
  }

  const ui = SpreadsheetApp.getUi();
  ui.createMenu("⚙️ ポスティング管理")
    .addItem("🚀 当月シート一括生成・確認（原本5種 ➔ 当月5種）", "rolloverMonthlySheetsFromUI")
    .addItem("⏰ 毎月1日 月次自動生成トリガー設定", "setupMonthlyProvisioningTrigger")
    .addSeparator()
    .addItem("🔓 スプシの保護・ロックをすべて解除", "removeAllProtections")
    .addItem("🔍 保護・ロックの状況を診断する", "diagnoseProtections")
    .addSeparator()
    .addItem("📊 全体数を集計する（ランキング更新）", "aggregateTotalVolumes")
    .addItem("📖 スタッフ用マニュアルを作成", "createManualSheet")
    .addSeparator()
    .addItem(
      "🔍 ドライブのファイルを確認する (レスキュー)",
      "diagnoseDriveFiles",
    )
    .addSeparator()
    .addItem("⏰ 自動集計（1時間ごと）を有効化", "setupHourlyRefreshTrigger")
    .addItem("📅 契約・利用終了日を設定", "setContractEndDateFromUI")
    .addSeparator()
    .addItem("🎨 全シートを「プロ仕様」に一斉整形", "formatAllSheets")
    .addItem("🔧 名簿シートを初期化・復旧する", "setupRosterSheet")
    .addSeparator()
    .addItem("📁 ドライブフォルダを自動セットアップ", "setupGoogleDriveFolders")
    .addToUi();
}


/**
 * 原本5種から当月5種シートを一括生成・確認する（UI手動実行用）
 */
function rolloverMonthlySheetsFromUI() {
  if (typeof DistrictProvisioner !== 'undefined' && DistrictProvisioner.getInstance) {
    const res = DistrictProvisioner.getInstance().rolloverMonthlySheets();
    SpreadsheetApp.getActiveSpreadsheet().toast(`当月（${res.month}）の5種シートを正常に確認・生成しました。`, "完了");
  } else {
    SpreadsheetApp.getUi().alert("エラー: DistrictProvisioner が利用できません。");
  }
}

/**
 * 毎月1日（深夜0時）の月次自動生成トリガーを設定する
 */
function setupMonthlyProvisioningTrigger() {
  if (typeof DistrictProvisioner !== 'undefined' && DistrictProvisioner.getInstance) {
    DistrictProvisioner.getInstance().setupMonthlyTrigger();
    SpreadsheetApp.getUi().alert("⏰ 毎月1日（深夜0時）の月次自動生成トリガーを設定しました。\n毎月自動的に原本5種から新月シートが生成されます。");
  } else {
    SpreadsheetApp.getUi().alert("エラー: DistrictProvisioner が利用できません。");
  }
}

/**
 * 日次トリガーから実行される月次判定・自動生成関数
 */
function rolloverMonthlySheetsDailyCheck() {
  if (typeof DistrictProvisioner !== 'undefined' && DistrictProvisioner.getInstance) {
    DistrictProvisioner.getInstance().rolloverMonthlySheets();
  }
}

/**
 * 定期集計トリガーを設定する
 */
function setupHourlyRefreshTrigger() {
  // 既存のトリガーを掃除
  deleteTriggers("refreshAreaSummaryCache");

  // 1時間おきに実行
  ScriptApp.newTrigger("refreshAreaSummaryCache")
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert("1時間おきの自動集計トリガーを設定しました。");
}

/**
 * トリガー
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  const name = sheet.getName();
  const col = range.getColumn();
  const row = range.getRow();

  // 除外シート
  const exclude = [
    CONFIG.get("SHEET_GUIDE"),
    CONFIG.get("SHEET_ROSTER"),
    CONFIG.get("SHEET_TEMPLATE"),
    CONFIG.get("SHEET_POSTAL"),
    CONFIG.get("SHEET_DISTRICT"),
    CONFIG.get("SHEET_MASTER_EXPORT"),
    CONFIG.get("SHEET_REPORT"),
    CONFIG.get("SHEET_MANUAL"),
    CONFIG.get("SHEET_STORAGE"),
  ];
  if (exclude.includes(name) || sheet.isSheetHidden()) return;

  // D列（完了チェック）が編集された場合
  if (col === 4 && row >= 2) {
    const val = range.getValue();
    const now = Utilities.formatDate(new Date(), "JST", "MM/dd HH:mm");

    // 日時をセット
    sheet.getRange(row, 5).setValue(val ? now : "");

    // サマリーとキャッシュを更新
    updateSheetSummary(sheet);
    updateAreaCache(name, val ? 1 : -1);
  } else if (col === 6 || col === 7) {
    // 枚数や担当が変更された場合
    updateSheetSummary(sheet);
  }
}

/**
 * 【レスキュー機能】ドライブ内のCSVファイルを診断し、表示する
 */
function diagnoseDriveFiles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let msg = "【ドライブ診断結果】\n\n";
  let count = 0;

  try {
    const files = DriveApp.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      if (
        name.toLowerCase().endsWith(".csv") ||
        file.getMimeType() === MimeType.GOOGLE_SHEETS
      ) {
        msg += `・${name}\n`;
        count++;
      }
      if (count > 20) break; // 探しすぎ防止
    }

    if (count === 0) {
      msg +=
        "CSVファイルが一つも見つかりませんでした。\nファイルをGoogleドライブの『マイドライブ』直下に置いてみてください。";
    } else {
      msg +=
        "\n上記の中に、使いたいファイル名はありますか？\n一字一句（スペース等も含め）同じである必要があります。";
    }
  } catch (e) {
    msg += "エラーが発生しました: " + e.message;
  }

  SpreadsheetApp.getUi().alert(msg);
}

/**
 * 原本および全エリアシートのデザインを「究極の視認性（シニア対応）」に一斉整形する
 */
function formatAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const template = ss.getSheetByName(CONFIG.get("SHEET_TEMPLATE"));
  const exclude = [
    CONFIG.get("SHEET_GUIDE"),
    CONFIG.get("SHEET_ROSTER"),
    CONFIG.get("SHEET_TEMPLATE"),
    CONFIG.get("SHEET_POSTAL"),
    CONFIG.get("SHEET_DISTRICT"),
    CONFIG.get("SHEET_MASTER_EXPORT"),
    CONFIG.get("SHEET_REPORT"),
    CONFIG.get("SHEET_MANUAL"),
    CONFIG.get("SHEET_STORAGE"),
  ];

  // 1. まずは「原本」を完璧に整える
  applyProDesign(template);

  // 2. 「名簿」を整える
  formatRosterSheet();

  // 3. 他の全エリアシートにも同じデザインを適用
  const sheets = ss.getSheets();
  sheets.forEach((s) => {
    const name = s.getName();
    if (!exclude.includes(name) && !s.isSheetHidden()) {
      applyProDesign(s);
    }
  });

  ss.toast("全シートを「究極の視認性デザイン」に整形しました！");
}

/**
 * 指定したシートにプレミアムデザインを適用する内部関数
 */
function applyProDesign(sheet) {
  if (!sheet) return;

  // 一旦、すべての行と列を表示する（隠れている行を復活させる）
  const maxRowsInit = sheet.getMaxRows();
  const maxColsInit = sheet.getMaxColumns();
  sheet.showRows(1, maxRowsInit);
  sheet.showColumns(1, maxColsInit);

  // 列幅の調整（E,F,Gを重点的に拡大）
  sheet.setColumnWidth(1, 450); // 住所 (A)
  sheet.setColumnWidth(2, 60); // 地図 (B)
  sheet.setColumnWidth(3, 250); // メモ (C)
  sheet.setColumnWidth(4, 60); // 完了 (D)
  sheet.setColumnWidth(5, 180); // 日付 (E) - 拡大
  sheet.setColumnWidth(6, 120); // 枚数 (F) - 拡大
  sheet.setColumnWidth(7, 220); // 担当 (G) - 拡大

  // F列（枚数）のプルダウン（データの入力規則）をクリアして、自由な数字入力に対応させる
  sheet.getRange("F2:F11").clearDataValidations();

  // 行の高さ調整（85pxのゆったりサイズ）
  sheet.setRowHeight(1, 50); // ヘッダー
  const dataRowHeight = 85; // データ行
  sheet.setRowHeights(2, 10, dataRowHeight);

  // セルの書式設定
  const allRange = sheet.getRange("A1:G11");
  allRange
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  // ヘッダーデザイン
  const header = sheet.getRange("A1:G1");
  header
    .setBackground("#1a237e")
    .setFontColor("#ffffff")
    .setFontSize(14)
    .setFontWeight("bold");

  // 住所列の超強調（18pt）
  sheet.getRange("A2:A11").setFontSize(18).setFontWeight("bold");

  // その他のデータ行のフォントサイズ
  sheet.getRange("B2:G11").setFontSize(14).setFontWeight("bold");

  // ストライプデザイン（列ごとの色分け）
  // A, C, E, G, K, L列に薄い色を敷く
  const lightColor = "#f8f9fa";
  sheet.getRange("A2:A11").setBackground(lightColor);
  sheet.getRange("C2:C11").setBackground(lightColor);
  sheet.getRange("E2:E11").setBackground(lightColor);
  sheet.getRange("G2:G11").setBackground(lightColor);
  sheet.getRange("K2:L11").setBackground(lightColor);

  // B, D, F列は白（強調）
  sheet.getRange("B2:B11").setBackground("#ffffff");
  sheet.getRange("D2:D11").setBackground("#ffffff");
  sheet.getRange("F2:F11").setBackground("#ffffff");

  // H列以降（システム用）をすべて非表示にする
  if (maxColsInit > 7) {
    sheet.hideColumns(8, maxColsInit - 7);
  }

  if (maxRowsInit > 11) {
    sheet.hideRows(12, maxRowsInit - 11);
  }
}

/**
 * 名簿シート・名簿の原本シートを「究極の視認性」に整形する
 */
function formatSingleRosterSheet(sheet) {
  if (!sheet) return;

  const maxRows = sheet.getMaxRows();
  const maxCols = sheet.getMaxColumns();

  // 全列を表示させてから、E列以降を隠す
  sheet.showColumns(1, maxCols);
  sheet.setHiddenGridlines(true);

  // 列幅設定 (ID: 100, 名前: 250, LINE_USER_ID: 300, 登録日時: 200)
  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 250);
  sheet.setColumnWidth(3, 300);
  sheet.setColumnWidth(4, 200);

  if (maxCols > 4) {
    sheet.hideColumns(5, maxCols - 4);
  }

  // ヘッダーデザイン (A1:D1)
  const header = sheet.getRange("A1:D1");
  header
    .setBackground("#1a237e")
    .setFontColor("#ffffff")
    .setFontSize(14)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 50);

  // データ行のデザイン（複数行ある場合にあらかじめ設定）
  if (maxRows > 1) {
    const dataRange = sheet.getRange(2, 1, maxRows - 1, 4);
    dataRange
      .setFontSize(18)
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setBackground("#ffffff");
    sheet.setRowHeights(2, maxRows - 1, 85);
  }
}

function formatRosterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = (typeof MonthlySheetResolver !== 'undefined' && MonthlySheetResolver.getInstance)
    ? MonthlySheetResolver.getInstance().getCurrentSheet("staff")
    : null;
  if (sheet) formatSingleRosterSheet(sheet);
  const templateSheet = ss.getSheetByName("名簿の原本");
  if (templateSheet) formatSingleRosterSheet(templateSheet);
  if (typeof ss.toast === 'function') {
    ss.toast("名簿関連シートをプロ仕様に整形しました！");
  }
}

/**
 * 名簿および名簿の原本シートを初期化・再構築
 */
function setupRosterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (typeof DistrictProvisioner !== 'undefined' && DistrictProvisioner.getInstance) {
    DistrictProvisioner.getInstance().createStaffMaster(ss);
    DistrictProvisioner.getInstance().rolloverMonthlySheets();
    return "名簿の原本および当月名簿を4列新SSOT構造で再構築しました。";
  }
  return "DistrictProvisioner not available";
}

/**
 * 管理者権限をチェックする
 */
function isNotAdmin() {
  // 現時点では全員を管理者として扱う（将来的にメールアドレス制限などを入れる場合はここを修正）
  return false;
}

function setContractEndDateFromUI() {
  const ui = SpreadsheetApp.getUi();
  const sysInfoService = typeof SystemInfoService !== 'undefined' && SystemInfoService.getInstance
    ? SystemInfoService.getInstance()
    : null;

  let currentEndDate = '';
  if (sysInfoService) {
    currentEndDate = sysInfoService.getContractEndDate();
  }

  const currentDisplay = currentEndDate
    ? `【現在の設定】: ${currentEndDate} まで利用可能`
    : "【現在の設定】: 期限なし（通常利用中）";

  const response = ui.prompt(
    "📅 契約・利用終了日の設定",
    `${currentDisplay}\n\n本システムの利用終了日を半角数字『YYYY-MM-DD』形式で入力してください。\n（例: 選挙当日の 2026-10-12）\n\n※設定した日付の当日 23:59:59 (JST) まで通常通りご利用いただけます。\n※空欄のままOKを押すと、期限設定を解除（無期限利用）します。\n※終了後もスプレッドシートのデータや過去の記録は安全に保全されます。`,
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const inputText = response.getResponseText().trim();

  if (inputText === "") {
    if (sysInfoService) {
      sysInfoService.setContractEndDate("");
    }
    PropertiesService.getScriptProperties().deleteProperty("DISABLE_ROLLOVER");
    ui.alert("利用終了日の設定を解除しました。\n期限なし（通常利用）を継続します。");
    return;
  }

  const match = inputText.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) {
    ui.alert("エラー: 日付の形式が正しくありません。\n『2026-10-12』のように YYYY-MM-DD 形式で入力してください。");
    return;
  }

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    ui.alert("エラー: 有効なカレンダー日付を入力してください。");
    return;
  }

  const testDate = new Date(y, m - 1, d);
  if (testDate.getFullYear() !== y || testDate.getMonth() !== (m - 1) || testDate.getDate() !== d) {
    ui.alert("エラー: カレンダー上に存在しない日付です。");
    return;
  }

  const normalizedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  if (sysInfoService) {
    sysInfoService.setContractEndDate(normalizedDate);
  }
  PropertiesService.getScriptProperties().deleteProperty("DISABLE_ROLLOVER");

  ui.alert(`契約・利用終了日を「${normalizedDate}」に設定しました。\n${normalizedDate} 23:59:59 (JST) まで通常通りご利用いただけます。`);
}

function toggleContractEndReservation() {
  setContractEndDateFromUI();
}


/**
 * スプレッドシート内のすべてのシート・セル範囲の保護（ロック）を完全に解除する
 */
function removeAllProtections() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // SHEET と RANGE の両タイプから保護を取得
  const types = [SpreadsheetApp.ProtectionType.SHEET, SpreadsheetApp.ProtectionType.RANGE];
  let sheetCount = 0;
  let rangeCount = 0;
  let skipCount = 0;

  types.forEach(type => {
    const protections = ss.getProtections(type);
    protections.forEach(p => {
      try {
        if (p.canEdit()) {
          const isSheet = p.getProtectionType() === SpreadsheetApp.ProtectionType.SHEET;
          p.remove();
          SpreadsheetApp.flush(); // 強制的に即時反映してエラーをtry-catchで捕捉
          if (isSheet) {
            sheetCount++;
          } else {
            rangeCount++;
          }
        } else {
          skipCount++;
        }
      } catch (e) {
        console.error("保護の解除に失敗:", e);
      }
    });
  });

  let msg = `シート保護: ${sheetCount}件、範囲保護: ${rangeCount}件 のロックをすべて解除しました。`;
  if (skipCount > 0) {
    msg += ` (権限不足のため ${skipCount}件をスキップしました)`;
  }
  ss.toast(msg, "解除完了", 10);
}

/**
 * シートおよび範囲保護 of 各シートの状況を詳細に診断してアラート表示する
 */
function diagnoseProtections() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let result = "【スプレッドシート保護状況 診断結果】\n\n";
  
  result += "スプレッドシートID: " + ss.getId() + "\n";
  result += "現在の実行ユーザー: " + Session.getActiveUser().getEmail() + "\n";
  result += "シート数: " + sheets.length + "\n\n";

  sheets.forEach(sheet => {
    result += `■ シート名: "${sheet.getName()}"\n`;
    
    const types = [SpreadsheetApp.ProtectionType.SHEET, SpreadsheetApp.ProtectionType.RANGE];
    let idx = 1;
    
    types.forEach(type => {
      const protections = sheet.getProtections(type);
      protections.forEach(p => {
        const typeStr = p.getProtectionType() === SpreadsheetApp.ProtectionType.SHEET ? "シート全体" : "範囲保護";
        const desc = p.getDescription() || "説明なし";
        let canEditVal = false;
        try {
          canEditVal = p.canEdit();
        } catch (e) {
          canEditVal = "エラー: " + e.message;
        }
        result += `    [${idx}] タイプ: ${typeStr}, 説明: "${desc}", 編集権限(canEdit): ${canEditVal}\n`;
        idx++;
      });
    });
    
    if (idx === 1) {
      result += "  - 保護オブジェクト数: 0\n";
    }
  });

  const ui = SpreadsheetApp.getUi();
  ui.alert("スプシ保護状況の診断結果", result, ui.ButtonSet.OK);
}

/**
 * デモ・本番用のGoogleドライブフォルダ構造を自動セットアップし、スプレッドシートを移動する
 */
function setupGoogleDriveFolders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ssName = ss.getName(); // 地区名SSOT
  const targetFolderName = ssName;
  
  // 1. 親フォルダ「POSTING_MAP_SYSTEM」を探す、なければ作成
  let systemFolder;
  const systemFolders = DriveApp.getFoldersByName("POSTING_MAP_SYSTEM");
  if (systemFolders.hasNext()) {
    systemFolder = systemFolders.next();
  } else {
    systemFolder = DriveApp.createFolder("POSTING_MAP_SYSTEM");
  }
  
  // 2. 「00_TEMPLATE」と「01_ACTIVE_CLIENTS」フォルダを作成
  let templateFolder;
  const templateFolders = systemFolder.getFoldersByName("00_TEMPLATE");
  if (templateFolders.hasNext()) {
    templateFolder = templateFolders.next();
  } else {
    templateFolder = systemFolder.createFolder("00_TEMPLATE");
  }
  
  let activeClientsFolder;
  const activeClientsFolders = systemFolder.getFoldersByName("01_ACTIVE_CLIENTS");
  if (activeClientsFolders.hasNext()) {
    activeClientsFolder = activeClientsFolders.next();
  } else {
    activeClientsFolder = systemFolder.createFolder("01_ACTIVE_CLIENTS");
  }
  
  // 3. 顧客個別フォルダ「${ssName}」を作成
  let clientFolder;
  const clientFolders = activeClientsFolder.getFoldersByName(targetFolderName);
  if (clientFolders.hasNext()) {
    clientFolder = clientFolders.next();
  } else {
    clientFolder = activeClientsFolder.createFolder(targetFolderName);
  }
  
  // 4. 写真格納用フォルダ「${ssName}_STORAGE」を作成
  let storageFolder;
  const storageFolderName = `${ssName}_STORAGE`;
  const storageFolders = clientFolder.getFoldersByName(storageFolderName);
  if (storageFolders.hasNext()) {
    storageFolder = storageFolders.next();
  } else {
    storageFolder = clientFolder.createFolder(storageFolderName);
    // 全員が写真をアップロードできるよう、リンクを知っている全員に編集権限を付与
    storageFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
  }
  
  // 5. スプレッドシート自体を顧客個別フォルダに移動
  const ssFile = DriveApp.getFileById(ss.getId());
  const currentParents = ssFile.getParents();
  while (currentParents.hasNext()) {
    const parent = currentParents.next();
    parent.removeFile(ssFile);
  }
  clientFolder.addFile(ssFile);
  
  // 6. 新しい写真フォルダIDをスクリプトプロパティに設定
  PropertiesService.getScriptProperties().setProperty("STORAGE_PARENT_ID", storageFolder.getId());
  
  ss.toast("フォルダ構造の自動セットアップが完了しました！", "セットアップ完了", 10);
  return `Setup completed. Storage Folder ID: ${storageFolder.getId()}`;
}
