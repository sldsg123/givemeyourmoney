# Inter Club Chao CN 会员信息收集

这是一个静态网页 + Cloudflare Worker + Cloudflare D1 的会员信息收集站点。

前端静态文件在 `docs/`，Worker 入口在 `worker/index.js`，D1 表结构在
`cloudflare/schema.sql`。`functions/api/submit.js` 是旧版 Pages Functions 入口，
如果你使用新版 Workers 静态资源部署，可以忽略它。

## 收集字段

旧会员续费：

- 姓名
- 微信号
- 成人会员人数
- 儿童会员人数
- 所有会员姓名
- 是否有信息变更
- 物流地址
- 已付款
- 备注

新会员入会：

- 提示会员先前往国际米兰官网完成信息录入
- 姓名
- 微信号
- 成人会员人数
- 儿童会员人数
- 需要会员礼品
- 所有会员姓名
- 物流地址
- 已付款
- 备注

## 会员费用

- 旧会员续费：含会员礼品，成人 240 元 / 人，儿童 145 元 / 人
- 新会员入会：含会员礼品，成人 305 元 / 人，儿童 195 元 / 人
- 新会员入会：不含会员礼品，成人 255 元 / 人，儿童 160 元 / 人
- Plus 会员：每人额外 280 元

页面底部的付款二维码默认收起，图片文件位于 `docs/images/payment_qr.JPG`。

## 本地测试前端

只测试页面 UI：

```sh
python3 -m http.server 8000 --directory docs
```

打开：

```text
http://localhost:8000
```

这个本地静态服务器不会连接 D1，只会把最近一次测试提交保存在浏览器
`localStorage` 并显示在页面下方。

## Cloudflare D1 部署步骤

Cloudflare 新 UI 里通常显示为 **Workers & Pages**，创建时选择
**Import a repository**。这个项目已经用 `wrangler.jsonc` 指定了静态文件目录：

```jsonc
"assets": {
  "directory": "./docs"
}
```

所以新版 Workers 部署流程里看不到 **Build output directory** 是正常的。

### 1. 创建 D1 Database

1. 打开 Cloudflare Dashboard。
2. 进入 **Storage & Databases > D1 SQL Database**。
3. 点击 **Create Database**。
4. 数据库名建议用：`inter-club-chao-cn-members`。
5. 创建后进入该数据库的 **Console**。
6. 粘贴 `cloudflare/schema.sql` 的全部内容并执行。

如果数据库已经创建过，并且只是给现有表增加“已付款”字段，请进入 D1 的
**Console**，执行 `cloudflare/add_paid_column.sql`：

```sql
ALTER TABLE member_submissions
ADD COLUMN paid TEXT NOT NULL DEFAULT '否';
```

如果数据库已经创建过，并且只是给现有表增加“需要会员礼品”字段，请进入
D1 的 **Console**，执行 `cloudflare/add_member_gift_needed_column.sql`：

```sql
ALTER TABLE member_submissions
ADD COLUMN member_gift_needed TEXT NOT NULL DEFAULT '';
```

如果数据库已经创建过，并且只是给现有表增加“地址已确认”字段，请进入 D1
的 **Console**，执行 `cloudflare/add_address_confirmed_column.sql`：

```sql
ALTER TABLE member_submissions
ADD COLUMN address_confirmed BOOLEAN NOT NULL DEFAULT false;
```

### 2. 创建 Cloudflare Worker 项目

1. 进入 **Workers & Pages**。
2. 点击 **Create application**。
3. 选择 **Import a repository**。
4. 选择这个 GitHub repo。
5. 项目名建议填 `givemeyourmoney`，要和 `wrangler.jsonc` 里的 `name` 一致。
6. Build command 可以留空。
7. Deploy command 使用默认值 `npx wrangler deploy`。
8. 保存并部署。

### 3. 绑定 D1 到 Worker

