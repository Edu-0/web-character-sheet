// Formato documental; independente da release e do namespace de storage.
export const SUPPORTED_VERSIONS = Object.freeze({ manifest: [1], package: [1, 2], system: [1, 2], layout: [1, 2], character: [1, 2], backup: [1, 2] });
export function versionIssue(document, kind, path = kind) {
  const versions = SUPPORTED_VERSIONS[kind];
  if (versions?.includes(document?.schemaVersion)) return null;
  return { path: `${path}.schemaVersion`, code: 'schema-version', message: `versão não suportada; versões aceitas: ${(versions || []).join(', ')}` };
}
