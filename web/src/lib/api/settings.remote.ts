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
	const { locals } = getRequestEvent();
	if (!locals.user) throw new Error('Unauthorized');

	const config = await db
		.select()
		.from(llmConfig)
		.where(eq(llmConfig.userId, locals.user.id))
		.limit(1);

	if (config.length === 0) throw new Error('No LLM configuration found');

	const { apiKey, provider } = config[0];
	const keys = apiKey.split(';').map(k => k.trim()).filter(Boolean);
	
	const results = [];

	for (const key of keys) {
		const keyHash = crypto.createHash('sha256').update(key).digest('hex');
		
		for (const model of GEMINI_MODELS) {
			let isAvailable = false;
			try {
				// Simple OpenAI-compatible check for Gemini
				const baseUrl = provider === 'gemini' 
					? 'https://generativelanguage.googleapis.com/v1beta/openai' 
					: 'https://api.openai.com/v1';
				
				const res = await fetch(`${baseUrl}/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${key}`
					},
					body: JSON.stringify({
						model,
						messages: [{ role: 'user', content: 'hi' }],
						max_tokens: 1
					})
				});

				// If 404 or 403, it's definitely not available for this key
				if (res.status === 404 || res.status === 403 || res.status === 401) {
					isAvailable = false;
				} else {
					// 200 or even 429 (rate limit) means the model exists and is accessible
					isAvailable = true;
				}
			} catch (e) {
				isAvailable = false;
			}

			// Update or insert status
			const existing = await db
				.select()
				.from(llmModelStatus)
				.where(and(
					eq(llmModelStatus.userId, locals.user.id),
					eq(llmModelStatus.keyHash, keyHash),
					eq(llmModelStatus.modelId, model)
				))
				.limit(1);

			if (existing.length > 0) {
				await db.update(llmModelStatus)
					.set({ isAvailable, updatedAt: new Date() })
					.where(eq(llmModelStatus.id, existing[0].id));
			} else {
				await db.insert(llmModelStatus).values({
					id: crypto.randomUUID(),
					userId: locals.user.id,
					keyHash,
					modelId: model,
					isAvailable,
					updatedAt: new Date()
				});
			}
			
			results.push({ key: key.slice(0, 8) + '...', model, isAvailable });
		}
	}

	return { results };
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
