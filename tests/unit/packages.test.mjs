import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateManifest, validateSystemPackage, validateCharacterForPackage } from '../../js/validation/schemas.js';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../../data/systems/index.json');
const example = read('../../data/examples/check-rolls.package.json');
test('exemplo de checkRoll independente dos IDs dos sistemas', () => assert.deepEqual(validateSystemPackage(example), []));

test('contrato de checkRoll recusa fontes ambíguas, caminhos e opções inválidas', () => {
  for (const change of [
    config => config.sources[0].formula = 'adjusted',
    config => config.sources[0].field = 'score..value',
    config => config.sources[0].valueField = 'rating',
    config => config.sources[1].formula = 'missing',
    config => config.sources = [],
    config => config.note = '',
    config => config.momentumField = 'score',
    config => config.script = 'alert(1)',
  ]) {
    const pkg = structuredClone(example); change(pkg.system.checks.action);
    assert.ok(validateSystemPackage(pkg).length > 0);
  }
  const pkg = structuredClone(example);
  pkg.layouts[0].tabs[0].sections[0].containers[0].components.at(-1).configFrom = 'checks.missing';
  assert.ok(validateSystemPackage(pkg).some(issue => issue.path.endsWith('.configFrom')));
});

test('fontes ocultas no layout também validam valores e IDs antes de importar', () => {
  const pkg = structuredClone(example);
  pkg.layouts[0].tabs[0].sections[0].containers[0].components = [pkg.layouts[0].tabs[0].sections[0].containers[0].components.at(-1)];
  const original = { ...pkg.system.characterTemplate, meta: { system: pkg.system.id, id: 'test' } };
  for (const change of [
    c => c.score = '2', c => c.score = Infinity,
    c => c.skills = {}, c => c.skills = [null],
    c => c.skills[0].rating = '3',
    c => c.skills.push({...c.skills[0]}),
  ]) {
    const character = structuredClone(original); change(character);
    assert.ok(validateCharacterForPackage(character,pkg).length > 0);
  }
  const optional = structuredClone(original); delete optional.score; delete optional.skills;
  assert.deepEqual(validateCharacterForPackage(optional,pkg), []);
});
test('manifesto público válido e IDs únicos', () => assert.deepEqual(validateManifest(manifest), []));
for (const entry of manifest.systems) test(`pacote ${entry.id}: contrato, template e roundtrip JSON`, () => {
  const pkg = { schemaVersion: 1, kind: 'rpg-system-package', system: read(`../../data/systems/${entry.system}`), layouts: entry.layouts.map(layout => read(`../../data/systems/${layout.file}`)) };
  pkg.schemaVersion = Math.max(pkg.system.schemaVersion,...pkg.layouts.map(layout=>layout.schemaVersion));
  assert.deepEqual(validateSystemPackage(pkg), []);
  const character = { ...structuredClone(pkg.system.characterTemplate), meta: { ...pkg.system.characterTemplate.meta, id: 'contract-test' } };
  assert.deepEqual(validateCharacterForPackage(character, pkg), []);
  assert.deepEqual(JSON.parse(JSON.stringify(character)), character);
  if (pkg.system.checks) {
    const invalid = structuredClone(pkg); Object.values(invalid.system.checks)[0].algorithm = 'unknown';
    assert.ok(validateSystemPackage(invalid).some(issue => issue.path.endsWith('.algorithm')));
    Object.values(invalid.system.checks)[0].sources[0].field = '__proto__.polluted';
    assert.ok(validateSystemPackage(invalid).length > 0);
  }
});
