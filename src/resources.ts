import { readdir, readFile } from 'fs/promises';
import { Logger } from 'winston';
import { MetricsEmitter } from './metrics.js';

/** Linux counts CPU time in ticks of 1/100 s (USER_HZ) */
const CLOCK_TICKS_PER_SECOND = 100;
export const SAMPLING_INTERVAL_MS = 5000;

/** A process, as read from /proc/<pid>/stat */
export type ProcessStat = {
  pid: number;
  ppid: number;
  /** Process name (Firefox names its child processes, e.g. "Web Content") */
  name: string;
  /** CPU time used since the process started (user + system), in clock ticks */
  cpuTicks: number;
};

/**
 * Parses /proc/<pid>/stat (see proc(5)). The name is between parentheses and may contain
 * spaces or parentheses itself: the fields are counted from the last ")".
 */
export const parseStat = (content: string): ProcessStat | undefined => {
  const open = content.indexOf('(');
  const close = content.lastIndexOf(')');
  if (open < 0 || close < open) return undefined;
  // fields[0] is field 3 of proc(5) (state): field n is fields[n - 3]
  const fields = content.slice(close + 2).split(' ');
  const stat = {
    pid: Number(content.slice(0, open)),
    ppid: Number(fields[1]),
    name: content.slice(open + 1, close),
    cpuTicks: Number(fields[11]) + Number(fields[12]),
  };
  return Number.isFinite(stat.pid + stat.ppid + stat.cpuTicks) ? stat : undefined;
};

/** Every process of the machine (of the container), by pid */
const readProcessStats = async (procDir: string): Promise<Map<number, ProcessStat>> => {
  const pids = (await readdir(procDir)).filter((entry) => /^\d+$/.test(entry));
  const stats = await Promise.all(
    pids.map((pid) => readFile(`${procDir}/${pid}/stat`, 'utf8').then(parseStat, () => undefined))
  );
  return new Map(
    stats.filter((stat): stat is ProcessStat => stat !== undefined).map((s) => [s.pid, s])
  );
};

/**
 * Memory of a process in kB: its proportional set size (PSS), where the pages shared by
 * several processes are split between them, so that the memory of a browser is the sum
 * of its processes' (summing their resident memory would count the shared pages in each
 * process: about 1.6 times more for Firefox). The resident memory (RSS) if the PSS
 * cannot be read.
 */
const readMemoryKb = async (procDir: string, pid: number): Promise<number> => {
  const pss = await readFile(`${procDir}/${pid}/smaps_rollup`, 'utf8').then(
    (content) => /^Pss:\s+(\d+) kB/m.exec(content)?.[1],
    () => undefined
  );
  if (pss !== undefined) return Number(pss);
  const status = await readFile(`${procDir}/${pid}/status`, 'utf8');
  return Number(/^VmRSS:\s+(\d+) kB/m.exec(status)?.[1] ?? 0);
};

/** Memory (kB) and command line of a process; undefined if it has exited */
const readProcessDetails = async (
  procDir: string,
  pid: number
): Promise<{ memoryKb: number; args: string } | undefined> => {
  try {
    const [memoryKb, cmdline] = await Promise.all([
      readMemoryKb(procDir, pid),
      readFile(`${procDir}/${pid}/cmdline`, 'utf8'),
    ]);
    return { memoryKb, args: cmdline.split('\0').join(' ').trim() };
  } catch {
    return undefined;
  }
};

/** The process and all its descendants */
export const processTree = (stats: Map<number, ProcessStat>, rootPid: number): ProcessStat[] => {
  const root = stats.get(rootPid);
  if (!root) return [];
  const children = new Map<number, ProcessStat[]>();
  for (const stat of stats.values()) {
    children.set(stat.ppid, [...(children.get(stat.ppid) ?? []), stat]);
  }
  const tree: ProcessStat[] = [];
  const queue = [root];
  while (queue.length > 0) {
    const stat = queue.shift()!;
    tree.push(stat);
    queue.push(...(children.get(stat.pid) ?? []));
  }
  return tree;
};

/**
 * Whether a process renders pages (what the "tab" metrics measure): a Firefox content
 * process, or a Chrome renderer. Chrome forks its renderers from its sandboxed zygote
 * (the one without --no-zygote-sandbox), whose command line they keep.
 */
