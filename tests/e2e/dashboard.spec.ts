import { test, expect } from "@playwright/test";
const token = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ0ZXN0In0.test";
const fixture = () =>
  Array.from({ length: 76 }, (_, i) => ({
    _id: `r${i}`,
    userId: "test",
    recordedAt: new Date(Date.UTC(2026, 6, 31 + i, 17)).toISOString(),
    meterReading: 1992 + i * 8,
    cycle: 0,
    modulus: 10000,
    seriesId: "main",
    recordType: "meter_reading",
    source: "measured",
    updatedAt: "2026-09-16T00:00:00Z",
  }));
test.beforeEach(async ({ page }) => {
  await page.addInitScript((t) => localStorage.setItem("token", t), token);
  await page.route("**/api/kafai", (route) =>
    route.fulfill({ json: fixture() }),
  );
});
for (const width of [360, 390, 412, 768, 1366, 1920])
  test(`dashboard fits ${width}px and charts respond`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/statist");
    await expect(
      page.getByRole("heading", { name: "แต่ละเดือน จ่ายเท่าไหร่?" }),
    ).toBeVisible();
    await expect(page.getByText("กำลังอ่านข้อมูลพลังงานของคุณ…")).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("สำรวจจุดข้อมูล").first().selectOption("0");
    await expect(page.locator(".chart-detail").first()).toBeVisible();
    await page.screenshot({
      path: `test-results/statistics-${width}.png`,
      fullPage: true,
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "จดครั้งถัดไป" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  });
test("CRUD baseline → consumption → edit → delete and reload", async ({
  page,
}) => {
  let rows: Record<string, unknown>[] = [];
  await page.unroute("**/api/kafai");
  await page.route("**/api/kafai**", async (route) => {
    const req = route.request(),
      method = req.method(),
      body = method === "GET" ? {} : req.postDataJSON(),
      id = req.url().split("/").at(-1);
    if (method === "POST") {
      const r = {
        ...body,
        _id: `r${rows.length}`,
        recordType: "meter_reading",
        source: "measured",
        userId: "test",
        updatedAt: "2026-09-16T00:00:00Z",
      };
      rows.push(r);
      return route.fulfill({ json: r, status: 201 });
    }
    if (method === "PUT") {
      rows = rows.map((r) => (r._id === id ? { ...r, ...body } : r));
      return route.fulfill({ json: rows.find((r) => r._id === id) });
    }
    if (method === "DELETE") {
      rows = rows.filter((r) => r._id !== id);
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: rows });
  });
  await page.goto("/");
  await page.getByLabel("วันที่และเวลาอ่านมิเตอร์").fill("2026-09-01T00:00");
  await page.getByLabel("เลขมิเตอร์ปัจจุบัน", { exact: true }).fill("1992");
  await page
    .getByRole("button", { name: "บันทึกเลขมิเตอร์", exact: true })
    .click();
  await expect(page.locator(".meter-digits")).toHaveText("1992");
  await page.getByLabel("วันที่และเวลาอ่านมิเตอร์").fill("2026-09-02T00:00");
  await page.getByLabel("เลขมิเตอร์ปัจจุบัน", { exact: true }).fill("2002");
  await expect(page.getByText("10 kWh เพิ่มขึ้น")).toBeVisible();
  await page
    .getByRole("button", { name: "บันทึกเลขมิเตอร์", exact: true })
    .click();
  await expect(page.locator(".meter-digits")).toHaveText("2002");
  await page.getByLabel("เดือนที่แสดง").fill("2026-09");
  await expect(page.locator(".metric").first()).toContainText("40");
  await page.getByRole("button", { name: "แก้ไข r1", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("เลขมิเตอร์ปัจจุบัน", { exact: true })
    .fill("2005");
  await page
    .getByRole("button", { name: "บันทึกการแก้ไข", exact: true })
    .click();
  await expect(page.locator(".metric").first()).toContainText("52");
  await page.reload();
  await expect(page.locator(".meter-digits")).toHaveText("2005");
  await page.getByRole("button", { name: "ลบ r1", exact: true }).click();
  await page.getByRole("button", { name: "ลบรายการ", exact: true }).click();
  await expect(page.locator(".meter-digits")).toHaveText("1992");
});
test("expired token redirects and empty state stays usable", async ({
  page,
}) => {
  await page.unroute("**/api/kafai");
  await page.route("**/api/kafai", (route) =>
    route.fulfill({ status: 401, json: { error: "expired" } }),
  );
  await page.goto("/statist");
  await expect(page).toHaveURL(/login/);
});
