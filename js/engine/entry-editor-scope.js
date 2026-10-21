// Transfer open entry dialogs only across synchronous remounts of the same sheet.
// Nothing is persisted or applied here; each new list supplies its current writer.
const scopes = new WeakMap();

export function createEntryEditorScope(host, character, system) {
  const identity = character.meta?.id && character.meta?.system
    ? JSON.stringify([character.meta.system, character.meta.id]) : character;
  let scope = scopes.get(host);
  if (scope && (scope.identity !== identity || scope.system !== system)) {
    scope.close();
    scope = null;
  }
  if (!scope) {
    const editors = new Set();
    scope = {identity, system, generation: 0,
      close() { for (const editor of [...editors]) editor.close(); },
      bind(key, binding) {
        for (const editor of editors) if (editor.key === key) editor.bind(binding);
      },
      track(key, editor) {
        const record = {key, ...editor};
        editors.add(record);
        return () => editors.delete(record);
      },
      suspend() { for (const editor of editors) editor.bind(null); },
    };
    scopes.set(host, scope);
  }
  scope.suspend();
  const generation = ++scope.generation;
  return {
    bind: scope.bind,
    track: scope.track,
    destroy() {
      // The app destroys then mounts synchronously. A real disposal still closes
      // the dialog, including when its isolated preview iframe is removed.
      queueMicrotask(() => {
        if (scope.generation !== generation) return;
        scope.close();
        if (scopes.get(host) === scope) scopes.delete(host);
      });
    },
  };
}

export const entryEditorKey = context => JSON.stringify(context.entryEditorIdentity || [
  context.field, context.itemSchema, context.editableWhen, context.disabledWhen, context.fixedLength,
]);
