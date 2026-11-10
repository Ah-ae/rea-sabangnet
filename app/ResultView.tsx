import type { ProcessResult } from "../src/service/process.js";

const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const signed = (n: number) => (n > 0 ? "+" : "") + n.toLocaleString("ko-KR") + "원";

export function ResultView({ r }: { r: ProcessResult }) {
  const t = r.totals;
  return (
    <>
      <section className="panel">
        <h2>요약 ({r.options.grade} · {r.options.settlementType} · {r.options.channelPath})</h2>
        <div className="kpi">
          <div className="card"><div className="k">정산대상</div><div className="v">{t.count}건</div></div>
          <div className="card"><div className="k">매출총액</div><div className="v">{won(t.grossSales)}</div></div>
          <div className="card"><div className="k">총 공제</div><div className="v">{won(t.totalFee)}</div></div>
          <div className="card"><div className="k">순정산액</div><div className="v">{won(t.netSettlement)}</div></div>
        </div>
        {r.skippedIds.length > 0 && (
          <p className="footnote">제외(취소/반품/교환) {r.skippedIds.length}건: {r.skippedIds.join(", ")}</p>
        )}
      </section>

      <section className="panel">
        <h2>상품주문별 정산내역</h2>
        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th>상품주문번호</th><th>상품명</th><th>결제금액</th>
                <th>주문관리수수료</th><th>판매수수료</th><th>기타공제</th>
                <th>정산예정액</th><th>정산예정일</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l) => {
                const om = l.fees.filter((f) => f.kind === "주문관리수수료").reduce((s, f) => s + f.amount, 0);
                const sale = l.fees.filter((f) => f.kind === "판매수수료").reduce((s, f) => s + f.amount, 0);
                const etc = l.fees.filter((f) => f.kind === "기타공제").reduce((s, f) => s + f.amount, 0);
                return (
                  <tr key={l.productOrderId}>
                    <td className="mono">{l.productOrderId}</td>
                    <td>{l.productName ?? "-"}</td>
                    <td>{won(l.paymentAmount)}</td>
                    <td className="muted">-{won(om)}</td>
                    <td className="muted">-{won(sale)}</td>
                    <td className="muted">{etc ? "-" + won(etc) : "-"}</td>
                    <td><strong>{won(l.settlementAmount)}</strong></td>
                    <td className="mono">{l.settlementDueDate || "미정"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {r.warnings.length > 0 && (
          <div className="warnbox">
            {r.warnings.map((w) => (
              <div key={w.productOrderId}>⚠ {w.productOrderId}: {w.messages.join(" / ")}</div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>월별 집계 (정산예정일 기준)</h2>
        <div className="tableScroll">
          <table>
            <thead>
              <tr><th>기간</th><th>건수</th><th>매출총액</th><th>주문관리수수료</th><th>판매수수료</th><th>순정산액</th></tr>
            </thead>
            <tbody>
              {r.monthly.map((b) => (
                <tr key={b.period}>
                  <td className="mono">{b.period}</td>
                  <td>{b.count}</td>
                  <td>{won(b.grossSales)}</td>
                  <td className="muted">{won(b.orderManagementFee)}</td>
                  <td className="muted">{won(b.salesFee)}</td>
                  <td><strong>{won(b.netSettlement)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {r.reconcile && (
        <section className="panel">
          <h2>정산 대사 (예상 vs 실제)</h2>
          <div className="kpi">
            <div className="card"><div className="k">일치</div><div className="v">{r.reconcile.summary.matched}</div></div>
            <div className="card"><div className="k">금액불일치</div><div className="v">{r.reconcile.summary.amountDiff}</div></div>
            <div className="card"><div className="k">미지급</div><div className="v">{r.reconcile.summary.missing}</div></div>
            <div className="card"><div className="k">예상밖</div><div className="v">{r.reconcile.summary.unexpected}</div></div>
          </div>
          <p className="footnote">
            순차이(실제−예상):{" "}
            <span className={r.reconcile.summary.netDiff === 0 ? "" : r.reconcile.summary.netDiff > 0 ? "pos" : "neg"}>
              {signed(r.reconcile.summary.netDiff)}
            </span>
          </p>
          <div className="tableScroll">
            <table>
              <thead>
                <tr><th>상품주문번호</th><th>상태</th><th>예상</th><th>실제</th><th>차이</th></tr>
              </thead>
              <tbody>
                {r.reconcile.rows.map((row) => (
                  <tr key={row.productOrderId}>
                    <td className="mono">{row.productOrderId}</td>
                    <td><span className={`tag ${row.status}`}>{row.status}</span></td>
                    <td>{row.expectedAmount == null ? "-" : won(row.expectedAmount)}</td>
                    <td>{row.actualAmount == null ? "-" : won(row.actualAmount)}</td>
                    <td className={row.diff == null ? "" : row.diff === 0 ? "" : row.diff > 0 ? "pos" : "neg"}>
                      {row.diff == null ? "-" : signed(row.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
