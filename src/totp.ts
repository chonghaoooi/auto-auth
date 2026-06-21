// TOTP (RFC 6238) — no external dependencies

function base32ToBytes(base32: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const output: number[] = [];
  const input = base32.toUpperCase().replace(/=+$/, "");
  for (let i = 0; i < input.length; i++) {
    const idx = alphabet.indexOf(input[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

async function generateTOTP(secret: string): Promise<string> {
  const keyBytes = base32ToBytes(secret);
  const now = Math.floor(Date.now() / 1000);
  // ponytail: wait out last 2s of window so code doesn't expire mid-submit
  if ((30 - (now % 30)) < 2) await new Promise<void>(r => setTimeout(r, 2500));
  const timeStep = Math.floor(Date.now() / 1000 / 30);

  const counter = new ArrayBuffer(8);
  const view = new DataView(counter);
  view.setUint32(0, 0, false);
  view.setUint32(4, timeStep, false);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, counter);
  const bytes = new Uint8Array(sig);
  const offset = bytes[19] & 0x0f;
  const code = ((bytes[offset] & 0x7f) << 24)
             | (bytes[offset + 1] << 16)
             | (bytes[offset + 2] << 8)
             |  bytes[offset + 3];

  return String(code % 1_000_000).padStart(6, "0");
}
