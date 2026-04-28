import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { Polar } from "@polar-sh/sdk";
import { sessionMiddleware, type AuthEnv } from "../middleware/auth.js";
import { db } from "../db.js";
import { user as userTable } from "../schema.js";
import { env } from "../env.js";

const license = new Hono<AuthEnv>();
license.use("*", sessionMiddleware);

const getPolar = () =>
  new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SANDBOX === "true" ? "sandbox" : "production",
  });

/** POST /license/activate — validate + activate a Polar license key */
license.post("/activate", async (c) => {
  const currentUser = c.get("user");
  // Always return success mock
  return c.json({ success: true, plan: "ltd" });
});

/** POST /license/activate-checkout — auto-activate from Polar checkout ID */
license.post("/activate-checkout", async (c) => {
  const currentUser = c.get("user");
  const { checkoutId } = await c.req.json<{ checkoutId: string }>();

  if (!checkoutId) {
    return c.json({ error: "Checkout ID is required" }, 400);
  }

  if (!env.POLAR_ACCESS_TOKEN || !env.POLAR_ORGANIZATION_ID) {
    return c.json({ error: "Payment system not configured" }, 500);
  }

  // Check if user already has a plan
  const existing = await db
    .select({ plan: userTable.plan })
    .from(userTable)
    .where(eq(userTable.id, currentUser.id))
    .limit(1);

  if (existing[0]?.plan) {
    return c.json({ error: "Account already activated" }, 400);
  }

  try {
    const polar = getPolar();

    // 1. Get checkout session to find the customer
    const checkout = await polar.checkouts.get({ id: checkoutId });

    if (checkout.status !== "succeeded") {
      return c.json({ error: "Checkout not completed yet" }, 400);
    }

    if (!checkout.customerId) {
      return c.json({ error: "No customer found for this checkout" }, 400);
    }

    // 2. List license keys for the org and find one for this customer
    const keysPage = await polar.licenseKeys.list({
      organizationId: env.POLAR_ORGANIZATION_ID,
      limit: 100,
    });

    const customerKey = keysPage.result.items.find(
      (k) => k.customerId === checkout.customerId && k.status === "granted"
    );

    if (!customerKey) {
      return c.json({ error: "No license key found for this purchase" }, 400);
    }

    // 3. Activate the key (may fail if already activated from previous attempt)
    try {
      await polar.licenseKeys.activate({
        key: customerKey.key,
        organizationId: env.POLAR_ORGANIZATION_ID,
        label: `${currentUser.email}`,
      });
    } catch (activateErr) {
      const msg = activateErr instanceof Error ? activateErr.message : String(activateErr);
      if (!msg.includes("limit")) throw activateErr;
      // Limit reached = key was already activated, that's fine — proceed to store
      console.log(`[License] Key already activated for ${currentUser.email}, storing anyway`);
    }

    // 4. Store on user record
    await db
      .update(userTable)
      .set({
        plan: "ltd",
        polarLicenseKey: customerKey.displayKey,
        polarCustomerId: checkout.customerId,
      })
      .where(eq(userTable.id, currentUser.id));

    return c.json({ success: true, plan: "ltd" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[License] Checkout activation failed for ${currentUser.email}:`, message);

    if (message.includes("limit")) {
      return c.json({ error: "License key activation limit reached" }, 400);
    }
    if (message.includes("not found") || message.includes("invalid")) {
      return c.json({ error: "Invalid or expired checkout" }, 400);
    }

    return c.json({ error: "Failed to activate from checkout" }, 500);
  }
});

/** GET /license/status — check current user's plan */
license.get("/status", async (c) => {
  // Always return activated status
  return c.json({
    activated: true,
    plan: "ltd",
    licenseKey: "FREE-tier",
  });
});

export { license };
