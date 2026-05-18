const SHEET_NAME = "会员信息";
const HEADERS = [
  "提交时间",
  "办理类型",
  "姓名",
  "微信号",
  "成人会员人数",
  "儿童会员人数",
  "会员姓名",
  "是否有信息变更",
  "官网信息录入",
  "物流地址",
  "备注",
  "页面地址",
  "浏览器信息",
  "前端提交时间",
];

const MEMBER_TYPE_LABELS = {
  renewal: "旧会员续费",
  new: "新会员入会",
};

function setupSheet() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);
  sheet.autoResizeColumns(1, HEADERS.length);

  return json_({
    ok: true,
    message: `工作表 "${SHEET_NAME}" 已准备好。`,
  });
}

function doGet() {
  return json_({
    ok: true,
    service: "Inter Club Chao CN 会员信息收集",
    time: new Date().toISOString(),
  });
}

function doPost(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};

    if (clean_(params.website)) {
      return json_({ ok: true, spam: true });
    }

    const memberType = clean_(params.memberType, 20);
    const name = clean_(params.name, 120);
    const wechatId = clean_(params.wechatId, 120);
    const adults = Number(clean_(params.adults, 2));
    const junior = Number(clean_(params.junior, 2));
    const memberNames = clean_(params.memberNames, 500);
    const hasInfoChange =
      memberType === "renewal" ? clean_(params.hasInfoChange, 40) : "";
    const officialRegistrationComplete =
      memberType === "new"
        ? clean_(params.officialRegistrationComplete, 20)
        : "";
    const shippingAddress = clean_(params.shippingAddress, 1000);
    const notes = clean_(params.notes, 500);
    const pageUrl = clean_(params.pageUrl, 500);
    const userAgent = clean_(params.userAgent, 500);
    const submittedAt = clean_(params.submittedAt, 80);

    if (!MEMBER_TYPE_LABELS[memberType]) {
      return json_({ ok: false, error: "办理类型无效。" });
    }

    if (!name || !wechatId || !memberNames || !shippingAddress) {
      return json_({ ok: false, error: "缺少必填信息。" });
    }

    if (!Number.isInteger(adults) || !Number.isInteger(junior)) {
      return json_({ ok: false, error: "会员人数无效。" });
    }

    if (adults + junior < 1) {
      return json_({ ok: false, error: "会员人数至少需要 1 人。" });
    }

    if (memberType === "renewal" && !hasInfoChange) {
      return json_({ ok: false, error: "请选择是否有信息变更。" });
    }

    if (memberType === "new" && officialRegistrationComplete !== "yes") {
      return json_({ ok: false, error: "请先确认已完成官网信息录入。" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getSheet_();
      ensureHeaders_(sheet);
      sheet.appendRow([
        new Date(),
        MEMBER_TYPE_LABELS[memberType],
        name,
        wechatId,
        adults,
        junior,
        memberNames,
        hasInfoChange,
        officialRegistrationComplete === "yes" ? "已完成" : "",
        shippingAddress,
        notes,
        pageUrl,
        userAgent,
        submittedAt,
      ]);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (error) {
    console.error(error);
    return json_({
      ok: false,
      error: "提交保存失败。",
    });
  }
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("请从 Google Sheet 的 Extensions > Apps Script 打开脚本。");
  }

  return (
    spreadsheet.getSheetByName(SHEET_NAME) ||
    spreadsheet.insertSheet(SHEET_NAME)
  );
}

function ensureHeaders_(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const existing = headerRange.getValues()[0].map((value) => String(value));
  const needsHeaders = HEADERS.some((header, index) => existing[index] !== header);

  if (needsHeaders) {
    headerRange.setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function clean_(value, maxLength) {
  const limit = maxLength || 500;
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
