/**
 * 정적 웹 데모 (GitHub Pages).
 * 서버 없이 브라우저에서 동일한 정산 엔진(processCsv)을 직접 실행한다.
 */
import { processCsv, type ProcessResult } from "../src/service/process.js";
import { SAMPLE_ACTUAL_CSV, SAMPLE_ORDERS_CSV } from "../src/service/samples.js";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const signed = (n: number) => (n > 0 ? "+" : "") + n.toLocaleString("ko-KR") + "원";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

function render(r: ProcessResult): string {
  const t = r.totals;
  const feeSum = (l: ProcessResult["lines"][number], kind: string) =>
    l.fees.filter((f) => f.kind === kind).reduce((s, f) => s + f.amount, 0);

  const lineRows = r.lines
    .map(
      (l) => `<tr>
        <td class="mono">${esc(l.productOrderId)}</td>
        <td>${esc(l.productName ?? "-")}</td>
        <td>${won(l.paymentAmount)}</td>
        <td class="muted">-${won(feeSum(l, "주문관리수수료"))}</td>
        <td class="muted">-${won(feeSum(l, "판매수수료"))}</td>
        <td><strong>${won(l.settlementAmount)}</strong></td>
        <td class="mono">${l.settlementDueDate || "미정"}</td></tr>`,
    )
    .join("");

  const monthRows = r.monthly
    .map(
      (b) => `<tr><td class="mono">${esc(b.period)}</td><td>${b.count}</td><td>${won(b.grossSales)}</td>
        <td class="muted">${won(b.orderManagementFee)}</td><td class="muted">${won(b.salesFee)}</td>
        <td><strong>${won(b.netSettlement)}</strong></td></tr>`,
    )
    .join("");

  let reconcileHtml = "";
  if (r.reconcile) {
    const s = r.reconcile.summary;
    const rows = r.reconcile.rows
      .map(
        (row) => `<tr><td class="mono">${esc(row.productOrderId)}</td>
          <td><span class="tag ${row.status}">${row.status}</span></td>
          <td>${row.expectedAmount == null ? "-" : won(row.expectedAmount)}</td>
          <td>${row.actualAmount == null ? "-" : won(row.actualAmount)}</td>
          <td class="${row.diff == null || row.diff === 0 ? "" : row.diff > 0 ? "pos" : "neg"}">${row.diff == null ? "-" : signed(row.diff)}</td></tr>`,
      )
      .join("");
    reconcileHtml = `<section class="panel"><h2>정산 대사 (예상 vs 실제)</h2>
      <div class="kpi">
        <div class="card"><div class="k">일치</div><div class="v">${s.matched}</div></div>
        <div class="card"><div class="k">금액불일치</div><div class="v">${s.amountDiff}</div></div>
        <div class="card"><div class="k">미지급</div><div class="v">${s.missing}</div></div>
        <div class="card"><div class="k">예상밖</div><div class="v">${s.unexpected}</div></div>
      </div>
      <p class="footnote">순차이(실제−예상): <span class="${s.netDiff === 0 ? "" : s.netDiff > 0 ? "pos" : "neg"}">${signed(s.netDiff)}</span></p>
      <div class="tableScroll"><table><thead><tr><th>상품주문번호</th><th>상태</th><th>예상</th><th>실제</th><th>차이</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>`;
  }

  const warnHtml = r.warnings.length
    ? `<div class="warnbox">${r.warnings.map((w) => `⚠ ${esc(w.productOrderId)}: ${esc(w.messages.join(" / "))}`).join("<br>")}</div>`
    : "";

  return `
    <section class="panel"><h2>요약 (${r.options.grade} · ${r.options.settlementType} · ${r.options.channelPath})</h2>
      <div class="kpi">
        <div class="card"><div class="k">정산대상</div><div class="v">${t.count}건</div></div>
        <div class="card"><div class="k">매출총액</div><div class="v">${won(t.grossSales)}</div></div>
        <div class="card"><div class="k">총 공제</div><div class="v">${won(t.totalFee)}</div></div>
        <div class="card"><div class="k">순정산액</div><div class="v">${won(t.netSettlement)}</div></div>
      </div>
      ${r.skippedIds.length ? `<p class="footnote">제외(취소/반품/교환) ${r.skippedIds.length}건: ${esc(r.skippedIds.join(", "))}</p>` : ""}
    </section>
    <section class="panel"><h2>상품주문별 정산내역</h2>
      <div class="tableScroll"><table><thead><tr><th>상품주문번호</th><th>상품명</th><th>결제금액</th><th>주문관리수수료</th><th>판매수수료</th><th>정산예정액</th><th>정산예정일</th></tr></thead><tbody>${lineRows}</tbody></table></div>
      ${warnHtml}
    </section>
    <section class="panel"><h2>월별 집계 (정산예정일 기준)</h2>
      <div class="tableScroll"><table><thead><tr><th>기간</th><th>건수</th><th>매출총액</th><th>주문관리수수료</th><th>판매수수료</th><th>순정산액</th></tr></thead><tbody>${monthRows}</tbody></table></div>
    </section>
    ${reconcileHtml}`;
}

function run() {
  const ordersCsv = $<HTMLTextAreaElement>("orders").value;
  const actualCsv = $<HTMLTextAreaElement>("actual").value;
  const out = $("output");
  const err = $("error");
  err.textContent = "";
  out.innerHTML = "";
  try {
    const result = processCsv(ordersCsv, actualCsv || undefined, {
      grade: $<HTMLSelectElement>("grade").value as never,
      channelPath: $<HTMLSelectElement>("path").value as never,
      settlementType: $<HTMLSelectElement>("type").value as never,
    });
    out.innerHTML = render(result);
  } catch (e) {
    err.textContent = "⚠ " + (e instanceof Error ? e.message : String(e));
  }
}

function init() {
  $("runBtn").addEventListener("click", run);
  $("sampleBtn").addEventListener("click", () => {
    $<HTMLTextAreaElement>("orders").value = SAMPLE_ORDERS_CSV;
    $<HTMLTextAreaElement>("actual").value = SAMPLE_ACTUAL_CSV;
  });
  const bindFile = (inputId: string, targetId: string) => {
    $<HTMLInputElement>(inputId).addEventListener("change", (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => ($<HTMLTextAreaElement>(targetId).value = String(reader.result ?? ""));
      reader.readAsText(file, "utf-8");
    });
  };
  bindFile("ordersFile", "orders");
  bindFile("actualFile", "actual");
}

document.addEventListener("DOMContentLoaded", init);
