/**
 * 영업일(business day) 계산.
 *
 * 정산예정일은 "구매확정 +N 영업일"처럼 영업일 기준으로 산출되므로,
 * 주말과 공휴일을 건너뛰는 로직이 필요하다.
 *
 * 날짜는 모두 ISO `yyyy-mm-dd` 문자열로 다루고, 내부적으로 UTC 자정 기준
 * Date로 변환해 타임존 드리프트를 피한다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** ISO 날짜 문자열을 UTC 자정 Date로 파싱. 형식이 틀리면 throw. */
export function parseISODate(iso: string): Date {
  if (!ISO_DATE.test(iso)) {
    throw new Error(`잘못된 날짜 형식(yyyy-mm-dd 이어야 함): ${iso}`);
  }
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`유효하지 않은 날짜: ${iso}`);
  }
  return d;
}

/** UTC Date를 ISO `yyyy-mm-dd`로 포맷. */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 주말(토=6, 일=0) 여부. */
export function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** 영업일 여부(주말/공휴일 제외). */
export function isBusinessDay(iso: string, holidays: ReadonlySet<string>): boolean {
  const d = parseISODate(iso);
  return !isWeekend(d) && !holidays.has(iso);
}

/**
 * `start`로부터 `n` 영업일 뒤의 날짜를 반환.
 * n=1 이면 start 다음 영업일. start 자체가 영업일인지는 무관하며, 항상 "뒤"로 센다.
 */
export function addBusinessDays(
  startIso: string,
  n: number,
  holidays: ReadonlySet<string>,
): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`영업일 수는 0 이상의 정수여야 함: ${n}`);
  }
  let cursor = parseISODate(startIso);
  let remaining = n;
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    const iso = toISODate(cursor);
    if (!isWeekend(cursor) && !holidays.has(iso)) {
      remaining -= 1;
    }
  }
  return toISODate(cursor);
}

/** `startIso`에 달력일(calendar days) `n`일을 더한 ISO 날짜. */
export function addCalendarDays(startIso: string, n: number): string {
  const d = parseISODate(startIso);
  return toISODate(new Date(d.getTime() + n * DAY_MS));
}

/**
 * 대한민국 공휴일 기본 시드(2025–2026, 대체공휴일 포함 주요 일자).
 * 정책에서 교체/확장 가능하도록 별도 상수로 제공한다.
 * 참고: 실제 운영에서는 매년 관보 기준으로 갱신해야 한다.
 */
export const KR_HOLIDAYS_2025_2026: readonly string[] = [
  // 2025
  "2025-01-01", // 신정
  "2025-01-28", "2025-01-29", "2025-01-30", // 설 연휴
  "2025-03-01", // 삼일절
  "2025-03-03", // 삼일절 대체
  "2025-05-05", // 어린이날/부처님오신날
  "2025-05-06", // 대체공휴일
  "2025-06-06", // 현충일
  "2025-08-15", // 광복절
  "2025-10-03", // 개천절
  "2025-10-06", "2025-10-07", "2025-10-08", // 추석 연휴
  "2025-10-09", // 한글날
  "2025-12-25", // 성탄절
  // 2026
  "2026-01-01", // 신정
  "2026-02-16", "2026-02-17", "2026-02-18", // 설 연휴
  "2026-03-01", // 삼일절
  "2026-03-02", // 삼일절 대체
  "2026-05-05", // 어린이날
  "2026-05-24", // 부처님오신날
  "2026-05-25", // 대체공휴일
  "2026-06-06", // 현충일
  "2026-08-15", // 광복절
  "2026-08-17", // 광복절 대체
  "2026-09-24", "2026-09-25", "2026-09-26", // 추석 연휴
  "2026-10-03", // 개천절
  "2026-10-05", // 개천절 대체
  "2026-10-09", // 한글날
  "2026-12-25", // 성탄절
];
