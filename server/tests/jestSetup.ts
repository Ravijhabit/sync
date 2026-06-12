import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env so DATABASE_URL_TEST is available, then override DATABASE_URL
// so the app's PrismaClient (src/lib/prisma.ts) uses the test database.
dotenv.config({ path: path.join(__dirname, '../.env') });

if (process.env['DATABASE_URL_TEST']) {
  process.env['DATABASE_URL'] = process.env['DATABASE_URL_TEST'];
}
