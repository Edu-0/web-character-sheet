// Expansão compartilhada pela renderização e pelo índice de busca.
export function resolveSource(root, path) {
  if (!root || !path) return [];
  let values = [root];
  path.replace(/^system\./, '').split('.').forEach((segment) => {
    const flatten = segment.endsWith('[]');
    const key = flatten ? segment.slice(0, -2) : segment;
    values = values.flatMap((value) => {
      const next = value?.[key];
      if (next == null) return [];
      return flatten && Array.isArray(next) ? next : [next];
    });
  });
  return values.flatMap((value) => Array.isArray(value) ? value : [value]);
}

function interpolate(value, context) {
  if (typeof value === 'string') return value.replace(/\{([^}]+)\}/g, (_, key) => context[key] ?? `{${key}}`);
  if (Array.isArray(value)) return value.map((item) => interpolate(item, context));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolate(item, context)]));
  return value;
}

export function expandComponents(container, system) {
  const items = container.repeat ? resolveSource(system, container.repeat.source) : [null];
  return items.flatMap((item, index) => {
    const context = item && typeof item === 'object' ? { index, ...item } : { index, key: item, name: item, label: item, value: item };
    return (container.components || []).map((definition) => {
      const component = interpolate(definition, context);
      if (component.optionsFrom && !component.options) {
        component.options = resolveSource(system, component.optionsFrom).map((option, optionIndex) => {
          if (option == null || typeof option !== 'object') return { value: option, label: String(option ?? '') };
          return { value: option.value ?? option.id ?? option.key ?? optionIndex, label: option.label ?? option.name ?? (option.points != null ? `${option.points} pontos` : String(option.id ?? optionIndex + 1)) };
        });
      }
      return component;
    });
  });
}

export function componentSearchKey(section, container, index) {
  return JSON.stringify([section.id, container.id, index]);
}
