const B = "https://innovait-hackathon.vercel.app";
const fake = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
let ok = 0, limited = 0, retryAfter = 0, other = 0;
for (let i = 0; i < 66; i++) {
  const r = await fetch(`${B}/api/race/reset`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": fake },
  });
  if (r.status === 200) ok++;
  else if (r.status === 429) { limited++; retryAfter = Number(r.headers.get("retry-after")); }
  else other++;
}
console.log(`spoofed key ${fake}`);
console.log(`  200 OK        ${ok}`);
console.log(`  429 limited   ${limited}   retry-after ${retryAfter}s`);
console.log(`  other         ${other}`);
console.log(limited > 0 ? "PASS — the limiter fires" : "FAIL — never limited");

// A real client (no spoof) must still be able to use the demo.
const real = await fetch(`${B}/api/race/reset`, { method: "POST" });
console.log(`unspoofed reset -> ${real.status} ${real.status === 200 ? "(demo unaffected)" : "(!!)"}`);
