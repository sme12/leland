import { defineConfig } from 'prisma/config';
import { existsSync } from 'node:fs';
import process from 'node:process';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://leland:leland@localhost:5432/leland',
  },
});
