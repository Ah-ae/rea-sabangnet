import { NextResponse } from "next/server";
import { processCsv, type ProcessOptions } from "../../../src/service/process.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  ordersCsv?: string;
  actualCsv?: string;
  options?: ProcessOptions;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON 본문을 해석할 수 없습니다." }, { status: 400 });
  }

  if (!body.ordersCsv || body.ordersCsv.trim() === "") {
    return NextResponse.json({ error: "ordersCsv(주문 CSV)가 필요합니다." }, { status: 400 });
  }

  try {
    const result = processCsv(body.ordersCsv, body.actualCsv, body.options ?? {});
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
