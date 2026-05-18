# Inter Club Chao CN 会员信息收集

这是一个静态网页表单，提交后可以通过 Google Apps Script 写入 Google Sheet。

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

## 本地测试前端

运行本地服务器：

```sh
python3 -m http.server 8000 --directory docs
```

看到 `Serving HTTP on ...` 后不要关闭终端。打开浏览器访问：

```text
http://localhost:8000
```

如果还没有配置 Google Apps Script URL，表单会把最近一次测试提交保存在浏览器
`localStorage`，并显示在页面下方的 **最近一次测试提交**。

## 连接 Google Sheet

1. 创建一个新的 Google Sheet。
2. 在表格里点击 **Extensions > Apps Script**。
3. 删除默认代码，把 `apps-script/Code.gs` 的内容完整粘贴进去。
4. 点击保存。
5. 在 Apps Script 顶部函数下拉框选择 `setupSheet`。
6. 点击 **Run**，按提示授权。
7. 回到 Google Sheet，确认出现了 `会员信息` 工作表和表头。

## 部署 Apps Script

1. 在 Apps Script 右上角点击 **Deploy > New deployment**。
2. 类型选择 **Web app**。
3. **Execute as** 选择 **Me**。
4. **Who has access** 选择 **Anyone**。
5. 点击 **Deploy**。
6. 复制 Web app URL。URL 应该以 `/exec` 结尾。

## 连接网页

打开 `docs/config.js`，把占位符替换成你的 Web app URL：

```js
window.FORM_ENDPOINT = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

然后刷新 `http://localhost:8000`，提交一条测试记录。页面提示提交成功后，到
Google Sheet 的 `会员信息` 工作表检查是否新增了一行。

## 更新 Apps Script 后重新部署

以后如果修改了 `apps-script/Code.gs`：

1. Apps Script 里点击 **Deploy > Manage deployments**。
2. 选择当前 Web app deployment。
3. 点击编辑。
4. 选择 **New version**。
5. 点击 **Deploy**。

## 清除本地测试数据

在浏览器控制台运行：

```js
localStorage.removeItem("latestMemberInfoSubmission");
location.reload();
```
