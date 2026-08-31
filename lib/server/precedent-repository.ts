import { z } from 'zod';

import { BEHAVIOR_OUTCOME_ALLOWLIST } from '../retrieval/active-focus';
import type {
  RawRetrievalContext,
  RetrievalRecord,
} from '../retrieval/types';

const shortKey = z.string().min(1).max(120);
const stringArray = (maximum: number) =>
  z.array(shortKey).min(1).max(maximum).refine((value) => new Set(value).size === value.length);
const relationshipSchema = z
  .object({
    type: z.literal('applies-to'),
    target: z
      .string()
      .min(3)
      .max(180)
      .regex(/^(?:context|variant|use-case|family):[^\r\n]+$/u),
  })
  .strict();

type PrecedentRow = {
  database_record_id: string;
  record_key: string;
  product: string;
  component_family: string;
  use_case: string;
  variants_json: string;
  behavior: string;
  intent: string;
  risk: string;
  normalized_outcome_key: string;
  source_status: string;
  valid_from: number;
  valid_until: number | null;
  supersedes_record_key: string | null;
  hostile: number;
  mismatch_tags_json: string;
  shape_tags_json: string;
  relationships_json: string;
  rationale: string;
  tags_json: string;
};

export type LoadedPrecedent = {
  databaseRecordId: string;
  record: RetrievalRecord;
};

export const ELIGIBLE_PRECEDENTS_SQL =
  `SELECT p.id AS database_record_id, p.record_key,
          pr.product, pr.component_family, pr.use_case, pr.variants_json,
          p.behavior, pr.intent, pr.risk, p.normalized_outcome_key,
          pr.source_status, p.valid_from, p.valid_until,
          pr.supersedes_record_key, pr.hostile, pr.mismatch_tags_json,
          pr.shape_tags_json, pr.relationships_json, p.rationale,
          p.tags_json
     FROM precedent_records p
     JOIN precedent_retrieval_profiles pr
       ON pr.workspace_id = p.workspace_id AND pr.record_id = p.id
    WHERE p.workspace_id = ?
      AND pr.product = ?
      AND pr.component_family = ?
      AND pr.use_case IN (?, '*')
      AND EXISTS (
        SELECT 1 FROM json_each(pr.variants_json)
         WHERE value IN (?, 'both')
      )
      AND p.behavior = ?
      AND pr.intent IN (?, '*')
      AND pr.risk IN (?, '*')
      AND EXISTS (
        SELECT 1 FROM json_each(pr.mismatch_tags_json)
         WHERE value IN (?, '*')
      )
      AND p.status = 'active'
      AND pr.source_status = 'active'
      AND pr.hostile = 0
      AND p.valid_from <= ?
      AND (p.valid_until IS NULL OR p.valid_until > ?)
      AND EXISTS (
        SELECT 1 FROM json_each(?) allowed
         WHERE allowed.value = p.normalized_outcome_key
      )
      AND NOT EXISTS (
        SELECT 1
          FROM precedent_records successor
          JOIN precedent_retrieval_profiles successor_profile
            ON successor_profile.workspace_id = successor.workspace_id
           AND successor_profile.record_id = successor.id
         WHERE successor.workspace_id = p.workspace_id
           AND successor_profile.supersedes_record_key = p.record_key
           AND successor.status = 'active'
           AND successor_profile.source_status = 'active'
           AND successor_profile.hostile = 0
           AND successor.valid_from <= ?
           AND (successor.valid_until IS NULL OR successor.valid_until > ?)
      )
    ORDER BY p.record_key
    LIMIT 36`;

export function eligiblePrecedentBindings(
  workspaceId: string,
  context: RawRetrievalContext,
  asOfSeconds: number,
  outcomes: readonly string[],
): unknown[] {
  return [
    workspaceId,
    context.product,
    context.componentFamily,
    context.useCase,
    context.variant,
    context.behavior,
    context.intent,
    context.risk,
    context.mismatchTag,
    asOfSeconds,
    asOfSeconds,
    JSON.stringify(outcomes),
    asOfSeconds,
    asOfSeconds,
  ];
}

function canonicalInstant(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new Error('Precedent time is invalid.');
  }
  return new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
}

function parseJson<T>(value: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(value));
}

function materializeRow(row: PrecedentRow, workspaceId: string): LoadedPrecedent {
  if (
    !/^[0-9a-f-]{36}$/u.test(row.database_record_id) ||
    !/^[A-Z][0-9]{3}$/u.test(row.record_key) ||
    row.hostile !== 0 ||
    row.source_status !== 'active' ||
    row.rationale.length < 1 ||
    row.rationale.length > 320
  ) {
    throw new Error('Eligible precedent data is malformed.');
  }
  return {
    databaseRecordId: row.database_record_id,
    record: {
      id: row.record_key,
      workspaceKey: workspaceId,
      product: shortKey.parse(row.product),
      componentFamily: shortKey.parse(row.component_family),
      useCase: shortKey.parse(row.use_case),
      variants: parseJson(row.variants_json, stringArray(4)),
      behavior: shortKey.parse(row.behavior),
      intent: shortKey.parse(row.intent),
      risk: shortKey.parse(row.risk),
      outcomeKey: shortKey.parse(row.normalized_outcome_key),
      status: row.source_status,
      validFrom: canonicalInstant(row.valid_from),
      validTo:
        row.valid_until === null ? null : canonicalInstant(row.valid_until),
      supersedes: row.supersedes_record_key,
      hostile: false,
      mismatchTags: parseJson(row.mismatch_tags_json, stringArray(4)),
      shapeTags: parseJson(row.shape_tags_json, stringArray(5)),
      relationships: parseJson(
        row.relationships_json,
        z.array(relationshipSchema).min(1).max(8),
      ),
      rationale: row.rationale,
      tags: parseJson(row.tags_json, z.array(shortKey).max(16)),
    },
  };
}

export async function loadEligiblePrecedents(
  db: D1Database,
  workspaceId: string,
  context: RawRetrievalContext,
  asOfSeconds: number,
): Promise<LoadedPrecedent[]> {
  const outcomes =
    BEHAVIOR_OUTCOME_ALLOWLIST[
      context.behavior as keyof typeof BEHAVIOR_OUTCOME_ALLOWLIST
    ];
  if (!outcomes) return [];
  const rows = await db
    .prepare(ELIGIBLE_PRECEDENTS_SQL)
    .bind(...eligiblePrecedentBindings(workspaceId, context, asOfSeconds, outcomes))
    .all<PrecedentRow>();
  if (!rows.success || rows.results.length > 36) {
    throw new Error('The eligible precedent query failed closed.');
  }
  return rows.results.map((row) => materializeRow(row, workspaceId));
}
