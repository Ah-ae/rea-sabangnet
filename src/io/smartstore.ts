/**
 * 스마트스토어 엑셀/CSV → 도메인 모델 매핑.
 *
 * 스마트스토어 판매자센터에서 내려받는 "주문/배송" 및 "정산내역" 파일의 한글 헤더를
 * 유연하게 인식해 ProductOrder / ActualSettlement 로 변환한다.
 * 스토어마다 헤더가 조금씩 달라서, 후보 헤더명을 여러 개 두고 첫 매칭을 사용한다.
 */

import { parseCsv, parseNumber } from "./csv.js";
import type { ActualSettlement } from "../domain/reconcile.js";
import type { OrderStatus, ProductOrder, SalesChannelPath } from "../domain/types.js";

/** 레코드에서 후보 헤더 중 처음 존재하는 값을 반환. */
function pick(rec: Record<string, string>, candidates: string[]): string | undefined {
  for (const c of candidates) {
    if (c in rec && rec[c] !== "") return rec[c];
  }
  return undefined;
}

/** 다양한 날짜 표기를 ISO yyyy-mm-dd 로 정규화. 실패 시 undefined. */
export function normalizeDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  // 이미 ISO
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // yyyy.mm.dd / yyyy/mm/dd
  m = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  // yyyymmdd
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return undefined;
}

const STATUS_MAP: Record<string, OrderStatus> = {
  결제완료: "결제완료",
  배송중: "배송중",
  배송완료: "배송완료",
  구매확정: "구매확정",
  취소: "취소",
  취소완료: "취소",
  반품: "반품",
  반품완료: "반품",
  교환: "교환",
};

function normalizeStatus(raw: string | undefined): OrderStatus | undefined {
  if (!raw) return undefined;
  const key = raw.trim();
  if (key in STATUS_MAP) return STATUS_MAP[key];
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (key.includes(k)) return v;
  }
  return undefined;
}

function normalizeChannelPath(raw: string | undefined): SalesChannelPath | undefined {
  if (!raw) return undefined;
  if (raw.includes("네이버쇼핑") || raw.includes("쇼핑검색") || raw.includes("가격비교")) {
    return "네이버쇼핑";
  }
  if (raw.includes("스토어") || raw.includes("직접") || raw.includes("자체")) {
    return "자체유입";
  }
  return undefined;
}

/** 스마트스토어 주문/배송 CSV 텍스트 → ProductOrder[] */
export function parseOrders(csvText: string): ProductOrder[] {
  const records = parseCsv(csvText);
  const orders: ProductOrder[] = [];
  for (const rec of records) {
    const productOrderId = pick(rec, ["상품주문번호", "productOrderId", "상품 주문번호"]);
    if (!productOrderId) continue; // 식별 불가 행 skip

    orders.push({
      productOrderId,
      orderId: pick(rec, ["주문번호", "orderId"]),
      productName: pick(rec, ["상품명", "productName", "상품 이름"]),
      sellerSku: pick(rec, ["판매자 상품코드", "판매자상품코드", "판매자 관리코드", "sellerSku", "SKU"]),
      quantity: parseNumber(pick(rec, ["수량", "구매수량", "quantity"]), 1),
      paymentAmount: parseNumber(
        pick(rec, [
          "정산기준금액",
          "결제금액",
          "상품별 총 주문금액",
          "상품별 총 결제금액",
          "구매자 결제금액",
          "paymentAmount",
        ]),
        0,
      ),
      channelPath: normalizeChannelPath(pick(rec, ["유입경로", "결제위치", "channelPath"])),
      deliveredAt: normalizeDate(pick(rec, ["배송완료일", "배송완료일시", "deliveredAt"])),
      dispatchedAt: normalizeDate(pick(rec, ["발송처리일", "발송일", "집화처리일", "dispatchedAt"])),
      confirmedAt: normalizeDate(pick(rec, ["구매확정일", "구매확정일시", "confirmedAt"])),
      status: normalizeStatus(pick(rec, ["주문상태", "배송상태", "상태", "status"])),
    });
  }
  return orders;
}

/** 스마트스토어 정산내역 CSV 텍스트 → ActualSettlement[] */
export function parseActualSettlements(csvText: string): ActualSettlement[] {
  const records = parseCsv(csvText);
  const out: ActualSettlement[] = [];
  for (const rec of records) {
    const productOrderId = pick(rec, ["상품주문번호", "productOrderId"]);
    if (!productOrderId) continue;
    out.push({
      productOrderId,
      settledAmount: parseNumber(
        pick(rec, ["정산금액", "정산완료금액", "실지급액", "정산예정금액", "settledAmount"]),
        0,
      ),
      settledAt: normalizeDate(pick(rec, ["정산일", "정산완료일", "정산예정일", "settledAt"])),
    });
  }
  return out;
}
