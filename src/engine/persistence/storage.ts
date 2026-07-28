import { z } from 'zod';

export const SettingsSchema = z.object({
  v: z.literal(2),
  renderPreset: z.enum(['translucent', 'high-contrast', 'opaque-fallback']).default('translucent'),
  highContrastCutaway: z.boolean().default(false),
}).passthrough();

export function readValidated<T>(key: string, schema: z.ZodSchema<T>, fallback: T): T {
  const raw = globalThis.localStorage?.getItem(key);
  if (raw === null || raw === undefined) return fallback;
  try { const result = schema.safeParse(JSON.parse(raw)); return result.success ? result.data : fallback; } catch { return fallback; }
}

export function writeValidated<T>(key: string, schema: z.ZodSchema<T>, value: T): boolean {
  const result = schema.safeParse(value);
  if (!result.success) return false;
  try { const serialized = JSON.stringify(result.data); if (serialized.length > 4096) return false; globalThis.localStorage?.setItem(key, serialized); return true; } catch { return false; }
}
