# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> invite join flow reaches shared deal room
- Location: tests/e2e/smoke.spec.ts:35:5

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | const adminEmail = "admin@bothsafe.local";
  4  | const adminPassword = "admin12345";
  5  | 
  6  | test("landing page loads and routes to create deal", async ({ page }) => {
  7  |   await page.goto("/");
  8  | 
  9  |   await expect(
  10 |     page.getByRole("heading", { name: "Pay safely. Ship confidently." }),
  11 |   ).toBeVisible();
  12 |   await expect(
  13 |     page.getByRole("button", { name: "Create as seller" }),
  14 |   ).toBeVisible();
  15 | 
  16 |   await page.getByRole("link", { name: /create as seller/i }).click();
  17 |   await expect(page).toHaveURL(/\/deals\/new\?role=seller/);
  18 | });
  19 | 
  20 | test("seller create flow shows creator and invite links", async ({ page }) => {
  21 |   await page.goto("/deals/new?role=seller");
  22 | 
  23 |   await page.getByLabel("Your name").fill("QA Seller");
  24 |   await page.getByLabel("Product title").fill("QA Phone");
  25 |   await page.getByLabel("Deal amount").fill("35");
  26 |   await page.getByLabel("Currency").selectOption("USD");
  27 |   await page.getByLabel("Seller payout KHQR").fill("QA KHQR 001");
  28 | 
  29 |   await page.getByRole("button", { name: "Create deal room" }).click();
  30 | 
  31 |   await expect(page.getByText("Creator private link")).toBeVisible();
  32 |   await expect(page.getByText("Counterparty invite link")).toBeVisible();
  33 | });
  34 | 
  35 | test("invite join flow reaches shared deal room", async ({ page, request }) => {
  36 |   const createResponse = await request.post("http://localhost:3001/v1/deals", {
  37 |     data: {
  38 |       source: "web",
  39 |       creator_role: "seller",
  40 |       language: "en",
  41 |       creator_name: "Flow Seller",
  42 |       product_title: "Joined Item",
  43 |       product_type: "Electronics",
  44 |       amount: 55,
  45 |       currency: "USD",
  46 |     },
  47 |   });
> 48 |   expect(createResponse.ok()).toBeTruthy();
     |                               ^ Error: expect(received).toBeTruthy()
  49 | 
  50 |   const payload = (await createResponse.json()) as {
  51 |     invite_url: string;
  52 |   };
  53 |   const inviteUrl = payload.invite_url.replace(
  54 |     "http://localhost:3000",
  55 |     "http://localhost:3002",
  56 |   );
  57 | 
  58 |   await page.goto(inviteUrl);
  59 | 
  60 |   await expect(page.getByText("Deal preview")).toBeVisible();
  61 |   await page.getByLabel("Your role").selectOption("buyer");
  62 |   await page.getByLabel("Your name").fill("Flow Buyer");
  63 |   await page.getByRole("button", { name: "Join and continue" }).click();
  64 | 
  65 |   await expect(page).toHaveURL(/\/d\/.+\?access=/);
  66 |   await expect(page.getByText("Joined Item").first()).toBeVisible();
  67 |   await expect(page.getByText("Waiting for both approvals")).toBeVisible();
  68 | });
  69 | 
  70 | test("admin login opens deals dashboard", async ({ page }) => {
  71 |   await page.goto("/admin");
  72 | 
  73 |   await page.getByLabel("Admin email").fill(adminEmail);
  74 |   await page.getByLabel("Password").fill(adminPassword);
  75 |   await page.getByRole("button", { name: "Sign in" }).click();
  76 | 
  77 |   await expect(page).toHaveURL(/\/admin\/deals/);
  78 |   await expect(page.getByRole("heading", { name: "Deal operations" })).toBeVisible();
  79 | });
  80 | 
```