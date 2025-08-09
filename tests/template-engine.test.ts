/**
 * Tests for Template Engine
 */

import { TemplateEngine } from '../src/templates/template-engine';
import { TemplateError } from '../src/core/errors';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('Basic rendering', () => {
    it('should render plain text without variables', () => {
      const template = 'Hello, World!';
      const result = engine.render(template, {});
      expect(result).toBe('Hello, World!');
    });

    it('should handle empty template', () => {
      const result = engine.render('', {});
      expect(result).toBe('');
    });

    it('should handle empty context', () => {
      const template = 'Hello ${name}';
      const result = engine.render(template, {});
      expect(result).toBe('Hello ');
    });
  });

  describe('Variable interpolation', () => {
    it('should interpolate simple variables', () => {
      const template = 'Hello, ${name}!';
      const context = { name: 'Alice' };
      const result = engine.render(template, context);
      expect(result).toBe('Hello, Alice!');
    });

    it('should interpolate nested properties', () => {
      const template = 'User: ${user.name}, Age: ${user.age}';
      const context = {
        user: { name: 'Bob', age: 30 }
      };
      const result = engine.render(template, context);
      expect(result).toBe('User: Bob, Age: 30');
    });

    it('should handle deeply nested properties', () => {
      const template = 'City: ${user.address.city.name}';
      const context = {
        user: {
          address: {
            city: { name: 'New York' }
          }
        }
      };
      const result = engine.render(template, context);
      expect(result).toBe('City: New York');
    });

    it('should handle undefined variables gracefully', () => {
      const template = 'Value: ${undefinedVar}';
      const result = engine.render(template, {});
      expect(result).toBe('Value: ');
    });

    it('should handle null values', () => {
      const template = 'Value: ${nullVar}';
      const context = { nullVar: null };
      const result = engine.render(template, context);
      expect(result).toBe('Value: ');
    });

    it('should handle numeric values', () => {
      const template = 'Count: ${count}';
      const context = { count: 42 };
      const result = engine.render(template, context);
      expect(result).toBe('Count: 42');
    });

    it('should handle boolean values', () => {
      const template = 'Active: ${isActive}';
      const context = { isActive: true };
      const result = engine.render(template, context);
      expect(result).toBe('Active: true');
    });

    it('should handle multiple variables', () => {
      const template = '${greeting}, ${name}! You have ${count} messages.';
      const context = {
        greeting: 'Hello',
        name: 'Charlie',
        count: 5
      };
      const result = engine.render(template, context);
      expect(result).toBe('Hello, Charlie! You have 5 messages.');
    });
  });

  describe('Escape sequences', () => {
    it('should escape template syntax', () => {
      const template = 'Literal: \\${variable}';
      const context = { variable: 'test' };
      const result = engine.render(template, context);
      expect(result).toBe('Literal: ${variable}');
    });

    it('should handle multiple escapes', () => {
      const template = '\\${var1} and \\${var2}';
      const result = engine.render(template, {});
      expect(result).toBe('${var1} and ${var2}');
    });

    it('should mix escaped and non-escaped', () => {
      const template = '\\${literal} but ${real}';
      const context = { real: 'interpolated' };
      const result = engine.render(template, context);
      expect(result).toBe('${literal} but interpolated');
    });
  });

  describe('Conditionals', () => {
    it('should render content when condition is true', () => {
      const template = '${if showMessage}Hello!${endif}';
      const context = { showMessage: true };
      const result = engine.render(template, context);
      expect(result).toBe('Hello!');
    });

    it('should not render content when condition is false', () => {
      const template = '${if showMessage}Hello!${endif}';
      const context = { showMessage: false };
      const result = engine.render(template, context);
      expect(result).toBe('');
    });

    it('should handle nested property conditions', () => {
      const template = '${if user.isActive}User is active${endif}';
      const context = { user: { isActive: true } };
      const result = engine.render(template, context);
      expect(result).toBe('User is active');
    });

    it('should treat non-empty strings as truthy', () => {
      const template = '${if name}Name: ${name}${endif}';
      const context = { name: 'Alice' };
      const result = engine.render(template, context);
      expect(result).toBe('Name: Alice');
    });

    it('should treat empty strings as falsy', () => {
      const template = '${if name}Has name${endif}';
      const context = { name: '' };
      const result = engine.render(template, context);
      expect(result).toBe('');
    });

    it('should treat zero as falsy', () => {
      const template = '${if count}Count: ${count}${endif}';
      const context = { count: 0 };
      const result = engine.render(template, context);
      expect(result).toBe('');
    });

    it('should treat non-zero numbers as truthy', () => {
      const template = '${if count}Count: ${count}${endif}';
      const context = { count: 5 };
      const result = engine.render(template, context);
      expect(result).toBe('Count: 5');
    });

    it('should treat empty arrays as falsy', () => {
      const template = '${if items}Has items${endif}';
      const context = { items: [] };
      const result = engine.render(template, context);
      expect(result).toBe('');
    });

    it('should treat non-empty arrays as truthy', () => {
      const template = '${if items}Has items${endif}';
      const context = { items: [1, 2, 3] };
      const result = engine.render(template, context);
      expect(result).toBe('Has items');
    });

    it('should handle nested conditionals', () => {
      const template = '${if outer}Outer${if inner} and Inner${endif}${endif}';
      const context = { outer: true, inner: true };
      const result = engine.render(template, context);
      expect(result).toBe('Outer and Inner');
    });

    it('should handle undefined conditions as falsy', () => {
      const template = '${if undefinedVar}Should not show${endif}';
      const result = engine.render(template, {});
      expect(result).toBe('');
    });
  });

  describe('Loops', () => {
    it('should iterate over arrays', () => {
      const template = '${foreach item in items}${item} ${endforeach}';
      const context = { items: ['a', 'b', 'c'] };
      const result = engine.render(template, context);
      expect(result).toBe('a b c ');
    });

    it('should handle empty arrays', () => {
      const template = '${foreach item in items}${item}${endforeach}';
      const context = { items: [] };
      const result = engine.render(template, context);
      expect(result).toBe('');
    });

    it('should handle undefined collections', () => {
      const template = '${foreach item in undefinedArray}${item}${endforeach}';
      const result = engine.render(template, {});
      expect(result).toBe('');
    });

    it('should handle non-array values', () => {
      const template = '${foreach item in notArray}${item}${endforeach}';
      const context = { notArray: 'string' };
      const result = engine.render(template, context);
      expect(result).toBe('');
    });

    it('should access loop item properties', () => {
      const template = '${foreach user in users}Name: ${user.name}, Age: ${user.age}\n${endforeach}';
      const context = {
        users: [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 }
        ]
      };
      const result = engine.render(template, context);
      expect(result).toBe('Name: Alice, Age: 25\nName: Bob, Age: 30\n');
    });

    it('should handle nested loops', () => {
      const template = '${foreach group in groups}Group: ${group.name}\n${foreach member in group.members}  - ${member}\n${endforeach}${endforeach}';
      const context = {
        groups: [
          { name: 'A', members: ['Alice', 'Amy'] },
          { name: 'B', members: ['Bob', 'Bill'] }
        ]
      };
      const result = engine.render(template, context);
      expect(result).toBe('Group: A\n  - Alice\n  - Amy\nGroup: B\n  - Bob\n  - Bill\n');
    });

    it('should handle conditionals inside loops', () => {
      const template = '${foreach num in numbers}${if num}${num} ${endif}${endforeach}';
      const context = { numbers: [1, 0, 2, 0, 3] };
      const result = engine.render(template, context);
      expect(result).toBe('1 2 3 ');
    });

    it('should handle loops inside conditionals', () => {
      const template = '${if showList}${foreach item in items}${item} ${endforeach}${endif}';
      const context = { showList: true, items: ['a', 'b', 'c'] };
      const result = engine.render(template, context);
      expect(result).toBe('a b c ');
    });

    it('should handle nested property paths in loops', () => {
      const template = '${foreach item in data.items}${item} ${endforeach}';
      const context = { data: { items: [1, 2, 3] } };
      const result = engine.render(template, context);
      expect(result).toBe('1 2 3 ');
    });
  });

  describe('Filters', () => {
    it('should apply uppercase filter', () => {
      const template = '${name | uppercase}';
      const context = { name: 'alice' };
      const result = engine.render(template, context);
      expect(result).toBe('ALICE');
    });

    it('should apply lowercase filter', () => {
      const template = '${name | lowercase}';
      const context = { name: 'BOB' };
      const result = engine.render(template, context);
      expect(result).toBe('bob');
    });

    it('should apply capitalize filter', () => {
      const template = '${name | capitalize}';
      const context = { name: 'aLiCe' };
      const result = engine.render(template, context);
      expect(result).toBe('Alice');
    });

    it('should apply trim filter', () => {
      const template = '${text | trim}';
      const context = { text: '  hello  ' };
      const result = engine.render(template, context);
      expect(result).toBe('hello');
    });

    it('should apply truncate filter with default length', () => {
      const template = '${text | truncate}';
      const context = { text: 'a'.repeat(60) };
      const result = engine.render(template, context);
      expect(result).toBe('a'.repeat(50) + '...');
    });

    it('should apply truncate filter with custom length', () => {
      const template = '${text | truncate(10)}';
      const context = { text: 'This is a long text' };
      const result = engine.render(template, context);
      expect(result).toBe('This is a ...');
    });

    it('should not truncate if text is shorter than limit', () => {
      const template = '${text | truncate(20)}';
      const context = { text: 'Short text' };
      const result = engine.render(template, context);
      expect(result).toBe('Short text');
    });

    it('should apply default filter for undefined values', () => {
      const template = '${undefinedVar | default(N/A)}';
      const result = engine.render(template, {});
      expect(result).toBe('N/A');
    });

    it('should apply default filter for null values', () => {
      const template = '${nullVar | default(Unknown)}';
      const context = { nullVar: null };
      const result = engine.render(template, context);
      expect(result).toBe('Unknown');
    });

    it('should apply default filter for empty strings', () => {
      const template = '${emptyStr | default(Empty)}';
      const context = { emptyStr: '' };
      const result = engine.render(template, context);
      expect(result).toBe('Empty');
    });

    it('should not apply default filter for valid values', () => {
      const template = '${value | default(Fallback)}';
      const context = { value: 'Actual' };
      const result = engine.render(template, context);
      expect(result).toBe('Actual');
    });

    it('should chain multiple filters', () => {
      const template = '${text | trim | uppercase | truncate(5)}';
      const context = { text: '  hello world  ' };
      const result = engine.render(template, context);
      expect(result).toBe('HELLO...');
    });

    it('should handle filters on undefined values', () => {
      const template = '${undefinedVar | uppercase}';
      const result = engine.render(template, {});
      expect(result).toBe('');
    });

    it('should throw error for unknown filter', () => {
      const template = '${name | unknownFilter}';
      expect(() => engine.render(template, { name: 'test' })).toThrow(TemplateError);
    });
  });

  describe('Complex templates', () => {
    it('should handle mixed content', () => {
      const template = [
        'Hello ${user.name}!',
        '',
        '${if user.messages}',
        'You have ${user.messageCount} messages:',
        '${foreach message in user.messages}',
        '  - ${message.subject | truncate(30)}',
        '${endforeach}',
        '${endif}',
        '',
        '${if user.isAdmin}',
        'Admin panel: enabled',
        '${endif}'
      ].join('\n');
      const context = {
        user: {
          name: 'Alice',
          messages: [
            { subject: 'Welcome to our platform!' },
            { subject: 'Your order has been shipped and will arrive soon' }
          ],
          messageCount: 2,
          isAdmin: true
        }
      };
      const result = engine.render(template, context);
      expect(result).toContain('Hello Alice!');
      expect(result).toContain('You have 2 messages:');
      expect(result).toContain('Welcome to our platform!');
      expect(result).toContain('Your order has been shipped an...');
      expect(result).toContain('Admin panel: enabled');
    });

    it('should handle template with all features', () => {
      const template = [
        '${foreach user in users}',
        'User: ${user.name | capitalize}',
        '${if user.email}Email: ${user.email | lowercase}${endif}',
        '${if user.tags}',
        'Tags: ${foreach tag in user.tags}#${tag} ${endforeach}',
        '${endif}',
        '---',
        '${endforeach}'
      ].join('\n');
      const context = {
        users: [
          {
            name: 'alice',
            email: 'ALICE@EXAMPLE.COM',
            tags: ['developer', 'team-lead']
          },
          {
            name: 'bob',
            tags: ['designer']
          }
        ]
      };
      const result = engine.render(template, context);
      expect(result).toContain('User: Alice');
      expect(result).toContain('Email: alice@example.com');
      expect(result).toContain('#developer #team-lead');
      expect(result).toContain('User: Bob');
      expect(result).not.toContain('Bob\nEmail:'); // Bob has no email
      expect(result).toContain('#designer');
    });

    it('should handle loops with empty template', () => {
      const template = '${foreach item in items}${endforeach}';
      const context = { items: [1, 2, 3] };
      const result = engine.render(template, context);
      expect(result).toBe('');
    });
  });

  describe('Error handling', () => {
    it('should throw error for unclosed variable', () => {
      const template = 'Hello ${name';
      expect(() => engine.render(template, {})).toThrow(TemplateError);
    });

    it('should throw error for unclosed conditional', () => {
      const template = '${if condition}Hello';
      expect(() => engine.render(template, {})).toThrow(TemplateError);
    });

    it('should throw error for unclosed loop', () => {
      const template = '${foreach item in items}${item}';
      expect(() => engine.render(template, {})).toThrow(TemplateError);
    });

    it('should throw error for invalid foreach syntax', () => {
      const template = '${foreach invalid syntax}${endforeach}';
      expect(() => engine.render(template, {})).toThrow(TemplateError);
    });

    it('should throw error for mismatched blocks', () => {
      const template = '${if condition}${endforeach}';
      expect(() => engine.render(template, {})).toThrow(TemplateError);
    });

    it('should throw error for invalid filter syntax', () => {
      const template = '${value | invalid(syntax}';
      expect(() => engine.render(template, {})).toThrow(TemplateError);
    });
  });

  describe('Template validation', () => {
    it('should validate correct template', () => {
      const template = 'Hello ${name}! ${if showMessage}Welcome!${endif}';
      const result = engine.validate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect unclosed variables', () => {
      const template = 'Hello ${name';
      const result = engine.validate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Unclosed');
    });

    it('should detect unclosed conditionals', () => {
      const template = '${if condition}Hello';
      const result = engine.validate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should detect invalid foreach syntax', () => {
      const template = '${foreach invalid}${endforeach}';
      const result = engine.validate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should detect unknown filters', () => {
      const template = '${value | unknownFilter}';
      const result = engine.validate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('Unknown filter');
    });
  });

  describe('Cache management', () => {
    it('should cache compiled templates', () => {
      const template = 'Hello ${name}!';
      const context1 = { name: 'Alice' };
      const context2 = { name: 'Bob' };

      // First render should compile
      const result1 = engine.render(template, context1);
      expect(result1).toBe('Hello Alice!');

      // Second render should use cache
      const result2 = engine.render(template, context2);
      expect(result2).toBe('Hello Bob!');
    });

    it('should clear cache', () => {
      const template = 'Hello ${name}!';
      engine.render(template, { name: 'Test' });
      
      // Clear cache
      engine.clearCache();
      
      // Should still work after cache clear
      const result = engine.render(template, { name: 'Alice' });
      expect(result).toBe('Hello Alice!');
    });
  });

  describe('Security', () => {
    it('should not execute JavaScript code', () => {
      const template = '${constructor.constructor("return process.exit()")()}';
      const result = engine.render(template, {});
      expect(result).toBe(''); // Should safely return empty, not execute
    });

    it('should not access prototype properties', () => {
      const template = '${__proto__.polluted}';
      const result = engine.render(template, {});
      expect(result).toBe('');
    });

    it('should handle malicious property paths safely', () => {
      const template = '${user[__proto__][polluted]}';
      const context = { user: { name: 'Alice' } };
      const result = engine.render(template, context);
      expect(result).toBe('');
    });

    it('should not allow code injection through filters', () => {
      const template = '${value | unknownFilter}';
      const context = { value: 'test' };
      expect(() => engine.render(template, context)).toThrow(TemplateError);
    });
  });

  describe('Performance considerations', () => {
    it('should handle large templates efficiently', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`
      }));

      const template = [
        '${foreach item in items}',
        'ID: ${item.id}',
        'Name: ${item.name | uppercase}',
        'Description: ${item.description | truncate(20)}',
        '${if item.id}Active${endif}',
        '---',
        '${endforeach}'
      ].join('\n');

      const start = Date.now();
      const result = engine.render(template, { items });
      const duration = Date.now() - start;

      // Should complete in reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      expect(result).toContain('ID: 0');
      expect(result).toContain('ID: 999');
    });

    it('should handle deeply nested structures', () => {
      // Create deeply nested context
      let value = 'deep';
      for (let i = 0; i < 10; i++) {
        value = { level: value } as any;
      }
      
      // Build the nested path
      const path = 'level.'.repeat(10) + 'level';
      const template = 'Value: ${' + path + '}';
      const context = { level: value };

      const result = engine.render(template, context);
      expect(result).toBe('Value: deep');
    });
  });
});