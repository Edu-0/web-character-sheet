// Histórico de sessão: patches dos campos alterados, sem executar regras novamente.
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function changesBetween(before, after, path = [], changes = []) {
  if (equal(before, after)) return changes;
  if (object(before) && object(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!path.length && key === 'meta') continue;
      const beforeExists = Object.hasOwn(before, key), afterExists = Object.hasOwn(after, key);
      if (beforeExists && afterExists) changesBetween(before[key], after[key], [...path, key], changes);
      else changes.push({ path: [...path, key], beforeExists, afterExists,
        ...(beforeExists ? { before: clone(before[key]) } : {}), ...(afterExists ? { after: clone(after[key]) } : {}) });
    }
  } else changes.push({ path, beforeExists: true, afterExists: true, before: clone(before), after: clone(after) });
  return changes;
}

function read(root, path) {
  let value = root;
  for (const key of path) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return { exists: false };
    value = value[key];
  }
  return { exists: true, value };
}

function write(root, change, side) {
  const parent = change.path.slice(0, -1).reduce((value, key) => value[key], root);
  const key = change.path.at(-1);
  if (change[`${side}Exists`]) parent[key] = clone(change[side]);
  else delete parent[key];
}

function mergeChanges(previous, next) {
  const merged = new Map(previous.map(change => [JSON.stringify(change.path), { ...change }]));
  for (const change of next) {
    const key = JSON.stringify(change.path), original = merged.get(key);
    // Campos distintos da mesma ação podem mudar juntos; ancestrais exigem nova operação.
    if (!original) {
      if ([...merged.values()].some(existing => {
        const shorter = existing.path.length < change.path.length ? existing.path : change.path;
        const longer = existing.path.length < change.path.length ? change.path : existing.path;
        return shorter.every((part, index) => part === longer[index]);
      })) return null;
      merged.set(key, { ...change }); continue;
    }
    original.afterExists = change.afterExists;
    if (change.afterExists) original.after = clone(change.after); else delete original.after;
  }
  return [...merged.values()].filter(change => change.beforeExists !== change.afterExists || !equal(change.before, change.after));
}

export class CharacterHistory {
  constructor({ maxEntries = 50, maxBytes = 2 * 1024 ** 2, maxCharacters = 10 } = {}) {
    this.maxEntries = maxEntries; this.maxBytes = maxBytes; this.maxCharacters = maxCharacters;
    this.histories = new Map(); this.active = null;
  }

  activate(character) {
    const key = character.meta?.id && JSON.stringify([character.meta.system, character.meta.id]);
    if (!key) { this.active = null; return; }
    let history = this.histories.get(key);
    if (!history || changesBetween(history.baseline, character).length) history = { baseline: clone(character), past: [], future: [] };
    this.histories.delete(key); this.histories.set(key, history); this.active = history;
    this.breakGroup();
    while (this.histories.size > this.maxCharacters) this.histories.delete(this.histories.keys().next().value);
  }

  clear() { this.histories.clear(); this.active = null; }
  rebase(character) { if (this.active) this.active.baseline = clone(character); }
  breakGroup() { if (this.active) this.active.group = null; }

  record(character, { group = null, label = 'Editar ficha' } = {}) {
    const history = this.active;
    if (!history) return;
    if (character.meta?.id !== history.baseline.meta?.id || character.meta?.system !== history.baseline.meta?.system) {
      this.activate(character); return;
    }
    const changes = changesBetween(history.baseline, character);
    this.rebase(character);
    if (!changes.length) return;
    history.future = [];
    const now = Date.now(), last = history.past.at(-1);
    const merged = group && history.group === group && now - history.time < 1000 && last ? mergeChanges(last.changes, changes) : null;
    if (merged) history.past.pop();
    const entry = { label: String(label).slice(0, 100), changes: merged || changes };
    entry.bytes = new TextEncoder().encode(JSON.stringify(entry.changes)).byteLength;
    // Uma alteração muito grande cria uma fronteira; nunca pula silenciosamente essa edição.
    if (entry.bytes > this.maxBytes) { history.past = []; history.group = null; return; }
    if (entry.changes.length) history.past.push(entry);
    history.group = entry.changes.length ? group : null; history.time = now;
    while (history.past.length > this.maxEntries || history.past.reduce((sum, item) => sum + item.bytes, 0) > this.maxBytes) history.past.shift();
  }

  status() {
    return { undo: this.active?.past.at(-1)?.label || null, redo: this.active?.future.at(-1)?.label || null,
      undoCount: this.active?.past.length || 0, redoCount: this.active?.future.length || 0 };
  }

  apply(character, direction, validate = () => {}) {
    const history = this.active;
    if (!history || !['undo', 'redo'].includes(direction)) return false;
    if (character.meta?.id !== history.baseline.meta?.id || character.meta?.system !== history.baseline.meta?.system) throw new Error('O histórico pertence a outro personagem.');
    const source = direction === 'undo' ? history.past : history.future;
    const destination = direction === 'undo' ? history.future : history.past;
    const entry = source.at(-1);
    if (!entry) return false;
    const expected = direction === 'undo' ? 'after' : 'before', result = direction === 'undo' ? 'before' : 'after';
    for (const change of entry.changes) {
      const current = read(character, change.path);
      if (current.exists !== change[`${expected}Exists`] || current.exists && !equal(current.value, change[expected])) {
        throw new Error('Este campo mudou fora do histórico. A operação foi cancelada para preservar seus dados.');
      }
    }
    const draft = clone(character);
    entry.changes.forEach(change => write(draft, change, result));
    validate(draft);
    entry.changes.forEach(change => write(character, change, result));
    source.pop(); destination.push(entry); this.breakGroup(); this.rebase(character);
    return true;
  }
}
