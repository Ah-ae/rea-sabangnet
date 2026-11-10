/**
 * 의존성 없는 소형 CSV 파서/직렬화기.
 *
 * - 쉼표 구분, 큰따옴표 인용, 인용 내 쉼표/개행/이스케이프("") 지원.
 * - BOM 제거, CRLF/CR/LF 개행 모두 허용.
 * 스마트스토어 엑셀 다운로드를 CSV로 저장한 파일을 다루기에 충분한 수준.
 */

/** CSV 텍스트를 레코드 배열(헤더 기준 객체)로 파싱. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    // 전부 빈 줄은 건너뜀.
    if (row.length === 1 && row[0] === "") continue;
    const rec: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      rec[header[c]!] = (row[c] ?? "").trim();
    }
    out.push(rec);
  }
  return out;
}

/** CSV를 2차원 셀 배열로 파싱(헤더 해석 없음). */
export function parseRows(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input; // strip BOM
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      // CRLF 처리: \r 다음 \n은 한 번만.
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += ch;
    }
  }
  // 마지막 필드/행 flush.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 객체 배열을 CSV 문자열로 직렬화. */
export function toCsv(records: readonly Record<string, unknown>[], headers?: string[]): string {
  if (records.length === 0) return (headers ?? []).join(",") + "\n";
  const cols = headers ?? Object.keys(records[0]!);
  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(",")];
  for (const rec of records) {
    lines.push(cols.map((c) => esc(rec[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

/** "1,234", "₩1,200", "3.63%", 빈칸 등을 숫자로 관대하게 파싱. 실패 시 fallback. */
export function parseNumber(raw: string | undefined, fallback = 0): number {
  if (raw == null) return fallback;
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}
