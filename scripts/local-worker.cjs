const { DatabaseSync } = require("node:sqlite");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function loadWorker() {
  const shipping = moduleUrl(await readFile(path.join(root, "worker/shipping.js"), "utf8"));
  const source = (await readFile(path.join(root, "worker/index.js"), "utf8"))
    .replace('"./shipping.js"', JSON.stringify(shipping));
  return (await import(moduleUrl(source))).default;
}

async function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(await readFile(path.join(root, "cloudflare/schema.sql"), "utf8"));
  const DB = {
    prepare(sql) {
      const prepared = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...params) { values = params; return this; },
        async first() { return prepared.get(...values) || null; },
        async all() { return { results: prepared.all(...values) }; },
        async run() { prepared.run(...values); },
      };
    },
  };
  return { sqlite, DB };
}

function seedDatabase(sqlite, count = 4) {
  const insert = sqlite.prepare(`INSERT INTO member_submissions
    (member_type, member_type_label, name, wechat_id, adults, junior,
     member_names, shipping_address, address_confirmed, shipped_flag, paid, member_gift_needed, notes)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (let i = 1; i <= count; i += 1) {
    const isNew = i % 2 === 0;
    insert.run(isNew ? "new" : "renewal", isNew ? "新会员入会" : "旧会员续费",
      `测试会员${i}`, `demo-wechat-${i}`, i % 2,
      `测试会员${i}、测试家属${i}`, `测试收件人${i} 13800000000\n上海市测试路 ${i} 号`,
      i % 4 === 2 ? 0 : 1, i % 4 === 3 ? 1 : 0,
      i % 2 ? "是" : "否", isNew ? "否" : "", i === 1 ? "测试备注 <script>alert(1)</script>" : "");
  }
}

module.exports = { root, loadWorker, createDatabase, seedDatabase };
