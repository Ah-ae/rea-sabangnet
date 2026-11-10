"use client";

import { useState } from "react";
import type { ProcessOptions, ProcessResult } from "../src/service/process.js";
import { SAMPLE_ACTUAL_CSV, SAMPLE_ORDERS_CSV } from "../src/service/samples.js";
import { ResultView } from "./ResultView.js";

const GRADES = ["영세", "중소1", "중소2", "중소3", "일반"] as const;
const PATHS = ["네이버쇼핑", "자체유입"] as const;
const TYPES = ["일반정산", "빠른정산"] as const;

export default function Page() {
  const [ordersCsv, setOrdersCsv] = useState("");
  const [actualCsv, setActualCsv] = useState("");
  const [opts, setOpts] = useState<Required<Pick<ProcessOptions, "grade" | "channelPath" | "settlementType">>>({
    grade: "영세",
    channelPath: "네이버쇼핑",
    settlementType: "일반정산",
  });
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSample = () => {
    setOrdersCsv(SAMPLE_ORDERS_CSV);
    setActualCsv(SAMPLE_ACTUAL_CSV);
    setError("");
  };

  const readFile = (file: File, set: (s: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => set(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  };

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordersCsv, actualCsv: actualCsv || undefined, options: opts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `오류 (${res.status})`);
      setResult(data as ProcessResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <header>
        <h1>스마트스토어 매출 정산 · 대사</h1>
        <p>
          주문 CSV를 넣으면 수수료를 차감한 정산예정액·정산예정일을 계산하고, 정산내역 CSV를 추가하면
          예상과 실제를 대사합니다. 계산은 서버 API(<code>/api/process</code>)에서 수행됩니다.
        </p>
      </header>

      <section className="panel">
        <h2>입력</h2>
        <div className="grid">
          <div>
            <label>주문 CSV (상품주문번호·결제금액·구매확정일 등) *</label>
            <textarea value={ordersCsv} onChange={(e) => setOrdersCsv(e.target.value)} placeholder="스마트스토어 주문/배송 엑셀을 CSV로 저장해 붙여넣기" />
            <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setOrdersCsv)} style={{ marginTop: 8 }} />
          </div>
          <div>
            <label>정산내역 CSV (선택 — 대사용)</label>
            <textarea value={actualCsv} onChange={(e) => setActualCsv(e.target.value)} placeholder="스마트스토어 정산내역 엑셀을 CSV로 저장해 붙여넣기" />
            <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setActualCsv)} style={{ marginTop: 8 }} />
          </div>
        </div>

        <div className="controls">
          <div>
            <label>사업자 매출등급</label>
            <select value={opts.grade} onChange={(e) => setOpts({ ...opts, grade: e.target.value as typeof opts.grade })}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label>기본 유입경로</label>
            <select value={opts.channelPath} onChange={(e) => setOpts({ ...opts, channelPath: e.target.value as typeof opts.channelPath })}>
              {PATHS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label>정산 방식</label>
            <select value={opts.settlementType} onChange={(e) => setOpts({ ...opts, settlementType: e.target.value as typeof opts.settlementType })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="row-btns">
          <button onClick={run} disabled={busy || !ordersCsv.trim()}>{busy ? "계산 중…" : "정산 계산"}</button>
          <button className="ghost" onClick={loadSample} disabled={busy}>샘플 불러오기</button>
        </div>
        {error && <div className="err">⚠ {error}</div>}
      </section>

      {result && <ResultView r={result} />}
    </div>
  );
}
