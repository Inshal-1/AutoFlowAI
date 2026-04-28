import { object, string, pipe, minLength } from 'valibot';

export const createKeySchema = object({
	name: pipe(string(), minLength(1, 'Please enter a name for the API key'))
});

export const deleteKeySchema = object({
	keyId: pipe(string(), minLength(1, 'Key ID is required'))
});
