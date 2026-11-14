import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Logger } from 'winston';
import type { MetricsEmitter } from '../metrics.js';
import {
  createResourceMonitor,
  isRenderer,
  parseStat,
  processTree,
  ResourceMonitor,
} from '../resources.js';

/** /proc/<pid>/stat: utime is field 14, stime field 15 */
const statLine = (pid: number, name: string, ppid: number, utime: number, stime = 0) =>
  `${pid} (${name}) S ${ppid} ${pid} ${pid} 0 -1 4194560 100 0 0 0 ${utime} ${stime} 0 0 20 0 1 0 100 1000 25\n`;

type FakeProcess = {
  pid: number;
  ppid: number;
  name: string;
  ticks: number;
  /** Proportional set size; the resident memory is twice as much */
  pssKb: number;
  args: string;
  /** smaps_rollup cannot be read: only the resident memory is known */
  noSmaps?: boolean;
};

/** Writes a process into a fake /proc directory */
const writeProcess = (procDir: string, p: FakeProcess) => {
  const dir = join(procDir, String(p.pid));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'stat'), statLine(p.pid, p.name, p.ppid, p.ticks));
  writeFileSync(
    join(dir, 'status'),
    `Name:\t${p.name}\nVmRSS:\t  ${p.pssKb * 2} kB\nThreads:\t4\n`
  );
  rmSync(join(dir, 'smaps_rollup'), { force: true });
  if (!p.noSmaps) {
    writeFileSync(
      join(dir, 'smaps_rollup'),
      `00400000-7ffc00000000 ---p 00000000 00:00 0  [rollup]\nRss:  ${p.pssKb * 2} kB\nPss:  ${p.pssKb} kB\nPss_Anon:  10 kB\n`
    );
  }
  writeFileSync(join(dir, 'cmdline'), p.args.split(' ').join('\0') + '\0');
};

describe('parseStat', () => {
  it('should read the parent, the name and the CPU time', () => {
    expect(parseStat(statLine(42, 'Web Content', 7, 120, 30))).toEqual({
      pid: 42,
      ppid: 7,
      name: 'Web Content',
      cpuTicks: 150,
    });
  });

  it('should read a name containing spaces and parentheses', () => {
    expect(parseStat(statLine(42, 'a (b) c', 7, 1, 2))).toMatchObject({
      ppid: 7,
      name: 'a (b) c',
      cpuTicks: 3,
    });
  });

  it('should ignore an unreadable line', () => {
    expect(parseStat('')).toBeUndefined();
    expect(parseStat('42 (x) S')).toBeUndefined();
  });
});

describe('processTree', () => {
  const stats = new Map(
    [
      { pid: 1, ppid: 0 },
      { pid: 10, ppid: 1 },
      { pid: 11, ppid: 10 },
      { pid: 12, ppid: 11 },
      { pid: 20, ppid: 1 },
    ].map((p) => [p.pid, { ...p, name: 'p', cpuTicks: 0 }])
  );

  it('should return the process and all its descendants', () => {
    expect(processTree(stats, 10).map((p) => p.pid)).toEqual([10, 11, 12]);
  });

  it('should return nothing for a process that has exited', () => {
    expect(processTree(stats, 99)).toEqual([]);
  });
});

describe('isRenderer', () => {
  it.each(['Web Content', 'Isolated Web Co', 'file:// Content'])(
    'should recognize the Firefox content process "%s"',
    (name) => {
      expect(isRenderer(name, 'firefox-bin -contentproc', 'firefox-bin -contentproc')).toBe(true);
    }
  );

  it.each(['Socket Process', 'RDD Process', 'WebExtensions', 'forkserver', 'firefox'])(
    'should not count the Firefox process "%s"',
    (name) => {
      expect(isRenderer(name, 'firefox-bin -contentproc', 'firefox --headless')).toBe(false);
    }
  );

  it('should recognize a Chrome renderer, forked from the sandboxed zygote', () => {
    expect(isRenderer('chrome', 'chrome --type=zygote', 'chrome --type=zygote --no-sandbox')).toBe(
      true
    );
    expect(isRenderer('chrome', 'chrome --type=renderer', 'chrome --headless')).toBe(true);
  });

  it('should not count the other Chrome processes', () => {
    // Zygotes, GPU process (forked from the unsandboxed zygote), utility processes
    expect(isRenderer('chrome', 'chrome --type=zygote', 'chrome --headless')).toBe(false);
    expect(
      isRenderer('chrome', 'chrome --type=zygote', 'chrome --type=zygote --no-zygote-sandbox')
    ).toBe(false);
    expect(isRenderer('chrome', '/proc/self/exe --type=utility', 'chrome --headless')).toBe(false);
    expect(isRenderer('chrome', 'chrome --headless', undefined)).toBe(false);
  });
});

