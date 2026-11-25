// COMFIT 결과표 진위 확인 (comfit.kr/verify). 서버 없이 브라우저 안에서만 확인한다.
// 개인정보를 입력받지 않고, 확인 기록을 남기지 않는다 (MASTER_PROMPT 10-4).
// 같은 파일을 Node 시험에서도 쓴다 (globalThis.crypto, DecompressionStream).

/** RFC 8785 JCS: 키 정렬, 공백 없음, 숫자는 ECMAScript 표기. */
export function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("JCS: 숫자가 아닙니다");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.filter((k) => value[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

export function base64UrlDecode(s) {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b + "=".repeat((4 - (b.length % 4)) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** "#..." 부분을 풀어 { summary, signature, kid, iat } 로. */
export async function decodePayload(fragment) {
  const data = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const json = new TextDecoder().decode(await inflateRaw(base64UrlDecode(data)));
  const env = JSON.parse(json);
  return { summary: env.s, signature: env.sig ?? null, kid: env.kid ?? null, iat: env.iat ?? null };
}

/**
 * 결과: "valid" | "invalid" | "unsigned" | "unknown-key" | "revoked"
 * keys: [{ kid, x, y, use, revoked }]  revoked: [kid, ...]
 */
export async function verify(payload, keys, revoked = []) {
  if (!payload.signature || !payload.kid) return "unsigned";
  if (revoked.includes(payload.kid)) return "revoked";
  const key = keys.find((k) => k.kid === payload.kid && k.use === "report");
  if (!key) return "unknown-key";
  if (key.revoked) return "revoked";
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: key.x, y: key.y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64UrlDecode(payload.signature),
    new TextEncoder().encode(canonicalize(payload.summary)),
  );
  return ok ? "valid" : "invalid";
}
