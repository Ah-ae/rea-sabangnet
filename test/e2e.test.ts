import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { aggregate, totals } from "../src/domain/aggregate.js";
import { makePolicy } from "../src/domain/policy.js";
import { reconcile } from "../src/domain/reconcile.js";
import { settleMany } from "../src/domain/settlement.js";
import { parseActualSettlements, parseOrders } from "../src/io/smartstore.js";

const fx = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");

describe("end-to-end: 주문 CSV → 정산 → 집계 → 대사", () => {
  const policy = makePolicy(); // 영세/일반정산/네이버쇼핑/floor
  const orders = parseOrders(fx("orders.csv"));
  const { lines, skipped } = settleMany(orders, policy);

  it("5건 중 취소 1건 제외, 4건 정산", () => {
    expect(orders).toHaveLength(5);
    expect(skipped.map((o) => o.productOrderId)).toEqual(["2026010100004"]);
    expect(lines).toHaveLength(4);
  });

  it("상품주문별 정산액이 수수료 규칙과 일치", () => {
    const byId = new Map(lines.map((l) => [l.productOrderId, l]));
    expect(byId.get("2026010100001")!.settlementAmount).toBe(84566); // 89000 - 1762 - 2672
    expect(byId.get("2026010100002")!.settlementAmount).toBe(36868); // 자체유입
    expect(byId.get("2026010100005")!.settlementAmount).toBe(151351);
  });

  it("날짜 근거 없는 주문은 정산예정일 미정 + 경고", () => {
    const l = lines.find((x) => x.productOrderId === "2026010100003")!;
    expect(l.settlementDueDate).toBe("");
    expect(l.warnings.length).toBeGreaterThan(0);
  });

  it("집계: 순정산 합계는 건별 합과 일치", () => {
    const t = totals(lines);
    const manual = lines.reduce((s, l) => s + l.settlementAmount, 0);
    expect(t.netSettlement).toBe(manual);
    expect(t.grossSales).toBe(89000 + 38000 + 15000 + 156000);
  });

  it("일별 집계는 정산예정일로 버킷팅(미정 버킷 포함)", () => {
    const buckets = aggregate(lines, "day");
    const periods = buckets.map((b) => b.period);
    expect(periods).toContain("2026-01-05");
    expect(periods).toContain("미정"); // 2026010100003
  });

  it("대사: 일치3 / 금액불일치1 / 미지급1 / 예상밖1", () => {
    const actual = parseActualSettlements(fx("actual-settlements.csv"));
    const r = reconcile(lines, actual);
    expect(r.summary.matched).toBe(2); // 0001, 0005
    expect(r.summary.amountDiff).toBe(1); // 0002 (−100)
    expect(r.summary.missing).toBe(1); // 0003
    expect(r.summary.unexpected).toBe(1); // 9999999
    expect(r.summary.netDiff).toBe(-100);
  });
});
