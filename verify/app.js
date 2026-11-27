import { decodePayload, verify } from "./verify.js";

const MESSAGES = {
  valid: ["서명 확인됨 — COMFIT이 발급한 결과와 같습니다.", "ok"],
  invalid: ["서명이 맞지 않습니다 — 내용이 바뀌었을 수 있습니다.", "bad"],
  unsigned: ["서명 없음 — 오프라인으로 발급된 결과표라 진위를 확인할 수 없습니다.", "warn"],
  "unknown-key": ["알 수 없는 서명 키입니다 — COMFIT이 발급한 결과표인지 확인할 수 없습니다.", "bad"],
  revoked: ["폐기된 서명 키입니다 — 이 결과표는 믿을 수 없습니다.", "bad"],
};

const STATUS = { Excellent: "아주 좋음", Good: "좋음", Fair: "보통", Caution: "주의", Danger: "위험" };
const MODE = { Quick: "빠른 검진", Standard: "표준 검진", Advanced: "정밀 검진" };
const COMP = { CPU: "CPU", GPU: "GPU", RAM: "RAM", SSD: "SSD", HDD: "HDD", MAINBOARD: "메인보드·전원", COOLING: "냉각", BATTERY: "배터리" };

function text(el, value) {
  el.textContent = value ?? "-";
  return el;
}

function row(table, cells) {
  const tr = document.createElement("tr");
  for (const c of cells) tr.appendChild(text(document.createElement("td"), c));
  table.appendChild(tr);
}

async function main() {
  const result = document.getElementById("result");
  if (!location.hash || location.hash.length < 10) {
    text(result, "결과표의 QR 코드를 찍어 이 페이지를 여세요.");
    return;
  }
  try {
    const [payload, keys, revoked] = await Promise.all([
      decodePayload(location.hash),
      fetch("keys.json").then((r) => r.json()),
      fetch("revoked.json").then((r) => r.json()),
    ]);
    const outcome = await verify(payload, keys.keys ?? [], revoked.revoked ?? []);
    const [message, cls] = MESSAGES[outcome];
    text(result, message).className = "result " + cls;

    const s = payload.summary;
    document.getElementById("details").hidden = false;
    text(document.getElementById("rn"), s.rn);
    text(document.getElementById("at"), s.at);
    text(document.getElementById("mode"), MODE[s.mode] ?? s.mode);
    text(document.getElementById("total"), s.total?.s == null ? "평가 불가" : `${s.total.s}점 (${STATUS[s.total.st] ?? s.total.st})`);
    const comps = document.getElementById("components");
    for (const c of s.comp ?? []) row(comps, [COMP[c.c] ?? c.c, c.m, c.s == null ? "평가 불가" : String(c.s), STATUS[c.st] ?? "-"]);
    const disks = document.getElementById("disks");
    for (const d of s.disk ?? []) row(disks, [d.m, d.poh == null ? "-" : `${d.poh}시간`, d.pc ?? "-", d.tbw == null ? "-" : `${d.tbw}TB`, d.lu == null ? "-" : `${d.lu}%`]);
  } catch {
    text(result, "결과표 정보를 읽을 수 없습니다. QR 코드를 다시 찍어 주세요.").className = "result bad";
  }
}

main();
