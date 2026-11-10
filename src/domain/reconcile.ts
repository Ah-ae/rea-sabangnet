/**
 * 정산 대사(reconciliation).
 *
 * 사방넷 정산관리의 핵심: "우리가 계산한 예상 정산액"과 "쇼핑몰이 실제로 지급한 정산내역"을
 * 상품주문번호 기준으로 맞춰보고 차이를 찾아낸다.
 *
 *  - matched      : 금액이 허용오차 내에서 일치
 *  - amount_diff  : 매칭됐지만 정산액 차이 > 허용오차
 *  - missing      : 예상엔 있는데 실제 정산내역에 없음(미지급/누락)
 *  - unexpected   : 실제엔 있는데 예상에 없음(계산 누락/추가 지급)
 */

import type { SettlementLine } from "./types.js";

/** 쇼핑몰에서 내려받은 실제 정산내역 1건. */
export interface ActualSettlement {
  productOrderId: string;
  /** 실제 지급 정산액(원). */
  settledAmount: number;
  /** 실제 정산일(ISO yyyy-mm-dd), 있으면. */
  settledAt?: string;
}

export type ReconcileStatus = "matched" | "amount_diff" | "missing" | "unexpected";

export interface ReconcileRow {
  productOrderId: string;
  status: ReconcileStatus;
  /** 예상 정산액(원), 예상이 없으면 null. */
  expectedAmount: number | null;
  /** 실제 정산액(원), 실제가 없으면 null. */
  actualAmount: number | null;
  /** 실제 − 예상(원). 한쪽이 없으면 null. */
  diff: number | null;
}

export interface ReconcileReport {
  rows: ReconcileRow[];
  summary: {
    total: number;
    matched: number;
    amountDiff: number;
    missing: number;
    unexpected: number;
    /** 모든 차이의 합(실제 − 예상). 양수면 실수령이 예상보다 많음. */
    netDiff: number;
  };
}

/**
 * 예상 정산내역과 실제 정산내역을 대사한다.
 * @param tolerance 금액 허용오차(원). 기본 0 — 원 단위까지 정확 비교.
 */
export function reconcile(
  expected: readonly SettlementLine[],
  actual: readonly ActualSettlement[],
  tolerance = 0,
): ReconcileReport {
  const expByKey = new Map<string, SettlementLine>();
  for (const e of expected) expByKey.set(e.productOrderId, e);

  const actByKey = new Map<string, ActualSettlement>();
  for (const a of actual) actByKey.set(a.productOrderId, a);

  const rows: ReconcileRow[] = [];
  const keys = new Set<string>([...expByKey.keys(), ...actByKey.keys()]);

  for (const key of keys) {
    const e = expByKey.get(key);
    const a = actByKey.get(key);

    if (e && a) {
      const diff = a.settledAmount - e.settlementAmount;
      rows.push({
        productOrderId: key,
        status: Math.abs(diff) <= tolerance ? "matched" : "amount_diff",
        expectedAmount: e.settlementAmount,
        actualAmount: a.settledAmount,
        diff,
      });
    } else if (e && !a) {
      rows.push({
        productOrderId: key,
        status: "missing",
        expectedAmount: e.settlementAmount,
        actualAmount: null,
        diff: null,
      });
    } else if (!e && a) {
      rows.push({
        productOrderId: key,
        status: "unexpected",
        expectedAmount: null,
        actualAmount: a.settledAmount,
        diff: null,
      });
    }
  }

  // 결정적 출력을 위해 상품주문번호로 정렬.
  rows.sort((x, y) => (x.productOrderId < y.productOrderId ? -1 : x.productOrderId > y.productOrderId ? 1 : 0));

  const summary = {
    total: rows.length,
    matched: rows.filter((r) => r.status === "matched").length,
    amountDiff: rows.filter((r) => r.status === "amount_diff").length,
    missing: rows.filter((r) => r.status === "missing").length,
    unexpected: rows.filter((r) => r.status === "unexpected").length,
    netDiff: rows.reduce((s, r) => s + (r.diff ?? 0), 0),
  };

  return { rows, summary };
}
