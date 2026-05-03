import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 8080);
const { server } = createApp();

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`letsgogaming server listening on http://localhost:${PORT}`);
});
