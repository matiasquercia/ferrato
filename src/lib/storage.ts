/** Preserve this page's cart when browser privacy settings or storage quotas block persistence. */
export function safeStorageEngine(getStorage: () => Storage): Record<string, string> {
  const memory: Record<string, string> = Object.create(null);
  let available = true;
  const read = (key: string) => {
    if (available) {
      try {
        const value = getStorage().getItem(key);
        if (value === null) delete memory[key];
        else memory[key] = value;
      } catch {
        available = false;
      }
    }
    return memory[key];
  };
  return new Proxy(memory, {
    get: (_, key) => typeof key === 'string' ? read(key) : undefined,
    has: (_, key) => typeof key === 'string' && read(key) !== undefined,
    set: (_, key, value) => {
      if (typeof key !== 'string') return false;
      memory[key] = String(value);
      if (available) {
        try { getStorage().setItem(key, memory[key]); } catch { available = false; }
      }
      return true;
    },
    deleteProperty: (_, key) => {
      if (typeof key !== 'string') return false;
      delete memory[key];
      if (available) {
        try { getStorage().removeItem(key); } catch { available = false; }
      }
      return true;
    },
  });
}
