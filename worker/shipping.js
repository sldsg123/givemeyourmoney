const RECORD_COLUMNS = `id, created_at, member_type, member_type_label, name,
  wechat_id, adults, junior, member_names, member_gift_needed, shipping_address,
  address_confirmed, shipped_flag, paid, notes`;

function respond(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function toRecord(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    memberType: row.member_type,
    memberTypeLabel: row.member_type_label,
    name: row.name,
    wechatId: row.wechat_id,
    adults: row.adults,
    junior: row.junior,
    memberNames: row.member_names,
    memberGiftNeeded: row.member_gift_needed || "",
    shippingAddress: row.shipping_address,
    addressConfirmed: row.address_confirmed === 1,
    shippedFlag: row.shipped_flag === 1,
    paid: row.paid,
    notes: row.notes || "",
  };
}

async function authorized(request, password) {
  const supplied = request.headers.get("authorization") || "";
  if (!supplied.startsWith("Bearer ") || supplied.length > 1024) return false;
  const encoder = new TextEncoder();
  const expectedHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(password))
  );
  const actualHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(supplied.slice(7)))
  );
  let difference = 0;
  for (let i = 0; i < expectedHash.length; i += 1) {
    difference |= expectedHash[i] ^ actualHash[i];
  }
  return difference === 0;
}

export async function handleShipping(request, env) {
  if (!["GET", "POST"].includes(request.method)) {
    return respond({ ok: false, error: "请求方式不支持。" }, 405);
  }
  if (!env.SHIPPING_ADMIN_PASSWORD) {
    return respond({ ok: false, error: "请先配置邮寄管理员口令。" }, 503);
  }
  if (!(await authorized(request, env.SHIPPING_ADMIN_PASSWORD))) {
    return respond({ ok: false, error: "管理员口令不正确，请重新登录。" }, 401);
  }
  if (!env.DB) return respond({ ok: false, error: "D1 数据库未绑定。" }, 503);

  try {
    if (request.method === "GET") return await listRecords(request, env.DB);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return respond({ ok: false, error: "请求来源无效。" }, 403);
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return respond({ ok: false, error: "请求格式无效。" }, 400);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return respond({ ok: false, error: "请求格式无效。" }, 400);
    }
    return await updateRecord(body, env.DB);
  } catch (error) {
    console.error("Shipping request failed", error);
    return respond({ ok: false, error: "邮寄数据操作失败，请稍后重试。" }, 500);
  }
}

async function listRecords(request, db) {
  const params = new URL(request.url).searchParams;
  const confirmed = params.get("confirmed") ?? "1";
  const shipped = params.get("shipped") ?? "0";
  const page = Number(params.get("page") ?? "1");
  const search = (params.get("search") || "").trim();
  if (!["all", "0", "1"].includes(confirmed) ||
      !["all", "0", "1"].includes(shipped) ||
      !Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 120) {
    return respond({ ok: false, error: "筛选条件无效。" }, 400);
  }
  const conditions = [];
  const bindings = [];
  if (confirmed !== "all") {
    conditions.push("address_confirmed = ?");
    bindings.push(Number(confirmed));
  }
  if (shipped !== "all") {
    conditions.push("shipped_flag = ?");
    bindings.push(Number(shipped));
  }
  if (search) {
    conditions.push("(instr(lower(name), lower(?)) > 0 OR instr(lower(wechat_id), lower(?)) > 0 OR instr(lower(member_names), lower(?)) > 0)");
    bindings.push(search, search, search);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM member_submissions ${where}`)
    .bind(...bindings).first();
  const pageSize = 50;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(count.total / pageSize)));
  const result = await db.prepare(
    `SELECT ${RECORD_COLUMNS} FROM member_submissions ${where}
     ORDER BY id ASC LIMIT ? OFFSET ?`
  ).bind(...bindings, pageSize, (currentPage - 1) * pageSize).all();
  const counts = await db.prepare(`SELECT COUNT(*) AS total,
    COALESCE(SUM(address_confirmed = 1 AND shipped_flag = 0), 0) AS ready,
    COALESCE(SUM(address_confirmed = 0), 0) AS unconfirmed,
    COALESCE(SUM(shipped_flag = 1), 0) AS shipped
    FROM member_submissions`).first();
  return respond({
    ok: true, records: result.results.map(toRecord), counts,
    total: count.total, page: currentPage, pageSize,
  });
}

async function updateRecord(body, db) {
  if (!body || !Number.isSafeInteger(body.id) || body.id < 1 ||
      !["address", "shipment"].includes(body.action)) {
    return respond({ ok: false, error: "记录或操作无效。" }, 400);
  }
  const expected = body.expected;
  if (!expected || typeof expected.shippingAddress !== "string" ||
      typeof expected.addressConfirmed !== "boolean" || typeof expected.shippedFlag !== "boolean") {
    return respond({ ok: false, error: "请刷新列表后重试。" }, 400);
  }
  const current = await db.prepare(`SELECT ${RECORD_COLUMNS} FROM member_submissions WHERE id = ?`)
    .bind(body.id).first();
  if (!current) return respond({ ok: false, error: "记录不存在，请刷新列表。" }, 404);

  let statement;
  const guardValues = [body.id, expected.shippingAddress,
    Number(expected.addressConfirmed), Number(expected.shippedFlag)];
  // The snapshot guards against confirming or shipping an address changed in another window.
  const guard = "WHERE id = ? AND shipping_address = ? AND address_confirmed = ? AND shipped_flag = ?";
  if (body.action === "address") {
    const address = typeof body.shippingAddress === "string" ? body.shippingAddress.trim() : "";
    if (!address || address.length > 1000 || typeof body.addressConfirmed !== "boolean") {
      return respond({ ok: false, error: "请填写完整地址（最多 1000 字）。" }, 400);
    }
    if (current.shipped_flag === 1 && !body.addressConfirmed) {
      return respond({ ok: false, error: "已寄出记录不能取消地址确认，请先撤销寄出。" }, 409);
    }
    statement = db.prepare(`UPDATE member_submissions
      SET shipping_address = ?, address_confirmed = ? ${guard} RETURNING ${RECORD_COLUMNS}`)
      .bind(address, Number(body.addressConfirmed), ...guardValues);
  } else {
    if (typeof body.shippedFlag !== "boolean") {
      return respond({ ok: false, error: "寄出状态无效。" }, 400);
    }
    if (body.shippedFlag && (current.address_confirmed !== 1 || !current.shipping_address.trim())) {
      return respond({ ok: false, error: "请先确认收件地址，再标记为已寄出。" }, 409);
    }
    statement = db.prepare(`UPDATE member_submissions SET shipped_flag = ?
      ${guard} RETURNING ${RECORD_COLUMNS}`).bind(Number(body.shippedFlag), ...guardValues);
  }
  const updated = await statement.first();
  if (!updated) {
    return respond({ ok: false, error: "这条记录已被修改，请刷新后重试。" }, 409);
  }
  return respond({ ok: true, record: toRecord(updated) });
}
