// engine/formula.js
// Avaliador de expressões usado pelas fórmulas declaradas em um system.json.
// É um pequeno interpretador (tokenizer + parser recursivo), não usa eval()/Function()
// para nunca executar código arbitrário vindo de um JSON importado/carregado.
//
// Gramática suportada: + - * / % ( ) , comparações (== != < <= > >=),
// lógicos (&& || !), literais numéricos/booleanos, identificadores (podem ter pontos,
// ex. "abilities.strength.score") e chamadas de função: floor, ceil, round, abs,
// sqrt, min, max, if(cond, a, b).
import { getByPath, pathKeys } from './paths.js';

export const FORMULA_LIMITS = Object.freeze({ length: 4096, tokens: 2048, nodes: 2048, depth: 64, operations: 10000, cache: 256 });

const FUNCTIONS = {
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  sqrt: Math.sqrt,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  if: (cond, a, b) => (cond ? a : b),
};

function tokenize(expression) {
  const tokens = [];
  const src = expression;
  let i = 0;
  while (i < src.length) {
    if (tokens.length >= FORMULA_LIMITS.tokens) throw new Error('Fórmula excede 2048 tokens.');
    const ch = src[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < src.length && /[0-9.]/.test(src[i])) i += 1;
      const literal = src.slice(start, i);
      if (!/^\d+(?:\.\d+)?$/.test(literal)) throw new Error(`Número inválido na fórmula: "${literal}"`);
      tokens.push({ type: 'number', value: Number(literal) });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_.]/.test(src[i])) i += 1;
      tokens.push({ type: 'identifier', value: src.slice(start, i) });
      continue;
    }
    if (ch === '&' && src[i + 1] === '&') { tokens.push({ type: '&&' }); i += 2; continue; }
    if (ch === '|' && src[i + 1] === '|') { tokens.push({ type: '||' }); i += 2; continue; }
    if (ch === '=' && src[i + 1] === '=') { tokens.push({ type: '==' }); i += 2; continue; }
    if (ch === '!' && src[i + 1] === '=') { tokens.push({ type: '!=' }); i += 2; continue; }
    if (ch === '<' && src[i + 1] === '=') { tokens.push({ type: '<=' }); i += 2; continue; }
    if (ch === '>' && src[i + 1] === '=') { tokens.push({ type: '>=' }); i += 2; continue; }
    if ('+-*/%(),<>!'.includes(ch)) { tokens.push({ type: ch }); i += 1; continue; }
    throw new Error(`Caractere inesperado na fórmula: "${ch}"`);
  }
  tokens.push({ type: 'eof' });
  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.depth = 0;
  }

  peek() { return this.tokens[this.pos]; }

  next() {
    const tok = this.tokens[this.pos];
    this.pos += 1;
    return tok;
  }

  expect(type) {
    const tok = this.next();
    if (tok.type !== type) throw new Error(`Esperado "${type}" mas encontrado "${tok.type}"`);
    return tok;
  }

  parseExpression() { return this.parseOr(); }

  parseOr() {
    let node = this.parseAnd();
    while (this.peek().type === '||') { this.next(); node = { op: '||', left: node, right: this.parseAnd() }; }
    return node;
  }

  parseAnd() {
    let node = this.parseEquality();
    while (this.peek().type === '&&') { this.next(); node = { op: '&&', left: node, right: this.parseEquality() }; }
    return node;
  }

  parseEquality() {
    let node = this.parseComparison();
    while (this.peek().type === '==' || this.peek().type === '!=') {
      const op = this.next().type;
      node = { op, left: node, right: this.parseComparison() };
    }
    return node;
  }

  parseComparison() {
    let node = this.parseAdditive();
    while (['<', '<=', '>', '>='].includes(this.peek().type)) {
      const op = this.next().type;
      node = { op, left: node, right: this.parseAdditive() };
    }
    return node;
  }

  parseAdditive() {
    let node = this.parseMultiplicative();
    while (this.peek().type === '+' || this.peek().type === '-') {
      const op = this.next().type;
      node = { op, left: node, right: this.parseMultiplicative() };
    }
    return node;
  }

  parseMultiplicative() {
    let node = this.parseUnary();
    while (['*', '/', '%'].includes(this.peek().type)) {
      const op = this.next().type;
      node = { op, left: node, right: this.parseUnary() };
    }
    return node;
  }

  parseUnary() {
    if (++this.depth > FORMULA_LIMITS.depth) throw new Error('Fórmula excede profundidade 64.');
    try {
      if (this.peek().type === '-') { this.next(); return { op: 'neg', value: this.parseUnary() }; }
      if (this.peek().type === '!') { this.next(); return { op: 'not', value: this.parseUnary() }; }
      return this.parsePrimary();
    } finally { this.depth -= 1; }
  }

  parsePrimary() {
    const tok = this.peek();
    if (tok.type === 'number') { this.next(); return { op: 'literal', value: tok.value }; }
    if (tok.type === '(') {
      this.next();
      const node = this.parseExpression();
      this.expect(')');
      return node;
    }
    if (tok.type === 'identifier') {
      this.next();
      if (tok.value === 'true') return { op: 'literal', value: true };
      if (tok.value === 'false') return { op: 'literal', value: false };
      if (this.peek().type === '(') {
        this.next();
        const args = [];
        if (this.peek().type !== ')') {
          args.push(this.parseExpression());
          while (this.peek().type === ',') { this.next(); args.push(this.parseExpression()); }
        }
        this.expect(')');
        return { op: 'call', name: tok.value, args };
      }
      return { op: 'identifier', name: tok.value };
    }
    throw new Error(`Token inesperado na fórmula: "${tok.type}"`);
  }
}

