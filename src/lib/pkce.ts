const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomUrlSafe(length = 64): string {
  if (length < 43 || length > 128) {
    throw new Error("PKCE values must be between 43 and 128 characters.");
  }
  const bytes = new Uint8Array(Math.ceil((length * 3) / 4) + 8);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export async function createPkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = randomUrlSafe(64);
  const challenge = await createCodeChallenge(verifier);
  return { verifier, challenge };
}
