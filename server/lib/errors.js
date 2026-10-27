export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new ApiError(400, msg, details);
export const unauthorized = (msg = 'You need to sign in to do that.') => new ApiError(401, msg);
export const forbidden = (msg = "You don't have permission to do that.") => new ApiError(403, msg);
export const notFound = (msg = 'Not found.') => new ApiError(404, msg);
export const conflict = (msg) => new ApiError(409, msg);

/** Wrap an async route so thrown errors reach the central error handler. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.name === 'ZodError') {
    const details = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!details[key]) details[key] = issue.message;
    }
    return res.status(400).json({ error: 'Please fix the highlighted fields.', details });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    return res.status(409).json({ error: `That ${field} is already in use.` });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: 'Malformed identifier.' });
  }
  if (
    err?.name === 'MongooseServerSelectionError' ||
    err?.name === 'MongoNetworkError' ||
    /MONGODB_URI/.test(err?.message || '')
  ) {
    console.error('[db] connection failure:', err.message);
    return res.status(503).json({ error: 'Database is unreachable right now. Please try again shortly.' });
  }
  console.error('[unhandled]', err);
  return res.status(500).json({ error: 'Something went wrong on our side.' });
}
