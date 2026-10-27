import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';

// One Express app instance per function container; the Mongo connection is
// cached inside server/lib/db.js so warm invocations skip the handshake.
const app = createApp();
export const handler = serverless(app);
