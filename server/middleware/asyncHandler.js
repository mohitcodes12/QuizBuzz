// Express 4 does NOT catch errors thrown inside async route handlers.
// This wrapper forwards any rejected promise to Express' error middleware.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
