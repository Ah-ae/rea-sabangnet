#!/usr/bin/env node
/**
 * triggerfish CLI — 스마트스토어 매출 정산.
 *
 * 사용법:
 *   triggerfish settle   <orders.csv> [--grade 영세] [--path 네이버쇼핑] [--type 일반정산] [--json]
 *   triggerfish report   <orders.csv> [--by day|month] [--grade ...] [--json]
 *   triggerfish reconcile <orders.csv> <actual.csv> [--tolerance 0] [--grade ...] [--json]
 *
 * 옵션:
 *   --grade     영세|중소1|중소2|중소3|일반   (기본 영세)
 *   --path      네이버쇼핑|자체유입            (기본 네이버쇼핑)
 *   --type      일반정산|빠른정산              (기본 일반정산)
 *   --rounding  floor|round|ceil              (기본 floor)
 *   --by        day|month                     (report 전용, 기본 day)
 *   --tolerance 허용오차(원)                   (reconcile 전용, 기본 0)
 *   --json      JSON 출력
 */

import { readFileSync } from "node:fs";
import { aggregate, totals } from "./domain/aggregate.js";
import { makePolicy } from "./domain/policy.js";
import { reconcile } from "./domain/reconcile.js";
import { settleMany } from "./domain/settlement.js";
import type { MerchantGrade, SalesChannelPath, SettlementType, RoundingMode } from "./domain/types.js";
import { parseActualSettlements, parseOrders } from "./io/smartstore.js";

interface Args {
  _: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

function policyFromFlags(flags: Record<string, string | boolean>) {
  return makePolicy({
    grade: (flags.grade as MerchantGrade) || "영세",
    defaultChannelPath: (flags.path as SalesChannelPath) || "네이버쇼핑",
    settlementType: (flags.type as SettlementType) || "일반정산",
    rounding: (flags.rounding as RoundingMode) || "floor",
  });
}

function read(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    console.error(`파일을 읽을 수 없습니다: ${path}`);
    process.exit(1);
  }
}

function cmdSettle(args: Args) {
  const file = args._[1];
  if (!file) return usageExit();
  const policy = policyFromFlags(args.flags);
  const orders = parseOrders(read(file));
  const { lines, skipped } = settleMany(orders, policy);

  if (args.flags.json) {
    console.log(JSON.stringify({ lines, skipped: skipped.map((o) => o.productOrderId) }, null, 2));
    return;
  }

  console.log(`\n■ 정산 계산 (${policy.grade} / ${policy.settlementType} / ${policy.defaultChannelPath})`);
  console.log(`  대상 ${lines.length}건, 제외(취소/반품/교환) ${skipped.length}건\n`);
  for (const l of lines) {
    console.log(`· ${l.productOrderId} ${l.productName ?? ""}`.trimEnd());
    console.log(`    결제 ${won(l.paymentAmount)}  →  정산 ${won(l.settlementAmount)}  (예정일 ${l.settlementDueDate || "미정"})`);
    for (const f of l.fees) {
      console.log(`      - ${f.label}: -${won(f.amount)}`);
    }
    for (const w of l.warnings) console.log(`      ⚠ ${w}`);
  }
  const t = totals(lines);
  console.log(`\n  합계: 매출 ${won(t.grossSales)}  공제 ${won(t.totalFee)}  순정산 ${won(t.netSettlement)}`);
}

function cmdReport(args: Args) {
  const file = args._[1];
  if (!file) return usageExit();
  const policy = policyFromFlags(args.flags);
  const by = (args.flags.by as string) === "month" ? "month" : "day";
  const orders = parseOrders(read(file));
  const { lines } = settleMany(orders, policy);
  const buckets = aggregate(lines, by);

  if (args.flags.json) {
    console.log(JSON.stringify({ granularity: by, buckets, totals: totals(lines) }, null, 2));
    return;
  }

  console.log(`\n■ 기간별 정산 리포트 (${by === "month" ? "월별" : "일별"}, 정산예정일 기준)\n`);
  const head = ["기간", "건수", "매출총액", "주문관리수수료", "판매수수료", "기타공제", "순정산액"];
  console.log(head.join("\t"));
  for (const b of buckets) {
    console.log([b.period, b.count, b.grossSales, b.orderManagementFee, b.salesFee, b.otherDeduction, b.netSettlement].join("\t"));
  }
  const t = totals(lines);
  console.log(["합계", t.count, t.grossSales, t.orderManagementFee, t.salesFee, t.otherDeduction, t.netSettlement].join("\t"));
}

function cmdReconcile(args: Args) {
  const ordersFile = args._[1];
  const actualFile = args._[2];
  if (!ordersFile || !actualFile) return usageExit();
  const policy = policyFromFlags(args.flags);
  const tolerance = Number(args.flags.tolerance ?? 0) || 0;

  const { lines } = settleMany(parseOrders(read(ordersFile)), policy);
  const actual = parseActualSettlements(read(actualFile));
  const report = reconcile(lines, actual, tolerance);

  if (args.flags.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n■ 정산 대사 (허용오차 ${won(tolerance)})\n`);
  const s = report.summary;
  console.log(`  총 ${s.total}건 | 일치 ${s.matched} | 금액불일치 ${s.amountDiff} | 미지급 ${s.missing} | 예상밖 ${s.unexpected}`);
  console.log(`  순차이(실제−예상): ${won(s.netDiff)}\n`);
  const problems = report.rows.filter((r) => r.status !== "matched");
  if (problems.length === 0) {
    console.log("  ✓ 모든 건이 예상과 일치합니다.");
    return;
  }
  console.log("  ▸ 불일치 내역:");
  for (const r of problems) {
    const exp = r.expectedAmount == null ? "-" : won(r.expectedAmount);
    const act = r.actualAmount == null ? "-" : won(r.actualAmount);
    const diff = r.diff == null ? "" : ` (차이 ${won(r.diff)})`;
    console.log(`    [${r.status}] ${r.productOrderId}  예상 ${exp} / 실제 ${act}${diff}`);
  }
}

function usageExit(): never {
  console.log(
    `triggerfish — 스마트스토어 매출 정산\n\n` +
      `  settle    <orders.csv>                정산 계산\n` +
      `  report    <orders.csv> [--by day|month]   기간별 리포트\n` +
      `  reconcile <orders.csv> <actual.csv>   예상 vs 실제 대사\n\n` +
      `공통 옵션: --grade 영세|중소1|중소2|중소3|일반  --path 네이버쇼핑|자체유입\n` +
      `           --type 일반정산|빠른정산  --rounding floor|round|ceil  --json`,
  );
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  switch (args._[0]) {
    case "settle":
      return cmdSettle(args);
    case "report":
      return cmdReport(args);
    case "reconcile":
      return cmdReconcile(args);
    default:
      return usageExit();
  }
}

main();
