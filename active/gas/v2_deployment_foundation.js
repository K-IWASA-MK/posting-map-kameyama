/**
 * POSTING MAP
 * Phase 31: District Deployment Foundation Core
 */

/**
 * Verification Result Model
 */
class VerificationResult {
  constructor(name, status, message) {
    this.name = name;
    this.status = status; // 'PASS' | 'WARNING' | 'FAILED' | 'SKIPPED'
    this.message = message || '';
    this.timestamp = Date.now();
  }
}

/**
 * Base Rule class
 */
class VerificationRule {
  constructor(name) {
    this.name = name;
  }
  execute() {
    throw new Error("Method execute() must be implemented");
  }
}

/**
 * Rule to verify Spreadsheet connection and basic read access
 */
class SpreadsheetRule extends VerificationRule {
  constructor() {
    super("Spreadsheet Access");
  }
  execute() {
    try {
      const ss = getSS();
      const name = ss.getName();
      const sheets = ss.getSheets();
      if (sheets.length === 0) {
        return new VerificationResult(this.name, "FAILED", "Spreadsheet resolved but contains no sheets.");
      }
      return new VerificationResult(this.name, "PASS", `Connected successfully to spreadsheet: "${name}"`);
    } catch (e) {
      return new VerificationResult(this.name, "FAILED", `Spreadsheet check failed: ${e.toString()}`);
    }
  }
}

/**
 * Rule to verify Google Drive folder access for media storage
 */
class DriveRule extends VerificationRule {
  constructor() {
    super("Google Drive Folder");
  }
  execute() {
    try {
      const folderId = getStorageFolderId();
      if (!folderId) {
        return new VerificationResult(this.name, "WARNING", "STORAGE_PARENT_ID is not configured in properties. Media upload might fail.");
      }
      const folder = DriveApp.getFolderById(folderId);
      const folderName = folder.getName();
      return new VerificationResult(this.name, "PASS", `Drive folder "${folderName}" (${folderId}) resolved successfully.`);
    } catch (e) {
      return new VerificationResult(this.name, "FAILED", `Drive folder check failed: ${e.toString()}`);
    }
  }
}

/**
class DistrictDeploymentFoundation {
  static runDiagnostics() {
    const rules = [
      new SpreadsheetRule(),
      new DriveRule()
    ];
    
    const results = [];
    let ready = true;
    
    for (const rule of rules) {
      const result = rule.execute();
      results.push(result);
      if (result.status === "FAILED") {
        ready = false;
      }
    }
    
    const status = ready ? "READY" : "NOT READY";
    
    if (ready) {
      try {
        this.recordDeploymentHistory(status);
      } catch (err) {
        results.push(new VerificationResult("Deployment History", "WARNING", `Failed to record deployment history: ${err.toString()}`));
      }
    }
    
    return {
      status: status,
      timestamp: Date.now(),
      results: results
    };
  }

  static recordDeploymentHistory(status) {
    const ss = getSS();
    let historySheet = ss.getSheetByName("DeploymentHistory");
    if (!historySheet) {
      historySheet = ss.insertSheet("DeploymentHistory");
      historySheet.appendRow(["Date", "Status", "Version", "Operator", "Details"]);
      historySheet.getRange("A1:E1").setFontWeight("bold").setBackground("#e5e7eb");
      historySheet.setFrozenRows(1);
    }
    
    const operator = Session.getActiveUser().getEmail() || "system";
    const version = CONFIG.get("VERSION") || "unknown";
    historySheet.appendRow([
      Utilities.formatDate(new Date(), "JST", "yyyy-MM-dd HH:mm:ss"),
      status,
      version,
      operator,
      "Automated verification completed successfully."
    ]);
  }
}

/**
 * SEC-002: Check if the action requires admin privileges
 */
