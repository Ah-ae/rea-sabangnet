import { describe, expect, it } from "vitest";
import { aggregate } from "../src/domain/aggregate.js";
import type { SettlementLine } from "../src/domain/types.js";

const line = (id: string, due: string, pay: number, omFee: number, saleFee: number): SettlementLine => ({
  productOrderId: id,
  quantity: 1,
  paymentAmount: pay,
  fees: [
    { kind: "주문관리수수료", label: "om", rate: 0, amount: omFee },
    { kind: "판매수수료", label: "sale", rate: 0, amount: saleFee },
  ],
  totalFee: omFee + saleFee,
  settlementAmount: pay - omFee - saleFee,
  settlementDueDate: due,
  settlementType: "일반정산",
  warnings: [],
});

describe("aggregate", () => {
  const lines = [
    line("A", "2026-01-05", 100_000, 1980, 3003),
    line("B", "2026-01-05", 50_000, 990, 1501),
    line("C", "2026-02-10", 30_000, 594, 900),
  ];

  it("일별 버킷", () => {
    const d = aggregate(lines, "day");
    expect(d.map((b) => b.period)).toEqual(["2026-01-05", "2026-02-10"]);
    const jan = d[0]!;
    expect(jan.count).toBe(2);
    expect(jan.grossSales).toBe(150_000);
    expect(jan.orderManagementFee).toBe(2970);
    expect(jan.salesFee).toBe(4504);
    expect(jan.netSettlement).toBe(150_000 - 2970 - 4504);
  });

  it("월별 버킷", () => {
    const m = aggregate(lines, "month");
    expect(m.map((b) => b.period)).toEqual(["2026-01", "2026-02"]);
    expect(m[0]!.count).toBe(2);
    expect(m[1]!.count).toBe(1);
  });
});
