import { describe, expect, it } from "vitest";
import { reconcile, type ActualSettlement } from "../src/domain/reconcile.js";
import type { SettlementLine } from "../src/domain/types.js";

const line = (id: string, amount: number): SettlementLine => ({
  productOrderId: id,
  quantity: 1,
  paymentAmount: amount + 5000,
  fees: [],
  totalFee: 5000,
  settlementAmount: amount,
  settlementDueDate: "2026-01-05",
  settlementType: "일반정산",
  warnings: [],
});

describe("reconcile", () => {
  it("완전 일치", () => {
    const exp = [line("A", 95017), line("B", 50000)];
    const act: ActualSettlement[] = [
      { productOrderId: "A", settledAmount: 95017 },
      { productOrderId: "B", settledAmount: 50000 },
    ];
    const r = reconcile(exp, act);
    expect(r.summary.matched).toBe(2);
    expect(r.summary.netDiff).toBe(0);
  });

  it("금액 불일치 감지 + 순차이 계산", () => {
    const exp = [line("A", 95017)];
    const act: ActualSettlement[] = [{ productOrderId: "A", settledAmount: 95000 }];
    const r = reconcile(exp, act);
    expect(r.summary.amountDiff).toBe(1);
    expect(r.rows[0]!.diff).toBe(-17); // 실제 − 예상
    expect(r.summary.netDiff).toBe(-17);
  });

  it("허용오차 내 차이는 일치로 본다", () => {
    const exp = [line("A", 95017)];
    const act: ActualSettlement[] = [{ productOrderId: "A", settledAmount: 95015 }];
    const r = reconcile(exp, act, 5);
    expect(r.summary.matched).toBe(1);
    expect(r.summary.amountDiff).toBe(0);
  });

  it("미지급(missing)과 예상밖(unexpected) 구분", () => {
    const exp = [line("A", 100), line("B", 200)];
    const act: ActualSettlement[] = [
      { productOrderId: "A", settledAmount: 100 },
      { productOrderId: "C", settledAmount: 300 },
    ];
    const r = reconcile(exp, act);
    expect(r.summary.matched).toBe(1);
    expect(r.summary.missing).toBe(1); // B
    expect(r.summary.unexpected).toBe(1); // C
    const b = r.rows.find((x) => x.productOrderId === "B")!;
    expect(b.status).toBe("missing");
    expect(b.actualAmount).toBeNull();
    const c = r.rows.find((x) => x.productOrderId === "C")!;
    expect(c.status).toBe("unexpected");
    expect(c.expectedAmount).toBeNull();
  });

  it("결과는 상품주문번호로 정렬", () => {
    const exp = [line("B", 1), line("A", 1)];
    const act: ActualSettlement[] = [
      { productOrderId: "B", settledAmount: 1 },
      { productOrderId: "A", settledAmount: 1 },
    ];
    const r = reconcile(exp, act);
    expect(r.rows.map((x) => x.productOrderId)).toEqual(["A", "B"]);
  });
});
