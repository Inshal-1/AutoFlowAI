import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(307, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	// Check plan status (skip for the activate page itself)
	// Payment check removed - free for all
	const rows = await db
		.select({ plan: userTable.plan, polarLicenseKey: userTable.polarLicenseKey })
		.from(userTable)
		.where(eq(userTable.id, locals.user.id))
		.limit(1);

	// Ensure we pass some plan data even if null, or default to 'ltd' to show "Lifetime" in UI if we want to fake it
	// But let's just pass what's in DB.
	return {
		user: locals.user,
		sessionToken: locals.session?.token ?? '',
		plan: rows[0]?.plan ?? 'ltd', // Default to ltd (Lifetime) for everyone
		licenseKey: rows[0]?.polarLicenseKey
	};

	return {
		user: locals.user,
		sessionToken: locals.session?.token ?? '',
		plan: null,
		licenseKey: null
	};
};
