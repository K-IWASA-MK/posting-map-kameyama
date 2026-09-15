/**
 * completion-validator.js
 * 証跡結果とAI報告内容(claims)を突き合わせ、完了状態を判定する
 */

function validateCompletion(claims, evidenceChecks) {
  const result = {
    IMPLEMENTED: "NOT VERIFIED",
    VERIFIED: "NOT VERIFIED",
    DEPLOYED: "NOT VERIFIED",
    "PRODUCTION VERIFIED": "NOT VERIFIED"
  };

  // Rule 4: No Evidence No PASS & Claim Validation Guard
  if (claims.implemented) {
    result.IMPLEMENTED = evidenceChecks.hasImplementationEvidence ? "PASS" : "FAIL";
  }

  if (claims.verified) {
    result.VERIFIED = evidenceChecks.hasVerificationEvidence ? "PASS" : "FAIL";
  }

  if (claims.deployed) {
    result.DEPLOYED = evidenceChecks.hasDeploymentEvidence ? "PASS" : "FAIL";
  }

  if (claims.productionVerified) {
    result["PRODUCTION VERIFIED"] = evidenceChecks.hasProductionEvidence ? "PASS" : "NOT VERIFIED";
  }

  // Rule 3: 完了状態の分離 (上位状態の飛び級禁止)
  // 下位のステータスが FAIL/NOT VERIFIED なのに上位が PASS なら FAIL(または WARNING) にする
  if (result.IMPLEMENTED !== "PASS") {
    if (result.VERIFIED === "PASS") result.VERIFIED = "FAIL";
    if (result.DEPLOYED === "PASS") result.DEPLOYED = "FAIL";
    if (result["PRODUCTION VERIFIED"] === "PASS") result["PRODUCTION VERIFIED"] = "FAIL";
  }

  if (result.VERIFIED !== "PASS") {
    if (result.DEPLOYED === "PASS") result.DEPLOYED = "FAIL";
    if (result["PRODUCTION VERIFIED"] === "PASS") result["PRODUCTION VERIFIED"] = "FAIL";
  }

  if (result.DEPLOYED !== "PASS") {
    if (result["PRODUCTION VERIFIED"] === "PASS") result["PRODUCTION VERIFIED"] = "FAIL";
  }

  return result;
}

module.exports = { validateCompletion };
