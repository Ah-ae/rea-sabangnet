/**
 * 공용 처리 서비스 — CLI/서버 API/정적 데모가 모두 재사용한다.
 *
 * CSV 텍스트 + 정책 옵션을 받아 정산 계산·집계·(선택) 대사를 한 번에 수행한 결과 객체를 반환.
 * 브라우저·Node 어디서나 동작하도록 파일시스템/프레임워크 의존성이 없다.
 */

import { aggregate, totals, type AggregateBucket } from "../domain/aggregate.js";
import { makePolicy } from "../domain/policy.js";
import { reconcile, type ReconcileReport } from "../domain/reconcile.js";
import { settleMany } from "../domain/settlement.js";
import type {
  MerchantGrade,
  RoundingMode,
  SalesChannelPath,
  SettlementLine,
  SettlementType,
} from "../domain/types.js";
import { parseActualSettlements, parseOrders } from "../io/smartstore.js";

export interface ProcessOptions {
  grade?: MerchantGrade;
  channelPath?: SalesChannelPath;
  settlementType?: SettlementType;
  rounding?: RoundingMode;
  /** 대사 허용오차(원). */
  tolerance?: number;
}

export interface ProcessResult {
  options: Required<Pick<ProcessOptions, "grade" | "channelPath" | "settlementType" | "rounding">> & {
    tolerance: number;
  };
  lines: SettlementLine[];
  skippedIds: string[];
  totals: AggregateBucket;
  daily: AggregateBucket[];
  monthly: AggregateBucket[];
  reconcile: ReconcileReport | null;
  warnings: { productOrderId: string; messages: string[] }[];
}

/**
 * 주문 CSV(+선택 정산내역 CSV)를 받아 정산 전체 파이프라인을 실행.
 * @throws 주문 CSV가 비어 식별 가능한 주문이 없으면 Error.
 */
export function processCsv(
  ordersCsv: string,
  actualCsv: string | undefined,
  opts: ProcessOptions = {},
): ProcessResult {
  const grade = opts.grade ?? "영세";
  const channelPath = opts.channelPath ?? "네이버쇼핑";
  const settlementType = opts.settlementType ?? "일반정산";
  const rounding = opts.rounding ?? "floor";
  const tolerance = opts.tolerance ?? 0;

  const orders = parseOrders(ordersCsv);
  if (orders.length === 0) {
    throw new Error("주문 CSV에서 상품주문번호를 가진 행을 찾지 못했습니다. 헤더(상품주문번호/결제금액 등)를 확인하세요.");
  }

  const policy = makePolicy({ grade, defaultChannelPath: channelPath, settlementType, rounding });
  const { lines, skipped } = settleMany(orders, policy);

  let reconcileReport: ReconcileReport | null = null;
  if (actualCsv && actualCsv.trim() !== "") {
    const actual = parseActualSettlements(actualCsv);
    reconcileReport = reconcile(lines, actual, tolerance);
  }

  return {
    options: { grade, channelPath, settlementType, rounding, tolerance },
    lines,
    skippedIds: skipped.map((o) => o.productOrderId),
    totals: totals(lines),
    daily: aggregate(lines, "day"),
    monthly: aggregate(lines, "month"),
    reconcile: reconcileReport,
    warnings: lines
      .filter((l) => l.warnings.length > 0)
      .map((l) => ({ productOrderId: l.productOrderId, messages: l.warnings })),
  };
}