D1 绑定已经写在 `wrangler.jsonc` 里，Cloudflare 每次从 GitHub 自动部署时会按
配置绑定数据库：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "inter-club-chao-cn-members",
    "database_id": "d60e8f47-f06b-4699-993b-0aecbab78ce9"
  }
]
```

绑定名必须是 `DB`，因为 `worker/index.js` 使用的是 `env.DB`。

### 4. 连接表单接口

`docs/config.js` 已经设置为：

```js
window.FORM_ENDPOINT = "/api/submit";
```

部署到 Cloudflare Workers 后，表单会提交到同域名下的：

```text
/api/submit
```

### 5. 测试提交

1. 打开 Cloudflare Worker 生成的 `*.workers.dev` 地址。
2. 填写表单并提交。
3. 页面提示“已提交，感谢填写。”
4. 回到 D1 数据库，执行：

```sql
SELECT
  id,
  created_at,
  member_type_label,
  name,
  wechat_id,
  adults,
  junior,
  member_names,
  has_info_change,
  official_registration_complete,
  member_gift_needed,
  shipping_address,
  address_confirmed,
  shipped_flag,
  paid,
  notes
FROM member_submissions
ORDER BY id DESC
LIMIT 10;
```

确认新记录出现。

## 绑定自定义域名

建议把正式域名迁到 Cloudflare Worker，不再使用 GitHub Pages 作为生产站点。

1. 打开 Cloudflare Worker。
2. 进入 **Settings > Domains & Routes** 或 **Triggers > Custom Domains**。
3. 添加 `interclubchao.org` 和 `www.interclubchao.org`。
4. 如果域名 DNS 已经在 Cloudflare，Cloudflare 会自动配置记录。
5. 如果 DNS 不在 Cloudflare，建议先把域名的 nameservers 切到 Cloudflare，
   再用 Cloudflare 的 Custom Domain 流程绑定。

完成后，用正式域名测试提交。

## 2026 邮寄管理

管理页：`https://www.interclubchao.org/2026shipping`。

默认显示地址已确认且未寄出的记录，可以筛选未确认地址、已寄出或全部登记，
并按姓名、微信号、所有会员姓名搜索。列表每页 50 条；统计数字为全库统计。
页面名中的 2026 是业务入口名称，不会按登记时间排除已有会员。

上线前，先在现有 D1 数据库的 Console 执行一次
`cloudflare/add_shipped_flag_column.sql`：

```sql
ALTER TABLE member_submissions
ADD COLUMN shipped_flag INTEGER NOT NULL DEFAULT 0 CHECK (shipped_flag IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_member_submissions_shipping
ON member_submissions (address_confirmed, shipped_flag, id);
```

已有记录和新登记默认都是未寄出（0）；标记寄出为 1，可以撤销寄出。
编辑地址时可以同时勾选“地址已确认”。未确认地址的记录不能标记寄出。
标记寄出只修改邮寄状态；修改地址不会改变付款、会员信息和寄出状态。

在 Cloudflare Worker 的 **Settings > Variables and Secrets** 中新增 Secret：

```text
SHIPPING_ADMIN_PASSWORD
```

值设为管理员口令，保存并部署。也可通过 `npx wrangler secret put
SHIPPING_ADMIN_PASSWORD` 交互式设置，不要把真实口令写进 Git。
每次打开管理页输入这个口令，口令只保留在当前页面内存，刷新需重新登录。
管理接口 `/api/shipping` 的查询与写入都校验口令；未配置口令时不会返回会员数据。
完成数据库迁移、配置 Secret 后，再推送并部署本次代码。

本地预览使用 Node.js 22.13+（内置 SQLite），只操作内存里的 64 条虚构记录：

```sh
npm run dev:shipping
```

打开 `http://localhost:8788/2026shipping`，本地口令为 `local-shipping-only`。
本地测试和线上 D1 完全独立，关闭预览后测试数据会清空。
端口被占用时，可以用 `PORT=8789 npm run dev:shipping`。

运行接口与迁移测试：

```sh
npm test
```

## 清除本地测试数据

在浏览器控制台运行：

```js
localStorage.removeItem("latestMemberInfoSubmission");
location.reload();
```
