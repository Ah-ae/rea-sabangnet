import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  addCalendarDays,
  isBusinessDay,
  isWeekend,
  parseISODate,
  toISODate,
} from "../src/domain/businessDays.js";

const holidays = new Set(["2026-01-01"]);

describe("businessDays", () => {
  it("주말을 인식한다", () => {
    expect(isWeekend(parseISODate("2026-01-10"))).toBe(true); // 토
    expect(isWeekend(parseISODate("2026-01-11"))).toBe(true); // 일
    expect(isWeekend(parseISODate("2026-01-12"))).toBe(false); // 월
  });

  it("공휴일/주말은 영업일이 아니다", () => {
    expect(isBusinessDay("2026-01-01", holidays)).toBe(false); // 공휴일(목)
    expect(isBusinessDay("2026-01-02", holidays)).toBe(true); // 금
    expect(isBusinessDay("2026-01-03", holidays)).toBe(false); // 토
  });

  it("금요일 +1 영업일은 (주말 건너뛴) 월요일", () => {
    // 2026-01-02 금 → +1영업일 → 2026-01-05 월
    expect(addBusinessDays("2026-01-02", 1, holidays)).toBe("2026-01-05");
  });

  it("공휴일을 건너뛴다", () => {
    // 2025-12-31 수 → +1영업일, 2026-01-01(공휴일 목) 건너뜀 → 2026-01-02 금
    expect(addBusinessDays("2025-12-31", 1, holidays)).toBe("2026-01-02");
  });

  it("n=0 이면 같은 날", () => {
    expect(addBusinessDays("2026-01-05", 0, holidays)).toBe("2026-01-05");
  });

  it("여러 영업일 누적", () => {
    // 월(1/5)에서 +5영업일 → 다음주 월(1/12)
    expect(addBusinessDays("2026-01-05", 5, holidays)).toBe("2026-01-12");
  });

  it("달력일 덧셈", () => {
    expect(addCalendarDays("2026-01-30", 2)).toBe("2026-02-01");
  });

  it("잘못된 날짜 형식은 throw", () => {
    expect(() => parseISODate("2026/01/01")).toThrow();
    expect(() => parseISODate("not-a-date")).toThrow();
  });

  it("toISODate 라운드트립", () => {
    expect(toISODate(parseISODate("2026-07-15"))).toBe("2026-07-15");
  });
});
