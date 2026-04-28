import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(env.DATABASE_URL, {
	idle_timeout: 20,
	max_lifetime: 60 * 5,
	connect_timeout: 10,
	prepare: false,
	onnotice: (msg) => console.log('[DB notice]', msg),
	debug: (connection, query, params, types) => {
		console.log('[DB query]', query, params);
	}
});

// Test connection on startup
client`SELECT 1`.then(() => console.log('[DB] Connection OK')).catch((err) => console.error('[DB] Connection FAILED:', err));

export const db = drizzle(client, { schema });
