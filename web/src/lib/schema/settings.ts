import { object, string, pipe, minLength, optional } from 'valibot';

export const llmConfigSchema = object({
	provider: pipe(string(), minLength(1, 'Please select a provider')),
	apiKey: pipe(string(), minLength(1, 'API key is required')),
	model: optional(string())
});
