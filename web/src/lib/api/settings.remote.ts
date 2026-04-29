import { form, query, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { llmConfig } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { llmConfigSchema } from '$lib/schema/settings';

export const getConfig = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return null;

	const config = await db
		.select()
		.from(llmConfig)
		.where(eq(llmConfig.userId, locals.user.id))
		.limit(1);

	if (config.length === 0) return null;

	// For editing, we need the actual keys or at least the correct count
	// Since the UI uses password fields, we can send them unmasked or individual masked
	// To keep it simple and fix the 'split' issue, we return unmasked keys 
	// because they are only sent over HTTPS to the logged-in user.
	return config[0];
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
