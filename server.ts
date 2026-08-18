import { PORT } from "./src/config";
import { handleRequest, routes } from "./src/routes";

const server = Bun.serve({
  port: PORT,
  routes,
  fetch: handleRequest,
});

export default server;
