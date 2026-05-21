/**
 * EconomySystem - 经济系统
 *
 * 职责：管理玩家货币、收入和支出
 */

export interface EconomyState {
  /** 当前现金 */
  cash: number;
  /** 总收入 */
  totalEarned: number;
  /** 总支出 */
  totalSpent: number;
}

export class EconomySystem {
  private state: EconomyState = {
    cash: 0,
    totalEarned: 0,
    totalSpent: 0,
  };

  private onCashChangedCallbacks: ((newCash: number, delta: number) => void)[] = [];
  private onInsufficientFundsCallbacks: ((required: number, available: number) => void)[] = [];

  constructor(initialCash: number = 0) {
    this.state.cash = initialCash;
  }

  get cash(): number {
    return this.state.cash;
  }

  get totalEarned(): number {
    return this.state.totalEarned;
  }

  get totalSpent(): number {
    return this.state.totalSpent;
  }

  addCash(amount: number): void {
    if (amount <= 0) return;

    this.state.cash += amount;
    this.state.totalEarned += amount;
    this.notifyCashChanged(amount);
  }

  spendCash(amount: number): boolean {
    if (amount <= 0) return false;

    if (this.state.cash < amount) {
      this.notifyInsufficientFunds(amount);
      return false;
    }

    this.state.cash -= amount;
    this.state.totalSpent += amount;
    this.notifyCashChanged(-amount);
    return true;
  }

  canAfford(amount: number): boolean {
    return this.state.cash >= amount;
  }

  setCash(amount: number): void {
    const delta = amount - this.state.cash;
    this.state.cash = amount;
    this.notifyCashChanged(delta);
  }

  getState(): EconomyState {
    return { ...this.state };
  }

  onCashChanged(callback: (newCash: number, delta: number) => void): void {
    this.onCashChangedCallbacks.push(callback);
  }

  onInsufficientFunds(callback: (required: number, available: number) => void): void {
    this.onInsufficientFundsCallbacks.push(callback);
  }

  private notifyCashChanged(delta: number): void {
    for (const callback of this.onCashChangedCallbacks) {
      callback(this.state.cash, delta);
    }
  }

  private notifyInsufficientFunds(required: number): void {
    for (const callback of this.onInsufficientFundsCallbacks) {
      callback(required, this.state.cash);
    }
  }

  reset(initialCash: number = 0): void {
    this.state = {
      cash: initialCash,
      totalEarned: 0,
      totalSpent: 0,
    };
  }

  dispose(): void {
    this.onCashChangedCallbacks = [];
    this.onInsufficientFundsCallbacks = [];
  }
}
