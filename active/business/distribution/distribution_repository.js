/**
 * Business Layer - Distribution Repository
 * 
 * Target Domain: Distribution Management
 * Owner Layer: Business Layer
 * Responsibility: 配布実績のシャドー書き込みおよび統計・ランキングデータアクセス
 */

if (typeof DistributionRepository === 'undefined') {
  DistributionRepository = class DistributionRepository {
    constructor() {
      // Data source access via Infrastructure Adapter
    }

    static getInstance() {
      if (!DistributionRepository.instance) {
        DistributionRepository.instance = new DistributionRepository();
      }
      return DistributionRepository.instance;
    }

    getSS() {
      if (typeof SpreadsheetAdapter !== 'undefined' && typeof SpreadsheetAdapter.getSS === 'function') {
        return SpreadsheetAdapter.getSS();
      } else if (typeof getSS === 'function') {
        return getSS();
      }
      return null;
    }

    fetchDeliveryStats() {
      const sheet = this.getDistributionSheet();
      if (!sheet) return { totalDistributed: 0, areasCount: 0 };

      let totalDistributed = 0;
      let areasCount = 0;
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const values = sheet.getRange(2, 4, lastRow - 1, 2).getValues();
        for (let j = 0; j < values.length; j++) {
          const completedAt = values[j][0];
          const count = parseFloat(values[j][1]) || 0;
          if (completedAt && count > 0) {
            totalDistributed += count;
            areasCount++;
          }
        }
      }

      return {
        totalDistributed: totalDistributed,
        areasCount: areasCount
      };
    }

    getDistributionSheet() {
      if (typeof MonthlySheetResolver !== 'undefined' && MonthlySheetResolver.getInstance) {
        return MonthlySheetResolver.getInstance().getCurrentSheet("distribution");
      }
      return null;
    }

    fetchRankingData() {
      const sheet = this.getDistributionSheet();
      if (!sheet) return [];

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];

      // A: rowId, B: cityName, C: townName, D: completedAt, E: count, F: staffId, G: staffName
      const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      const staffMap = {};

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const rawCompletedAt = row[3];
        const count = parseFloat(row[4]) || 0;
        const staffId = row[5] ? String(row[5]).trim() : "";
        const staffName = row[6] ? String(row[6]).trim() : "";

        // 必須条件: completedAt が存在、staffId が存在、count > 0
        if (!rawCompletedAt || !staffId || count <= 0) continue;

        // 日時正規化処理（Date型または文字列からミリ秒タイムスタンプへ安全にパース）
        let timeVal = 0;
        if (rawCompletedAt instanceof Date && !isNaN(rawCompletedAt.getTime())) {
          timeVal = rawCompletedAt.getTime();
        } else if (typeof rawCompletedAt === 'string') {
          const trimmedDate = rawCompletedAt.trim();
          if (trimmedDate !== "") {
            const parsed = Date.parse(trimmedDate.replace(/-/g, '/'));
            if (!isNaN(parsed)) {
              timeVal = parsed;
            }
          }
        } else if (typeof rawCompletedAt === 'number' && rawCompletedAt > 0) {
          timeVal = rawCompletedAt;
        }

        if (!staffMap[staffId]) {
          staffMap[staffId] = {
            staffId: staffId,
            name: staffName || staffId,
            count: 0,
            latestTimestamp: timeVal
          };
        }

        staffMap[staffId].count += count;

        // staffName は completedAt が最新のレコードを採用
        if (timeVal > staffMap[staffId].latestTimestamp) {
          staffMap[staffId].latestTimestamp = timeVal;
          if (staffName) {
            staffMap[staffId].name = staffName;
          }
        }
      }

      const list = Object.values(staffMap);

      // ソート: ① count 降順, ② 同数時は staffId 昇順
      list.sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.staffId.localeCompare(b.staffId);
      });

      let currentRank = 0;
      let previousCount = null;

      return list.map((item, index) => {
        if (previousCount === null || item.count !== previousCount) {
          currentRank = index + 1;
        }
        previousCount = item.count;

        return {
          rank: currentRank,
          staffId: item.staffId,
          name: item.name,
          count: item.count
        };
      });
    }

    /**
     * 最新の配布実績レコードを取得（SSOT配布実績固定マスターシートの全行から、D列タイムスタンプ降順で最大 limit 件）
     */
    fetchLatestRecords(limit = 20) {
      const sheet = this.getDistributionSheet();
      if (!sheet) return [];

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];

      // 固定マスター型シートの全エリア行（単一Range Readで一括取得: A〜I列）
      const values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      const records = [];

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const rowId = row[0];
        const cityName = row[1] ? String(row[1]).trim() : "";
        const townName = row[2] ? String(row[2]).trim() : "";
        const rawCompletedAt = row[3];
        const count = parseFloat(row[4]) || 0;
        const staffId = row[5] ? String(row[5]).trim() : "";
        const staffName = row[6] ? String(row[6]).trim() : "";
        const gpsStatus = row[7] === "OK" ? "OK" : "NO";
        const photoStatus = row[8] === "OK" ? "OK" : "NO";

        // D列（配布日時）が存在する完了レコードのみを対象
        if (!rawCompletedAt) continue;

        let timeStr = "";
        let timeVal = 0;

        if (rawCompletedAt instanceof Date && !isNaN(rawCompletedAt.getTime())) {
          timeVal = rawCompletedAt.getTime();
          const month = String(rawCompletedAt.getMonth() + 1).padStart(2, '0');
          const day = String(rawCompletedAt.getDate()).padStart(2, '0');
          const hours = String(rawCompletedAt.getHours()).padStart(2, '0');
          const minutes = String(rawCompletedAt.getMinutes()).padStart(2, '0');
          timeStr = `${month}/${day} ${hours}:${minutes}`;
        } else if (typeof rawCompletedAt === 'string') {
          const trimmed = rawCompletedAt.trim();
          const parsed = Date.parse(trimmed.replace(/-/g, '/'));
          if (!isNaN(parsed)) {
            timeVal = parsed;
            const d = new Date(parsed);
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            timeStr = `${month}/${day} ${hours}:${minutes}`;
          } else {
            timeVal = i + 2;
            timeStr = trimmed;
          }
        } else {
          timeVal = i + 2;
          timeStr = "--:--";
        }

        records.push({
          recordId: `REC_${timeVal}_${staffId || 'STAFF'}_${rowId}`,
          rowId: rowId,
          cityName: cityName,
          townName: townName,
          time: timeStr,
          timestamp: timeVal,
          count: count,
          staffId: staffId || 'S001',
          staffName: staffName || staffId || 'S001',
          gpsStatus: gpsStatus,
          photoStatus: photoStatus
        });
      }

      // D列の実際の配布日時（timestamp）の降順、同一timestampの場合は rowId 降順（第2キー）で決定論的ソート
      records.sort((a, b) => {
        if (b.timestamp !== a.timestamp) {
          return b.timestamp - a.timestamp;
        }
        return (parseInt(b.rowId, 10) || 0) - (parseInt(a.rowId, 10) || 0);
      });

      return records.slice(0, limit);
    }
  };
  DistributionRepository.instance = null;
}
