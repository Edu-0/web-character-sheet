import { startStaticServer } from './static-server.mjs';

export default async function globalSetup() {
  const server = await startStaticServer();
  return async () => new Promise((resolve) => server.close(resolve));
}
