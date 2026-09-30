// engine/formula.js
// Avaliador de expressões usado pelas fórmulas declaradas em um system.json.
// É um pequeno interpretador (tokenizer + parser recursivo), não usa eval()/Function()
// para nunca executar código arbitrário vindo de um JSON importado/carregado.
//
// Gramática suportada: + - * / % ( ) , comparações (== != < <= > >=),
// lógicos (&& || !), literais numéricos/booleanos, identificadores (podem ter pontos,
// ex. "abilities.strength.score") e chamadas de função: floor, ceil, round, abs,
// sqrt, min, max, if(cond, a, b).
import { getByPath } from './paths.js';

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
    const ch = src[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < src.length && /[0-9.]/.test(src[i])) i += 1;
      tokens.push({ type: 'number', value: parseFloat(src.slice(start, i)) });
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
    if (this.peek().type === '-') { this.next(); return { op: 'neg', value: this.parseUnary() }; }
    if (this.peek().type === '!') { this.next(); return { op: 'not', value: this.parseUnary() }; }
    return this.parsePrimary();
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
  switch (node.op) {
    case 'literal': return node.value;
    case 'identifier': return resolveIdentifier(node.name, scope);
    case 'neg': return -evalNode(node.value, scope);
    case 'not': return !evalNode(node.value, scope);
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new Error(`Função desconhecida na fórmula: "${node.name}"`);
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

/**
 * Avalia uma expressão de fórmula contra um escopo de variáveis.
 * scope = { vars: { nome: valor, ... }, data: objetoOpcionalParaCaminhosPontilhados }
 */
export function evaluate(expression, scope = {}) {
  let ast = astCache.get(expression);
  if (!ast) {
    ast = new Parser(tokenize(expression)).parseExpression();
    astCache.set(expression, ast);
  }
  return evalNode(ast, scope);
}
