/**
 * 스마트스토어 매출 정산 도메인 타입.
 *
 * 금액 단위는 모두 원(KRW) 정수. 스마트스토어 정산은 원 단위로 처리되므로
 * 소수점/센트 개념이 없다. 수수료 계산 결과의 소수 원은 `rounding` 정책으로 정리한다.
 */

/** 사업자 매출등급 — 네이버페이 주문관리수수료 요율을 결정한다. */
export type MerchantGrade = "영세" | "중소1" | "중소2" | "중소3" | "일반";

/** 유입경로 — 2025.6 개편 판매수수료 요율을 결정한다. */
export type SalesChannelPath =
  | "네이버쇼핑" // 네이버쇼핑 검색/가격비교 등 유입
  | "자체유입"; // 스토어 즐겨찾기/직접 방문 등

/** 정산 방식. */
export type SettlementType =
  | "일반정산" // 구매확정 +1 영업일
  | "빠른정산"; // 집화처리 +1 영업일, 판매대금 90% 선지급

/** 수수료 1건 내역. */
export interface FeeLine {
  /** 수수료 종류 식별자. */
  kind: "주문관리수수료" | "판매수수료" | "기타공제";
  /** 사람이 읽는 설명. */
  label: string;
  /** 적용 요율(0~1). 기타공제처럼 정액이면 0. */
  rate: number;
  /** 공제 금액(원, 양수). 정산액에서 차감된다. */
  amount: number;
}

/** 정산 계산의 입력이 되는 상품주문 1건(스마트스토어 "상품주문번호" 단위). */
export interface ProductOrder {
  /** 상품주문번호 (스마트스토어 productOrderId). 정산/대사의 매칭 키. */
  productOrderId: string;
  /** 주문번호 (스마트스토어 orderId). 참고용. */
  orderId?: string;
  /** 상품명. */
  productName?: string;
  /** 판매자 SKU/관리코드. */
  sellerSku?: string;
  /** 수량. */
  quantity: number;
  /**
   * 결제금액(원) — 수수료 부과 기준이 되는 실제 고객 결제액.
   * 상품금액 + 옵션가 − 즉시할인/쿠폰 등을 반영한 "정산 기준 금액"이어야 한다.
   */
  paymentAmount: number;
  /** 유입경로 (판매수수료 요율 결정). 생략 시 정책 기본값. */
  channelPath?: SalesChannelPath;
  /** 배송완료일 (ISO yyyy-mm-dd). 자동 구매확정 기준. */
  deliveredAt?: string;
  /** 집화처리일 (ISO yyyy-mm-dd). 빠른정산 기준. */
  dispatchedAt?: string;
  /** 구매확정일 (ISO yyyy-mm-dd). 일반정산 기준. 없으면 배송완료+자동확정으로 추정. */
  confirmedAt?: string;
  /** 주문 상태. 정산 대상 여부 판단에 사용. */
  status?: OrderStatus;
  /** 임의 공제(쿠폰 분담금, 판매자 부담 등) — 양수 금액 리스트. */
  extraDeductions?: { label: string; amount: number }[];
}

export type OrderStatus =
  | "결제완료"
  | "배송중"
  | "배송완료"
  | "구매확정"
  | "취소"
  | "반품"
  | "교환";

/** 정산 계산 결과(상품주문 1건). */
export interface SettlementLine {
  productOrderId: string;
  orderId?: string;
  productName?: string;
  sellerSku?: string;
  quantity: number;
  /** 결제금액(수수료 기준). */
  paymentAmount: number;
  /** 공제 내역. */
  fees: FeeLine[];
  /** 총 공제액(원). */
  totalFee: number;
  /** 정산예정액(원) = paymentAmount − totalFee. 빠른정산은 선지급분 기준. */
  settlementAmount: number;
  /** 정산예정일(ISO yyyy-mm-dd). */
  settlementDueDate: string;
  /** 적용된 정산 방식. */
  settlementType: SettlementType;
  /** 계산 과정에서 발생한 경고(추정 사용 등). */
  warnings: string[];
}

/** 반올림 정책 — 수수료의 소수 원 처리. */
export type RoundingMode = "floor" | "round" | "ceil";

/** 정산 정책(요율표 + 계산 규칙). */
export interface SettlementPolicy {
  /** 사업자 매출등급 (주문관리수수료 요율 결정). */
  grade: MerchantGrade;
  /** 기본 유입경로 (상품주문에 없을 때). */
  defaultChannelPath: SalesChannelPath;
  /** 정산 방식. */
  settlementType: SettlementType;
  /** 수수료 소수 원 반올림 정책. 기본 floor(원단위 절사). */
  rounding: RoundingMode;
  /** 빠른정산 선지급 비율(0~1). 기본 0.9. */
  fastSettlementAdvanceRatio: number;
  /** 자동 구매확정까지의 일수(배송완료 기준). 기본 8. */
  autoConfirmDays: number;
  /** 공휴일 목록(ISO yyyy-mm-dd). 영업일 계산에 사용. */
  holidays: string[];
}