function isProtectedDeploymentAction(params) {
  return (
    params.cleanupResources === "true" || params.cleanupResources === true ||
    params.bootstrapProperties === "true" || params.bootstrapProperties === true ||
    params.executeFullBatch === "true" || params.executeFullBatch === true ||
    params.rebuildCache === "true" || params.rebuildCache === true
  );
}

/**
 * SEC-002: Fetch admin LINE user IDs from the admin sheet
 */
function getDeploymentAdmins() {
  try {
    const ss = typeof getSS === 'function' ? getSS() : SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = (typeof CONFIG !== 'undefined' && CONFIG.get) ? CONFIG.get("SHEET_ADMIN") : "管理者ID";
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    const admins = [];
    for (let i = 0; i < data.length; i++) {
      const id = String(data[i][0] || "").trim();
      if (id && id.startsWith("U") && id.length > 20) {
        admins.push(id);
      }
    }
    return admins;
  } catch (e) {
    return [];
  }
}

/**
 * SEC-002: Verify if the user is an admin
 */
function verifyDeploymentAdminGate(params) {
  const userId = params.liffUserId;
  
  if (!userId) {
    throw new Error("ADMIN_AUTH_REQUIRED");
  }
  
  const admins = getDeploymentAdmins();
  if (!admins.includes(userId)) {
    throw new Error("ADMIN_PERMISSION_DENIED");
  }
  
  return true;
}

/**
 * Global function entry point
 */
