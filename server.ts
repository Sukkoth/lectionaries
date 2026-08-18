import app from "./src/app";
import { PORT } from "./src/config";

export const handleRequest = app.fetch;

export default {
  port: PORT,
  fetch: app.fetch,
};
