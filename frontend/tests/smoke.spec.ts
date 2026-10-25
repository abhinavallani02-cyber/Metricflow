import { test, expect } from "@playwright/test";

test("landing has exactly three sections; word chips work with keyboard; copy works", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page.locator("main > section")).toHaveCount(3);
  const chip = page.getByRole("button", { name: "Change word: transactions" });
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Change word: sales data" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Copy commands" }).click();
  await expect(page.locator(".copy-status")).toContainText("Commands copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "python -m backend.app.ingest",
  );
  await page.getByRole("link", { name: "Explore dashboard" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", { name: "The bigger picture." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("real dataset renders and filters reconcile with API", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/health");
  expect((await health.json()).dataset_ready).toBe(true);
  await page.goto("/dashboard");
  await expect(page.locator(".kpi").first()).toBeVisible();
  const all = await (await request.get("/api/overview")).json();
  await expect(page.locator(".kpi").nth(1)).toContainText(
    all.orders.toLocaleString("en-GB"),
  );
  await page
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption("France");
  const selected = await (
    await request.get("/api/overview?country=France")
  ).json();
  await expect(page.locator(".kpi").nth(1)).toContainText(
    selected.orders.toLocaleString("en-GB"),
  );
  await page.getByLabel("From", { exact: true }).fill("2011-06-01");
  await page.getByLabel("To", { exact: true }).fill("2011-06-30");
  const month = await (
    await request.get(
      "/api/overview?country=France&start=2011-06-01&end=2011-06-30",
    )
  ).json();
  await expect(page.locator(".kpi").nth(1)).toContainText(
    month.orders.toLocaleString("en-GB"),
  );
  await page.getByRole("button", { name: "Products", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Top 10 products by units sold" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await expect(
    page.getByText("Repeat customer rate", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Geography", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All selected countries" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Data quality", exact: true }).click();
  await expect(
    page.getByText("Full dataset audit.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByRole("combobox", { name: "Country", exact: true }),
  ).toHaveValue("");
});

test("preview controls change charts, limit and accent", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".kpi").first()).toBeVisible();
  await page.getByLabel("Chart metric").selectOption("orders");
  await expect(
    page.getByRole("heading", { name: "Orders, over time" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Countries", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Orders by country" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Top 10", exact: true }).click();
  await expect(
    page.getByText("Top 10 countries · ranked by orders"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use #6554a4 chart accent" }).click();
  await expect(
    page.getByRole("button", { name: "Use #6554a4 chart accent" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByText("View data table", { exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(10);
});

test("empty results and API errors are explicit", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator(".kpi").first()).toBeVisible();
  // A valid country with no sale on the first dataset day.
  await page
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption("Saudi Arabia");
  await page.getByLabel("From", { exact: true }).fill("2010-12-01");
  await page.getByLabel("To", { exact: true }).fill("2010-12-01");
  await expect(page.getByText("No sales in this selection.")).toBeVisible();
  await page.route("**/api/overview*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Dataset not loaded. Import the original UCI workbook.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("alert")).toContainText("Dataset not loaded");
});

for (const width of [320, 375, 768, 1440]) {
  test(`responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/dashboard"]) {
      await page.goto(route);
      await expect(page.locator(".kpi").first()).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: innerWidth,
        body: document.documentElement.scrollWidth,
      }));
      expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
}

test("all word variants fit narrow screens with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  for (let variant = 0; variant < 3; variant++) {
    for (const chip of await page
      .getByRole("button", { name: /Change word:/ })
      .all())
      await chip.click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  }
});
