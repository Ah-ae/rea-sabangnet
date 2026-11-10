/**
 * 정산 계산 엔진.
 *
 * 입력: 상품주문(ProductOrder) + 정산정책(SettlementPolicy)
 * 출력: 정산내역(SettlementLine) — 공제 내역, 정산예정액, 정산예정일.
 *
 * 정산예정일 규칙:
 *  - 일반정산: (구매확정일) +1 영업일.
 *    구매확정일이 없으면 배송완료일 + autoConfirmDays(기본 8일, 달력일)로 자동 구매확정 추정.
 *  - 빠른정산: (집화처리일) +1 영업일, 정산액은 결제금액의 advanceRatio(기본 90%).
 */

import { addBusinessDays, addCalendarDays } from "./businessDays.js";
import { computeFees } from "./fees.js";
import type {
  ProductOrder,
  SettlementLine,
  SettlementPolicy,
} from "./types.js";

/** 정산 대상에서 제외되는 상태(취소/반품/교환). */
const NON_SETTLED_STATUS = new Set(["취소", "반품", "교환"]);

/** 정산 대상 여부. */
export function isSettleable(order: ProductOrder): boolean {
  return !(order.status && NON_SETTLED_STATUS.has(order.status));
}

/** 구매확정일 결정(명시값 우선, 없으면 배송완료+자동확정 추정). */
function resolveConfirmDate(
  order: ProductOrder,
  policy: SettlementPolicy,
  warnings: string[],
): string | null {
  if (order.confirmedAt) return order.confirmedAt;
  if (order.deliveredAt) {
    const estimated = addCalendarDays(order.deliveredAt, policy.autoConfirmDays);
    warnings.push(
      `구매확정일 미기재 → 배송완료(${order.deliveredAt})+${policy.autoConfirmDays}일 자동확정으로 추정(${estimated})`,
    );
    return estimated;
  }
  return null;
}

/** 정산예정일 계산. */
function resolveDueDate(
  order: ProductOrder,
  policy: SettlementPolicy,
  holidays: ReadonlySet<string>,
  warnings: string[],
): string | null {
  if (policy.settlementType === "빠른정산") {
    if (!order.dispatchedAt) {
      warnings.push("빠른정산인데 집화처리일(dispatchedAt) 없음 → 정산예정일 산출 불가");
      return null;
    }
    return addBusinessDays(order.dispatchedAt, 1, holidays);
  }
  // 일반정산
  const confirm = resolveConfirmDate(order, policy, warnings);
  if (!confirm) {
    warnings.push("구매확정일/배송완료일 모두 없음 → 정산예정일 산출 불가");
    return null;
  }
  return addBusinessDays(confirm, 1, holidays);
}

/** 상품주문 1건 정산 계산. */
export function settleOne(
  order: ProductOrder,
  policy: SettlementPolicy,
): SettlementLine {
  const warnings: string[] = [];
  const holidays = new Set(policy.holidays);

  const fees = computeFees(order, policy);
  const totalFee = fees.reduce((s, f) => s + f.amount, 0);

  let settlementAmount = order.paymentAmount - totalFee;
  if (policy.settlementType === "빠른정산") {
    // 빠른정산은 수수료 차감 후 금액의 advanceRatio를 선지급한다.
    settlementAmount = Math.floor(settlementAmount * policy.fastSettlementAdvanceRatio);
    warnings.push(
      `빠른정산 선지급 ${Math.round(policy.fastSettlementAdvanceRatio * 100)}% 적용(잔액은 구매확정 후 정산)`,
    );
  }

  const due = resolveDueDate(order, policy, holidays, warnings) ?? "";

  return {
    productOrderId: order.productOrderId,
    orderId: order.orderId,
    productName: order.productName,
    sellerSku: order.sellerSku,
    quantity: order.quantity,
    paymentAmount: order.paymentAmount,
    fees,
    totalFee,
    settlementAmount,
    settlementDueDate: due,
    settlementType: policy.settlementType,
    warnings,
  };
}

/** 여러 상품주문 정산 계산(정산 대상만). 제외된 주문은 결과에 포함하지 않는다. */
export function settleMany(
  orders: readonly ProductOrder[],
  policy: SettlementPolicy,
): { lines: SettlementLine[]; skipped: ProductOrder[] } {
  const lines: SettlementLine[] = [];
  const skipped: ProductOrder[] = [];
  for (const o of orders) {
    if (!isSettleable(o)) {
      skipped.push(o);
      continue;
    }
    lines.push(settleOne(o, policy));
  }
  return { lines, skipped };
}
