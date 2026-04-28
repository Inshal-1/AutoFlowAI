import { form, getRequestEvent, query } from '$app/server';
import { auth } from '$lib/server/auth';
import { createKeySchema, deleteKeySchema } from '$lib/schema/api-keys';
import { db } from '$lib/server/db';
import { apiKey } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';

function generateRandomString(length: number) {
	return crypto.randomBytes(length).toString('base64url');
}

function hashKey(key: string) {
	return crypto.createHash('sha256').update(key).digest('base64url');
}

export const listKeys = query(async () => {
	const { request } = getRequestEvent();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return [];

	const keys = await db
		.select()
		.from(apiKey)
		.where(eq(apiKey.referenceId, session.user.id))
		.orderBy(desc(apiKey.createdAt));

	return keys.map((k) => ({
		id: k.id,
		name: k.name,
		start: k.start,
		createdAt: k.createdAt
	}));
});

export const createKey = form(createKeySchema, async ({ name }) => {
	const { request } = getRequestEvent();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw new Error('Not authenticated');

	const rawKey = 'autoflow_' + generateRandomString(32);
	const hashedKey = hashKey(rawKey);
	const start = rawKey.substring(0, 12);

	await db.insert(apiKey).values({
		id: crypto.randomUUID(),
		name,
		key: hashedKey,
		start,
		prefix: 'autoflow_',
		referenceId: session.user.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		configId: 'default'
	});

	return { key: rawKey };
});

export const deleteKey = form(deleteKeySchema, async ({ keyId }) => {
	const { request } = getRequestEvent();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw new Error('Not authenticated');

	await db.delete(apiKey).where(eq(apiKey.id, keyId));
	return { deleted: true };
});
