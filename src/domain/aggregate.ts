/**
 * 기간별 정산 집계 리포트.
 *
 * 정산예정일 기준으로 일별/월별 매출·수수료·순정산액을 집계한다.
 * (사방넷 정산관리의 "정산 예정 리포트"에 해당.)
 */

import type { FeeLine, SettlementLine } from "./types.js";

export interface AggregateBucket {
  /** 버킷 키 — 일별이면 yyyy-mm-dd, 월별이면 yyyy-mm. */
  period: string;
  /** 건수. */
  count: number;
  /** 결제금액 합계(매출총액). */
  grossSales: number;
  /** 주문관리수수료 합계. */
  orderManagementFee: number;
  /** 판매수수료 합계. */
  salesFee: number;
  /** 기타공제 합계. */
  otherDeduction: number;
  /** 총 공제 합계. */
  totalFee: number;
  /** 순정산액 합계. */
  netSettlement: number;
}

export type Granularity = "day" | "month";

function bucketKey(dueDate: string, granularity: Granularity): string {
  if (!dueDate) return "미정"; // 정산예정일 산출 불가 건
  return granularity === "month" ? dueDate.slice(0, 7) : dueDate;
}

function sumFeeByKind(fees: readonly FeeLine[], kind: FeeLine["kind"]): number {
  return fees.reduce((s, f) => (f.kind === kind ? s + f.amount : s), 0);
}

/** 정산내역을 기간 단위로 집계. 결과는 period 오름차순. */
export function aggregate(
  lines: readonly SettlementLine[],
  granularity: Granularity = "day",
): AggregateBucket[] {
  const map = new Map<string, AggregateBucket>();

  for (const line of lines) {
    const key = bucketKey(line.settlementDueDate, granularity);
    let b = map.get(key);
    if (!b) {
      b = {
        period: key,
        count: 0,
        grossSales: 0,
        orderManagementFee: 0,
        salesFee: 0,
        otherDeduction: 0,
        totalFee: 0,
        netSettlement: 0,
      };
      map.set(key, b);
    }
    b.count += 1;
    b.grossSales += line.paymentAmount;
    b.orderManagementFee += sumFeeByKind(line.fees, "주문관리수수료");
    b.salesFee += sumFeeByKind(line.fees, "판매수수료");
    b.otherDeduction += sumFeeByKind(line.fees, "기타공제");
    b.totalFee += line.totalFee;
    b.netSettlement += line.settlementAmount;
  }

  return [...map.values()].sort((a, b) =>
    a.period < b.period ? -1 : a.period > b.period ? 1 : 0,
  );
}

/** 전체 합계(단일 버킷). */
export function totals(lines: readonly SettlementLine[]): AggregateBucket {
  const all = aggregate(lines, "day");
  return all.reduce<AggregateBucket>(
    (acc, b) => ({
      period: "합계",
      count: acc.count + b.count,
      grossSales: acc.grossSales + b.grossSales,
      orderManagementFee: acc.orderManagementFee + b.orderManagementFee,
      salesFee: acc.salesFee + b.salesFee,
      otherDeduction: acc.otherDeduction + b.otherDeduction,
      totalFee: acc.totalFee + b.totalFee,
      netSettlement: acc.netSettlement + b.netSettlement,
    }),
    {
      period: "합계",
      count: 0,
      grossSales: 0,
      orderManagementFee: 0,
      salesFee: 0,
      otherDeduction: 0,
      totalFee: 0,
      netSettlement: 0,
    },
  );
}
