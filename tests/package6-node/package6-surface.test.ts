import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

function hex(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'iu'));
  assert.ok(match, `missing --${name}`);
  return match[1]!;
}

function luminance(value: string): number {
  const channels = value.slice(1).match(/.{2}/gu)!.map((channel) => {
    const component = Number.parseInt(channel, 16) / 255;
    return component <= 0.04045
      ? component / 12.92
      : ((component + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

test('surface tokens meet text contrast and reserve indigo for interaction', () => {
  assert.ok(contrast(hex('ink'), hex('canvas')) >= 7);
  assert.ok(contrast(hex('muted'), hex('surface')) >= 4.5);
  assert.ok(contrast(hex('indigo'), '#ffffff') >= 4.5);
  assert.ok(contrast(hex('danger'), '#ffffff') >= 4.5);
  assert.match(css, /\.button-primary\s*\{[^}]*var\(--indigo\)/u);
  assert.doesNotMatch(css, /gradient|violet|purple|glass/iu);
});

test('surface contract keeps native focus, touch, reflow, and motion safeguards', () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px/iu);
  assert.match(css, /\.button\s*\{[^}]*min-height:\s*44px/iu);
  assert.match(css, /\.variant-tab\s*\{[^}]*min-height:\s*44px/iu);
  assert.match(css, /\.review-acknowledgement input[\s\S]*?width:\s*24px[\s\S]*?height:\s*24px/iu);
  assert.match(css, /@media \(max-width:\s*419px\)/u);
  assert.match(css, /\.table-scroll\s*\{[^}]*overflow-x:\s*auto/iu);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*transition-duration:\s*0\.001ms/iu);
});
