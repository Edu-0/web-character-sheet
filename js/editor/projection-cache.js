// Only validated, revision-owned documents opt in. Mutable callers stay uncached.
// Values are derived indexes, never an editable or authoritative document.
const revisions=new WeakMap();
export function revisionProjection(pkg){if(pkg&&typeof pkg==='object'&&!revisions.has(pkg))revisions.set(pkg,new Map());return pkg;}
export function cachedProjection(pkg,key,build){const cache=revisions.get(pkg);if(!cache)return build();if(!cache.has(key))cache.set(key,build());return cache.get(key);}
