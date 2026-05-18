import { test, expect, Page, APIRequestContext } from "@playwright/test";

const ADMIN_EMAIL = "admin@bothsafe.local";
const ADMIN_PASSWORD = "admin12345";

// Unique emails to avoid conflicts
test.describe("Full Escrow Flow — Buyer → Seller → Admin", () => {
  let buyerEmail: string;
  let sellerEmail: string;
  let inviteLink: string;
  let creatorAccessUrl: string;
  let publicId: string;
  let paymentId: string;
  let adminToken: string;
  let dealId: string;

  test.beforeAll(async ({ request }) => {
    buyerEmail = `buyer-${Date.now()}@test.local`;
    sellerEmail = `seller-${Date.now()}@test.local`;

    // Register buyer
    await request.post("http://localhost:3003/v1/auth/register", {
      data: { email: buyerEmail, password: "password123", name: "Test Buyer" },
    });

    // Register seller
    await request.post("http://localhost:3003/v1/auth/register", {
      data: { email: sellerEmail, password: "password123", name: "Test Seller" },
    });

    // Login as admin
    const adminRes = await request.post("http://localhost:3003/v1/auth/admin/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const adminData = await adminRes.json() as { token: string };
    adminToken = adminData.token;
  });

  async function loginAs(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.waitForSelector("#auth-email", { timeout: 10000 });
    await page.fill("#auth-email", email);
    await page.fill("#auth-password", password);
    await page.click("#btn-login-submit");
    // Wait for navigation away from login
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });
  }

  test("Step 1: Buyer creates a deal", async ({ page }) => {
    await loginAs(page, buyerEmail, "password123");

    await page.goto("/deals/new?role=buyer");
    await page.waitForSelector("text=Your name", { timeout: 10000 });

    await page.fill("input", "Test Buyer", { strict: false });
    // The first input should be creator_name
    const inputs = page.locator("input");
    await inputs.nth(0).fill("Test Buyer");
    await inputs.nth(2).fill("iPhone 15 Pro");
    await inputs.nth(4).fill("500");

    await page.click("button:has-text('Create deal')");

    // Wait for deal creation result
    await page.waitForSelector("text=Creator link", { timeout: 15000 });

    // Extract invite link and access URL
    const inviteLinkEl = page.locator("text=Invite link").locator("xpath=../../..").locator("p").first();
    inviteLink = await inviteLinkEl.textContent() ?? "";

    const creatorLinkEl = page.locator("text=Creator link").locator("xpath=../../..").locator("p").first();
    creatorAccessUrl = await creatorLinkEl.textContent() ?? "";

    // Extract publicId from the creator URL
    const creatorUrl = new URL(creatorAccessUrl);
    publicId = creatorUrl.pathname.split("/").pop() ?? "";

    expect(publicId).toBeTruthy();
    expect(inviteLink).toContain("invite=");
  });

  test("Step 2: Seller joins via invite link", async ({ page }) => {
    await loginAs(page, sellerEmail, "password123");

    await page.goto(inviteLink);
    await page.waitForSelector("text=Join this deal", { timeout: 10000 });

    // Fill in seller name
    const nameInput = page.locator("input").filter({ hasText: /^$/ }).first();
    await nameInput.fill("Test Seller");

    await page.click("button:has-text('Join')");

    // Wait for deal room to load
    await page.waitForSelector("text=Deal room", { timeout: 15000 });

    // Verify seller is in the deal
    const pageContent = await page.content();
    expect(pageContent).toContain("Test Seller");
  });

  test("Step 3: Both parties approve the deal", async ({ browser }) => {
    // Seller approves first
    const sellerContext = await browser.newContext();
    const sellerPage = await sellerContext.newPage();
    await loginAs(sellerPage, sellerEmail, "password123");
    await sellerPage.goto(creatorAccessUrl.replace("?access=", "?access=")); // Actually seller should use their own access

    // The seller needs to access via the invite link or their stored access token
    // Let them re-join or access the deal
    await sellerPage.goto(inviteLink);
    await sellerPage.waitForTimeout(2000);

    // Try to find and click approve
    const approveBtn = sellerPage.locator("button:has-text('Approve')");
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click();
      await sellerPage.waitForTimeout(2000);
    }

    await sellerContext.close();

    // Buyer approves
    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    await loginAs(buyerPage, buyerEmail, "password123");
    await buyerPage.goto(creatorAccessUrl);
    await buyerPage.waitForTimeout(2000);

    const buyerApproveBtn = buyerPage.locator("button:has-text('Approve')");
    if (await buyerApproveBtn.isVisible().catch(() => false)) {
      await buyerApproveBtn.click();
      await buyerPage.waitForTimeout(2000);
    }

    await buyerContext.close();
  });

  test("Step 4: Buyer uploads payment proof", async ({ page }) => {
    await loginAs(page, buyerEmail, "password123");
    await page.goto(creatorAccessUrl);
    await page.waitForTimeout(3000);

    // Look for payment section and upload
    const payNowBtn = page.locator("button:has-text('Pay now')");
    if (await payNowBtn.isVisible().catch(() => false)) {
      await payNowBtn.click();
      await page.waitForTimeout(1000);
    }

    // Fill payment amount
    const amountInput = page.locator("input[inputmode='decimal']").first();
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill("500");
    }

    // Submit payment proof (without file for simplicity)
    const submitBtn = page.locator("button:has-text('Submit payment proof')");
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  });

  test("Step 5: Admin verifies payment via API", async ({ request }) => {
    // Get the deal details to find payment ID
    const dealsRes = await request.get("http://localhost:3003/v1/admin/deals", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dealsData = await dealsRes.json() as { items: Array<{ id: string; publicId: string; payments: Array<{ id: string }> }> };
    const deal = dealsData.items.find((d) => d.publicId === publicId);
    expect(deal).toBeDefined();
    dealId = deal!.id;
    paymentId = deal!.payments[0]?.id;
    expect(paymentId).toBeTruthy();

    // Verify payment
    const verifyRes = await request.post(
      `http://localhost:3003/v1/admin/payment-proofs/${paymentId}/verify`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(verifyRes.status()).toBe(201);
    const verifyData = await verifyRes.json() as { deal_status: string };
    expect(verifyData.deal_status).toBe("SELLER_PREPARING");
  });

  test("Step 6: Seller uploads shipping proof", async ({ page }) => {
    await loginAs(page, sellerEmail, "password123");

    // Seller accesses deal via invite link (they need to re-join or use stored token)
    await page.goto(inviteLink);
    await page.waitForTimeout(3000);

    // If already joined, should see deal room
    // Click "Ship now" if available
    const shipNowBtn = page.locator("button:has-text('Ship now')");
    if (await shipNowBtn.isVisible().catch(() => false)) {
      await shipNowBtn.click();
      await page.waitForTimeout(1000);
    }

    // Fill shipping form
    const deliveryInput = page.locator("input").filter({ hasText: /^$/ }).first();
    if (await deliveryInput.isVisible().catch(() => false)) {
      await deliveryInput.fill("Kerry Express");
    }

    const trackingInput = page.locator("input").nth(1);
    if (await trackingInput.isVisible().catch(() => false)) {
      await trackingInput.fill("KE123456789");
    }

    const submitBtn = page.locator("button:has-text('Submit shipping')");
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  });

  test("Step 7: Buyer confirms receipt", async ({ page }) => {
    await loginAs(page, buyerEmail, "password123");
    await page.goto(creatorAccessUrl);
    await page.waitForTimeout(3000);

    const confirmBtn = page.locator("button:has-text('Confirm received')");
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(1000);

      // Confirm dialog
      const dialogConfirm = page.locator("button:has-text('Confirm')").last();
      if (await dialogConfirm.isVisible().catch(() => false)) {
        await dialogConfirm.click();
        await page.waitForTimeout(3000);
      }
    }

    // Verify status is RELEASE_PENDING
    const content = await page.content();
    expect(content).toContain("RELEASE_PENDING");
  });

  test("Step 8: Admin releases payment to seller", async ({ request }) => {
    const releaseRes = await request.post(
      `http://localhost:3003/v1/admin/deals/${dealId}/release`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { payout_reference: "PAYOUT-E2E-001" },
      },
    );
    expect(releaseRes.status()).toBe(201);
    const releaseData = await releaseRes.json() as { status: string };
    expect(releaseData.status).toBe("RELEASED");
  });

  test("Step 9: Buyer sees released status", async ({ page }) => {
    await loginAs(page, buyerEmail, "password123");
    await page.goto(creatorAccessUrl);
    await page.waitForTimeout(3000);

    const content = await page.content();
    expect(content).toContain("RELEASED");
  });
});
