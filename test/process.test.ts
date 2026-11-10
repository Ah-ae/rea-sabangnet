import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { processCsv } from "../src/service/process.js";

const fx = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");

describe("processCsv", () => {
  it("주문 CSV만으로 정산+집계 결과를 낸다", () => {
    const r = processCsv(fx("orders.csv"), undefined);
    expect(r.lines).toHaveLength(4);
    expect(r.skippedIds).toEqual(["2026010100004"]);
    expect(r.totals.grossSales).toBe(298000);
    expect(r.reconcile).toBeNull();
    expect(r.warnings.some((w) => w.productOrderId === "2026010100003")).toBe(true);
  });

  it("정산내역 CSV를 주면 대사까지 수행", () => {
    const r = processCsv(fx("orders.csv"), fx("actual-settlements.csv"));
    expect(r.reconcile).not.toBeNull();
    expect(r.reconcile!.summary.netDiff).toBe(-100);
  });

  it("옵션(등급/유입경로)이 반영된다", () => {
    const r = processCsv(fx("orders.csv"), undefined, { grade: "일반", channelPath: "자체유입" });
    expect(r.options.grade).toBe("일반");
    // 일반(3.63%)이 영세(1.98%)보다 주문관리수수료가 크므로 순정산이 작아진다.
    const base = processCsv(fx("orders.csv"), undefined, { grade: "영세" });
    expect(r.totals.netSettlement).toBeLessThan(base.totals.netSettlement);
  });

  it("식별 가능한 주문이 없으면 throw", () => {
    expect(() => processCsv("아무거나,헤더\n1,2\n", undefined)).toThrow();
  });
});
