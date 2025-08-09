/**
 * Tests for Logger utilities
 */

import { ConsoleLogger, SilentLogger, LogLevel } from '../src/utils/logger';

describe('Logger', () => {
  describe('ConsoleLogger', () => {
    let consoleSpy: {
      debug: jest.SpyInstance;
      info: jest.SpyInstance;
      warn: jest.SpyInstance;
      error: jest.SpyInstance;
    };

    beforeEach(() => {
      consoleSpy = {
        debug: jest.spyOn(console, 'debug').mockImplementation(),
        info: jest.spyOn(console, 'info').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        error: jest.spyOn(console, 'error').mockImplementation(),
      };
    });

    afterEach(() => {
      Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    });

    it('should log at all levels when minLevel is DEBUG', () => {
      const logger = new ConsoleLogger(LogLevel.DEBUG);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleSpy.debug).toHaveBeenCalledWith('[DEBUG] debug message');
      expect(consoleSpy.info).toHaveBeenCalledWith('[INFO] info message');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] warn message');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] error message');
    });

    it('should only log INFO and above when minLevel is INFO', () => {
      const logger = new ConsoleLogger(LogLevel.INFO);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalledWith('[INFO] info message');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] warn message');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] error message');
    });

    it('should only log WARN and above when minLevel is WARN', () => {
      const logger = new ConsoleLogger(LogLevel.WARN);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] warn message');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] error message');
    });

    it('should only log ERROR when minLevel is ERROR', () => {
      const logger = new ConsoleLogger(LogLevel.ERROR);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] error message');
    });

    it('should support additional arguments', () => {
      const logger = new ConsoleLogger(LogLevel.DEBUG);

      logger.info('message with args', { key: 'value' }, 123);

      expect(consoleSpy.info).toHaveBeenCalledWith('[INFO] message with args', { key: 'value' }, 123);
    });

    it('should default to INFO level', () => {
      const logger = new ConsoleLogger();

      logger.debug('debug message');
      logger.info('info message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalledWith('[INFO] info message');
    });
  });

  describe('SilentLogger', () => {
    let consoleSpy: {
      debug: jest.SpyInstance;
      info: jest.SpyInstance;
      warn: jest.SpyInstance;
      error: jest.SpyInstance;
    };

    beforeEach(() => {
      consoleSpy = {
        debug: jest.spyOn(console, 'debug').mockImplementation(),
        info: jest.spyOn(console, 'info').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        error: jest.spyOn(console, 'error').mockImplementation(),
      };
    });

    afterEach(() => {
      Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    });

    it('should never call console methods', () => {
      const logger = new SilentLogger();

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });
});