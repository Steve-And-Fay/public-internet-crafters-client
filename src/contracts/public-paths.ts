/** Optional public routes, never private routes or identifiers. Invalid configuration denies all. */
export interface PublicPathPolicy {
  mode: "all" | "allowlist" | "invalid";
  paths: string[];
}

function canonicalPath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 2_000 ||
    !/^\/[a-zA-Z0-9_./~-]*$/u.test(value) ||
    value.includes("//") ||
    value.split("/").some((segment) => segment === "." || segment === "..")
  )
    return null;
  return value === "/" ? value : value.replace(/\/$/u, "");
}

export function parsePublicPaths(raw: string | null | undefined): PublicPathPolicy {
  if (raw === undefined || raw === null) return { mode: "all", paths: [] };
  const invalid: PublicPathPolicy = { mode: "invalid", paths: [] };
  if (raw.length > 8_192) return invalid;
  try {
    const input: unknown = JSON.parse(raw);
    if (!Array.isArray(input) || input.length > 100) return invalid;
    const paths: string[] = [];
    for (const value of input) {
      if (typeof value !== "string") return invalid;
      const subtree = value.endsWith("/*");
      const path = canonicalPath(subtree ? value.slice(0, -2) : value);
      if (!path || (subtree && path === "/")) return invalid;
      paths.push(subtree ? `${path}/*` : path);
    }
    return { mode: "allowlist", paths: [...new Set(paths)] };
  } catch {
    return invalid;
  }
}

export function publicPathAllowed(path: unknown, policy: PublicPathPolicy): boolean {
  if (policy.mode === "all") return true;
  if (policy.mode === "invalid") return false;
  const canonical = canonicalPath(path);
  return (
    canonical !== null &&
    policy.paths.some((allowed) =>
      allowed.endsWith("/*") ? canonical.startsWith(allowed.slice(0, -1)) : canonical === allowed,
    )
  );
}

/** Same-site private links must not leak through events on an otherwise public page. */
export function publicDestinationAllowed(
  destination: unknown,
  hostname: string,
  policy: PublicPathPolicy,
): boolean {
  if (policy.mode === "all" || typeof destination !== "string" || !destination) return true;
  if (policy.mode === "invalid") return false;
  try {
    const url = new URL(destination, `https://${hostname}`);
    if (!["http:", "https:"].includes(url.protocol) || url.hostname !== hostname) return true;
    return publicPathAllowed(url.pathname, policy);
  } catch {
    return false;
  }
}
