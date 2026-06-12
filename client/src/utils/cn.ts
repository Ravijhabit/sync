export function cn(...classes: ReadonlyArray<string | undefined | false | null>): string {
  return classes.filter((c): c is string => typeof c === 'string' && c.length > 0).join(' ');
}
