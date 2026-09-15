/**
 * POSTING MAP - District Provisioner (Generation 2)
 * 責務: 新地区作成時の「CSV → 原本5種 → 当月5種」一括生成、および月替わり自動生成
 * 
 * 【厳格な制約】
 * 1. 責務は「原本5種生成」「CSVエリア展開」「当月5種生成（原本からの複製）」「月次トリガー管理」のみ。
 * 2. MonthlySheetResolverとは完全に責務分離する（Resolverは参照解決SSOT、Provisionerが生成SSOT）。
 * 3. 前月シートは一切削除せず、履歴として保持する。
 * 4. SYSTEM_INFOは月次化対象外・固定保護。
 * 5. 地区名・自治体名・件数はコードにハードコードせず、CSVおよびSpreadsheetから動的に決定する。
 */
(function(global) {
  class DistrictProvisioner {
    constructor() {
      this.masterNames = {
        distribution: "配布実績の原本",
        staff: "名簿の原本",
        flyer: "保有チラシ枚数の原本",
        transfer: "受渡要請履歴の原本",
        pin: "PinStatusの原本"
      };

      this.prefixes = {
        distribution: "配布実績",
        staff: "名簿",
        flyer: "保有チラシ枚数",
        transfer: "受渡要請履歴",
        pin: "PinStatus"
      };
    }

    static getInstance() {
      if (!DistrictProvisioner.instance) {
        DistrictProvisioner.instance = new DistrictProvisioner();
      }
      return DistrictProvisioner.instance;
    }

    getSS() {
      if (typeof getSS === 'function') {
        return getSS();
      } else if (typeof SpreadsheetApp !== 'undefined' && typeof SpreadsheetApp.getActiveSpreadsheet === 'function') {
        return SpreadsheetApp.getActiveSpreadsheet();
      }
      throw new Error("SpreadsheetApp is unavailable");
    }

    /**
     * 新地区作成時の一括プロビジョニング
     * address_master.csv のデータを受け取り、原本5種 ➔ 当月5種 を一括生成する
     * 
     * @param {Array<Object>} addresses - CSVからパースしたエリア配列 [{ rowId, cityName, townName }, ...]
     * @return {Object} 結果オブジェクト { success: true, count: number, month: string }
     */
    provisionNewDistrict(addresses, options) {
      if (!Array.isArray(addresses) || addresses.length === 0) {
        return {
          success: false,
          code: "INVALID_ARGUMENT",
          message: "addresses must be a non-empty array of address master records."
        };
      }

      const token = options && options.provisioningToken;
      const tokenCheck = typeof verifyProvisioningToken === 'function'
        ? verifyProvisioningToken(token)
        : { success: false, code: "UNAUTHORIZED", message: "verifyProvisioningToken unavailable" };
      if (!tokenCheck.success) {
        return tokenCheck;
      }

      const ss = this.getSS();
      const districtName = (ss.getName() || '').trim();
      const invalidNames = [
        '無題のスプレッドシート',
        '無題',
        'untitled spreadsheet',
        'untitled',
        '新規スプレッドシート',
        'スプレッドシート'
      ];
      const lowerName = districtName.toLowerCase();
      const isInvalidName = !districtName ||
        invalidNames.some(inv => lowerName === inv || lowerName.startsWith('copy of') || lowerName.startsWith('のコピー'));

      if (isInvalidName) {
        return {
          success: false,
          code: "INVALID_DISTRICT_NAME",
          message: `Spreadsheet name "${districtName}" is invalid. Please rename your spreadsheet to the target district code (e.g. <TARGET_DISTRICT_CODE>) before provisioning.`
        };
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(30000);

      try {
        let sysInfoResult = null;
        if (options && options.skipSystemInfo === true) {
          sysInfoResult = {
            success: true,
            sheetName: 'SYSTEM_INFO',
            districtName: districtName,
            skipped: true
          };
        } else {
          sysInfoResult = (typeof SystemInfoService !== 'undefined' && SystemInfoService.getInstance)
            ? SystemInfoService.getInstance().syncSystemInfo(options)
            : this.createOrSyncSystemInfo(ss, options);
        }

        this.createMasterSheets(ss, addresses);

        const monthResult = this.rolloverMonthlySheets(null, options);

        if (typeof cleanupPinStatusDaily === 'function') {
          cleanupPinStatusDaily();
        }

        if (typeof setupPinStatusCleanupTrigger === 'function') {
          setupPinStatusCleanupTrigger();
        }
        this.setupMonthlyTrigger();

        SpreadsheetApp.flush();

        const types = ['distribution', 'staff', 'flyer', 'transfer', 'pin'];
        const monthlySheets = types.map(t => `${this.prefixes[t]}${monthResult.month}`);

        const allSheets = [
          "SYSTEM_INFO",
          ...Object.values(this.masterNames),
          ...monthlySheets
        ];

        return {
          success: true,
          message: "All 11 district sheets provisioned successfully with COPY-READY automated triggers.",
          districtName: (sysInfoResult && sysInfoResult.districtName) || districtName,
          sheets: allSheets,
          totalSheetsCount: allSheets.length,
          count: Array.isArray(addresses) ? addresses.length : 0,
          month: monthResult.month,
          triggersConfigured: true,
          dailyCleanupExecuted: true,
          skipSystemInfo: !!(options && options.skipSystemInfo === true)
        };
      } finally {
        lock.releaseLock();
      }
    }

    /**
     * 公式空データベーステンプレートの自動生成
     * コピー元Spreadsheetから不要シート削除・データクリア・SYSTEM_INFO初期化を行い、
     * 指定されたマスター保管フォルダへ POSTING_MAP_EMPTY_TEMPLATE を生成する
     *
     * @param {string} sourceSpreadsheetId - コピー元Spreadsheet ID（非ハードコード）
     * @param {string} targetFolderId - 格納先フォルダID
     * @param {Object} options - オプション（provisioningToken等）
     * @return {Object} 結果オブジェクト { success: boolean, templateId: string, templateUrl: string, sheets: Array }
     */
    createEmptyTemplate(sourceSpreadsheetId, targetFolderId, options) {
      if (!sourceSpreadsheetId) {
        return { success: false, code: "INVALID_ARGUMENT", message: "sourceSpreadsheetId is required." };
      }
      if (!targetFolderId) {
        return { success: false, code: "INVALID_ARGUMENT", message: "targetFolderId is required." };
      }

      const token = options && options.provisioningToken;
      const tokenCheck = typeof verifyProvisioningToken === 'function'
        ? verifyProvisioningToken(token)
        : { success: false, code: "UNAUTHORIZED", message: "verifyProvisioningToken unavailable" };
      if (!tokenCheck.success) {
        return tokenCheck;
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(30000);

      try {
        const folder = DriveApp.getFolderById(targetFolderId);
        const sourceFile = DriveApp.getFileById(sourceSpreadsheetId);
        const templateName = "POSTING_MAP_EMPTY_TEMPLATE";

        const existingFiles = folder.getFilesByName(templateName);
        while (existingFiles.hasNext()) {
          const oldFile = existingFiles.next();
          oldFile.setTrashed(true);
        }

        const newFile = sourceFile.makeCopy(templateName, folder);
        const newSS = SpreadsheetApp.openById(newFile.getId());

        const keepSheetNames = [
          "SYSTEM_INFO",
          ...Object.values(this.masterNames)
        ];

        const allCurrentSheets = newSS.getSheets();
        allCurrentSheets.forEach(sheet => {
          const sName = sheet.getName();
          if (!keepSheetNames.includes(sName)) {
            newSS.deleteSheet(sheet);
          }
        });

        // 2. 原本5種のデータ行クリア（2行目以降が存在する場合は削除し、1行目ヘッダーのみ残存）
        Object.values(this.masterNames).forEach(masterName => {
          const sheet = newSS.getSheetByName(masterName);
          if (sheet) {
            const lr = sheet.getLastRow();
            if (lr >= 2) {
              sheet.deleteRows(2, lr - 1);
            }
          }
        });

        const sysSheet = newSS.getSheetByName("SYSTEM_INFO");
        if (sysSheet) {
          const lr = sysSheet.getLastRow();
          if (lr >= 2) {
            sysSheet.getRange(2, 2, lr - 1, 1).clearContent();
            sysSheet.getRange(lr, 2).setValue("ACTIVE");
          }
        }

        SpreadsheetApp.flush();

        const finalSheets = newSS.getSheets().map(s => ({
          name: s.getName(),
          lastRow: s.getLastRow(),
          lastColumn: s.getLastColumn(),
          dataRows: Math.max(0, s.getLastRow() - 1)
        }));

        return {
          success: true,
          message: "POSTING_MAP_EMPTY_TEMPLATE created successfully.",
          templateId: newFile.getId(),
          templateUrl: newFile.getUrl(),
          targetFolderId: targetFolderId,
          sourceSpreadsheetId: sourceSpreadsheetId,
          sheetsCount: finalSheets.length,
          sheets: finalSheets
        };
      } finally {
        lock.releaseLock();
      }
    }

    /**
     * 公式空テンプレートから新地区スプレッドシートDBを複製・生成
     *
     * @param {string} templateSpreadsheetId - 複製元EMPTY TEMPLATE ID
     * @param {string} targetDistrictName - 新地区名（例: "OKAYAMA-02"）
     * @param {string} targetFolderId - 格納先フォルダID (例: 03_BRANCH/OKAYAMA-02)
     * @param {Object} options - オプション（provisioningToken等）
     * @return {Object} 結果オブジェクト { success, spreadsheetId, spreadsheetUrl, districtName, sheetsCount, sheets }
     */
    createDistrictDatabase(templateSpreadsheetId, targetDistrictName, targetFolderId, options) {
      if (!templateSpreadsheetId) {
        return { success: false, code: "INVALID_ARGUMENT", message: "templateSpreadsheetId is required." };
      }
      if (!targetDistrictName) {
        return { success: false, code: "INVALID_ARGUMENT", message: "targetDistrictName is required." };
      }
      if (!targetFolderId) {
        return { success: false, code: "INVALID_ARGUMENT", message: "targetFolderId is required." };
      }

      const token = options && options.provisioningToken;
      const tokenCheck = typeof verifyProvisioningToken === 'function'
        ? verifyProvisioningToken(token)
        : { success: false, code: "UNAUTHORIZED", message: "verifyProvisioningToken unavailable" };
      if (!tokenCheck.success) {
        return tokenCheck;
      }

      const lock = LockService.getScriptLock();
      lock.waitLock(30000);

      try {
        const folder = DriveApp.getFolderById(targetFolderId);
        const templateFile = DriveApp.getFileById(templateSpreadsheetId);

        // 格納先フォルダ内の同名スプレッドシートがあればゴミ箱へ退避
        const existingFiles = folder.getFilesByName(targetDistrictName);
        while (existingFiles.hasNext()) {
          const oldFile = existingFiles.next();
          oldFile.setTrashed(true);
        }

        // EMPTY TEMPLATE から複製し新地区名を設定
        const newFile = templateFile.makeCopy(targetDistrictName, folder);
        const newSS = SpreadsheetApp.openById(newFile.getId());

        SpreadsheetApp.flush();

        const finalSheets = newSS.getSheets().map(s => ({
          name: s.getName(),
          lastRow: s.getLastRow(),
          lastColumn: s.getLastColumn(),
          dataRows: Math.max(0, s.getLastRow() - 1)
        }));

        return {
          success: true,
          message: `District database "${targetDistrictName}" created successfully from template.`,
          spreadsheetId: newFile.getId(),
          spreadsheetUrl: newFile.getUrl(),
          districtName: targetDistrictName,
          targetFolderId: targetFolderId,
          templateSpreadsheetId: templateSpreadsheetId,
          sheetsCount: finalSheets.length,
          sheets: finalSheets
        };
      } finally {
        lock.releaseLock();
      }
    }

    createOrSyncSystemInfo(ss, options) {
      if (typeof SystemInfoService !== 'undefined' && SystemInfoService.getInstance) {
        return SystemInfoService.getInstance().syncSystemInfo(options);
      }
      const opts = options || {};
      const sheetName = "SYSTEM_INFO";
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }

      const districtName = ss.getName();
      const subdomain = districtName.toLowerCase();
      const baseUrl = (opts.baseUrl && opts.baseUrl !== "https://postingmap.jp")
        ? opts.baseUrl
        : `https://${subdomain}.postingmap.jp`;
      const hAppUrl = `${baseUrl}/`;
      const dashboardUrl = `${baseUrl}/active/manager/`;

      let liffUrl = opts.productionLiffUrl || "";
      let liffId = opts.liffId || "";
      if (!liffId && liffUrl) {
        const match = String(liffUrl).match(/liff\.line\.me\/([^/?#]+)/i);
        if (match && match[1]) {
          liffId = match[1];
        }
      }
      if (!liffId && typeof PropertiesService !== 'undefined') {
        try {
          const props = PropertiesService.getScriptProperties();
          liffId = props.getProperty("LINE_LIFF_ID") || props.getProperty("LIFF_ID") || "";
          if (liffId && !liffUrl) {
            liffUrl = `https://liff.line.me/${liffId}`;
          }
        } catch (e) {}
      }

      let managerPassword = opts.managerPassword || "";
      if (!managerPassword && sheet) {
        try {
          const lastRow = sheet.getLastRow();
          if (lastRow > 1) {
            const data = sheet.getRange(1, 1, lastRow, 2).getValues();
            for (let i = 0; i < data.length; i++) {
              if (data[i][0] === "Manager認証パスワード" && data[i][1]) {
                managerPassword = String(data[i][1]).trim();
                break;
              }
            }
          }
        } catch (e) {}
      }
      if (!managerPassword) {
        managerPassword = String(Math.floor(100000 + Math.random() * 900000));
      }

      let contractEndDate = opts.contractEndDate || "";
      if (!contractEndDate && sheet) {
        try {
          const lastRow = sheet.getLastRow();
          if (lastRow > 1) {
            const data = sheet.getRange(1, 1, lastRow, 2).getValues();
            for (let i = 0; i < data.length; i++) {
              if (data[i][0] === "契約終了日" && data[i][1]) {
                const val = data[i][1];
                if (val instanceof Date) {
                  if (typeof Utilities !== 'undefined' && typeof Utilities.formatDate === 'function') {
                    contractEndDate = Utilities.formatDate(val, "JST", "yyyy-MM-dd");
                  } else {
                    const jst = new Date(val.getTime() + (9 * 60 * 60 * 1000));
                    contractEndDate = jst.toISOString().slice(0, 10);
                  }
                } else {
                  contractEndDate = String(val).trim().replace(/\//g, '-');
                }
                break;
              }
            }
          }
        } catch (e) {}
      }

      const headers = [["項目", "内容"]];
      const rows = [
        ["地区コード", districtName],
        ["地区名", districtName],
        ["HアプリURL", hAppUrl],
        ["Dashboard URL", dashboardUrl],
        ["LIFFアプリ名", `POSTING MAP ${districtName}`],
        ["LIFF ID", liffId],
        ["LIFF URL", liffUrl],
        ["Endpoint URL", hAppUrl],
        ["Manager認証パスワード", managerPassword],
        ["状態", "ACTIVE"],
        ["契約終了日", contractEndDate]
      ];

      const currentLr = sheet.getLastRow();
      if (currentLr >= 2) {
        sheet.getRange(2, 1, currentLr - 1, 2).clearContent();
      }

      sheet.getRange(1, 1, 1, 2).setValues(headers);
      sheet.getRange("A1:B1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.getRange(2, 1, rows.length, 2).setValues(rows);
      sheet.getRange(`A2:A${rows.length + 1}`).setFontWeight("bold");
      sheet.setFrozenRows(1);

      return {
        success: true,
        sheet: sheetName,
        districtName: districtName,
        rowCount: rows.length
      };
    }
    /**
     * 原本5種の生成・初期化
     */
    createMasterSheets(ss, addresses) {
      // 1. 配布実績の原本 (全エリアを展開)
      this.createDistributionMaster(ss, addresses);

      // 2. 名簿の原本 (ヘッダーのみ、0行)
      this.createStaffMaster(ss);

      // 3. 保有チラシ枚数の原本 (ヘッダーのみ、0行)
      this.createFlyerMaster(ss);

      // 4. 受渡要請履歴の原本 (ヘッダーのみ、0行)
      this.createTransferMaster(ss);

      // 5. PinStatusの原本 (ヘッダーのみ、0行)
      this.createPinMaster(ss);
    }

    /**
     * 配布実績の原本
     * A〜O列: [ID, 市町村, 町域, 配布完了日時, 配布枚数, 担当者ID, 担当者名, GPS, 写真, 緯度, 経度, GPS日時, 写真ファイルID, 写真URL, 写真日時]
     */
    createDistributionMaster(ss, addresses) {
      const masterName = this.masterNames.distribution;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }

      const headers = [
        ["ID", "市町村", "町域", "配布完了日時", "配布枚数", "担当者ID", "担当者名", "GPS", "写真", "緯度", "経度", "GPS日時", "写真ファイルID", "写真URL", "写真日時"]
      ];
      sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
      sheet.getRange("A1:O1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);

      if (Array.isArray(addresses) && addresses.length > 0) {
        const rows = addresses.map((addr, idx) => {
          const rowId = addr.rowId !== undefined ? addr.rowId : (idx + 1);
          const city = addr.cityName || addr.city_name || "";
          const town = addr.townName || addr.town_name || "";
          return [rowId, city, town, "", "", "", "", "", "", "", "", "", "", "", ""];
        });

        // 既存の古い行があればクリア
        const currentLr = sheet.getLastRow();
        if (currentLr >= 2) {
          sheet.getRange(2, 1, currentLr - 1, 15).clearContent();
        }

        // CSVから動的展開
        sheet.getRange(2, 1, rows.length, 15).setValues(rows);
      }
    }

    /**
     * 名簿の原本
     * A〜D列: [ID, 名前, LINE_USER_ID, 登録日時]
     */
    createStaffMaster(ss) {
      const masterName = this.masterNames.staff;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }
      const headers = [["ID", "名前", "LINE_USER_ID", "登録日時"]];
      sheet.getRange(1, 1, 1, 4).setValues(headers);
      sheet.getRange("A1:D1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    /**
     * 保有チラシ枚数の原本
     * A〜F列: [ID, 担当者ID, 担当者名, 保管場所, 保有枚数, 最終更新日時]
     */
    createFlyerMaster(ss) {
      const masterName = this.masterNames.flyer;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }
      const headers = [["ID", "担当者ID", "担当者名", "保管場所", "保有枚数", "最終更新日時"]];
      sheet.getRange(1, 1, 1, 6).setValues(headers);
      sheet.getRange("A1:F1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    /**
     * 受渡要請履歴の原本
     * A〜G列: [日時, 要請者, 要請者ID, 保管者, 保管者ID, 連絡方法, 連絡先]
     */
    createTransferMaster(ss) {
      const masterName = this.masterNames.transfer;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }
      const headers = [["日時", "要請者", "要請者ID", "保管者", "保管者ID", "連絡方法", "連絡先"]];
      sheet.getRange(1, 1, 1, 7).setValues(headers);
      sheet.getRange("A1:G1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    /**
     * PinStatusの原本
     * A〜B列: [rowId, status]
     */
    createPinMaster(ss) {
      const masterName = this.masterNames.pin;
      let sheet = ss.getSheetByName(masterName);
      if (!sheet) {
        sheet = ss.insertSheet(masterName);
      }
      const headers = [["rowId", "status"]];
      sheet.getRange(1, 1, 1, 2).setValues(headers);
      sheet.getRange("A1:B1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    /**
     * 原本5種から当月5種を生成・複製する
     * 過去月シートは履歴として保持し、絶対に削除しない。
     * 新月は原本から新規生成し、0から開始する。
     * 
     * @param {string} [targetMonth] - 生成対象年月 (YYYY-MM)。未指定時は現在月。
     * @return {Object} 結果 { success: true, month: string, created: string[] }
     */
    rolloverMonthlySheets(targetMonth, options = {}) {
      const ss = this.getSS();
      const month = targetMonth || (
        typeof MonthlySheetResolver !== 'undefined' && MonthlySheetResolver.getInstance
          ? MonthlySheetResolver.getInstance().getCurrentMonth()
          : Utilities.formatDate(new Date(), "JST", "yyyy-MM")
      );

      const createdSheets = [];
      const types = ['distribution', 'staff', 'flyer', 'transfer', 'pin'];

      types.forEach(type => {
        const prefix = this.prefixes[type];
        const masterName = this.masterNames[type];
        const monthlyName = `${prefix}${month}`;

        let currentMonthly = ss.getSheetByName(monthlyName);
        if (!currentMonthly) {
          const masterSheet = ss.getSheetByName(masterName);
          if (!masterSheet) {
            throw new Error(`Master template sheet "${masterName}" does not exist. Run provisionNewDistrict first.`);
          }

          // 原本から複製
          currentMonthly = masterSheet.copyTo(ss);
          currentMonthly.setName(monthlyName);

          // 配布実績の場合、原本に記録がある場合でも当月は未完了（初期状態0%）から開始する
          if (type === 'distribution') {
            const lr = currentMonthly.getLastRow();
            if (lr >= 2) {
              // D〜O列 (完了日時、枚数、担当者、GPS、写真等) をクリア
              currentMonthly.getRange(2, 4, lr - 1, 12).clearContent();
            }
          }

          createdSheets.push(monthlyName);
        } else {
          // 既存の当月シートが存在する場合の同期（新地区プロビジョニング初期化対応）
          const masterSheet = ss.getSheetByName(masterName);
          if (masterSheet) {
            if (type === 'distribution') {
              const masterLr = masterSheet.getLastRow();
              const currentLr = currentMonthly.getLastRow();
              const currentLc = Math.max(currentMonthly.getLastColumn(), 15);

              let existingCompletedCount = 0;
              if (currentLr >= 2) {
                const existingData = currentMonthly.getRange(2, 1, currentLr - 1, currentLc).getValues();
                existingCompletedCount = existingData.filter(r => r[3] && String(r[3]).trim() !== "").length;
              }

              const shouldReset = options && options.resetExistingRecords === true;
              if (existingCompletedCount > 0 && !shouldReset) {
                console.log(`[rolloverMonthlySheets] distribution sheet has ${existingCompletedCount} completed records. Preserving existing distribution records.`);
              } else {
                if (currentLr >= 2) {
                  currentMonthly.getRange(2, 1, currentLr - 1, currentLc).clearContent();
                }
                if (masterLr >= 2) {
                  const masterData = masterSheet.getRange(2, 1, masterLr - 1, 15).getValues();
                  const initialMonthlyData = masterData.map(r => [r[0], r[1], r[2], "", "", "", "", "", "", "", "", "", "", "", ""]);
                  currentMonthly.getRange(2, 1, initialMonthlyData.length, 15).setValues(initialMonthlyData);
                }
              }
            } else if (type === 'pin') {
            } else {
              const currentLr = currentMonthly.getLastRow();
              const currentLc = currentMonthly.getLastColumn();
              if (currentLr >= 2 && currentLc >= 1) {
                currentMonthly.getRange(2, 1, currentLr - 1, currentLc).clearContent();
              }
            }
          }
        }
      });

      return {
        success: true,
        month: month,
        created: createdSheets
      };
    }

    /**
     * 毎月1日 0:00 JST に rolloverMonthlySheets を実行する時間主導型トリガーを設定
     */
    setupMonthlyTrigger() {
      if (typeof deleteTriggers === 'function') {
        deleteTriggers("rolloverMonthlySheetsDailyCheck");
      }
      ScriptApp.newTrigger("rolloverMonthlySheetsDailyCheck")
        .timeBased()
        .everyDays(1)
        .atHour(0)
        .create();
      console.log("rolloverMonthlySheetsDailyCheck trigger set: daily at 0:00 AM JST");
    }
  }

  DistrictProvisioner.instance = null;
  global.DistrictProvisioner = DistrictProvisioner;
})(this);
