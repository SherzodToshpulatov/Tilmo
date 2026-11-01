import { handleRequest } from './app';
import { createDependencies } from './dependencies';

export { UsageLimiter } from './usage/usage-limiter';

export default {
  fetch(request, env) {
    return handleRequest(request, () => createDependencies(env));
  },
} satisfies ExportedHandler<Env>;
