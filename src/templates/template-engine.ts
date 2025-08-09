/**
 * Template Engine for rendering prompts with context variables
 * Supports variable interpolation, conditionals, loops, and filters
 */

import { TemplateError } from '../core/errors';

/**
 * Token types for template parsing
 */
enum TokenType {
  TEXT = 'TEXT',
  VARIABLE = 'VARIABLE',
  IF_START = 'IF_START',
  IF_END = 'IF_END',
  FOREACH_START = 'FOREACH_START',
  FOREACH_END = 'FOREACH_END',
  ESCAPE = 'ESCAPE',
}

/**
 * Token representation
 */
interface Token {
  type: TokenType;
  value: string;
  position: number;
}

/**
 * AST node types
 */
type ASTNode = TextNode | VariableNode | ConditionalNode | LoopNode;

interface TextNode {
  type: 'text';
  value: string;
}

interface VariableNode {
  type: 'variable';
  path: string;
  filters: string[];
}

interface ConditionalNode {
  type: 'conditional';
  condition: string;
  trueBranch: ASTNode[];
  falseBranch?: ASTNode[];
}

interface LoopNode {
  type: 'loop';
  itemName: string;
  collectionPath: string;
  body: ASTNode[];
}

/**
 * Built-in filter functions
 */
const FILTERS: Record<string, (value: unknown, ...args: string[]) => string> = {
  uppercase: (value) => String(value).toUpperCase(),
  lowercase: (value) => String(value).toLowerCase(),
  truncate: (value, length = '50') => {
    const str = String(value);
    const len = parseInt(length, 10);
    return str.length > len ? str.substring(0, len) + '...' : str;
  },
  capitalize: (value) => {
    const str = String(value);
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },
  trim: (value) => String(value).trim(),
  default: (value, defaultValue = '') => {
    return value === null || value === undefined || value === '' ? defaultValue : String(value);
  },
};

/**
 * Template Engine implementation
 */
export class TemplateEngine {
  private compiledCache = new Map<string, ASTNode[]>();

  /**
   * Render a template with the given context
   */
  render(template: string, context: Record<string, unknown>): string {
    const ast = this.parse(template);
    return this.evaluate(ast, context);
  }

