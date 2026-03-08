declare module '@bloom-perf/yaml-pptr' {
  import type { Browser, Page } from 'puppeteer';

  export type ScenarioContext = {
    scenarioName: string;
    workerIndex: number;
    iteration: number;
  };

  export type OnPageCallback = (page: Page, context: ScenarioContext) => Promise<void>;

  export type ReadYamlOptions = {
    browsers?: { [key: string]: Browser };
    logger?: unknown;
    onPage?: OnPageCallback;
  };

  export function readYamlAndInterpret(
    yamlContent: string,
    options?: ReadYamlOptions
  ): Promise<void>;
}
