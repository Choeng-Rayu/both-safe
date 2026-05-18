import { expect, test } from "@playwright/test";

const adminEmail = "admin@bothsafe.local";
const adminPassword = "admin12345";

test("landing page loads and protected create route requires login", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Pay safely. Ship confidently." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create as seller" }),
  ).toBeVisible();

  await page.getByRole("link", { name: /create as seller/i }).click();
  await expect(page).toHaveURL(/\/login\?redirectTo=/);
  await expect(page.getByText("Sign in to protect your deals")).toBeVisible();
});

test("direct create deal access redirects to login", async ({ page }) => {
  await page.goto("/deals/new?role=seller");

  await expect(page).toHaveURL(/\/login\?redirectTo=/);
});

test("admin login opens deals dashboard", async ({ page }) => {
  await page.goto("/admin");

  await page.getByLabel("Admin email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();

  await expect(page).toHaveURL(/\/admin\/deals/);
  await expect(page.getByRole("heading", { name: "Deal operations" })).toBeVisible();
});
