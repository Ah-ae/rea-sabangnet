/**
 * 정산정책 생성 헬퍼.
 */

import { KR_HOLIDAYS_2025_2026 } from "./businessDays.js";
import type { SettlementPolicy } from "./types.js";

export const DEFAULT_POLICY: SettlementPolicy = {
  grade: "영세",
  defaultChannelPath: "네이버쇼핑",
  settlementType: "일반정산",
  rounding: "floor", // 수수료 원단위 절사
  fastSettlementAdvanceRatio: 0.9,
  autoConfirmDays: 8,
  holidays: [...KR_HOLIDAYS_2025_2026],
};

/** 기본 정책에서 일부만 덮어써서 정책 생성. */
export function makePolicy(overrides: Partial<SettlementPolicy> = {}): SettlementPolicy {
  return {
    ...DEFAULT_POLICY,
    ...overrides,
    holidays: overrides.holidays ?? [...DEFAULT_POLICY.holidays],
  };
}
