import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { apiKey } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import { getRequestEvent } from '$app/server';
import * as schema from './db/schema';
import { sendEmail } from './email';

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5173',
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema
	}),
	plugins: [sveltekitCookies(getRequestEvent), apiKey()],
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false
	}
});
