import { describe, it, expect } from '@jest/globals';
import { createLogger } from '../logger.js';

describe('createLogger', () => {
  it('should create a winston logger instance', () => {
    const logger = createLogger();

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('should have debug level configured', () => {
    const logger = createLogger();

    expect(logger.level).toBe('debug');
  });

  it('should have at least one transport', () => {
    const logger = createLogger();

    expect(logger.transports.length).toBeGreaterThan(0);
  });
});
