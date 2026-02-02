declare module '@bloom-perf/yaml-pptr' {
  import { Browser, Page } from 'puppeteer';
  import { Logger } from 'winston';

  export function readYamlAndInterpret(
    yaml: string,
    logger: Logger
  ): (browser: Browser, callback: (page: Page) => Promise<void>) => Promise<void>;
}
