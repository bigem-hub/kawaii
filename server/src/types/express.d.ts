// Express 5 types `req.params` values as `string | string[]`. Every route
// reads a single `:param`, so declare it as a plain string record globally.
declare namespace Express {
  interface Request {
    params: Record<string, string>;
  }
}
