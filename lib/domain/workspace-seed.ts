import {
  canonicalFocusConfiguration,
  REVISION_1_CONFIGURATION,
} from './focus-configuration';
import { deterministicUuid, sha256Hex } from '../server/crypto';

export type WorkspaceSeed = {
  variants: Array<{
    id: string;
    slug: 'delete-account-standard' | 'delete-account-danger-emphasis';
    revisionId: string;
    configurationJson: string;
    configurationHash: string;
  }>;
  activeVariantId: string;
  precedent: {
    id: string;
    recordKey: 'D001';
  };
  edgeIds: string[];
};

export async function createWorkspaceSeed(workspaceId: string): Promise<WorkspaceSeed> {
  const configurationJson = canonicalFocusConfiguration(REVISION_1_CONFIGURATION);
  const configurationHash = await sha256Hex(configurationJson);
  const slugs = [
    'delete-account-standard',
    'delete-account-danger-emphasis',
  ] as const;
  const variants = await Promise.all(
    slugs.map(async (slug) => ({
      id: await deterministicUuid(`fcs-seed-v2:${workspaceId}:variant:${slug}`),
      slug,
      revisionId: await deterministicUuid(
        `fcs-seed-v2:${workspaceId}:revision:${slug}:1`,
      ),
      configurationJson,
      configurationHash,
    })),
  );
  return {
    variants,
    activeVariantId: variants[0]!.id,
    precedent: {
      id: await deterministicUuid(`fcs-seed-v2:${workspaceId}:precedent:D001`),
      recordKey: 'D001',
    },
    edgeIds: await Promise.all(
      variants.map(({ slug }) =>
        deterministicUuid(`fcs-seed-v2:${workspaceId}:edge:D001:${slug}`),
      ),
    ),
  };
}
