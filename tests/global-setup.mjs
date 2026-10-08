import { startStaticServer } from './static-server.mjs';
import { buildOffline } from '../scripts/build-offline.mjs';
import {buildEditorPreview} from '../scripts/build-editor-preview.mjs';

export default async function globalSetup() {
  await buildEditorPreview();
  await buildOffline();
  const server = await startStaticServer();
  return async () => new Promise((resolve) => server.close(resolve));
}
