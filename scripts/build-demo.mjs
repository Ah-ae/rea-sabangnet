// 정적 데모 빌드: web-demo/main.ts 를 브라우저 번들로 묶고 docs/ 에 정적 사이트를 생성.
// GitHub Pages 는 docs/ 를 그대로 서빙한다.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docs = resolve(root, "docs");
mkdirSync(resolve(docs, "assets"), { recursive: true });

// src/ 의 ESM ".js" import 지정자를 실제 ".ts" 파일로 해석하는 esbuild 플러그인.
const jsToTs = {
  name: "js-to-ts",
  setup(b) {
    b.onResolve({ filter: /\.js$/ }, (args) => {
      if (!args.path.startsWith(".")) return undefined;
      const tsPath = resolve(dirname(args.importer), args.path.replace(/\.js$/, ".ts"));
      if (existsSync(tsPath)) return { path: tsPath };
      return undefined;
    });
  },
};

await build({
  entryPoints: [resolve(root, "web-demo/main.ts")],
  outfile: resolve(docs, "assets/demo.js"),
  bundle: true,
  format: "esm",
  target: ["es2020"],
  minify: true,
  sourcemap: false,
  plugins: [jsToTs],
  logLevel: "info",
});

// 스타일: 앱의 globals.css 재사용 + 데모 폼 전용 보강.
const baseCss = readFileSync(resolve(root, "app/globals.css"), "utf8");
const demoCss = `
.file { margin-top: 8px; font-size: 12px; color: var(--muted); }
code { font-family: var(--mono); background: var(--panel-2); padding: 1px 5px; border-radius: 4px; }
.badge { display:inline-block; font-size:11px; color:var(--muted); border:1px solid var(--border); border-radius:999px; padding:2px 10px; margin-bottom:10px;}
`;
writeFileSync(resolve(docs, "assets/styles.css"), baseCss + demoCss);

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>스마트스토어 매출 정산 — 데모 (rea-sabangnet)</title>
<meta name="description" content="사방넷 정산관리를 참고한 스마트스토어 매출 정산/대사 데모. 브라우저에서 바로 계산됩니다.">
<link rel="stylesheet" href="./assets/styles.css">
</head>
<body>
<div class="wrap">
  <header>
    <span class="badge">GitHub Pages · 100% 클라이언트 계산 (서버 없음)</span>
    <h1>스마트스토어 매출 정산 · 대사 <span class="muted">데모</span></h1>
    <p>주문 CSV의 결제금액에서 수수료를 차감해 정산예정액·정산예정일을 계산하고, 정산내역 CSV를 추가하면 예상과 실제를 대사합니다. 입력 데이터는 서버로 전송되지 않고 이 페이지 안에서만 처리됩니다.</p>
  </header>

  <section class="panel">
    <h2>입력</h2>
    <div class="grid">
      <div>
        <label>주문 CSV (상품주문번호·결제금액·구매확정일 등) *</label>
        <textarea id="orders" placeholder="스마트스토어 주문/배송 엑셀을 CSV로 저장해 붙여넣기"></textarea>
        <input id="ordersFile" class="file" type="file" accept=".csv,text/csv">
      </div>
      <div>
        <label>정산내역 CSV (선택 — 대사용)</label>
        <textarea id="actual" placeholder="스마트스토어 정산내역 엑셀을 CSV로 저장해 붙여넣기"></textarea>
        <input id="actualFile" class="file" type="file" accept=".csv,text/csv">
      </div>
    </div>
    <div class="controls">
      <div>
        <label>사업자 매출등급</label>
        <select id="grade"><option>영세</option><option>중소1</option><option>중소2</option><option>중소3</option><option>일반</option></select>
      </div>
      <div>
        <label>기본 유입경로</label>
        <select id="path"><option>네이버쇼핑</option><option>자체유입</option></select>
      </div>
      <div>
        <label>정산 방식</label>
        <select id="type"><option>일반정산</option><option>빠른정산</option></select>
      </div>
    </div>
    <div class="row-btns">
      <button id="runBtn">정산 계산</button>
      <button id="sampleBtn" class="ghost">샘플 불러오기</button>
    </div>
    <div id="error" class="err"></div>
  </section>

  <div id="output"></div>

  <p class="footnote">수수료 요율·공휴일은 2025–2026 기준 시드값입니다. 실제 운영 전 공식 공지로 갱신하세요. ·
    실제 서버 API로 동작하는 전체 웹앱은 Vercel 배포본을 참고하세요.</p>
</div>
<script type="module" src="./assets/demo.js"></script>
</body>
</html>
`;
writeFileSync(resolve(docs, "index.html"), html);
// Pages 가 Jekyll 처리를 건너뛰도록.
writeFileSync(resolve(docs, ".nojekyll"), "");
console.log("데모 빌드 완료 → docs/");
