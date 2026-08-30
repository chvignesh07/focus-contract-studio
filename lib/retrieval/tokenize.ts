export function tokenize(value: string): string[] {
  return value.normalize('NFKC').toLowerCase().match(/[a-z0-9]+/gu) ?? [];
}

export function uniqueQueryTokens(value: string): string[] {
  return [...new Set(tokenize(value))];
}
