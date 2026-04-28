import { form, getRequestEvent, query } from '$app/server';
import { auth } from '$lib/server/auth';
import { createKeySchema, deleteKeySchema } from '$lib/schema/api-keys';

export const listKeys = query(async () => {
	try {
		const { request } = getRequestEvent();
		return await auth.api.listApiKeys({ headers: request.headers });
	} catch (err) {
		console.error('Error listing API keys:', err);
		throw err;
	}
});

export const createKey = form(createKeySchema, async ({ name }) => {
	try {
		const { request } = getRequestEvent();
		const result = await auth.api.createApiKey({
			body: { name, prefix: 'autoflow_' },
			headers: request.headers
		});
		return result;
	} catch (err) {
		console.error('Error creating API key:', err);
		throw err;
	}
});

export const deleteKey = form(deleteKeySchema, async ({ keyId }) => {
	const { request } = getRequestEvent();
	await auth.api.deleteApiKey({
		body: { keyId },
		headers: request.headers
	});
	return { deleted: true };
});
