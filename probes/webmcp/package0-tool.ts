export const PACKAGE0_TOOL_NAME = 'fcs_package0_probe';

type Package0ProbeInput = {
  mode: 'snapshot' | 'wait_for_cancel';
};

type ToolInvocationContext = {
  signal: AbortSignal;
};

type Package0ProbeTool = {
  name: typeof PACKAGE0_TOOL_NAME;
  description: string;
  inputSchema: {
    type: 'object';
    properties: {
      mode: { type: 'string'; enum: Package0ProbeInput['mode'][] };
    };
    required: ['mode'];
    additionalProperties: false;
  };
  annotations: {
    readOnlyHint: true;
    untrustedContentHint: false;
  };
  execute: (
    input: unknown,
    context: ToolInvocationContext,
  ) => Promise<unknown>;
};

export type ModelContextLike = {
  registerTool: (
    tool: Package0ProbeTool,
    options: { signal: AbortSignal },
  ) => Promise<void>;
};

const package0ProbeTool: Package0ProbeTool = {
  name: PACKAGE0_TOOL_NAME,
  description:
    'Read a bounded Focus Contract Studio bootstrap result or wait for invocation cancellation.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['snapshot', 'wait_for_cancel'] },
    },
    required: ['mode'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: false,
  },
  execute: async (rawInput, { signal }) => {
    const input = parsePackage0ProbeInput(rawInput);

    if (input.mode === 'wait_for_cancel') {
      await waitForCancellation(signal);
    }

    return {
      ok: true,
      probe: 'focus-contract-studio-package-0',
      lifecycle: 'registered',
      readOnly: true,
    };
  },
};

function parsePackage0ProbeInput(input: unknown): Package0ProbeInput {
  if (
    input === null ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 1 ||
    !Object.hasOwn(input, 'mode')
  ) {
    throw new TypeError('Invalid Package 0 probe input');
  }

  const mode = (input as { mode?: unknown }).mode;
  if (mode !== 'snapshot' && mode !== 'wait_for_cancel') {
    throw new TypeError('Invalid Package 0 probe input');
  }

  return { mode };
}

export class Package0ProbeRegistry {
  private registrationController: AbortController | undefined;

  async install(modelContext: ModelContextLike): Promise<void> {
    this.dispose();
    const controller = new AbortController();
    this.registrationController = controller;

    try {
      await modelContext.registerTool(package0ProbeTool, {
        signal: controller.signal,
      });
    } catch (error) {
      if (this.registrationController === controller) {
        this.registrationController = undefined;
      }
      controller.abort();
      throw error;
    }
  }

  dispose(): void {
    this.registrationController?.abort();
    this.registrationController = undefined;
  }
}

async function waitForCancellation(signal: AbortSignal): Promise<never> {
  if (signal.aborted) {
    throw abortError();
  }

  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(abortError()), { once: true });
  });
}

function abortError(): DOMException {
  return new DOMException('WebMCP probe invocation cancelled', 'AbortError');
}
