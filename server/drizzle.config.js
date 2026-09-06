/** @type {import('drizzle-kit').Config} */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data.db",
  },
};
