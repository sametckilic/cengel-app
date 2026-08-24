import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://cengel:cengel@localhost:54329/cengel',
  },
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/database/schema.ts',
  strict: true,
  verbose: true,
});
