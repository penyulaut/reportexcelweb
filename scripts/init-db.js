

const { createClient } = require('@libsql/client');

async function main() {
  const rawUrl = process.env.TURSO_DATABASE_URL;
  const TURSO_URL = rawUrl ? rawUrl.replace("libsql://", "https://") : "libsql://axonz-axonz.aws-ap-northeast-1.turso.io".replace("libsql://", "https://");
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_TOKEN) {
    console.error("TURSO_AUTH_TOKEN is missing!");
    process.exit(1);
  }

  const db = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });

  console.log("Creating users table if it doesn't exist...");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log("Database tables initialized successfully.");
}

main().catch(console.error);
