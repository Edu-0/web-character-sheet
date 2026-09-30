const SCHEMA_VERSION = 1;

export const KNOWN_COMPONENT_TYPES = new Set([
  'boolean',
  'computed',
  'counter',
  'die',
  'image',
  'list',
  'number',
  'poolBuilder',
  'resource',
  'select',
  'slotTracker',
  'stateList',
  'table',
  'tagList',
  'text',
  'textarea',
]);

const FIELD_COMPONENT_TYPES = new Set([
  'boolean', 'counter', 'die', 'image', 'list', 'number', 'resource', 'select',
  'slotTracker', 'stateList', 'table', 'tagList', 'text', 'textarea',
]);

export class SchemaValidationError extends Error {
  constructor(label, issues) {
    const first = issues[0];
    super(`${first.path}: ${first.message}${issues.length > 1 ? ` (+${issues.length - 1} erro(s))` : ''}`);
    this.name = 'SchemaValidationError';
    this.label = label;
    this.issues = issues;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function add(issues, path, message, code = 'invalid') {
  issues.push({ path, message, code });
}

function requireObject(value, path, issues) {
  if (!isObject(value)) {
    add(issues, path, 'deve ser um objeto');
    return false;
  }
  return true;
}

function requireString(value, path, issues) {
  if (typeof value !== 'string' || value.trim() === '') {
    add(issues, path, 'deve ser uma string não vazia');
    return false;
  }
  return true;
}

function requireArray(value, path, issues, { nonEmpty = false } = {}) {
  if (!Array.isArray(value)) {
    add(issues, path, 'deve ser uma lista');
    return false;
  }
  if (nonEmpty && value.length === 0) add(issues, path, 'deve conter ao menos um item');
  return true;
}

function validateVersion(document, path, issues) {
  if (document?.schemaVersion !== SCHEMA_VERSION) {
    add(issues, `${path}.schemaVersion`, `deve ser ${SCHEMA_VERSION}`, 'schema-version');
  }
}

function validateUniqueIds(items, path, issues) {
  const seen = new Set();
  items.forEach((item, index) => {
    if (!item?.id) return;
    if (seen.has(item.id)) add(issues, `${path}[${index}].id`, `ID duplicado "${item.id}"`, 'duplicate-id');
    seen.add(item.id);
  });
}

export function validateManifest(manifest) {
  const issues = [];
  if (!requireObject(manifest, 'manifest', issues)) return issues;
  validateVersion(manifest, 'manifest', issues);
  if (requireArray(manifest.systems, 'manifest.systems', issues, { nonEmpty: true })) {
    validateUniqueIds(manifest.systems, 'manifest.systems', issues);
    manifest.systems.forEach((entry, index) => {
      const path = `manifest.systems[${index}]`;
      if (!requireObject(entry, path, issues)) return;
      requireString(entry.id, `${path}.id`, issues);
      requireString(entry.name, `${path}.name`, issues);
      requireString(entry.system, `${path}.system`, issues);
      if (requireArray(entry.layouts, `${path}.layouts`, issues, { nonEmpty: true })) {
        validateUniqueIds(entry.layouts, `${path}.layouts`, issues);
        entry.layouts.forEach((layout, layoutIndex) => {
          requireString(layout?.id, `${path}.layouts[${layoutIndex}].id`, issues);
          requireString(layout?.file, `${path}.layouts[${layoutIndex}].file`, issues);
        });
      }
    });
  }
  return issues;
}

export function validateSystem(system) {
  const issues = [];
  if (!requireObject(system, 'system', issues)) return issues;
  validateVersion(system, 'system', issues);
  requireString(system.id, 'system.id', issues);
  requireString(system.name, 'system.name', issues);
  if (!requireObject(system.characterTemplate, 'system.characterTemplate', issues)) return issues;
  issues.push(...validateCharacter(system.characterTemplate, { root: 'system.characterTemplate', allowMissingId: true, expectedSystem: system.id }));
  if (system.formulas !== undefined && requireObject(system.formulas, 'system.formulas', issues)) {
    Object.entries(system.formulas).forEach(([key, formula]) => {
      if (typeof formula !== 'string' || formula.trim() === '') add(issues, `system.formulas.${key}`, 'deve ser uma fórmula não vazia');
    });
  }
  return issues;
}

export function validateLayout(layout, { system = null } = {}) {
  const issues = [];
  if (!requireObject(layout, 'layout', issues)) return issues;
  validateVersion(layout, 'layout', issues);
  requireString(layout.id, 'layout.id', issues);
  requireString(layout.system, 'layout.system', issues);
  if (system && layout.system !== system.id) add(issues, 'layout.system', `deve corresponder ao sistema "${system.id}"`, 'system-mismatch');

  if (requireArray(layout.tabs, 'layout.tabs', issues, { nonEmpty: true })) {
    validateUniqueIds(layout.tabs, 'layout.tabs', issues);
    layout.tabs.forEach((tab, tabIndex) => validateTab(tab, tabIndex, system, issues));
  }
  return issues;
}

function validateTab(tab, tabIndex, system, issues) {
  const path = `layout.tabs[${tabIndex}]`;
  if (!requireObject(tab, path, issues)) return;
  requireString(tab.id, `${path}.id`, issues);
  requireString(tab.label, `${path}.label`, issues);
  if (requireArray(tab.sections, `${path}.sections`, issues, { nonEmpty: true })) {
    validateUniqueIds(tab.sections, `${path}.sections`, issues);
    tab.sections.forEach((section, sectionIndex) => validateSection(section, `${path}.sections[${sectionIndex}]`, system, issues));
  }
}

function validateSection(section, path, system, issues) {
  if (!requireObject(section, path, issues)) return;
  requireString(section.id, `${path}.id`, issues);
  if (requireArray(section.containers, `${path}.containers`, issues, { nonEmpty: true })) {
    validateUniqueIds(section.containers, `${path}.containers`, issues);
    section.containers.forEach((container, index) => validateContainer(container, `${path}.containers[${index}]`, system, issues));
  }
}

function validateContainer(container, path, system, issues) {
  if (!requireObject(container, path, issues)) return;
  if (container.id !== undefined) requireString(container.id, `${path}.id`, issues);
  if (container.layout !== undefined && requireObject(container.layout, `${path}.layout`, issues)) {
    const allowed = new Set(['grid', 'flex', 'stack']);
    if (!allowed.has(container.layout.type)) add(issues, `${path}.layout.type`, `tipo "${container.layout.type}" desconhecido`);
    if (container.layout.gap !== undefined && (!Number.isFinite(container.layout.gap) || container.layout.gap < 0)) {
      add(issues, `${path}.layout.gap`, 'deve ser um número não negativo');
    }
  }
  if (container.repeat !== undefined) {
    if (requireObject(container.repeat, `${path}.repeat`, issues)) requireString(container.repeat.source, `${path}.repeat.source`, issues);
  }
  if (requireArray(container.components, `${path}.components`, issues, { nonEmpty: true })) {
    container.components.forEach((component, index) => validateComponent(component, `${path}.components[${index}]`, system, issues));
  }
}

function validateComponent(component, path, system, issues) {
  if (!requireObject(component, path, issues)) return;
  if (!requireString(component.type, `${path}.type`, issues)) return;
  if (!KNOWN_COMPONENT_TYPES.has(component.type)) {
    add(issues, path, `tipo "${component.type}" desconhecido`, 'unknown-component');
    return;
  }
  if (FIELD_COMPONENT_TYPES.has(component.type)) requireString(component.field, `${path}.field`, issues);
  if (component.type === 'computed') {
    requireString(component.formula, `${path}.formula`, issues);
    if (system && component.formula && !system.formulas?.[component.formula]) {
      add(issues, `${path}.formula`, `fórmula "${component.formula}" não existe em system.formulas`, 'unknown-formula');
    }
  }
}

export function validateCharacter(character, { root = 'character', allowMissingId = false, expectedSystem = null } = {}) {
  const issues = [];
  if (!requireObject(character, root, issues)) return issues;
  validateVersion(character, root, issues);
  if (!requireObject(character.meta, `${root}.meta`, issues)) return issues;
  if (!allowMissingId) requireString(character.meta.id, `${root}.meta.id`, issues);
  requireString(character.meta.system, `${root}.meta.system`, issues);
  if (expectedSystem && character.meta.system !== expectedSystem) {
    add(issues, `${root}.meta.system`, `deve ser "${expectedSystem}"`, 'system-mismatch');
  }
  return issues;
}

export function validateSystemPackage(pkg) {
  const issues = [];
  if (!requireObject(pkg, 'package', issues)) return issues;
  validateVersion(pkg, 'package', issues);
  if (pkg.kind !== 'rpg-system-package') add(issues, 'package.kind', 'deve ser "rpg-system-package"');
  issues.push(...validateSystem(pkg.system));
  if (requireArray(pkg.layouts, 'package.layouts', issues, { nonEmpty: true })) {
    validateUniqueIds(pkg.layouts, 'package.layouts', issues);
    pkg.layouts.forEach((layout) => issues.push(...validateLayout(layout, { system: pkg.system })));
  }
  return issues;
}

export function assertValid(value, validator, label) {
  const issues = validator(value);
  if (issues.length) throw new SchemaValidationError(label, issues);
  return value;
}
