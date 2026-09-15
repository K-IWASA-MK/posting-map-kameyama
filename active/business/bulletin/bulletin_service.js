(function(global) {
  class BulletinService {
    constructor() {}

    static getInstance() {
      if (!BulletinService.instance) {
        BulletinService.instance = new BulletinService();
      }
      return BulletinService.instance;
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

    getBulletinSheet() {
      const ss = this.getSS();
      let sheet = ss.getSheetByName("掲示板");
      if (!sheet) {
        sheet = ss.insertSheet("掲示板");
        sheet.getRange(1, 1, 1, 4).setValues([["日時", "投稿者ID", "投稿者名", "メッセージ"]]);
      }
      return sheet;
    }

    getContactSheet() {
      const ss = this.getSS();
      let sheet = ss.getSheetByName("掲示板連絡履歴");
      if (!sheet) {
        sheet = ss.insertSheet("掲示板連絡履歴");
        sheet.getRange(1, 1, 1, 6).setValues([["日時", "送信者ID", "送信者名", "相手ID", "連絡方法", "連絡先"]]);
      }
      return sheet;
    }

    getPosts() {
      try {
        const sheet = this.getBulletinSheet();
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return { success: true, posts: [] };

        const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
        const posts = values.map(r => ({
          updatedAt: (r[0] && typeof r[0].getMonth === 'function')
            ? Utilities.formatDate(r[0], "JST", "yyyy/MM/dd HH:mm")
            : (r[0] ? String(r[0]).trim() : ""),
          staffId: String(r[1] || '').trim(),
          staffName: String(r[2] || '').trim(),
          message: String(r[3] || '').trim()
        })).filter(p => p.message !== "");

        posts.reverse();
        return { success: true, posts: posts };
      } catch (err) {
        return { success: false, message: err.toString(), posts: [] };
      }
    }

    createPost(data) {
      const staffId = data && data.staffId ? String(data.staffId).trim() : '';
      const staffName = data && data.staffName ? String(data.staffName).trim() : '';
      const message = data && data.message ? String(data.message).trim() : '';

      if (!staffId || !message) {
        return { success: false, message: "IDまたはメッセージが不足しています。" };
      }
      if (message.length > 150) {
        return { success: false, message: "メッセージは150文字以内で入力してください。" };
      }

      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
      } catch (e) {
        return { success: false, message: "システムが混雑しています。時間をおいて再度お試しください。" };
      }

      try {
        const sheet = this.getBulletinSheet();
        const now = new Date();
        const formattedDate = Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm:ss");

        sheet.appendRow([formattedDate, staffId, staffName, message]);

        return {
          success: true,
          post: {
            updatedAt: Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm"),
            staffId: staffId,
            staffName: staffName,
            message: message
          }
        };
      } catch (err) {
        return { success: false, message: err.toString() };
      } finally {
        lock.releaseLock();
      }
    }

    sendContact(data) {
      const requestUserId = data && data.requestUserId ? String(data.requestUserId).trim() : '';
      const targetStaffId = data && data.targetStaffId ? String(data.targetStaffId).trim() : '';
      const contactMethod = data && data.contactMethod ? String(data.contactMethod).trim() : 'LINE';
      const contactValue = data && data.contactValue ? String(data.contactValue).trim() : '';

      if (!requestUserId || !targetStaffId || !contactValue) {
        return { success: false, message: "必須パラメータが不足しています。" };
      }

      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
      } catch (e) {
        return { success: false, message: "システムが混雑しています。時間をおいて再度お試しください。" };
      }

      try {
        const rosterSheet = this.getMonthlySheet('staff');
        let requestUserName = requestUserId;
        let targetName = targetStaffId;
        let targetLineUserId = "";

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
              if (rowId === targetStaffId) {
                targetName = rowName || targetStaffId;
                targetLineUserId = rowLineId;
              }
            }
          }
        }

        const contactSheet = this.getContactSheet();
        const now = new Date();
        const requestTime = Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm:ss");

        contactSheet.appendRow([
          requestTime,
          requestUserId,
          requestUserName,
          targetStaffId,
          contactMethod,
          contactValue
        ]);

        if (targetLineUserId) {
          const postingMapUrl = typeof getProductionLiffUrl === 'function' ? getProductionLiffUrl() : '';
          const messageText =
            "💬 掲示板の投稿への連絡が届きました\n\n\n" +
            requestUserName + "（" + requestUserId + "）さんから、あなたの掲示板投稿に関して連絡が届いています。\n\n\n" +
            "【連絡先】\n" +
            contactMethod + "：" + contactValue + "\n\n\n" +
            "この連絡先へ直接ご連絡ください。\n\n\n" +
            "↓\n" +
            "POSTING MAPを開く\n" +
            postingMapUrl;

          this.sendLinePushMessage(targetLineUserId, messageText);
        }

        return { success: true };
      } catch (err) {
        return { success: false, message: err.toString() };
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

      try {
        UrlFetchApp.fetch(url, options);
      } catch (e) {}
    }
  }

  global.BulletinService = BulletinService;
})(this);
