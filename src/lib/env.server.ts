/** Server-only values: Worker secrets, process.env, then Astro/Vite env. Never import from client code. */
type LocalsLike = {
  runtime?: { env?: Record<string, unknown> };
  cloudflare?: { env?: Record<string, unknown> };
};

function fromLocals(locals: unknown, name: string): string | undefined {
  if (!locals || typeof locals !== 'object') return undefined;
  const bag = locals as LocalsLike;
  const env = bag.runtime?.env ?? bag.cloudflare?.env;
  const value = env?.[name];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function serverSecret(name: string, locals?: unknown): string | undefined {
  const fromRuntime = fromLocals(locals, name);
  if (fromRuntime) return fromRuntime;
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  if (fromProcess?.trim()) return fromProcess;
  const fromVite = (import.meta.env as Record<string, string | undefined>)[name];
  return fromVite?.trim() ? fromVite : undefined;
}
