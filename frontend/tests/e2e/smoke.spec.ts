import { expect, test } from "@playwright/test";

const adminEmail = "admin@bothsafe.local";
const adminPassword = "admin12345";

test("landing page loads and routes to create deal", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Pay safely. Ship confidently." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create as seller" }),
  ).toBeVisible();

  await page.getByRole("link", { name: /create as seller/i }).click();
  await expect(page).toHaveURL(/\/deals\/new\?role=seller/);
});

test("seller create flow shows creator and invite links", async ({ page }) => {
  await page.goto("/deals/new?role=seller");

  await page.getByLabel("Your name").fill("QA Seller");
  await page.getByLabel("Product title").fill("QA Phone");
  await page.getByLabel("Deal amount").fill("35");
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByLabel("Seller payout KHQR").fill("QA KHQR 001");

  await page.getByRole("button", { name: "Create deal room" }).click();

  await expect(page.getByText("Creator private link")).toBeVisible();
  await expect(page.getByText("Counterparty invite link")).toBeVisible();
});

test("invite join flow reaches shared deal room", async ({ page, request }) => {
  const createResponse = await request.post("http://localhost:3001/v1/deals", {
    data: {
      source: "web",
      creator_role: "seller",
      language: "en",
      creator_name: "Flow Seller",
      product_title: "Joined Item",
      product_type: "Electronics",
      amount: 55,
      currency: "USD",
    },
  });
  expect(createResponse.ok()).toBeTruthy();

  const payload = (await createResponse.json()) as {
    invite_url: string;
  };
  const inviteUrl = payload.invite_url.replace(
    "http://localhost:3000",
    "http://localhost:3002",
  );

  await page.goto(inviteUrl);

  await expect(page.getByText("Deal preview")).toBeVisible();
  await page.getByLabel("Your role").selectOption("buyer");
  await page.getByLabel("Your name").fill("Flow Buyer");
  await page.getByRole("button", { name: "Join and continue" }).click();

  await expect(page).toHaveURL(/\/d\/.+\?access=/);
  await expect(page.getByText("Joined Item").first()).toBeVisible();
  await expect(page.getByText("Waiting for both approvals")).toBeVisible();
});

test("admin login opens deals dashboard", async ({ page }) => {
  await page.goto("/admin");

  await page.getByLabel("Admin email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/admin\/deals/);
  await expect(page.getByRole("heading", { name: "Deal operations" })).toBeVisible();
});
