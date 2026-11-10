import { describe, expect, it } from "vitest";
import { makePolicy } from "../src/domain/policy.js";
import { isSettleable, settleMany, settleOne } from "../src/domain/settlement.js";
import type { ProductOrder } from "../src/domain/types.js";

const order = (over: Partial<ProductOrder> = {}): ProductOrder => ({
  productOrderId: "P1",
  quantity: 1,
  paymentAmount: 100_000,
  confirmedAt: "2026-01-02", // 금
  ...over,
});

describe("settleOne — 일반정산", () => {
  it("정산액 = 결제 − 수수료", () => {
    const line = settleOne(order(), makePolicy({ grade: "영세", defaultChannelPath: "네이버쇼핑" }));
    // 100000 - 1980 - 3003 = 95017
    expect(line.totalFee).toBe(4983);
    expect(line.settlementAmount).toBe(95017);
  });

  it("정산예정일 = 구매확정 +1 영업일(주말 건너뜀)", () => {
    const line = settleOne(order({ confirmedAt: "2026-01-02" }), makePolicy());
    expect(line.settlementDueDate).toBe("2026-01-05"); // 금 → 월
  });

  it("구매확정일 없으면 배송완료 +8일 자동확정으로 추정", () => {
    const line = settleOne(
      order({ confirmedAt: undefined, deliveredAt: "2026-01-05" }),
      makePolicy({ autoConfirmDays: 8 }),
    );
    // 2026-01-05 + 8일 = 2026-01-13(화), +1 영업일 = 2026-01-14(수)
    expect(line.settlementDueDate).toBe("2026-01-14");
    expect(line.warnings.some((w) => w.includes("자동확정"))).toBe(true);
  });

  it("날짜 근거가 전혀 없으면 정산예정일 미정 + 경고", () => {
    const line = settleOne(order({ confirmedAt: undefined, deliveredAt: undefined }), makePolicy());
    expect(line.settlementDueDate).toBe("");
    expect(line.warnings.length).toBeGreaterThan(0);
  });
});

describe("settleOne — 빠른정산", () => {
  it("집화 +1영업일, 90% 선지급", () => {
    const line = settleOne(
      order({ dispatchedAt: "2026-01-02" }),
      makePolicy({ settlementType: "빠른정산", grade: "영세", defaultChannelPath: "네이버쇼핑" }),
    );
    expect(line.settlementDueDate).toBe("2026-01-05");
    // floor((100000-4983)*0.9) = floor(85515.3) = 85515
    expect(line.settlementAmount).toBe(85515);
    expect(line.warnings.some((w) => w.includes("선지급"))).toBe(true);
  });

  it("집화일 없으면 정산예정일 미정", () => {
    const line = settleOne(order({ dispatchedAt: undefined }), makePolicy({ settlementType: "빠른정산" }));
    expect(line.settlementDueDate).toBe("");
  });
});

describe("settleMany", () => {
  it("취소/반품/교환은 정산 대상에서 제외", () => {
    expect(isSettleable(order({ status: "취소" }))).toBe(false);
    expect(isSettleable(order({ status: "반품" }))).toBe(false);
    expect(isSettleable(order({ status: "배송완료" }))).toBe(true);

    const { lines, skipped } = settleMany(
      [order({ productOrderId: "A" }), order({ productOrderId: "B", status: "취소" })],
      makePolicy(),
    );
    expect(lines.map((l) => l.productOrderId)).toEqual(["A"]);
    expect(skipped.map((o) => o.productOrderId)).toEqual(["B"]);
  });
});
