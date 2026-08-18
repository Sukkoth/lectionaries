import { PORT } from "./src/config";
import { handleRequest, routes } from "./src/routes";

export { handleRequest } from "./src/routes";

// Export default server options for Bun.serve
export default {
  port: PORT,
  routes,
  fetch: handleRequest,
};