describe('createResourceMonitor', () => {
  let procDir: string;
  let clock: number;
  let me: MetricsEmitter;
  let logger: Logger;
  let monitor: ResourceMonitor;

  const firefox: FakeProcess[] = [
    { pid: 10, ppid: 1, name: 'firefox', ticks: 1000, pssKb: 300_000, args: 'firefox --headless' },
    {
      pid: 11,
      ppid: 10,
      name: 'forkserver',
      ticks: 10,
      pssKb: 20_000,
      args: 'firefox-bin -contentproc',
    },
    {
      pid: 12,
      ppid: 11,
      name: 'Web Content',
      ticks: 500,
      pssKb: 150_000,
      args: 'firefox-bin -contentproc',
    },
    {
      pid: 13,
      ppid: 11,
      name: 'Socket Process',
      ticks: 50,
      pssKb: 30_000,
      args: 'firefox-bin -contentproc',
    },
  ];
  // Kyara itself, and a process unrelated to the browser
  const others: FakeProcess[] = [
    { pid: 1, ppid: 0, name: 'node', ticks: 9000, pssKb: 150_000, args: 'node dist/main.js' },
    { pid: 50, ppid: 1, name: 'ps', ticks: 5, pssKb: 5_000, args: 'ps' },
  ];

  const createMonitor = (platform: NodeJS.Platform = 'linux') =>
    createResourceMonitor(me, logger, {
      procDir,
      platform,
      intervalMs: 3_600_000,
      now: () => clock,
    });

  beforeEach(() => {
    procDir = mkdtempSync(join(tmpdir(), 'kyara-proc-'));
    [...others, ...firefox].forEach((p) => writeProcess(procDir, p));
    clock = 0;
    me = {
      resourcesConsumptionPerTab: jest.fn(),
      resourcesConsumptionPerPod: jest.fn(),
    } as unknown as MetricsEmitter;
    logger = { info: jest.fn(), warn: jest.fn() } as unknown as Logger;
  });

  afterEach(() => {
    monitor?.stop();
    rmSync(procDir, { recursive: true, force: true });
  });

  it('should measure the CPU used between two samples, per tab and for the whole browser', async () => {
    monitor = createMonitor();
    monitor.watch('firefox', 10);
    await monitor.sample(); // the first sample, started by watch()
    expect(me.resourcesConsumptionPerPod).not.toHaveBeenCalled();

    // 5 s later: the main process used 0.5 s of CPU, the content process 1 s
    clock = 5000;
    writeProcess(procDir, { ...firefox[0], ticks: 1050 });
    writeProcess(procDir, { ...firefox[2], ticks: 600, pssKb: 160_000 });
    // smaps_rollup not readable: its resident memory is used instead
    writeProcess(procDir, { ...firefox[3], noSmaps: true });
    writeProcess(procDir, { ...others[0], ticks: 9900 });
    await monitor.sample();

    expect(me.resourcesConsumptionPerTab).toHaveBeenCalledTimes(1);
    expect(me.resourcesConsumptionPerTab).toHaveBeenCalledWith('firefox', 160_000, 20);
    expect(me.resourcesConsumptionPerPod).toHaveBeenCalledTimes(1);
    expect(me.resourcesConsumptionPerPod).toHaveBeenCalledWith(
      'firefox',
      300_000 + 20_000 + 160_000 + 2 * 30_000,
      30
    );
  });

  it('should count the renderers of Chrome', async () => {
    const chrome: FakeProcess[] = [
      { pid: 30, ppid: 1, name: 'chrome', ticks: 100, pssKb: 200_000, args: 'chrome --headless' },
      {
        pid: 31,
        ppid: 30,
        name: 'chrome',
        ticks: 0,
        pssKb: 80_000,
        args: 'chrome --type=zygote --no-zygote-sandbox',
      },
      { pid: 32, ppid: 30, name: 'chrome', ticks: 0, pssKb: 80_000, args: 'chrome --type=zygote' },
      {
        pid: 33,
        ppid: 31,
        name: 'chrome',
        ticks: 10,
        pssKb: 100_000,
        args: 'chrome --type=zygote --no-zygote-sandbox',
      },
      {
        pid: 34,
        ppid: 32,
        name: 'chrome',
        ticks: 10,
        pssKb: 140_000,
        args: 'chrome --type=zygote',
      },
    ];
    chrome.forEach((p) => writeProcess(procDir, p));
    monitor = createMonitor();
    monitor.watch('chrome', 30);
    await monitor.sample();

    clock = 2000;
    writeProcess(procDir, { ...chrome[4], ticks: 110 });
    await monitor.sample();

    // Only the renderer forked from the sandboxed zygote (34), not the GPU process (33)
    expect(me.resourcesConsumptionPerTab).toHaveBeenCalledTimes(1);
    expect(me.resourcesConsumptionPerTab).toHaveBeenCalledWith('chrome', 140_000, 50);
    expect(me.resourcesConsumptionPerPod).toHaveBeenCalledWith('chrome', 600_000, 50);
  });

  it('should stop measuring a browser that has exited', async () => {
    monitor = createMonitor();
    monitor.watch('firefox', 10);
    await monitor.sample();

    firefox.forEach((p) => rmSync(join(procDir, String(p.pid)), { recursive: true }));
    clock = 5000;
    await monitor.sample();
    // Even if its pid were reused afterwards
    writeProcess(procDir, firefox[0]);
    clock = 10000;
    await monitor.sample();

    expect(me.resourcesConsumptionPerPod).not.toHaveBeenCalled();
  });

  it('should not measure anything once stopped', async () => {
    monitor = createMonitor();
    monitor.watch('firefox', 10);
    await monitor.sample();
    monitor.stop();

    clock = 5000;
    await monitor.sample();

    expect(me.resourcesConsumptionPerPod).not.toHaveBeenCalled();
  });

  it('should only measure on Linux', async () => {
    monitor = createMonitor('darwin');
    monitor.watch('firefox', 10);
    await monitor.sample();
    clock = 5000;
    await monitor.sample();

    expect(logger.info).toHaveBeenCalledWith(
      'CPU/RAM metrics of firefox are not collected: only available on Linux'
    );
    expect(me.resourcesConsumptionPerPod).not.toHaveBeenCalled();
  });

  it('should log a sampling failure', async () => {
    rmSync(procDir, { recursive: true });
    monitor = createMonitor();
    monitor.watch('firefox', 10);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('CPU/RAM sampling failed'));
  });
});