function evalNode(node, scope) {
  if (++scope.operations > FORMULA_LIMITS.operations) throw new Error('Fórmula excede o orçamento de operações.');
  switch (node.op) {
    case 'literal': return node.value;
    case 'identifier': return resolveIdentifier(node.name, scope);
    case 'neg': return -evalNode(node.value, scope);
    case 'not': return !evalNode(node.value, scope);
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!Object.hasOwn(FUNCTIONS, node.name)) throw new Error(`Função desconhecida na fórmula: "${node.name}"`);
      return fn(...node.args.map((a) => evalNode(a, scope)));
    }
    case '+': return evalNode(node.left, scope) + evalNode(node.right, scope);
    case '-': return evalNode(node.left, scope) - evalNode(node.right, scope);
    case '*': return evalNode(node.left, scope) * evalNode(node.right, scope);
    case '/': return evalNode(node.left, scope) / evalNode(node.right, scope);
    case '%': return evalNode(node.left, scope) % evalNode(node.right, scope);
    case '==': return evalNode(node.left, scope) === evalNode(node.right, scope);
    case '!=': return evalNode(node.left, scope) !== evalNode(node.right, scope);
    case '<': return evalNode(node.left, scope) < evalNode(node.right, scope);
    case '<=': return evalNode(node.left, scope) <= evalNode(node.right, scope);
    case '>': return evalNode(node.left, scope) > evalNode(node.right, scope);
    case '>=': return evalNode(node.left, scope) >= evalNode(node.right, scope);
    case '&&': return evalNode(node.left, scope) && evalNode(node.right, scope);
    case '||': return evalNode(node.left, scope) || evalNode(node.right, scope);
    default: throw new Error(`Operação desconhecida na fórmula: "${node.op}"`);
  }
}

function resolveIdentifier(name, scope) {
  if (scope.vars && Object.prototype.hasOwnProperty.call(scope.vars, name)) return scope.vars[name];
  if (scope.data) {
    const value = getByPath(scope.data, name);
    if (value !== undefined) return value;
  }
  throw new Error(`Identificador não definido na fórmula: "${name}"`);
}

const astCache = new Map();

export function validateFormula(expression) {
  if (typeof expression !== 'string' || !expression.trim() || expression.length > FORMULA_LIMITS.length) throw new Error('Fórmula deve conter de 1 a 4096 caracteres.');
  const parser = new Parser(tokenize(expression));
  const ast = parser.parseExpression();
  parser.expect('eof');
  const pending = [{ node: ast, depth: 1 }];
  let count = 0;
  while (pending.length) {
    const {node, depth} = pending.pop();
    if (++count > FORMULA_LIMITS.nodes || depth > FORMULA_LIMITS.depth) throw new Error('Fórmula excede limites de nós ou profundidade.');
    if (node.op === 'call' && !Object.hasOwn(FUNCTIONS, node.name)) throw new Error(`Função desconhecida na fórmula: "${node.name}"`);
    if (node.op === 'identifier') pathKeys(node.name);
    for (const child of [node.left, node.right, typeof node.value === 'object' ? node.value : null, ...(node.args || [])]) {
      if (child) pending.push({node: child, depth: depth + 1});
    }
  }
  return ast;
}

/**
 * Avalia uma expressão de fórmula contra um escopo de variáveis.
 * scope = { vars: { nome: valor, ... }, data: objetoOpcionalParaCaminhosPontilhados }
 */
export function evaluate(expression, scope = {}) {
  let ast = astCache.get(expression);
  if (!ast) {
    ast = validateFormula(expression);
    if (astCache.size >= FORMULA_LIMITS.cache) astCache.delete(astCache.keys().next().value);
    astCache.set(expression, ast);
  }
  const result = evalNode(ast, { ...scope, operations: 0 });
  if (typeof result !== 'boolean' && (typeof result !== 'number' || !Number.isFinite(result))) throw new Error('Fórmula deve produzir um número finito ou booleano.');
  return result;
}
