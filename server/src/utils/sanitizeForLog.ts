const PII_FIELDS = new Set([
  'name',
  'email',
  'company',
  'bio',
  'interests',
  'content',
  'justification',
  'feedback',
]);

export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!PII_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}
