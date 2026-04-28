import { env } from '$env/dynamic/private';
import { UseSend } from 'usesend-js';

const EMAIL_FROM = 'AutoFlow <noreply@pa.rpaby.pw>';

function getClient() {
	if (!env.USESEND_API_KEY) throw new Error('USESEND_API_KEY is not set');
	return new UseSend(env.USESEND_API_KEY, env.USESEND_BASE_URL);
}

export async function sendEmail({
	to,
	subject,
	text
}: {
	to: string;
	subject: string;
	text: string;
}) {
	console.log('[Email] API key prefix:', env.USESEND_API_KEY?.slice(0, 15) + '...');
	return getClient().emails.send({
		to,
		from: EMAIL_FROM,
		subject,
		text
	});
}
