import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './lib/db.js';

const port = Number(process.env.PORT || 5050);

async function main() {
  await connectDB();
  console.log('[db] connected');
  createApp().listen(port, () => console.log(`[api] http://localhost:${port}/api/health`));
}

main().catch((err) => {
  console.error('[api] failed to start:', err.message);
  process.exit(1);
});
