import { describe, expect, it } from "vitest";
import { parseCsv, parseNumber, toCsv } from "../src/io/csv.js";
import { normalizeDate, parseActualSettlements, parseOrders } from "../src/io/smartstore.js";

describe("csv parser", () => {
  it("인용/쉼표/이스케이프 처리", () => {
    const text = 'a,b\n"1,000","he said ""hi"""\n';
    const recs = parseCsv(text);
    expect(recs).toEqual([{ a: "1,000", b: 'he said "hi"' }]);
  });

  it("BOM과 CRLF 처리", () => {
    const text = '﻿x,y\r\n1,2\r\n';
    expect(parseCsv(text)).toEqual([{ x: "1", y: "2" }]);
  });

  it("빈 줄 무시", () => {
    const text = "a\n1\n\n2\n";
    expect(parseCsv(text)).toEqual([{ a: "1" }, { a: "2" }]);
  });

  it("parseNumber 관대 파싱", () => {
    expect(parseNumber("1,234")).toBe(1234);
    expect(parseNumber("₩1,200")).toBe(1200);
    expect(parseNumber("3.63%")).toBe(3.63);
    expect(parseNumber("")).toBe(0);
    expect(parseNumber(undefined, -1)).toBe(-1);
  });

  it("toCsv 라운드트립", () => {
    const rows = [{ a: "1,000", b: "x" }];
    const csv = toCsv(rows);
    expect(parseCsv(csv)).toEqual(rows);
  });
});

describe("normalizeDate", () => {
  it("여러 표기 → ISO", () => {
    expect(normalizeDate("2026-01-05")).toBe("2026-01-05");
    expect(normalizeDate("2026.1.5")).toBe("2026-01-05");
    expect(normalizeDate("2026/01/05 13:22")).toBe("2026-01-05");
    expect(normalizeDate("20260105")).toBe("2026-01-05");
    expect(normalizeDate("없음")).toBeUndefined();
    expect(normalizeDate(undefined)).toBeUndefined();
  });
});

describe("parseOrders (스마트스토어 헤더)", () => {
  it("한글 헤더를 ProductOrder로 매핑", () => {
    const csv =
      "상품주문번호,주문번호,상품명,수량,결제금액,주문상태,구매확정일,판매자 상품코드\n" +
      '2026010112345,ORD-1,"운동화, 신상",2,"120,000",배송완료,2026.01.02,SKU-9\n';
    const orders = parseOrders(csv);
    expect(orders).toHaveLength(1);
    const o = orders[0]!;
    expect(o.productOrderId).toBe("2026010112345");
    expect(o.productName).toBe("운동화, 신상");
    expect(o.quantity).toBe(2);
    expect(o.paymentAmount).toBe(120000);
    expect(o.status).toBe("배송완료");
    expect(o.confirmedAt).toBe("2026-01-02");
    expect(o.sellerSku).toBe("SKU-9");
  });

  it("상품주문번호 없는 행은 skip", () => {
    const csv = "상품주문번호,결제금액\n,1000\nP2,2000\n";
    const orders = parseOrders(csv);
    expect(orders.map((o) => o.productOrderId)).toEqual(["P2"]);
  });
});

describe("parseActualSettlements", () => {
  it("정산내역 매핑", () => {
    const csv = "상품주문번호,정산금액,정산완료일\nP1,\"95,017\",2026-01-05\n";
    const act = parseActualSettlements(csv);
    expect(act).toEqual([{ productOrderId: "P1", settledAmount: 95017, settledAt: "2026-01-05" }]);
  });
});