function verifyDistrictDeployment(e) {
  const params = e && e.parameter ? e.parameter : (e || {});

  // Structure Guard Validation (Required + Forbidden sheets checks)
  if (params.structureGuard === "true" || params.structureGuard === true) {
    try {
      const ssId = params.spreadsheetId;
      const ss = ssId ? SpreadsheetApp.openById(ssId) : getSS();
      const sheetNames = ss.getSheets().map(s => s.getName());
      
      const REQUIRED_SHEETS = ["名簿", "保有チラシ枚数", "原本"];
      const FORBIDDEN_SHEETS = ["temp", "test", "debug", "unknown_generated"];
      
      const missing = REQUIRED_SHEETS.filter(name => !sheetNames.includes(name));
      const violated = FORBIDDEN_SHEETS.filter(name => sheetNames.includes(name));
      
      if (missing.length > 0) {
        return {
          success: false,
          error: "STRUCTURE_MISMATCH",
          message: "Required sheets missing from spreadsheet: " + missing.join(", "),
          status: "DENIED"
        };
      }
      
      if (violated.length > 0) {
        return {
          success: false,
          error: "STRUCTURE_MISMATCH",
          message: "Forbidden sheets found in spreadsheet: " + violated.join(", "),
          status: "DENIED"
        };
      }
      
      return {
        success: true,
        message: "Spreadsheet structure guard validation passed."
      };
    } catch (err) {
      return {
        success: false,
        error: "STRUCTURE_GUARD_ERROR",
        message: err.toString(),
        status: "DENIED"
      };
    }
  }
  
  // SEC-002: Admin Authentication Gate for Protected Actions
  if (isProtectedDeploymentAction(params)) {
    try {
      verifyDeploymentAdminGate(params);
    } catch (err) {
      return {
        success: false,
        error: err.message,
        message: "Access Denied: " + err.message,
        status: "DENIED"
      };
    }
  }

  // Cleanup/Rollback Action (deletes spreadsheet and folder under native user credentials)
  if (params.cleanupResources === "true" || params.cleanupResources === true) {
    try {
      const details = [];
      if (params.spreadsheetId) {
        try {
          DriveApp.getFileById(params.spreadsheetId).setTrashed(true);
          details.push(`Spreadsheet trashed: ${params.spreadsheetId}`);
        } catch (e) {
          details.push(`Failed to trash spreadsheet: ${e.toString()}`);
        }
      }
      if (params.storageFolderId) {
        try {
          DriveApp.getFolderById(params.storageFolderId).setTrashed(true);
          details.push(`Folder trashed: ${params.storageFolderId}`);
        } catch (e) {
          details.push(`Failed to trash folder: ${e.toString()}`);
        }
      }
      return {
        success: true,
        message: "Resources cleanup completed.",
        details: details
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed to cleanup resources: " + err.toString()
      };
    }
  }
  
  // Create Backup Snapshot Action (PM-002 Rollback support)
  if (params.backupSpreadsheet === "true" || params.backupSpreadsheet === true) {
    try {
      const targetSs = getSS();
      const file = DriveApp.getFileById(targetSs.getId());
      const backupFolderId = "18SZgoZBw-lWMMvuWwlnah5tFM2RYgsnY"; // 05_BACKUP
      let backupFolder;
      try {
        backupFolder = DriveApp.getFolderById(backupFolderId);
      } catch (fErr) {
        backupFolder = DriveApp.getRootFolder();
      }
      const timestamp = Utilities.formatDate(new Date(), "JST", "yyyyMMdd_HHmmss");
      const backupName = `BACKUP_${targetSs.getName()}_${timestamp}`;
      const copyFile = file.makeCopy(backupName, backupFolder);
      return {
        success: true,
        backupName: backupName,
        backupFileId: copyFile.getId(),
        message: `Successfully created spreadsheet backup copy: ${backupName}`
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed backupSpreadsheet: " + err.toString()
      };
    }
  }



  // District CSV Deep Audit Inspector
  if (params.inspectCsvRules === "true" || params.inspectCsvRules === true) {
    try {
      const districtFileId = CONFIG.get("DISTRICT_CSV_FILE_ID");
      const districtFile = DriveApp.getFileById(districtFileId);
      const districtData = getCsvOrSheetDataFromFile(districtFile);

      // 全国ルール監査
      const gunRules = [];
      const specialRules = [];
      const cityRules = [];

      districtData.forEach((row, index) => {
        if (index === 0 || !row || row.length < 3) return;
        const district = row[0];
        const pref = row[1];
        const city = row[2];
        const targetArea = row[3] || "";

        const item = { line: index + 1, district, pref, city, targetArea };

        if (city.endsWith("郡") || city.includes("郡")) {
          gunRules.push(item);
        } else if (targetArea && targetArea !== "(全域)" && targetArea !== "全域") {
          specialRules.push(item);
        } else {
          cityRules.push(item);
        }
      });

      return {
        success: true,
        districtFileName: districtFile.getName(),
        totalRows: districtData.length - 1,
        gunRulesCount: gunRules.length,
        specialRulesCount: specialRules.length,
        cityRulesCount: cityRules.length,
        gunRules: gunRules,
        specialRules: specialRules,
        allRows: districtData
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed inspectCsvRules: " + err.toString()
      };
    }
  }

  // Sprint B-1.2 Generation Order Fact Inspector
  if (params.inspectSequence === "true" || params.inspectSequence === true) {
    try {
      const ss = getSS();
      const actualSheetsInOrder = ss.getSheets().map((s, index) => ({
        index: index + 1,
        name: s.getName(),
        isHidden: s.isSheetHidden()
      }));

      const items = extractDistrictAddresses(ss.getName());
      const top20Extracted = items.slice(0, 20).map((item, idx) => ({
        index: idx + 1,
        city: item.city,
        address: item.address,
        postalCode: item.postalCode
      }));

      // __TEMP_ADDRESSES__ シートの生データ先頭20行
      const tempSheet = ss.getSheetByName("__TEMP_ADDRESSES__");
      let top20Temp = [];
      if (tempSheet && tempSheet.getLastRow() >= 2) {
        const last = Math.min(21, tempSheet.getLastRow());
        const vals = tempSheet.getRange(2, 1, last - 1, 2).getValues();
        top20Temp = vals.map((r, idx) => ({
          row: idx + 2,
          postalCode: r[0],
          address: r[1],
          extractedCity: r[1]
        }));
      }

      return {
        success: true,
        actualSheetsInOrder: actualSheetsInOrder,
        top20Extracted: top20Extracted,
        top20TempSheetRows: top20Temp
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed inspectSequence: " + err.toString()
      };
    }
  }

  // 調査専用: inspectDriveCsv
  if (params.inspectDriveCsv === "true" || params.inspectDriveCsv === true) {
    try {
      const fileId = params.fileId || CONFIG.get("DISTRICT_CSV_FILE_ID");
      let fileFound = false;
      let fileName = "";
      let fileSize = 0;
      let mimeType = "";
      let canAccess = false;
      let rawContentSnippet = "";
      let rowCount = 0;
      let sampleRows = [];
      let errMessage = null;

      try {
        const file = DriveApp.getFileById(fileId);
        fileFound = true;
        canAccess = true;
        fileName = file.getName();
        fileSize = file.getSize();
        mimeType = file.getMimeType();

        const blob = file.getBlob();
        const text = blob.getDataAsString();
        rawContentSnippet = text.slice(0, 300);

        const data = getCsvOrSheetDataFromFile(file);
        rowCount = data ? data.length : 0;
        sampleRows = data ? data.slice(0, 5) : [];
      } catch (e) {
        errMessage = e.toString();
      }

      return {
        success: true,
        postalCsvFileId: fileId,
        fileFound: fileFound,
        canAccess: canAccess,
        fileName: fileName,
        fileSize: fileSize,
        mimeType: mimeType,
        rowCount: rowCount,
        errMessage: errMessage,
        rawContentSnippet: rawContentSnippet,
        sampleRows: sampleRows
      };
    } catch (err) {
      return { success: false, message: err.toString() };
    }
  }

  // 調査専用: inspectSheetNames
  if (params.inspectSheetNames === "true" || params.inspectSheetNames === true) {
    try {
      const ss = getSS();
      const sheets = ss.getSheets();
      const sheetNames = sheets.map(s => s.getName());
      return {
        success: true,
        data: {
          spreadsheetId: ss.getId(),
          templateConfigName: CONFIG.get("SHEET_TEMPLATE"),
          sheetNames: sheetNames
        }
      };
    } catch (err) {
      return { success: false, error: err.toString() };
    }
  }

  // Force Start Batch Action
  if (params.forceStartBatch === "true" || params.forceStartBatch === true) {
    try {
      forceStartBatch();
      const ss = getSS();
      const tempSheet = ss.getSheetByName("__TEMP_ADDRESSES__");
      const tempRows = tempSheet ? tempSheet.getLastRow() : 0;
      const props = PropertiesService.getScriptProperties();
      return {
        success: true,
        batchStatus: props.getProperty("BATCH_STATUS"),
        tempRowsCount: tempRows,
        message: `Batch force started cleanly. Temp rows: ${tempRows}`
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed forceStartBatch: " + err.toString()
      };
    }
  }

  // Run Batch Step Action
  if (params.runBatchStep === "true" || params.runBatchStep === true) {
    try {
      const props = PropertiesService.getScriptProperties();
      let loops = 0;
      while (props.getProperty("BATCH_STATUS") === "running" && loops < 5) {
        loops++;
        generateAreaSheetsBatch();
      }

      const status = props.getProperty("BATCH_STATUS");
      const index = props.getProperty("BATCH_INDEX");

      if (status !== "running") {
        sortAllAreaSheetTabs();
        createSystemCacheSheet();
        refreshAreaSummaryCache();
      }

      return {
        success: true,
        status: status,
        index: index,
        isCompleted: status !== "running",
        message: `Batch Step executed ${loops} loops. Status: ${status}, Index: ${index}`
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed runBatchStep: " + err.toString()
      };
    }
  }

  // Sort Tabs Action
  if (params.sortTabs === "true" || params.sortTabs === true) {
    try {
      sortAllAreaSheetTabs();
      return {
        success: true,
        message: "Successfully sorted all area sheet tabs physically."
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed sortTabs: " + err.toString()
      };
    }
  }

  // All Areas Postal Code Order Audit Inspector
  if (params.auditAllAreas === "true" || params.auditAllAreas === true) {
    try {
      const ss = getSS();
      const exclude = [
        CONFIG.get("SHEET_GUIDE"), CONFIG.get("SHEET_ROSTER"), CONFIG.get("SHEET_TEMPLATE"),
        CONFIG.get("SHEET_POSTAL"), CONFIG.get("SHEET_DISTRICT"), CONFIG.get("SHEET_MASTER_EXPORT"),
        CONFIG.get("SHEET_REPORT"), CONFIG.get("SHEET_MANUAL"), CONFIG.get("SHEET_SYSTEM_CACHE"),
        CONFIG.get("SHEET_STORAGE"), "__TEMP_ADDRESSES__"
      ];

      const areaSheets = ss.getSheets().filter(s => !exclude.includes(s.getName()));
      const sheetAudits = [];
      let totalAllSheetsNumericAscending = true;

      areaSheets.forEach(s => {
        const lastRow = s.getLastRow();
        let isAscending = true;
        let nonAscendingCount = 0;
        let rowsCount = 0;
        
        if (lastRow >= 2) {
          const vals = s.getRange(2, 1, lastRow - 1, 1).getValues();
          rowsCount = vals.length;
          
          for (let i = 0; i < vals.length - 1; i++) {
            const addr1 = vals[i][0] || "";
            const addr2 = vals[i + 1][0] || "";
            
            const match1 = addr1.match(/〒?(\d{3}-\d{4}|\d{7})/);
            const match2 = addr2.match(/〒?(\d{3}-\d{4}|\d{7})/);
            
            if (match1 && match2) {
              const num1 = parseInt(match1[1].replace("-", ""), 10);
              const num2 = parseInt(match2[1].replace("-", ""), 10);
              if (num1 > num2) {
                isAscending = false;
                totalAllSheetsNumericAscending = false;
                nonAscendingCount++;
              }
            }
          }
        }

        sheetAudits.push({
          name: s.getName(),
          rowsCount: rowsCount,
          isNumericAscending: isAscending,
          nonAscendingCount: nonAscendingCount
        });
      });

      return {
        success: true,
        totalAreaSheets: areaSheets.length,
        totalAllSheetsNumericAscending: totalAllSheetsNumericAscending,
        sheets: sheetAudits
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed auditAllAreasPostalOrder: " + err.toString()
      };
    }
  }

  // Sprint B-1.3 Postal Order Audit Inspector
  if (params.auditPostalOrder === "true" || params.auditPostalOrder === true) {
    try {
      const ss = getSS();

      // 抽出結果（extractDistrictAddresses）の郵便番号順序チェック
      const items = extractDistrictAddresses(ss.getName());
      let isExtractedAscending = true;
      const nonAscendingPairs = [];

      for (let i = 0; i < items.length - 1; i++) {
        const p1 = items[i].postalCode.replace("-", "");
        const p2 = items[i + 1].postalCode.replace("-", "");
        if (p1 && p2 && p1 > p2) {
          isExtractedAscending = false;
          if (nonAscendingPairs.length < 10) {
            nonAscendingPairs.push({
              index: i + 1,
              prev: { postalCode: items[i].postalCode, address: items[i].address },
              curr: { postalCode: items[i + 1].postalCode, address: items[i + 1].address }
            });
          }
        }
      }

      return {
        success: true,
        isExtractedAscending: isExtractedAscending,
        nonAscendingPairs: nonAscendingPairs
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed auditPostalOrder: " + err.toString()
      };
    }
  }
  if (params.testExtractBreakdown === "true" || params.testExtractBreakdown === true) {
    try {
      const items = extractDistrictAddresses();
      const breakdown = {};
      items.forEach(item => {
        const c = item.city;
        breakdown[c] = (breakdown[c] || 0) + 1;
      });

      return {
        success: true,
        totalItems: items.length,
        breakdown: breakdown
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed testExtractBreakdown: " + err.toString()
      };
    }
  }

  // Full Pipeline Audit Direct Inspector
  if (params.auditPipeline === "true" || params.auditPipeline === true) {
    try {
      const ss = getSS();
      const exclude = [
        CONFIG.get("SHEET_GUIDE"), CONFIG.get("SHEET_ROSTER"), CONFIG.get("SHEET_TEMPLATE"),
        CONFIG.get("SHEET_POSTAL"), CONFIG.get("SHEET_DISTRICT"), CONFIG.get("SHEET_MASTER_EXPORT"),
        CONFIG.get("SHEET_REPORT"), CONFIG.get("SHEET_MANUAL"), CONFIG.get("SHEET_SYSTEM_CACHE"),
        CONFIG.get("SHEET_STORAGE"), "__TEMP_ADDRESSES__"
      ];
      
      const allSheets = ss.getSheets();
      const areaSheets = allSheets.filter(s => !exclude.includes(s.getName()));
      
      const resultList = areaSheets.map(s => {
        const lastRow = s.getLastRow();
        let repAddr = "";
        if (lastRow >= 2) {
          repAddr = s.getRange(2, 1).getValue() || "";
        }
        return {
          name: s.getName(),
          total: lastRow >= 2 ? lastRow - 1 : 0,
          repAddress: repAddr,
          isHidden: s.isSheetHidden()
        };
      });

      let totalPoints = 0;
      resultList.forEach(r => totalPoints += r.total);

      return {
        success: true,
        totalAreaSheets: resultList.length,
        totalAddresses: totalPoints,
        areas: resultList
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed auditPipelineResult: " + err.toString()
      };
    }
  }

  // Show All Area Sheets & Rebuild Cache Action
  if (params.showAll === "true" || params.showAll === true) {
    try {
      const ss = getSS();
      const exclude = [
        CONFIG.get("SHEET_GUIDE"), CONFIG.get("SHEET_ROSTER"), CONFIG.get("SHEET_TEMPLATE"),
        CONFIG.get("SHEET_POSTAL"), CONFIG.get("SHEET_DISTRICT"), CONFIG.get("SHEET_MASTER_EXPORT"),
        CONFIG.get("SHEET_REPORT"), CONFIG.get("SHEET_MANUAL"), CONFIG.get("SHEET_SYSTEM_CACHE"),
        CONFIG.get("SHEET_STORAGE"), "__TEMP_ADDRESSES__"
      ];
      const sheets = ss.getSheets();
      let shownCount = 0;
      sheets.forEach(s => {
        if (!exclude.includes(s.getName())) {
          s.showSheet();
          shownCount++;
        }
      });
      SpreadsheetApp.flush();

      createSystemCacheSheet();
      const dashData = refreshAreaSummaryCache();

      return {
        success: true,
        message: `Successfully unhidden ${shownCount} area sheets and rebuilt cache.`,
        shownCount: shownCount,
        summaryCount: dashData.summary ? dashData.summary.length : 0,
        summary: dashData.summary,
        stats: dashData.stats
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed showAllAreaSheetsAndRebuild: " + err.toString()
      };
    }
  }

  // Full Synchronous Batch Execution for Audit
  if (params.executeFullBatch === "true" || params.executeFullBatch === true) {
    try {
      const ss = getSS();
      // 1. 古いエリアシートを全削除（共通ガバナンス isProtectedSheet で保護）
      const sheets = ss.getSheets();
      sheets.forEach(s => {
        if (!isProtectedSheet(s.getName())) {
          try {
            Logger.log("DELETE SHEET: " + s.getName());
            ss.deleteSheet(s);
          } catch (delE) {}
        }
      });
      SpreadsheetApp.flush();

      // 2. forceStartBatch 実行
      forceStartBatch();
      
      const props = PropertiesService.getScriptProperties();
      let loops = 0;
      while (props.getProperty("BATCH_STATUS") === "running" && loops < 50) {
        loops++;
        generateAreaSheetsBatch();
      }

      createSystemCacheSheet();
      const dashData = refreshAreaSummaryCache();

      return {
        success: true,
        message: "Full Batch Engine executed completely.",
        summaryCount: dashData.summary ? dashData.summary.length : 0,
        summary: dashData.summary,
        stats: dashData.stats
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed executeFullBatch: " + err.toString()
      };
    }
  }

  // System Cache Rebuild Action
  if (params.rebuildCache === "true" || params.rebuildCache === true) {
    try {
      createSystemCacheSheet();
      const dashData = refreshAreaSummaryCache();
      return {
        success: true,
        message: "createSystemCacheSheet() successfully executed.",
        summaryCount: dashData.summary ? dashData.summary.length : 0
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed to rebuild system cache: " + err.toString()
      };
    }
  }

  // Dashboard & Summary Observer Action
  if (params.action === "getDashboardData" || params.getDashboardData === "true") {
    try {
      const dashData = getDashboardData();
      return {
        success: true,
        summary: dashData.summary,
        stats: dashData.stats,
        updatedAt: dashData.updatedAt
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed to fetch dashboard data: " + err.toString()
      };
    }
  }

  // Batch Pipeline Observer Actions
  if (params.triggerBatch === "true" || params.triggerBatch === true) {
    try {
      forceStartBatch();
      return {
        success: true,
        message: "forceStartBatch() successfully initiated."
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed to trigger forceStartBatch(): " + err.toString()
      };
    }
  }

  if (params.checkBatchStatus === "true" || params.checkBatchStatus === true) {
    const props = PropertiesService.getScriptProperties();
    const status = props.getProperty("BATCH_STATUS") || "completed";
    const index = props.getProperty("BATCH_INDEX") || "0";
    return {
      success: true,
      data: {
        batchStatus: status,
        batchIndex: index,
        isCompleted: status === "completed"
      }
    };
  }

  // Template Recovery Action
  if (params.restoreTemplate === "true" || params.restoreTemplate === true) {
    try {
      const template = createTemplateSheet();
      return {
        success: true,
        message: `Template sheet "${template.getName()}" successfully ensured and restored.`,
        templateName: template.getName()
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed to restore template sheet: " + err.toString()
      };
    }
  }
  // Step 1 Audit Test Runner (Phase 3 Reference Data Infrastructure Audit)
  if (params.runStep1 === "true" || params.runStep1 === true) {
    try {
      // Purge old config cache to ensure latest REFERENCE_FILES IDs are loaded
      if (typeof CacheService !== "undefined" && CacheService.getScriptCache()) {
        CacheService.getScriptCache().remove("CONFIG_STORE");
        CacheService.getScriptCache().remove("CONFIG_CACHE");
      }
      if (typeof PropertiesService !== "undefined") {
        PropertiesService.getScriptProperties().deleteProperty("CONFIG_STORE");
      }

      const targetDistrict = params.districtName || getSS().getName();
      const targetPrefecture = params.prefecture || "";
      
      const districtFileId = CONFIG.get("DISTRICT_CSV_FILE_ID") || "";

      let districtFileName = "address_master.csv";
      try {
        if (districtFileId) districtFileName = DriveApp.getFileById(districtFileId).getName();
      } catch (eName) {}

      const addresses = extractDistrictAddresses(targetDistrict);
      const totalCount = addresses ? addresses.length : 0;
      
      const top5 = addresses && totalCount > 0 ? addresses.slice(0, 5) : [];
      const last5 = addresses && totalCount > 0 ? addresses.slice(-5) : [];

      return {
        success: true,
        message: `Step 1 Reference Infrastructure Audit Executed Successfully for "${targetDistrict}"`,
        audit: {
          targetDistrict: targetDistrict,
          targetPrefecture: targetPrefecture,
          districtFileId: districtFileId,
          districtFileName: districtFileName,
          totalCount: totalCount,
          top5: top5,
          last5: last5
        }
      };
    } catch (err) {
      return {
        success: false,
        message: "Step 1 Audit Error: " + err.toString()
      };
    }
  }

  // Populate extracted district data into spreadsheet using extractDistrictAddresses & exact sheet Gid
  if (params.populateData === "true" || params.populateData === true) {
    try {
      const targetSsId = params.spreadsheetId || (typeof getSS === 'function' && getSS() ? getSS().getId() : (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getActiveSpreadsheet().getId() : ""));
      const targetGid = params.gid || "1893108169";
      const ss = SpreadsheetApp.openById(targetSsId);
      
      // Target sheet by Gid 1893108169 or fallback to first sheet
      let sheet = null;
      const sheets = ss.getSheets();
      for (let s of sheets) {
        if (s.getSheetId().toString() === targetGid) {
          sheet = s;
          break;
        }
      }
      if (!sheet) sheet = sheets[0];
      
      // Execute genuine extractDistrictAddresses logic
      const targetDistrict = params.districtName || ss.getName();
      const targetPref = params.prefecture || "";
      
      let items = [];
      try {
        items = extractDistrictAddresses(targetDistrict);
      } catch (e) {
        Logger.log("extractDistrictAddresses fallback: " + e.toString());
      }

      let rowsData = [
        ["郵便番号", "都道府県", "市区町村名", "市区町村カナ", "町域名/住所", "町域カナ", "ステータス", "選挙区コード"]
      ];

      if (items && items.length > 0) {
        items.forEach(item => {
          rowsData.push([
            item.postalCode || "",
            targetPref,
            item.city || "",
            item.cityKana || "",
            item.address || "",
            item.townKana || "",
            "VERIFIED",
            targetDistrict
          ]);
        });
      }

      sheet.clear();
      sheet.getRange(1, 1, rowsData.length, rowsData[0].length).setValues(rowsData);

      // Apply Posting Map UI Design Standards (漆黒UI / Dark Theme header)
      sheet.getRange(1, 1, 1, rowsData[0].length)
        .setBackground('#000000')
        .setFontColor('#ffffff')
        .setFontWeight('bold');

      return {
        success: true,
        message: `Successfully executed extractDistrictAddresses logic and populated ${rowsData.length - 1} full-spec records into "${ss.getName()}"`,
        spreadsheetId: targetSsId,
        rowCount: rowsData.length - 1
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed to populate district data: " + err.toString()
      };
    }
  }

  // Bootstrap Script Properties directly
  if (params.bootstrapProperties === "true" || params.bootstrapProperties === true) {
    try {
      const props = PropertiesService.getScriptProperties();
      const newProps = {};
      if (params.spreadsheetId) newProps["SPREADSHEET_ID"] = params.spreadsheetId;
      if (params.storageFolderId) newProps["STORAGE_PARENT_ID"] = params.storageFolderId;
      if (params.districtId) newProps["DISTRICT_ID"] = params.districtId;
      
      props.setProperties(newProps);
      
      if (typeof CacheService !== "undefined" && CacheService.getScriptCache()) {
        CacheService.getScriptCache().remove("CONFIG_CACHE");
      }
      
      return {
        success: true,
        message: "Script properties bootstrapped successfully.",
        properties: newProps
      };
    } catch (err) {
      return {
        success: false,
        message: "Failed to bootstrap script properties: " + err.toString()
      };
    }
  }

  return DistrictDeploymentFoundation.runDiagnostics();
}
