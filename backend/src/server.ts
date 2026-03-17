import { handleAppRequest } from './app-handler';

const PORT = Number(process.env.PORT ?? 8787);

const server = Bun.serve({
  port: PORT,
  fetch: handleAppRequest,
});

console.log(`Airport Now API listening on http://localhost:${server.port}`);
