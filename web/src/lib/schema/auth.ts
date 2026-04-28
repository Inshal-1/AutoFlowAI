import { object, string, pipe, minLength, email } from 'valibot';

export const signupSchema = object({
	name: pipe(string(), minLength(4, 'Name must be at least 4 characters')),
	email: pipe(string(), minLength(1, 'Email is required'), email('Please enter a valid email')),
	password: pipe(string(), minLength(8, 'Password must be at least 8 characters'))
});

export const loginSchema = object({
	email: pipe(string(), minLength(1, 'Email is required'), email('Please enter a valid email')),
	password: pipe(string(), minLength(8, 'Password must be at least 8 characters'))
});
