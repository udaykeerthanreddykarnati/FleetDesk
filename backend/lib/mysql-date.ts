/** Convert a validated instant to a MySQL DATETIME string; MySQL DATETIME has no timezone field. */
export function toMysqlUtcDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid date and time is required.');
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
