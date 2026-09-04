import {
  createFcsWebMcpV2Tools,
  createPackage2Tools,
  type RegisteredFcsWebMcpV2Tool,
  type RegisteredPackage2Tool,
} from './contracts.ts';

export type {
  RegisteredFcsWebMcpV2Tool,
  RegisteredPackage2Tool,
} from './contracts.ts';

export type ModelContextLike = {
  registerTool: (
    tool: RegisteredPackage2Tool,
    options: { signal: AbortSignal },
  ) => Promise<void>;
};

type RegistryOptions = Parameters<typeof createPackage2Tools>[0];

export class Package2ToolRegistry {
  private registrationController: AbortController | undefined;
  private readonly options: RegistryOptions;

  constructor(options: RegistryOptions) {
    this.options = options;
  }

  get installed(): boolean {
    return this.registrationController !== undefined;
  }

  async install(modelContext: ModelContextLike): Promise<void> {
    this.dispose();
    const controller = new AbortController();
    this.registrationController = controller;
    try {
      for (const tool of createPackage2Tools(this.options)) {
        await modelContext.registerTool(tool, { signal: controller.signal });
      }
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

export type FcsWebMcpV2ModelContextLike = {
  registerTool: (
    tool: RegisteredFcsWebMcpV2Tool,
    options: { signal: AbortSignal },
  ) => Promise<void>;
};

type FcsWebMcpV2RegistryOptions = {
  csrfToken: string;
  fetcher: Parameters<typeof createFcsWebMcpV2Tools>[0]['fetcher'];
  pageKey: string;
  currentPageKey: () => string;
  onMutationCommitted?: (
    toolName: RegisteredFcsWebMcpV2Tool['name'],
    result: unknown,
  ) => void;
};

type RegistryGlobal = typeof globalThis & {
  __fcsWebMcpV2Registration?: AbortController;
};

const registryGlobal = globalThis as RegistryGlobal;

export class FcsWebMcpV2Registry {
  private registrationController: AbortController | undefined;
  private readonly options: FcsWebMcpV2RegistryOptions;

  constructor(options: FcsWebMcpV2RegistryOptions) {
    this.options = options;
  }

  get installed(): boolean {
    return this.registrationController?.signal.aborted === false;
  }

  async install(modelContext: FcsWebMcpV2ModelContextLike): Promise<void> {
    this.dispose();
    registryGlobal.__fcsWebMcpV2Registration?.abort();
    const controller = new AbortController();
    registryGlobal.__fcsWebMcpV2Registration = controller;
    this.registrationController = controller;
    try {
      for (const registeredTool of createFcsWebMcpV2Tools({
        csrfToken: this.options.csrfToken,
        fetcher: this.options.fetcher,
        lifecycleSignal: controller.signal,
        isCurrent: () => this.options.currentPageKey() === this.options.pageKey,
      })) {
        controller.signal.throwIfAborted();
        const tool = registeredTool.annotations.readOnlyHint || !this.options.onMutationCommitted
          ? registeredTool
          : {
              ...registeredTool,
              execute: async (...args: Parameters<typeof registeredTool.execute>) => {
                const result = await registeredTool.execute(...args);
                try {
                  this.options.onMutationCommitted?.(registeredTool.name, result);
                } catch {
                  // The mutation already committed; UI synchronization must not falsify its result.
                }
                return result;
              },
            };
        await modelContext.registerTool(tool, { signal: controller.signal });
      }
      controller.signal.throwIfAborted();
    } catch (error) {
      controller.abort();
      if (this.registrationController === controller) {
        this.registrationController = undefined;
      }
      if (registryGlobal.__fcsWebMcpV2Registration === controller) {
        delete registryGlobal.__fcsWebMcpV2Registration;
      }
      throw error;
    }
  }

  dispose(): void {
    const controller = this.registrationController;
    controller?.abort();
    if (registryGlobal.__fcsWebMcpV2Registration === controller) {
      delete registryGlobal.__fcsWebMcpV2Registration;
    }
    this.registrationController = undefined;
  }
}
