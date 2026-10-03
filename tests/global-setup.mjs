import { startStaticServer } from './static-server.mjs';
import { buildOffline } from '../scripts/build-offline.mjs';

export default async function globalSetup() {
  await buildOffline();
  const server = await startStaticServer();
  return async () => new Promise((resolve) => server.close(resolve));
}
