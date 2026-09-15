/**
 * GAS v2 - Core Aggregation Engine (Single Source of Truth)
 * 
 * UI層での計算を排除し、すべてここで完結させる。
 */

// ==========================================
// 集計エンジン (Aggregation Engine)
// UI層の計算を完全に排除するための集計メソッド群
// ==========================================



/**
 * 個人別配布枚数ランキング
 */
function getRankingDataCore() {
  if (typeof DistributionRepository !== 'undefined' && DistributionRepository.getInstance) {
    return DistributionRepository.getInstance().fetchRankingData();
  }
  return [];
}
