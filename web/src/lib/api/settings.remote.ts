import { form, query, command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { llmConfig, llmModelStatus } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { llmConfigSchema } from '$lib/schema/settings';
import { GEMINI_MODELS } from '$lib/constants';
import crypto from 'crypto';

export const getConfig = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return null;

	const config = await db
		.select()
		.from(llmConfig)
		.where(eq(llmConfig.userId, locals.user.id))
		.limit(1);

	if (config.length === 0) return null;

	return config[0];
});

export const getModelStatuses = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return [];

	return await db
		.select()
		.from(llmModelStatus)
		.where(eq(llmModelStatus.userId, locals.user.id));
});

export const validateLlmConfig = command(async () => {
...
	return { results };
});

export const pruneInvalidKeys = command(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw new Error('Unauthorized');

	const config = await db
		.select()
		.from(llmConfig)
		.where(eq(llmConfig.userId, locals.user.id))
		.limit(1);

	if (config.length === 0) return { removedCount: 0 };

	const { apiKey } = config[0];
	const keys = apiKey.split(';').map(k => k.trim()).filter(Boolean);
	const validKeys = [];

	for (const key of keys) {
		const keyHash = crypto.createHash('sha256').update(key).digest('hex');
		
		// Check if this key is available for AT LEAST ONE model
		const statuses = await db
			.select()
			.from(llmModelStatus)
			.where(and(
				eq(llmModelStatus.userId, locals.user.id),
				eq(llmModelStatus.keyHash, keyHash),
				eq(llmModelStatus.isAvailable, true)
			));

		if (statuses.length > 0) {
			validKeys.push(key);
		}
	}

	const newApiKeyString = validKeys.join(';');
	const removedCount = keys.length - validKeys.length;

	if (removedCount > 0) {
		await db.update(llmConfig)
			.set({ apiKey: newApiKeyString, updatedAt: new Date() })
			.where(eq(llmConfig.id, config[0].id));
	}

	return { removedCount, remainingCount: validKeys.length };
});

export const updateConfig = form(llmConfigSchema, async (data) => {
	const { locals } = getRequestEvent();
	if (!locals.user) return;

	const existing = await db
		.select()
		.from(llmConfig)
		.where(eq(llmConfig.userId, locals.user.id))
		.limit(1);

	if (existing.length > 0) {
		await db
			.update(llmConfig)
			.set({
				provider: data.provider,
				apiKey: data.apiKey,
				model: data.model ?? null
			})
			.where(eq(llmConfig.userId, locals.user.id));
	} else {
		await db.insert(llmConfig).values({
			id: crypto.randomUUID(),
			userId: locals.user.id,
			provider: data.provider,
			apiKey: data.apiKey,
			model: data.model ?? null
		});
	}

	return { saved: true };
});
