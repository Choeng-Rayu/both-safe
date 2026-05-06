# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> seller create flow shows creator and invite links
- Location: tests/e2e/smoke.spec.ts:20:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Creator private link')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('Creator private link')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "BothSafe Protected deal rooms" [ref=e5] [cursor=pointer]:
          - /url: /
          - img [ref=e7]
          - generic [ref=e10]:
            - generic [ref=e11]: BothSafe
            - generic [ref=e12]: Protected deal rooms
        - generic [ref=e13]:
          - img [ref=e15]
          - button "KM" [ref=e19] [cursor=pointer]
          - button "EN" [pressed] [ref=e20] [cursor=pointer]
          - button "中文" [ref=e21] [cursor=pointer]
    - main [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]:
          - text: Create protected deal
          - heading "Create protected deal" [level=1] [ref=e25]
          - paragraph [ref=e26]: Start the deal, then share the invite link in your chat.
          - generic [ref=e27]:
            - button "Seller Create as seller" [ref=e28] [cursor=pointer]:
              - generic [ref=e29]: Seller
              - generic [ref=e30]: Create as seller
            - button "Buyer Create as buyer" [ref=e31] [cursor=pointer]:
              - generic [ref=e32]: Buyer
              - generic [ref=e33]: Create as buyer
        - generic [ref=e34]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - generic [ref=e37]:
                - text: Your name
                - generic [ref=e38]: "*"
              - textbox "Your name *" [ref=e39]: QA Seller
            - generic [ref=e40]:
              - generic [ref=e41]: Phone number
              - textbox "Phone number Optional" [ref=e42]
              - generic [ref=e43]: Optional
            - generic [ref=e44]:
              - generic [ref=e45]:
                - text: Product title
                - generic [ref=e46]: "*"
              - textbox "Product title *" [ref=e47]: QA Phone
            - generic [ref=e48]:
              - generic [ref=e49]: Product type
              - textbox "Product type" [ref=e50]
            - generic [ref=e51]:
              - generic [ref=e52]:
                - text: Deal amount
                - generic [ref=e53]: "*"
              - textbox "Deal amount *" [ref=e54]: "35"
            - generic [ref=e55]:
              - generic [ref=e56]: Currency
              - combobox "Currency" [ref=e57]:
                - option "USD" [selected]
                - option "KHR"
            - generic [ref=e59]:
              - generic [ref=e60]: Product description
              - textbox "Product description" [ref=e61]
            - generic [ref=e63]:
              - generic [ref=e64]: Seller payout KHQR
              - textbox "Seller payout KHQR Seller payout details can be added now or before final approval." [ref=e65]: QA KHQR 001
              - generic [ref=e66]: Seller payout details can be added now or before final approval.
            - generic [ref=e67]:
              - generic [ref=e68]: Bank name
              - textbox "Bank name" [ref=e69]
            - generic [ref=e70]:
              - generic [ref=e71]: Account name
              - textbox "Account name" [ref=e72]
            - generic [ref=e73]:
              - generic [ref=e74]: Account number
              - textbox "Account number" [ref=e75]
          - paragraph [ref=e76]: Cannot POST /v1/deals
          - button "Create deal room" [ref=e78] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e84] [cursor=pointer]:
    - img [ref=e85]
  - alert [ref=e88]
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
> 31 |   await expect(page.getByText("Creator private link")).toBeVisible();
     |                                                        ^ Error: expect(locator).toBeVisible() failed
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
  48 |   expect(createResponse.ok()).toBeTruthy();
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