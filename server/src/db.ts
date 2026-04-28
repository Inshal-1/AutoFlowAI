import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env.js";
import * as schema from "./schema.js";

const client = postgres(env.DATABASE_URL, {
  idle_timeout: 20,        // close idle connections after 20s (Railway proxy kills at ~60s)
  max_lifetime: 60 * 5,    // recycle connections every 5 minutes
  connect_timeout: 10,     // fail fast on connection issues
});
export const db = drizzle(client, { schema });
