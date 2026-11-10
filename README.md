# triggerfish — 스마트스토어 매출 정산 엔진

사방넷(sabangnet) **정산관리** 기능을 참고해 구현한, 네이버 스마트스토어 **매출 정산/대사(reconciliation)** 코어입니다. TypeScript + Node, 외부 런타임 의존성은 `zod`뿐이며 정산 계산·대사·집계는 순수 도메인 로직으로 분리돼 있습니다.

---

## 1. 조사 결과 — 사방넷은 어떻게 동작하는가 (근거 기반)

`rea`(Reverse Engineer Anything, MCP)와 Chrome DevTools Protocol로 **실제 제품 도메인**을 관찰해 확인한 사실입니다.

### 1-1. "Windows 전용 설치 프로그램"이라는 통념은 현재 제품(사방넷 2.0)에 맞지 않음

| 확인 항목 | 근거 |
|---|---|
| rea가 사방넷 페이지 타깃 인식 | `rea list-browser-targets` → `evidence_id: ev_e8ff06dd…`, target title "사방넷 - No.1 쇼핑몰 통합관리…" |
| rea 수동 관찰 | `rea inspect-web-page` (CDP observation provider v2) |
| 설치 불필요 명시 | 창고관리 소개 페이지 문구: **"설치도, 연동도 필요 없어요"** |
| 설치 바이너리 없음 | 관리자 콘솔 `sbadmin01.sabangnet.co.kr`은 미로그인 시 웹 로그인으로 리다이렉트. `<object>`/ActiveX, `.exe`/`.msi` 다운로드 **없음** |
| 프런트엔드 스택 | Vue SPA (`app.*.js`, `chunk-vendors.*.js`, `cmn-ui-core.3.8.2.min.js`) |

→ 과거 사방넷 1.0은 IE/ActiveX(송장출력·엑셀 모듈)에 의존했으나, **현재는 브라우저 기반 SaaS**입니다. 설치형 흔적은 원격지원(ezHelp)과 로컬 송장 프린터 모듈 정도입니다.

### 1-2. 사방넷의 실제 동작 구조 (멀티채널 OMS/WMS)

- **채널 계정 등록** → 700개 쇼핑몰 주문을 **통합 수집** → 단일 주문 스키마로 정규화
- **상품 통합등록**: 마스터 상품 1건 → 다채널 일괄 등록/수정
- **재고 동기화**: SKU 단위 단일 재고풀, 스케줄러가 **10분마다** 각 채널과 자동 동기화
- **송장 전송**: 택배 송장번호를 각 쇼핑몰에 자동 역전송
- **정산관리**: 쇼핑몰별 판매액/수수료/정산예정액을 집계·대사 ← **본 프로젝트가 구현한 영역**

> 출처: 사방넷 공식 사이트(service-intro/*), NHN커머스·카페24 앱스토어 리스팅.

### 1-3. 스마트스토어 정산 규칙 (구현 근거)

- **정산 주기**: 일반정산 = 구매확정 +1영업일 / 빠른정산 = 집화 +1영업일(판매대금 90% 선지급) / 자동 구매확정 = 배송완료 +8일
- **수수료(2025.6 개편 후)**
  - 네이버페이 **주문관리수수료**(매출등급별, VAT 포함): 영세 1.98% · 중소1 2.585% · 중소2 2.75% · 중소3 3.025% · 일반 3.63%
  - **판매수수료**(유입경로별, VAT 별도): 네이버쇼핑 2.73% · 자체유입 0.91%
- **정산액 = 결제금액 − 주문관리수수료 − 판매수수료 − 기타공제**

> 요율은 변동될 수 있어 `src/domain/fees.ts`의 요율표를 **설정값**으로 분리했습니다. 운영 시 공식 공지로 갱신하세요.

---

## 2. 구현한 핵심 기능

```
src/
  domain/
    types.ts          도메인 타입 (ProductOrder, SettlementLine, FeeLine, SettlementPolicy…)
    businessDays.ts   영업일 계산 (주말·공휴일 skip, KR 공휴일 2025–2026 시드)
    fees.ts           수수료 요율표 + 계산 (주문관리/판매/기타공제, VAT·반올림 정책)
    settlement.ts     정산 계산 (정산예정액·정산예정일, 일반/빠른정산, 자동확정 추정)
    reconcile.ts      정산 대사 (예상 vs 실제: matched/amount_diff/missing/unexpected)
    aggregate.ts      기간별 집계 (일별·월별 매출·수수료·순정산액)
    policy.ts         정책 팩토리 (기본값 + override)
  io/
    csv.ts            의존성 없는 CSV 파서/직렬화기
    smartstore.ts     스마트스토어 엑셀/CSV 한글 헤더 → 도메인 매핑
  cli.ts              settle / report / reconcile 명령
  index.ts            공개 API
```

## 3. 사용법

```bash
npm install
npm test            # 45 tests
npm run typecheck

# 정산 계산
npx tsx src/cli.ts settle fixtures/orders.csv

# 기간별 리포트 (일별/월별)
npx tsx src/cli.ts report fixtures/orders.csv --by month

# 예상 vs 실제 정산 대사
npx tsx src/cli.ts reconcile fixtures/orders.csv fixtures/actual-settlements.csv
```

공통 옵션: `--grade 영세|중소1|중소2|중소3|일반` · `--path 네이버쇼핑|자체유입` · `--type 일반정산|빠른정산` · `--rounding floor|round|ceil` · `--json`

### 프로그램 API

```ts
import { parseOrders, settleMany, reconcile, aggregate, makePolicy } from "triggerfish";

const policy = makePolicy({ grade: "중소1", settlementType: "빠른정산" });
const { lines } = settleMany(parseOrders(csvText), policy);
const monthly = aggregate(lines, "month");
const report = reconcile(lines, actualSettlements, /* tolerance */ 0);
```

## 4. 입력 포맷

스마트스토어 판매자센터의 **주문/배송** 및 **정산내역** 엑셀을 CSV로 저장해 사용합니다. 헤더는 유연하게 인식합니다(예: `상품주문번호`, `결제금액`/`정산기준금액`, `구매확정일`, `주문상태`, 정산내역의 `정산금액`). 샘플은 `fixtures/` 참고.

## 5. 설계 노트

- **금액은 원(KRW) 정수**로 다루며, 수수료의 소수 원은 `rounding`(기본 `floor`, 원단위 절사)으로 정리.
- 정산예정일은 **영업일 기준**이라 주말·공휴일을 건너뜁니다. 공휴일 목록은 정책에서 교체 가능.
- 취소/반품/교환 주문은 정산 대상에서 제외하고 `skipped`로 분리.
- 구매확정일이 없으면 배송완료 +8일 자동확정으로 **추정**하고 `warnings`에 남깁니다.
- 멀티채널 확장: `SalesChannelPath`/요율표/파서를 채널별로 추가하면 쿠팡·11번가 등으로 확장 가능(사방넷식 통합 정산).

## 6. 한계 / 다음 단계

- 요율·공휴일은 시드값 — 운영 반영 전 공식 공지로 갱신 필요.
- 복수구매할인·즉시할인·포인트 등 **정산 기준 금액 산정**은 입력 `paymentAmount`에 이미 반영됐다고 가정.
- 실제 스마트스토어 **커머스 API** 연동(주문 수집/정산내역 자동 다운로드)은 미포함 — CSV 임포트로 대체. 다음 단계로 API 어댑터를 `io/`에 추가 가능.
