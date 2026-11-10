/**
 * 스마트스토어 수수료 정책 — 요율표 및 계산.
 *
 * 2025년 6월 개편 기준:
 *  - 네이버페이 주문관리수수료: 사업자 매출등급별 차등(아래 요율은 VAT 포함).
 *  - 판매수수료: 유입경로별 차등(네이버쇼핑 vs 자체유입), 공시 요율은 VAT 별도.
 *
 * 주의: 요율은 변동될 수 있으므로 이 표는 "기본 시드"이며, 운영 시 공식 공지로 갱신한다.
 * 출처(2026-11 확인):
 *  - 주문관리수수료 등급별 요율(VAT 포함)
 *  - 판매수수료 네이버쇼핑 2.73% / 자체유입 0.91% (VAT 별도)
 */

import type {
  FeeLine,
  MerchantGrade,
  ProductOrder,
  RoundingMode,
  SalesChannelPath,
  SettlementPolicy,
} from "./types.js";

/** 주문관리수수료 요율표(VAT 포함). 매출등급 → 요율(0~1). */
export const ORDER_MANAGEMENT_FEE_RATE: Readonly<Record<MerchantGrade, number>> = {
  영세: 0.0198, // ~3억
  중소1: 0.02585, // 3~5억
  중소2: 0.0275, // 5~10억
  중소3: 0.03025, // 10~30억
  일반: 0.0363, // 30억~
};

/** 판매수수료 공시 요율(VAT 별도). 유입경로 → 요율(0~1). */
export const SALES_FEE_RATE_EXCL_VAT: Readonly<Record<SalesChannelPath, number>> = {
  네이버쇼핑: 0.0273,
  자체유입: 0.0091,
};

/** 부가가치세율. 판매수수료(VAT 별도) 요율에 적용. */
export const VAT_RATE = 0.1;

/** 금액 반올림 정책 적용(소수 원 정리). */
export function applyRounding(value: number, mode: RoundingMode): number {
  switch (mode) {
    case "floor":
      return Math.floor(value);
    case "ceil":
      return Math.ceil(value);
    case "round":
      return Math.round(value);
  }
}

/**
 * 상품주문 1건의 공제(수수료) 내역을 계산.
 * 반환 순서: 주문관리수수료 → 판매수수료 → 기타공제.
 */
export function computeFees(order: ProductOrder, policy: SettlementPolicy): FeeLine[] {
  const base = order.paymentAmount;
  const fees: FeeLine[] = [];

  // 1) 주문관리수수료 (VAT 포함 요율)
  const omRate = ORDER_MANAGEMENT_FEE_RATE[policy.grade];
  fees.push({
    kind: "주문관리수수료",
    label: `네이버페이 주문관리수수료(${policy.grade}, VAT포함)`,
    rate: omRate,
    amount: applyRounding(base * omRate, policy.rounding),
  });

  // 2) 판매수수료 (VAT 별도 → VAT 가산)
  const path: SalesChannelPath = order.channelPath ?? policy.defaultChannelPath;
  const salesRate = SALES_FEE_RATE_EXCL_VAT[path];
  const salesRateInclVat = salesRate * (1 + VAT_RATE);
  fees.push({
    kind: "판매수수료",
    label: `판매수수료(${path}, ${(salesRate * 100).toFixed(2)}%+VAT)`,
    rate: salesRateInclVat,
    amount: applyRounding(base * salesRateInclVat, policy.rounding),
  });

  // 3) 기타공제(쿠폰 분담, 판매자 부담 등)
  for (const d of order.extraDeductions ?? []) {
    if (d.amount <= 0) continue;
    fees.push({
      kind: "기타공제",
      label: d.label,
      rate: 0,
      amount: applyRounding(d.amount, policy.rounding),
    });
  }

  return fees;
}
