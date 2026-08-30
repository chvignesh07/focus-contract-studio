import { env } from 'cloudflare:workers';
import { expect, test } from 'vitest';

test('generated Cloudflare dependency family runs a fresh local D1 in workerd', async () => {
  await env.DB
    .prepare('INSERT INTO package0_parent (id, slug) VALUES (?, ?)')
    .bind(1, 'cloudflare-vitest-compat')
    .run();

  const row = await env.DB
    .prepare('SELECT id, slug FROM package0_parent WHERE id = ?')
    .bind(1)
    .first<{ id: number; slug: string }>();

  expect(row).toEqual({ id: 1, slug: 'cloudflare-vitest-compat' });
});
