const actions = new Map();
export function registerEntryAction(name, render) { actions.set(name, render); }
export function createEntryAction(name, context) { return actions.get(name)?.(context); }
