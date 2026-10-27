import mongoose from 'mongoose';

// Serverless-friendly connection cache. Netlify Functions reuse the module
// scope between warm invocations, so we keep one connection promise around
// instead of opening a new socket on every request.
const globalCache = globalThis;
if (!globalCache.__tiebreakMongoose) {
  globalCache.__tiebreakMongoose = { conn: null, promise: null };
}
const cache = globalCache.__tiebreakMongoose;

export async function connectDB() {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
  }

  if (!cache.promise) {
    mongoose.set('strictQuery', true);
    cache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 5,
      })
      .then((m) => m)
      .catch((err) => {
        cache.promise = null; // allow a retry on the next request
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDB() {
  if (cache.conn) {
    await mongoose.disconnect();
    cache.conn = null;
    cache.promise = null;
  }
}
