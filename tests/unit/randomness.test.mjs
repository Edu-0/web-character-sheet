import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rollOne} from '../../js/engine/dice-resolver.js';

const range = 0x100000000;
const source = (...words) => array => {
  assert.ok(array instanceof Uint32Array);
  assert.equal(array.length, 1);
  assert.ok(words.length, 'consulta aleatória inesperada');
  array[0] = words.shift();
};

test('faces têm intervalos inteiros iguais; sobra é descartada antes do resultado', () => {
  for (const sides of [1,3,6,20,100,100000,range]) {
    const bucket = Math.floor(range / sides), limit = bucket * sides;
    for (const face of new Set([1,Math.ceil(sides / 2),sides])) {
      assert.equal(rollOne(sides, source((face - 1) * bucket)), face);
      assert.equal(rollOne(sides, source(face * bucket - 1)), face);
    }
    if (limit < range) {
      assert.equal(rollOne(sides, source(limit, range - 1, 0)), 1);
      assert.equal(rollOne(sides, source(limit, limit - 1)), sides);
    }
  }
});

test('faces inválidas não consultam fonte e erro do gerador não vira resultado', () => {
  for (const sides of [undefined,NaN,Infinity,0,-1,1.5,'6',range + 1]) {
    assert.throws(() => rollOne(sides, () => assert.fail('não deve consultar a fonte')), /faces inválido/);
  }
  assert.throws(() => rollOne(6, () => {throw new Error('fonte falhou');}), /fonte falhou/);
});

test('fonte real usa crypto; ausência de crypto falha sem recorrer a Math.random', () => {
  const originalRandom = Math.random;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Math.random = () => assert.fail('Math.random não deve gerar dados');
    for (const sides of [3,6,20,100,100000]) {
      const face = rollOne(sides);
      assert.ok(Number.isInteger(face) && face >= 1 && face <= sides);
    }
    Object.defineProperty(globalThis, 'crypto', {value:undefined,configurable:true});
    assert.throws(() => rollOne(6), /Geração segura de dados indisponível/);
  } finally {
    Math.random = originalRandom;
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});
