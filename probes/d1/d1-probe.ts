export function interpretRequiredSingleRow(result: D1Result<unknown>) {
  if (result.meta.changes === 0) {
    return {
      ok: false,
      code: 'ZERO_ROW_REJECTED',
      changes: 0,
    } as const;
  }

  if (result.meta.changes !== 1) {
    return {
      ok: false,
      code: 'UNEXPECTED_ROW_COUNT',
      changes: result.meta.changes,
    } as const;
  }

  return {
    ok: true,
    changes: result.meta.changes,
  } as const;
}
