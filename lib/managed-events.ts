const STORAGE_KEY = "choseikun-managed-event-tokens";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readManagedEventTokens(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(stored)) return [];
    return Array.from(new Set(stored.filter((token): token is string =>
      typeof token === "string" && TOKEN_PATTERN.test(token),
    )));
  } catch {
    return [];
  }
}

function writeManagedEventTokens(tokens: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Storage may be disabled. The management URL still works when saved separately.
  }
}

export function rememberManagedEventToken(token: string): void {
  if (!TOKEN_PATTERN.test(token)) return;
  writeManagedEventTokens([token, ...readManagedEventTokens().filter((saved) => saved !== token)]);
}

export function forgetManagedEventToken(token: string): void {
  writeManagedEventTokens(readManagedEventTokens().filter((saved) => saved !== token));
}

export function tokenFromManageUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const match = url.pathname.match(/^\/manage\/([A-Za-z0-9_-]{43})\/?$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}
