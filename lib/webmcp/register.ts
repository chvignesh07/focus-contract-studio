import {
  createPackage2Tools,
  type RegisteredPackage2Tool,
} from './contracts.ts';

export type { RegisteredPackage2Tool } from './contracts.ts';

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
