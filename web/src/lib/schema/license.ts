import { object, string, pipe, minLength } from 'valibot';

export const activateLicenseSchema = object({
	key: pipe(string(), minLength(1, 'License key is required'))
});

export const activateCheckoutSchema = object({
	checkoutId: pipe(string(), minLength(1, 'Checkout ID is required'))
});
