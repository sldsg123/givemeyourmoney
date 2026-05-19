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

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: jsonHeaders,
    });
  }

  if (context.request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    const params = await readParams(context.request);

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
    const shippingAddress = clean(params.get("shippingAddress"), 1000);
    const notes = clean(params.get("notes"), 500);
    const pageUrl = clean(params.get("pageUrl"), 500);
    const userAgent = clean(params.get("userAgent"), 500);
    const submittedAt = clean(params.get("submittedAt"), 80);

    if (!context.env.DB) {
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

    const result = await context.env.DB.prepare(
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
        shipping_address,
        notes,
        page_url,
        user_agent,
        submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        shippingAddress,
        notes,
        pageUrl,
        userAgent,
        submittedAt
      )
      .run();

    return json({
      ok: true,
      id: result.meta.last_row_id,
    });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: "提交保存失败。" }, 500);
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
}
