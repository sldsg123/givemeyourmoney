const MEMBER_TYPE_LABELS = {
  renewal: "旧会员续费",
  new: "新会员入会",
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/submit") {
      return handleSubmit(request, env);
    }

    if (url.pathname === "/api/lookup") {
      return handleLookup(request, env);
    }

    if (url.pathname === "/api/update") {
      return handleUpdate(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSubmit(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: jsonHeaders,
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const params = await readParams(request);

    if (clean(params.get("website"))) {
      return json({ ok: true, spam: true });
    }

    const memberType = clean(params.get("memberType"), 20);
    const name = clean(params.get("name"), 120);
    const wechatId = clean(params.get("wechatId"), 120);
    const adults = Number(clean(params.get("adults"), 2));
    const junior = Number(clean(params.get("junior"), 2));
    const memberNames = clean(params.get("memberNames"), 500);
    const hasInfoChange =
      memberType === "renewal" ? clean(params.get("hasInfoChange"), 40) : "";
    const officialRegistrationComplete =
      memberType === "new"
        ? clean(params.get("officialRegistrationComplete"), 20)
        : "";
    const memberGiftNeeded =
      memberType === "new"
        ? clean(params.get("memberGiftNeeded"), 10) === "是"
          ? "是"
          : "否"
        : "";
    const shippingAddress = clean(params.get("shippingAddress"), 1000);
    const paid = clean(params.get("paid"), 10) === "是" ? "是" : "否";
    const notes = clean(params.get("notes"), 500);
    const pageUrl = clean(params.get("pageUrl"), 500);
    const userAgent = clean(params.get("userAgent"), 500);
    const submittedAt = clean(params.get("submittedAt"), 80);

    if (!env.DB) {
      return json({ ok: false, error: "D1 数据库未绑定。" }, 500);
    }

    if (!MEMBER_TYPE_LABELS[memberType]) {
      return json({ ok: false, error: "办理类型无效。" }, 400);
    }

    if (!name || !wechatId || !memberNames || !shippingAddress) {
      return json({ ok: false, error: "缺少必填信息。" }, 400);
    }

    if (!Number.isInteger(adults) || !Number.isInteger(junior)) {
      return json({ ok: false, error: "会员人数无效。" }, 400);
    }

    if (adults + junior < 1) {
      return json({ ok: false, error: "会员人数至少需要 1 人。" }, 400);
    }

    if (memberType === "renewal" && !hasInfoChange) {
      return json({ ok: false, error: "请选择是否有信息变更。" }, 400);
    }

    if (memberType === "new" && officialRegistrationComplete !== "yes") {
      return json({ ok: false, error: "请先确认已完成官网信息录入。" }, 400);
    }

    await env.DB.prepare(
      `INSERT INTO member_submissions (
        member_type,
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
        paid,
        notes,
        page_url,
        user_agent,
        submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        memberType,
        MEMBER_TYPE_LABELS[memberType],
        name,
        wechatId,
        adults,
        junior,
        memberNames,
        hasInfoChange,
        officialRegistrationComplete === "yes" ? "已完成" : "",
        memberGiftNeeded,
        shippingAddress,
        paid,
        notes,
        pageUrl,
        userAgent,
        submittedAt
      )
      .run();

    return json({
      ok: true,
      id: result.meta?.last_row_id || null,
    });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: "提交保存失败。" }, 500);
  }
}

async function handleLookup(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: jsonHeaders,
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const params = await readParams(request);
    const name = clean(params.get("name"), 120);
    const wechatId = clean(params.get("wechatId"), 120);

    if (!env.DB) {
      return json({ ok: false, error: "D1 数据库未绑定。" }, 500);
    }

    if (!name || !wechatId) {
      return json({ ok: false, error: "请填写姓名和微信号。" }, 400);
    }

    const record = await env.DB.prepare(
      `SELECT
        id,
        created_at,
        member_type,
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
        paid,
        notes,
        submitted_at
      FROM member_submissions
      WHERE name = ? AND wechat_id = ?
      ORDER BY id DESC
      LIMIT 1`
    )
      .bind(name, wechatId)
      .first();

    if (!record) {
      return json({ ok: false, error: "没有找到匹配记录。" }, 404);
    }

    return json({ ok: true, record: toClientRecord(record) });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: "查询失败。" }, 500);
  }
}

async function handleUpdate(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: jsonHeaders,
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const params = await readParams(request);
    const id = Number(clean(params.get("id"), 20));
    const lookupName = clean(params.get("lookupName"), 120);
    const lookupWechatId = clean(params.get("lookupWechatId"), 120);
    const memberType = clean(params.get("memberType"), 20);
    const name = clean(params.get("name"), 120);
    const wechatId = clean(params.get("wechatId"), 120);
    const adults = Number(clean(params.get("adults"), 2));
    const junior = Number(clean(params.get("junior"), 2));
    const memberNames = clean(params.get("memberNames"), 500);
    const hasInfoChange =
      memberType === "renewal" ? clean(params.get("hasInfoChange"), 40) : "";
    const memberGiftNeeded =
      memberType === "new"
        ? clean(params.get("memberGiftNeeded"), 10) === "是"
          ? "是"
          : "否"
        : "";
    const shippingAddress = clean(params.get("shippingAddress"), 1000);
    const paid = clean(params.get("paid"), 10) === "是" ? "是" : "否";
    const notes = clean(params.get("notes"), 500);
    const pageUrl = clean(params.get("pageUrl"), 500);
    const userAgent = clean(params.get("userAgent"), 500);

    if (!env.DB) {
      return json({ ok: false, error: "D1 数据库未绑定。" }, 500);
    }

    if (!Number.isInteger(id) || id < 1 || !lookupName || !lookupWechatId) {
      return json({ ok: false, error: "查询记录无效，请重新查询。" }, 400);
    }

    if (!MEMBER_TYPE_LABELS[memberType]) {
      return json({ ok: false, error: "办理类型无效。" }, 400);
    }

    if (!name || !wechatId || !memberNames || !shippingAddress) {
      return json({ ok: false, error: "缺少必填信息。" }, 400);
    }

    if (!Number.isInteger(adults) || !Number.isInteger(junior)) {
      return json({ ok: false, error: "会员人数无效。" }, 400);
    }

    if (adults + junior < 1) {
      return json({ ok: false, error: "会员人数至少需要 1 人。" }, 400);
    }

    if (memberType === "renewal" && !hasInfoChange) {
      return json({ ok: false, error: "请选择是否有信息变更。" }, 400);
    }

    const existing = await env.DB.prepare(
      `SELECT id
      FROM member_submissions
      WHERE id = ? AND name = ? AND wechat_id = ?`
    )
      .bind(id, lookupName, lookupWechatId)
      .first();

    if (!existing) {
      return json({ ok: false, error: "记录已变化，请重新查询后再更新。" }, 409);
    }

    const result = await env.DB.prepare(
      `UPDATE member_submissions
      SET
        member_type = ?,
        member_type_label = ?,
        name = ?,
        wechat_id = ?,
        adults = ?,
        junior = ?,
        member_names = ?,
        has_info_change = ?,
        official_registration_complete = ?,
        member_gift_needed = ?,
        shipping_address = ?,
        paid = ?,
        notes = ?,
        page_url = ?,
        user_agent = ?
      WHERE id = ? AND name = ? AND wechat_id = ?`
    )
      .bind(
        memberType,
        MEMBER_TYPE_LABELS[memberType],
        name,
        wechatId,
        adults,
        junior,
        memberNames,
        hasInfoChange,
        memberType === "new" ? "已完成" : "",
        memberGiftNeeded,
        shippingAddress,
        paid,
        notes,
        pageUrl,
        userAgent,
        id,
        lookupName,
        lookupWechatId
      )
      .run();

    const updated = await env.DB.prepare(
      `SELECT
        id,
        created_at,
        member_type,
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
        paid,
        notes,
        submitted_at
      FROM member_submissions
      WHERE id = ?`
    )
      .bind(id)
      .first();

    return json({ ok: true, record: toClientRecord(updated) });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: "更新失败。" }, 500);
  }
}

async function readParams(request) {
  const body = await request.text();
  return new URLSearchParams(body);
}

function clean(value, maxLength) {
  const limit = maxLength || 500;
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function toClientRecord(record) {
  return {
    id: record.id,
    createdAt: record.created_at,
    memberType: record.member_type,
    memberTypeLabel: record.member_type_label,
    name: record.name,
    wechatId: record.wechat_id,
    adults: String(record.adults ?? ""),
    junior: String(record.junior ?? ""),
    memberNames: record.member_names,
    hasInfoChange: record.has_info_change || "",
    officialRegistrationComplete: record.official_registration_complete || "",
    memberGiftNeeded: record.member_gift_needed || "",
    shippingAddress: record.shipping_address,
    paid: record.paid || "否",
    notes: record.notes || "",
    submittedAt: record.submitted_at || "",
  };
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
}
