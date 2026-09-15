(function(global) {
  class TransferService {
    constructor() {}

    static getInstance() {
      if (!TransferService.instance) {
        TransferService.instance = new TransferService();
      }
      return TransferService.instance;
    }

    getSS() {
      if (typeof getSS === 'function') {
        return getSS();
      }
      if (typeof SpreadsheetAdapter !== 'undefined') {
        return SpreadsheetAdapter.getInstance().getActiveSpreadsheet();
      }
      throw new Error("Active spreadsheet unavailable");
    }

    getMonthlySheet(type) {
      if (typeof MonthlySheetResolver !== 'undefined' && MonthlySheetResolver.getInstance) {
        return MonthlySheetResolver.getInstance().getCurrentSheet(type);
      }
      return null;
    }

    requestFlyerTransfer(data) {
      const requestUserId = data && data.requestUserId ? String(data.requestUserId).trim() : '';
      const holderUserId = data && data.holderUserId ? String(data.holderUserId).trim() : '';
      const contactMethod = data && data.contactMethod ? String(data.contactMethod).trim() : 'LINE';
      const contactValue = data && data.contactValue ? String(data.contactValue).trim() : '';

      if (!requestUserId || !holderUserId || !contactValue) {
        return { success: false, message: "必須パラメータが不足しています。" };
      }

      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
      } catch (e) {
        return { success: false, message: "システムが混雑しています。時間をおいて再度お試しください。" };
      }

      try {
        const ss = this.getSS();

        const rosterSheet = this.getMonthlySheet('staff');

        let requestUserName = requestUserId;
        let holderName = holderUserId;
        let holderLineUserId = "";

        if (rosterSheet) {
          const lastRosterRow = rosterSheet.getLastRow();
          if (lastRosterRow >= 2) {
            const rosterValues = rosterSheet.getRange(2, 1, lastRosterRow - 1, 4).getValues();
            for (let i = 0; i < rosterValues.length; i++) {
              const rowId = String(rosterValues[i][0] || '').trim();
              const rowName = String(rosterValues[i][1] || '').trim();
              const rowLineId = String(rosterValues[i][2] || '').trim();

              if (rowId === requestUserId) {
                requestUserName = rowName || requestUserId;
              }
              if (rowId === holderUserId) {
                holderName = rowName || holderUserId;
                holderLineUserId = rowLineId;
              }
            }
          }
        }

        let s = this.getMonthlySheet('transfer');
        if (!s) {
          return {
            success: false,
            code: "SHEET_NOT_READY",
            message: "「受渡要請履歴」シートが準備されていません。"
          };
        }
        const expectedHeaders = [["日時", "要請者", "要請者ID", "保管者", "保管者ID", "連絡方法", "連絡先"]];
        s.getRange(1, 1, 1, 7).setValues(expectedHeaders);
        if (s.getLastColumn() >= 8) {
          s.getRange(1, 8, s.getLastRow(), s.getLastColumn() - 7).clearContent();
        }

        const now = new Date();
        const requestTime = Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm:ss");

        s.appendRow([
          requestTime,
          requestUserName,
          requestUserId,
          holderName,
          holderUserId,
          contactMethod,
          contactValue
        ]);

        if (holderLineUserId) {
          const postingMapUrl = typeof getProductionLiffUrl === 'function' ? getProductionLiffUrl() : '';

          const messageText =
            "📦 チラシの受渡要請が届きました\n\n\n" +
            requestUserName + "（" + requestUserId + "）さんがあなたの保有している\n" +
            "チラシを希望しています。\n\n\n" +
            "【連絡先】\n" +
            contactMethod + "：" + contactValue + "\n\n\n" +
            "この連絡先へ直接ご連絡ください。\n\n\n" +
            "↓\n" +
            "POSTING MAPを開く\n" +
            postingMapUrl;

          this.sendLinePushMessage(holderLineUserId, messageText);
        }

        return { success: true };
      } catch(e) {
        return { success: false, message: e.toString() };
      } finally {
        lock.releaseLock();
      }
    }

    sendLinePushMessage(toUserId, messageText) {
      const props = PropertiesService.getScriptProperties();
      const token = props.getProperty("LINE_CHANNEL_ACCESS_TOKEN_ADMIN") || props.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
      if (!token) return;

      const url = "https://api.line.me/v2/bot/message/push";
      const payload = {
        to: toUserId,
        messages: [{
          type: "text",
          text: messageText
        }]
      };

      const options = {
        method: "post",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      Logger.log('LINE Push → status:' + response.getResponseCode() + ' body:' + response.getContentText());
    }

    getTransferRequests() {
      const s = this.getMonthlySheet('transfer');
      if (!s) return [];
      const lastRow = s.getLastRow();
      if (lastRow < 2) return [];
      const values = s.getRange(2, 1, lastRow - 1, 7).getValues();
      return values.map((r, i) => ({
        rowNumber: i + 2,
        requestTime: (r[0] && typeof r[0].getMonth === 'function') ? Utilities.formatDate(r[0], "JST", "yyyy/MM/dd HH:mm:ss") : String(r[0] || ''),
        requesterName: r[1],
        requesterId: r[2],
        holderName: r[3],
        holderId: r[4],
        contactMethod: r[5],
        contactValue: r[6]
      }));
    }

    resolveTransferRequest(data) {
      const rowNumber = parseInt(data.rowNumber);
      const status = data.status || "完了";
      if (!rowNumber || rowNumber < 2) return { success: false, message: "Invalid row number" };

      const lock = LockService.getScriptLock();
      try { lock.waitLock(10000); } catch(e) { return { success: false, message: "Lock timeout" }; }

      try {
        const s = this.getMonthlySheet('transfer');
        if (!s) return { success: false, message: "Sheet not found" };

        const lastRow = s.getLastRow();
        if (rowNumber > lastRow) {
          return { success: false, message: "Invalid row number" };
        }

        const operatorId = data.liffUserId;
        if (!operatorId) {
          return { success: false, message: "Permission denied" };
        }

        const requesterId = String(s.getRange(rowNumber, 3).getValue()).trim();
        const holderId = String(s.getRange(rowNumber, 5).getValue()).trim();

        const admins = typeof getDeploymentAdmins === 'function' ? getDeploymentAdmins() : [];
        const isAdmin = admins.includes(operatorId);

        if (operatorId !== requesterId && operatorId !== holderId && !isAdmin) {
          return { success: false, message: "Permission denied" };
        }

        s.getRange(rowNumber, 8).setValue(status);
        return { success: true };
      } catch(e) {
        return { success: false, message: e.toString() };
      } finally {
        lock.releaseLock();
      }
    }
  }

  TransferService.instance = null;
  global.TransferService = TransferService;
})(this);
