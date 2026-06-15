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
- 会员姓名
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
- 会员姓名
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

新版 UI 里 Bindings 是独立 tab，而且不一定显示 Production 环境，这是正常的。

1. 打开刚创建的 Worker。
2. 进入 **Bindings** tab。
3. 点击 **Add binding**。
4. 选择 **D1 database**。
5. **Variable name** 必须填：

```text
DB
```

6. D1 database 选择刚创建的 `inter-club-chao-cn-members`。
7. 保存后重新部署一次 Worker。

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
  shipping_address,
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
3. 添加 `www.givemeyourmoney.online`。
4. 如果域名 DNS 已经在 Cloudflare，Cloudflare 会自动配置记录。
5. 如果 DNS 不在 Cloudflare，建议先把域名的 nameservers 切到 Cloudflare，
   再用 Cloudflare 的 Custom Domain 流程绑定。

完成后，用正式域名测试提交。

## 清除本地测试数据

在浏览器控制台运行：

```js
localStorage.removeItem("latestMemberInfoSubmission");
location.reload();
```
