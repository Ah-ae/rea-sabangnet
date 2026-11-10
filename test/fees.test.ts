import { describe, expect, it } from "vitest";
import {
  ORDER_MANAGEMENT_FEE_RATE,
  SALES_FEE_RATE_EXCL_VAT,
  VAT_RATE,
  applyRounding,
  computeFees,
} from "../src/domain/fees.js";
import { makePolicy } from "../src/domain/policy.js";
import type { ProductOrder } from "../src/domain/types.js";

const order = (over: Partial<ProductOrder> = {}): ProductOrder => ({
  productOrderId: "P1",
  quantity: 1,
  paymentAmount: 100_000,
  ...over,
});

describe("applyRounding", () => {
  it("floor/round/ceil", () => {
    expect(applyRounding(1980.9, "floor")).toBe(1980);
    expect(applyRounding(1980.4, "round")).toBe(1980);
    expect(applyRounding(1980.1, "ceil")).toBe(1981);
  });
});

describe("computeFees", () => {
  it("영세+네이버쇼핑 100,000원 수수료", () => {
    const policy = makePolicy({ grade: "영세", defaultChannelPath: "네이버쇼핑", rounding: "floor" });
    const fees = computeFees(order(), policy);
    const om = fees.find((f) => f.kind === "주문관리수수료")!;
    const sale = fees.find((f) => f.kind === "판매수수료")!;

    // 주문관리수수료: 100000 * 0.0198 = 1980
    expect(om.amount).toBe(1980);
    // 판매수수료: 100000 * (0.0273 * 1.1) = 3003
    expect(sale.amount).toBe(3003);
  });

  it("등급별 주문관리수수료 요율이 반영된다", () => {
    const base = 1_000_000;
    for (const grade of Object.keys(ORDER_MANAGEMENT_FEE_RATE) as (keyof typeof ORDER_MANAGEMENT_FEE_RATE)[]) {
      const policy = makePolicy({ grade, rounding: "floor" });
      const fees = computeFees(order({ paymentAmount: base }), policy);
      const om = fees.find((f) => f.kind === "주문관리수수료")!;
      expect(om.amount).toBe(Math.floor(base * ORDER_MANAGEMENT_FEE_RATE[grade]));
    }
  });

  it("자체유입 판매수수료가 더 낮다", () => {
    const naver = computeFees(order(), makePolicy({ defaultChannelPath: "네이버쇼핑" }));
    const own = computeFees(order(), makePolicy({ defaultChannelPath: "자체유입" }));
    const naverSale = naver.find((f) => f.kind === "판매수수료")!.amount;
    const ownSale = own.find((f) => f.kind === "판매수수료")!.amount;
    expect(ownSale).toBeLessThan(naverSale);
    // 0.0091 * 1.1 * 100000 = 1001
    expect(ownSale).toBe(1001);
  });

  it("상품별 channelPath가 정책 기본값을 덮어쓴다", () => {
    const policy = makePolicy({ defaultChannelPath: "네이버쇼핑" });
    const fees = computeFees(order({ channelPath: "자체유입" }), policy);
    expect(fees.find((f) => f.kind === "판매수수료")!.amount).toBe(1001);
  });

  it("기타공제가 양수만 추가된다", () => {
    const policy = makePolicy();
    const fees = computeFees(
      order({ extraDeductions: [{ label: "쿠폰분담", amount: 500 }, { label: "무효", amount: 0 }] }),
      policy,
    );
    const extras = fees.filter((f) => f.kind === "기타공제");
    expect(extras).toHaveLength(1);
    expect(extras[0]!.amount).toBe(500);
  });

  it("VAT 상수", () => {
    expect(VAT_RATE).toBe(0.1);
    expect(SALES_FEE_RATE_EXCL_VAT["네이버쇼핑"]).toBeCloseTo(0.0273, 6);
  });
});
