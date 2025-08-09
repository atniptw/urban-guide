/**
 * Tests for Templates module exports
 */

import * as TemplateExports from '../src/templates';

describe('Template exports', () => {
  it('should export TemplateEngine class', () => {
    expect(TemplateExports.TemplateEngine).toBeDefined();
    expect(typeof TemplateExports.TemplateEngine).toBe('function');
  });
});