  /**
   * Validate template syntax without rendering
   */
  validate(template: string): { valid: boolean; errors?: string[] } {
    try {
      this.parse(template);
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, errors: [message] };
    }
  }

  /**
   * Parse template into AST
   */
  private parse(template: string): ASTNode[] {
    // Check cache first
    const cached = this.compiledCache.get(template);
    if (cached) {
      return cached;
    }

    const tokens = this.tokenize(template);
    const ast = this.buildAST(tokens);

    // Cache the result
    this.compiledCache.set(template, ast);
    return ast;
  }

  /**
   * Tokenize template string
   */
  private tokenize(template: string): Token[] {
    const tokens: Token[] = [];
    let position = 0;
    let textBuffer = '';

    while (position < template.length) {
      // Check for escape sequence
      if (template.substring(position, position + 3) === '\\${') {
        textBuffer += '${';
        position += 3;
        continue;
      }

      // Check for template expression
      if (template.substring(position, position + 2) === '${') {
        // Save any buffered text
        if (textBuffer) {
          tokens.push({ type: TokenType.TEXT, value: textBuffer, position });
          textBuffer = '';
        }

        // Find the closing }
        const closeIndex = template.indexOf('}', position + 2);
        if (closeIndex === -1) {
          throw new TemplateError(`Unclosed template expression at position ${position}`);
        }

        const expression = template.substring(position + 2, closeIndex).trim();

        // Determine token type based on expression content
        if (expression.startsWith('if ')) {
          tokens.push({
            type: TokenType.IF_START,
            value: expression.substring(3).trim(),
            position,
          });
        } else if (expression === 'endif') {
          tokens.push({ type: TokenType.IF_END, value: '', position });
        } else if (expression.startsWith('foreach ')) {
          tokens.push({
            type: TokenType.FOREACH_START,
            value: expression.substring(8).trim(),
            position,
          });
        } else if (expression === 'endforeach') {
          tokens.push({ type: TokenType.FOREACH_END, value: '', position });
        } else {
          tokens.push({ type: TokenType.VARIABLE, value: expression, position });
        }

        position = closeIndex + 1;
      } else {
        textBuffer += template[position];
        position++;
      }
    }

    // Add any remaining text
    if (textBuffer) {
      tokens.push({ type: TokenType.TEXT, value: textBuffer, position });
    }

    return tokens;
  }

  /**
   * Build AST from tokens
   */
  private buildAST(tokens: Token[]): ASTNode[] {
    const nodes: ASTNode[] = [];
    let index = 0;

    while (index < tokens.length) {
      const token = tokens[index];

      switch (token.type) {
        case TokenType.TEXT:
          nodes.push({ type: 'text', value: token.value });
          index++;
          break;

        case TokenType.VARIABLE:
          nodes.push(this.parseVariable(token.value));
          index++;
          break;

        case TokenType.IF_START: {
          const result = this.parseConditional(tokens, index);
          nodes.push(result.node);
          index = result.nextIndex;
          break;
        }

        case TokenType.FOREACH_START: {
          const result = this.parseLoop(tokens, index);
          nodes.push(result.node);
          index = result.nextIndex;
          break;
        }

        default:
          throw new TemplateError(`Unexpected token ${token.type} at position ${token.position}`);
      }
    }

    return nodes;
  }

  /**
   * Parse variable expression with filters
   */
  private parseVariable(expression: string): VariableNode {
    const parts = expression.split('|').map((p) => p.trim());
    const path = parts[0];
    const filters = parts.slice(1);

    // Validate filter names
    for (const filter of filters) {
      const filterName = filter.split('(')[0].trim();
      if (!FILTERS[filterName]) {
        throw new TemplateError(`Unknown filter: ${filterName}`);
      }
    }

    return { type: 'variable', path, filters };
  }

  /**
   * Parse conditional block
   */
  private parseConditional(
    tokens: Token[],
    startIndex: number
  ): { node: ConditionalNode; nextIndex: number } {
    const condition = tokens[startIndex].value;
    const trueBranch: ASTNode[] = [];
    let index = startIndex + 1;

    while (index < tokens.length) {
      const token = tokens[index];

      if (token.type === TokenType.IF_END) {
        return {
          node: { type: 'conditional', condition, trueBranch },
          nextIndex: index + 1,
        };
      }

      // Handle nested structures
      if (token.type === TokenType.IF_START) {
        const result = this.parseConditional(tokens, index);
        trueBranch.push(result.node);
        index = result.nextIndex;
      } else if (token.type === TokenType.FOREACH_START) {
        const result = this.parseLoop(tokens, index);
        trueBranch.push(result.node);
        index = result.nextIndex;
      } else if (token.type === TokenType.TEXT) {
        trueBranch.push({ type: 'text', value: token.value });
        index++;
      } else if (token.type === TokenType.VARIABLE) {
        trueBranch.push(this.parseVariable(token.value));
        index++;
      } else {
        throw new TemplateError(`Unexpected token in conditional at position ${token.position}`);
      }
    }

    throw new TemplateError('Unclosed conditional block');
  }

  /**
   * Parse loop block
   */
  private parseLoop(tokens: Token[], startIndex: number): { node: LoopNode; nextIndex: number } {
    const loopExpr = tokens[startIndex].value;
    const match = loopExpr.match(/^(\w+)\s+in\s+(.+)$/);

    if (!match) {
      throw new TemplateError(
        `Invalid foreach syntax: ${loopExpr}. Expected: "item in collection"`
      );
    }

    const [, itemName, collectionPath] = match;
    const body: ASTNode[] = [];
    let index = startIndex + 1;

    while (index < tokens.length) {
      const token = tokens[index];

      if (token.type === TokenType.FOREACH_END) {
        return {
          node: { type: 'loop', itemName, collectionPath, body },
          nextIndex: index + 1,
        };
      }

      // Handle nested structures
      if (token.type === TokenType.IF_START) {
        const result = this.parseConditional(tokens, index);
        body.push(result.node);
        index = result.nextIndex;
      } else if (token.type === TokenType.FOREACH_START) {
        const result = this.parseLoop(tokens, index);
        body.push(result.node);
        index = result.nextIndex;
      } else if (token.type === TokenType.TEXT) {
        body.push({ type: 'text', value: token.value });
        index++;
      } else if (token.type === TokenType.VARIABLE) {
        body.push(this.parseVariable(token.value));
        index++;
      } else {
        throw new TemplateError(`Unexpected token in loop at position ${token.position}`);
      }
    }

    throw new TemplateError('Unclosed foreach block');
  }

  /**
   * Evaluate AST with context
   */
  private evaluate(nodes: ASTNode[], context: Record<string, unknown>): string {
    let result = '';

    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          result += node.value;
          break;

        case 'variable':
          result += this.evaluateVariable(node, context);
          break;

        case 'conditional':
          result += this.evaluateConditional(node, context);
          break;

        case 'loop':
          result += this.evaluateLoop(node, context);
          break;
      }
    }

    return result;
  }

  /**
   * Evaluate variable with filters
   */
  private evaluateVariable(node: VariableNode, context: Record<string, unknown>): string {
    let value = this.resolvePath(node.path, context);

    // If there are filters and value is undefined/null, convert to empty string first
    if (node.filters.length > 0 && (value === undefined || value === null)) {
      value = '';
    }

    // Apply filters
    for (const filterExpr of node.filters) {
      const match = filterExpr.match(/^(\w+)(?:\(([^)]*)\))?$/);
      if (!match) {
        throw new TemplateError(`Invalid filter syntax: ${filterExpr}`);
      }

      const [, filterName, argsStr] = match;
      const filter = FILTERS[filterName];
      if (!filter) {
        throw new TemplateError(`Unknown filter: ${filterName}`);
      }

      const args = argsStr ? argsStr.split(',').map((a) => a.trim()) : [];
      value = filter(value, ...args);
    }

    return String(value ?? '');
  }

  /**
   * Evaluate conditional
   */
  private evaluateConditional(node: ConditionalNode, context: Record<string, unknown>): string {
    const conditionValue = this.resolvePath(node.condition, context);
    const isTruthy = this.isTruthy(conditionValue);

    if (isTruthy) {
      return this.evaluate(node.trueBranch, context);
    } else if (node.falseBranch) {
      return this.evaluate(node.falseBranch, context);
    }

    return '';
  }

  /**
   * Evaluate loop
   */
  private evaluateLoop(node: LoopNode, context: Record<string, unknown>): string {
    const collection = this.resolvePath(node.collectionPath, context);

    if (!Array.isArray(collection)) {
      return '';
    }

    let result = '';
    for (const item of collection) {
      const loopContext = { ...context, [node.itemName]: item as unknown };
      result += this.evaluate(node.body, loopContext);
    }

    return result;
  }

  /**
   * Resolve property path in context
   */
  private resolvePath(path: string, context: Record<string, unknown>): unknown {
    // Handle special context variables
    if (path === '.') {
      return context;
    }

    const parts = path.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }

      if (typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, part)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Check if value is truthy for conditionals
   */
  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (value === false || value === 0 || value === '') {
      return false;
    }
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    return true;
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.compiledCache.clear();
  }
}
