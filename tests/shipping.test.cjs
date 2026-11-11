const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { root, loadWorker, createDatabase, seedDatabase } = require("../scripts/local-worker.cjs");

async function setup(t) {
  const worker = await loadWorker();
  const { sqlite, DB } = await createDatabase();
  seedDatabase(sqlite);
  t.after(() => sqlite.close());
  const env = { DB, SHIPPING_ADMIN_PASSWORD: "test-password", ASSETS: { fetch: async (request) => new Response(new URL(request.url).pathname) } };
  const request = async (query = "", body, password = "test-password") => {
    const response = await worker.fetch(new Request(`https://example.com/api/shipping${query}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${password}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  const snapshot = (id) => {
    const row = sqlite.prepare("SELECT * FROM member_submissions WHERE id = ?").get(id);
    return { shippingAddress: row.shipping_address, addressConfirmed: row.address_confirmed === 1, shippedFlag: row.shipped_flag === 1 };
  };
  return { worker, sqlite, env, request, snapshot };
}

test("management API denies unauthenticated reads and writes before querying D1", async (t) => {
  const { request, sqlite } = await setup(t);
  assert.equal((await request("", undefined, "wrong")).status, 401);
  assert.equal((await request("", { id: 1, action: "shipment", shippedFlag: true }, "wrong")).status, 401);
  assert.equal(sqlite.prepare("SELECT shipped_flag FROM member_submissions WHERE id = 1").get().shipped_flag, 0);
});

test("missing secret fails closed", async (t) => {
  const { worker, env } = await setup(t);
  delete env.SHIPPING_ADMIN_PASSWORD;
  assert.equal((await worker.fetch(new Request("https://example.com/api/shipping"), env)).status, 503);
});

test("default queue, unconfirmed, shipped, all, search and pagination", async (t) => {
  const { request, sqlite } = await setup(t);
  const ready = await request();
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body.records.map((r) => r.id), [1, 4]);
  assert.deepEqual(ready.body.counts, { total: 4, ready: 2, unconfirmed: 1, shipped: 1 });
  assert.equal(ready.headers.get("cache-control"), "no-store");
  assert.deepEqual((await request("?confirmed=0&shipped=all")).body.records.map((r) => r.id), [2]);
  assert.deepEqual((await request("?confirmed=all&shipped=1")).body.records.map((r) => r.id), [3]);
  assert.equal((await request("?confirmed=all&shipped=all")).body.total, 4);
  assert.equal((await request("?search=demo-wechat-1")).body.total, 1);
  assert.equal((await request("?search=%27%20OR%201%3D1--")).body.total, 0);
  assert.equal((await request("?confirmed=invalid")).status, 400);
  for (let i = 0; i < 52; i += 1) sqlite.exec("INSERT INTO member_submissions (member_type, member_type_label, name, wechat_id, adults, junior, member_names, shipping_address, address_confirmed) VALUES ('renewal','renewal','extra','extra',1,0,'extra','address',1)");
  const page = await request("?page=2");
  assert.equal(page.body.records.length, 4);
  assert.equal(page.body.page, 2);
});

test("address edit preserves other member fields, supports confirmation, rejects stale snapshots", async (t) => {
  const { request, sqlite, snapshot } = await setup(t);
  const original = snapshot(2);
  const result = await request("", { id: 2, action: "address", expected: original,
    shippingAddress: "新收件人 13900000000\n北京市新地址", addressConfirmed: true });
  assert.equal(result.status, 200);
  assert.equal(result.body.record.addressConfirmed, true);
  assert.equal(result.body.record.shippingAddress, "新收件人 13900000000\n北京市新地址");
  assert.equal(sqlite.prepare("SELECT wechat_id FROM member_submissions WHERE id = 2").get().wechat_id, "demo-wechat-2");
  assert.equal((await request("", { id: 2, action: "address", expected: original, shippingAddress: "旧地址覆盖", addressConfirmed: true })).status, 409);
  assert.equal((await request("", { id: 1, action: "address", expected: snapshot(1), shippingAddress: " ", addressConfirmed: true })).status, 400);
});

test("shipment requires confirmation, is reversible and prevents stale address shipping", async (t) => {
  const { request, snapshot, sqlite } = await setup(t);
  assert.equal((await request("", { id: 2, action: "shipment", shippedFlag: true, expected: snapshot(2) })).status, 409);
  const before = snapshot(1);
  const shipped = await request("", { id: 1, action: "shipment", shippedFlag: true, expected: before });
  assert.equal(shipped.status, 200);
  assert.equal(shipped.body.record.shippedFlag, true);
  assert.equal((await request()).body.records.some((r) => r.id === 1), false);
  assert.equal((await request("", { id: 1, action: "shipment", shippedFlag: true, expected: before })).status, 409);
  assert.equal((await request("", { id: 1, action: "shipment", shippedFlag: false, expected: snapshot(1) })).status, 200);
  sqlite.prepare("UPDATE member_submissions SET shipping_address = 'changed' WHERE id = 1").run();
  assert.equal((await request("", { id: 1, action: "shipment", shippedFlag: true, expected: before })).status, 409);
});

test("subpage routing and existing registration route remain available", async (t) => {
  const { worker, env } = await setup(t);
  for (const pathname of ["/2026shipping", "/2026shipping/"]) {
    const response = await worker.fetch(new Request(`https://example.com${pathname}`), env);
    assert.equal(await response.text(), "/shipping.html");
  }
  assert.equal((await worker.fetch(new Request("https://example.com/api/submit"), env)).status, 405);
});

test("registration still inserts successfully with shipped_flag default zero", async (t) => {
  const { worker, env, sqlite } = await setup(t);
  const response = await worker.fetch(new Request("https://example.com/api/submit", {
    method: "POST",
    body: new URLSearchParams({ memberType: "renewal", name: "新测试登记", wechatId: "new-registration",
      adults: "1", junior: "0", memberNames: "新测试登记", hasInfoChange: "无变更",
      shippingAddress: "新测试地址", paid: "否" }),
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const row = sqlite.prepare("SELECT shipped_flag, address_confirmed FROM member_submissions WHERE wechat_id = ?").get("new-registration");
  assert.equal(row.shipped_flag, 0);
  assert.equal(row.address_confirmed, 0);
});

test("migration adds default zero to existing rows and keeps existing data", async () => {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE member_submissions (id INTEGER PRIMARY KEY, name TEXT, address_confirmed BOOLEAN DEFAULT false); INSERT INTO member_submissions (name) VALUES ('existing')");
    db.exec(await readFile(path.join(root, "cloudflare/add_shipped_flag_column.sql"), "utf8"));
    const row = db.prepare("SELECT * FROM member_submissions").get();
    assert.equal(row.name, "existing");
    assert.equal(row.shipped_flag, 0);
    assert.throws(() => db.exec("UPDATE member_submissions SET shipped_flag = 2"));
  } finally { db.close(); }
});