export const isRenderer = (name: string, args: string, parentArgs: string | undefined) =>
  /^(Web Content|Isolated Web Co|file:\/\/ Content)/.test(name) ||
  args.includes('--type=renderer') ||
  (parentArgs !== undefined &&
    parentArgs.includes('--type=zygote') &&
    !parentArgs.includes('--no-zygote-sandbox'));

export type ResourceMonitor = {
  /** Measures the browser whose main process is `pid`, until that process exits */
  watch(browser: string, pid: number): void;
  /** Takes a sample (also run every SAMPLING_INTERVAL_MS), or waits for the one in progress */
  sample(): Promise<void>;
  stop(): void;
};

export type ResourceMonitorOptions = {
  procDir?: string;
  platform?: NodeJS.Platform;
  intervalMs?: number;
  now?: () => number;
};

/**
 * Samples the CPU and memory used by each watched browser, from /proc (Linux only): per
 * process rendering pages (tab metrics) and for the whole browser (pod metrics). The CPU
 * usage is the CPU time used between two samples, so it is measured from the second one.
 */
export const createResourceMonitor = (
  me: MetricsEmitter,
  logger: Logger,
  {
    procDir = '/proc',
    platform = process.platform,
    intervalMs = SAMPLING_INTERVAL_MS,
    now = () => performance.now(),
  }: ResourceMonitorOptions = {}
): ResourceMonitor => {
  const watched = new Map<number, string>();
  /** CPU ticks of the watched processes at the previous sample */
  let previousTicks = new Map<number, number>();
  let previousTime: number | undefined;
  let timer: NodeJS.Timeout | undefined;
  let inProgress: Promise<void> | undefined;

  const takeSample = async () => {
    if (watched.size === 0) return;
    const time = now();
    const stats = await readProcessStats(procDir);
    const elapsedSeconds = previousTime === undefined ? undefined : (time - previousTime) / 1000;
    const ticks = new Map<number, number>();

    for (const [rootPid, browser] of watched) {
      const tree = processTree(stats, rootPid);
      if (tree.length === 0) {
        watched.delete(rootPid);
        continue;
      }
      const details = new Map(
        await Promise.all(
          tree.map(async (stat) => [stat.pid, await readProcessDetails(procDir, stat.pid)] as const)
        )
      );
      let browserRamKb = 0;
      let browserCpu = 0;
      let cpuMeasured = false;
      for (const stat of tree) {
        const detail = details.get(stat.pid);
        if (!detail) continue;
        ticks.set(stat.pid, stat.cpuTicks);
        browserRamKb += detail.memoryKb;
        const previous = previousTicks.get(stat.pid);
        if (previous === undefined || !elapsedSeconds) continue;
        const cpu = ((stat.cpuTicks - previous) / CLOCK_TICKS_PER_SECOND / elapsedSeconds) * 100;
        browserCpu += cpu;
        cpuMeasured = true;
        if (isRenderer(stat.name, detail.args, details.get(stat.ppid)?.args)) {
          me.resourcesConsumptionPerTab(browser, detail.memoryKb, cpu);
        }
      }
      if (cpuMeasured) {
        me.resourcesConsumptionPerPod(browser, browserRamKb, browserCpu);
      }
    }
    previousTicks = ticks;
    previousTime = time;
  };

  const sample = () => {
    inProgress ??= takeSample().finally(() => {
      inProgress = undefined;
    });
    return inProgress;
  };

  const sampleAndLog = () =>
    sample().catch((err: unknown) => logger.warn(`CPU/RAM sampling failed: ${String(err)}`));

  return {
    watch(browser, pid) {
      if (platform !== 'linux') {
        logger.info(`CPU/RAM metrics of ${browser} are not collected: only available on Linux`);
        return;
      }
      watched.set(pid, browser);
      if (!timer) {
        // Does not keep the process alive
        timer = setInterval(() => void sampleAndLog(), intervalMs).unref();
      }
      void sampleAndLog();
    },
    sample,
    stop() {
      clearInterval(timer);
      timer = undefined;
      watched.clear();
    },
  };
};
