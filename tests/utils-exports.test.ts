/**
 * Tests for Utils module exports
 */

import * as UtilsExports from '../src/utils';

describe('Utils exports', () => {
  it('should export LogLevel enum', () => {
    expect(UtilsExports.LogLevel).toBeDefined();
    expect(UtilsExports.LogLevel.DEBUG).toBe(0);
    expect(UtilsExports.LogLevel.INFO).toBe(1);
    expect(UtilsExports.LogLevel.WARN).toBe(2);
    expect(UtilsExports.LogLevel.ERROR).toBe(3);
  });

  it('should export ConsoleLogger class', () => {
    expect(UtilsExports.ConsoleLogger).toBeDefined();
    expect(typeof UtilsExports.ConsoleLogger).toBe('function');
  });

  it('should export SilentLogger class', () => {
    expect(UtilsExports.SilentLogger).toBeDefined();
    expect(typeof UtilsExports.SilentLogger).toBe('function');
  });

  it('should export default logger instance', () => {
    expect(UtilsExports.logger).toBeDefined();
    expect(typeof UtilsExports.logger.info).toBe('function');
    expect(typeof UtilsExports.logger.debug).toBe('function');
    expect(typeof UtilsExports.logger.warn).toBe('function');
    expect(typeof UtilsExports.logger.error).toBe('function');
  });
});