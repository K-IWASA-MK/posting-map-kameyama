/**
 * Business Layer - GPS Service Module
 *
 * Domain: GPS / Photo Domain
 * Layer: Business Layer
 * Responsibility: GPS・写真保存に関する業務フロー統括、排他制御、およびシステムログ管理
 */

if (typeof GPSService === 'undefined') {
  GPSService = class GPSService {
    constructor() {
      this.repository = GPSRepository.getInstance();
    }

    static getInstance() {
      if (!GPSService.instance) {
        GPSService.instance = new GPSService();
      }
      return GPSService.instance;
    }

    updateRecordWithGPSPhoto(data) {
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(15000);
      } catch (e) {
        console.error("[GPSService] Lock timeout error:", e);
        return { success: false, message: "サーバーが混雑しています。時間をおいて再度お試しください。" };
      }

      try {
        console.log("[GPSService] Start processing GPS/Photo record update for staff:", data ? data.staffName : "Unknown");

        // rowId strict validation (integer >= 1)
        const rowIdNum = Number(data.rowId);
        if (!Number.isInteger(rowIdNum) || rowIdNum < 1 || String(data.rowId).trim() === "") {
           return { success: false, message: "Invalid rowId" };
        }

        // Idempotency Check
        const existing = this.repository.checkExistingStatus(rowIdNum);
        let photoStatus = existing ? existing.photoStatus : "NO";
        let gpsStatus = existing ? existing.gpsStatus : "NO";

        const isComplete = data.isDone === 'true' || data.isDone === true;

        if (isComplete && existing && existing.gpsStatus === "OK" && existing.photoStatus === "OK") {
           console.log(`[GPSService] RowId ${rowIdNum} already completed with OK/OK. Returning existing.`);
           return {
             success: true,
             rowId: rowIdNum,
             count: parseFloat(data.count) || 0,
             gpsStatus: "OK",
             photoStatus: "OK",
             timestamp: Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss")
           };
        }

        let photoFileId = "";

        // photoData check
        if (isComplete && data.photoData && photoStatus !== "OK") {
          console.log("[GPSService] Uploading photo to Google Drive...");
          try {
            const photoRes = this.repository.savePhotoToDrive(data, rowIdNum);
            if (photoRes && photoRes.success) {
               photoStatus = "OK";
               photoFileId = photoRes.fileId || "";
            }
          } catch(photoErr) {
            console.error("[GPSService] Photo upload failed:", photoErr);
          }
        }

        console.log("[GPSService] Updating Spreadsheet record...");
        const result = this.repository.updateSheetRecordAndLog(data, rowIdNum, gpsStatus, photoStatus, existing, photoFileId);

        return result;
      } catch (e) {
        console.error("[GPSService] Error processing updateRecordWithGPSPhoto:", e);
        return { success: false, message: e.toString() };
      } finally {
        lock.releaseLock();
      }
    }
  };
  GPSService.instance = null;
}
