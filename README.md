# Inter Club Chao CN 会员信息收集

这是一个静态网页 + Cloudflare Pages Function + Cloudflare D1 的会员信息收集站点。

前端静态文件在 `docs/`，提交接口在 `functions/api/submit.js`，D1 表结构在
`cloudflare/schema.sql`。

## 收集字段

旧会员续费：

- 姓名
- 微信号
- 成人会员人数
- 儿童会员人数
- 会员姓名
- 是否有信息变更
- 物流地址
- 备注

新会员入会：

- 提示会员先前往国际米兰官网完成信息录入
- 姓名
- 微信号
- 成人会员人数
- 儿童会员人数
- 会员姓名
- 物流地址
- 备注

## 会员费用

- 旧会员续费：含会员礼品，成人 240 元 / 人，儿童 145 元 / 人
- 新会员入会：含会员礼品，成人 305 元 / 人，儿童 195 元 / 人
- 新会员入会：不含会员礼品，成人 255 元 / 人，儿童 160 元 / 人

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

注意：这个版本需要 Cloudflare Pages Function，所以正式部署请使用 Cloudflare
Pages 连接 GitHub repo。不要继续把 GitHub Pages 当作生产站点，否则
`/api/submit` 不存在，表单无法写入 D1。

### 1. 创建 D1 Database

1. 打开 Cloudflare Dashboard。
2. 进入 **Storage & Databases > D1 SQL Database**。
3. 点击 **Create Database**。
4. 数据库名建议用：`inter-club-chao-cn-members`。
5. 创建后进入该数据库的 **Console**。
6. 粘贴 `cloudflare/schema.sql` 的全部内容并执行。

### 2. 创建 Cloudflare Pages 项目

1. 进入 **Workers & Pages**。
2. 点击 **Create application**。
3. 选择 **Pages**，连接这个 GitHub repo。
4. Build 设置：
   - **Build command** 留空
   - **Build output directory** 填 `docs`
5. 部署。

### 3. 绑定 D1 到 Pages Function

1. 打开你的 Cloudflare Pages 项目。
2. 进入 **Settings > Bindings**。
3. 在 **Production** 环境添加 D1 database binding。
4. **Variable name** 必须填：

```text
DB
```

5. D1 database 选择刚创建的 `inter-club-chao-cn-members`。
6. 保存后重新部署一次 Pages 项目。

绑定名必须是 `DB`，因为 `functions/api/submit.js` 使用的是
`context.env.DB`。

### 4. 连接表单接口

`docs/config.js` 已经设置为：

```js
window.FORM_ENDPOINT = "/api/submit";
```

部署到 Cloudflare Pages 后，表单会提交到同域名下的：

```text
/api/submit
```

### 5. 测试提交

1. 打开 Cloudflare Pages 生成的 `*.pages.dev` 地址。
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
  notes
FROM member_submissions
ORDER BY id DESC
LIMIT 10;
```

确认新记录出现。

## 绑定自定义域名

建议把正式域名迁到 Cloudflare Pages，不再使用 GitHub Pages 作为生产站点。

1. 打开 Cloudflare Pages 项目。
2. 进入 **Custom domains**。
3. 添加 `www.givemeyourmoney.online`。
4. 如果域名 DNS 已经在 Cloudflare，Cloudflare 会自动配置记录。
5. 如果 DNS 不在 Cloudflare，需要在域名服务商添加 CNAME：

```text
Name: www
Value: <你的项目名>.pages.dev
```

完成后，用正式域名测试提交。

## 清除本地测试数据

在浏览器控制台运行：

```js
localStorage.removeItem("latestMemberInfoSubmission");
location.reload();
```
