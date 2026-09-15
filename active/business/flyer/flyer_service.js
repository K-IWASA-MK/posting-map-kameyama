/**
 * Business Layer - Flyer Service Module
 * 
 * Domain: Flyer Domain
 * Layer: Business Layer
 * Responsibility: チラシ保管業務の集計・保有枚数更新サービス
 */

if (typeof FlyerService === 'undefined') {
  FlyerService = class FlyerService {
    constructor() {
      this.repository = FlyerRepository.getInstance();
    }

    static getInstance() {
      if (!FlyerService.instance) {
        FlyerService.instance = new FlyerService();
      }
      return FlyerService.instance;
    }

    getFlyerStock() {
      return this.repository.findAllStocks();
    }

    updateFlyerStock(location, count, staffName, staffId) {
      return this.repository.updateStock(location, count, staffName, staffId);
    }
  };
  FlyerService.instance = null;
}
