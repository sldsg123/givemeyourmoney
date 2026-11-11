(() => {
  const login = document.querySelector("[data-login]");
  const workspace = document.querySelector("[data-workspace]");
  const status = document.querySelector("[data-status]");
  const filters = document.querySelector("[data-filters]");
  const recordsBody = document.querySelector("[data-records]");
  const refresh = document.querySelector("[data-refresh]");
  const logout = document.querySelector("[data-logout]");
  const previous = document.querySelector("[data-prev]");
  const next = document.querySelector("[data-next]");
  const editor = document.querySelector("[data-editor]");
  const addressForm = document.querySelector("[data-address-form]");
  const editorStatus = document.querySelector("[data-editor-status]");
  const shipmentDialog = document.querySelector("[data-shipment-dialog]");
  const shipmentStatus = document.querySelector("[data-shipment-status]");
  const shipmentConfirm = document.querySelector("[data-shipment-confirm]");
  let password = "";
  let page = 1;
  let records = [];
  let editing = null;
  let shipping = null;
  let loading = false;
  let saving = false;
  let sessionVersion = 0;

  const message = (element, text, state = "") => {
    element.textContent = text;
    element.dataset.state = state;
  };

  const lock = () => {
    sessionVersion += 1;
    password = "";
    records = [];
    editing = null;
    shipping = null;
    recordsBody.replaceChildren();
    workspace.hidden = true;
    refresh.hidden = true;
    logout.hidden = true;
    login.hidden = false;
    addressForm.reset();
    editor.close();
    shipmentDialog.close();
    login.elements.password.value = "";
    login.elements.password.focus();
  };

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { ...options.headers, authorization: `Bearer ${password}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      if (response.status === 401) lock();
      throw new Error(result.error || "请求失败，请重试。");
    }
    return result;
  };

  const cell = (row, lines) => {
    const td = document.createElement("td");
    lines.forEach(([text, className = ""]) => {
      const span = document.createElement("span");
      span.className = `cell-line ${className}`;
      span.textContent = text;
      td.append(span);
    });
    row.append(td);
    return td;
  };

  const snapshot = (record) => ({
    shippingAddress: record.shippingAddress,
    addressConfirmed: record.addressConfirmed,
    shippedFlag: record.shippedFlag,
  });

  function renderRecords() {
    recordsBody.replaceChildren();
    records.forEach((record) => {
      const row = document.createElement("tr");
      cell(row, [[record.name], [record.wechatId, "muted"], [`#${record.id} · ${record.createdAt.slice(0, 10)}`, "muted"]]);
      cell(row, [[record.memberNames]]);
      cell(row, [[record.memberTypeLabel], [`成人 ${record.adults} / 儿童 ${record.junior}`, "muted"]]);
      const gift = record.memberType === "renewal" || record.memberGiftNeeded === "是";
      cell(row, [[record.paid === "是" ? "已付款" : "未付款", record.paid === "是" ? "badge confirmed" : "badge pending"],
        [gift ? "含会员礼品" : "不含会员礼品", "muted"]]);
      cell(row, [[record.shippingAddress, "address"]]);
      cell(row, [[record.addressConfirmed ? "地址已确认" : "地址未确认", `badge ${record.addressConfirmed ? "confirmed" : "pending"}`],
        [record.shippedFlag ? "已寄出" : "未寄出", `badge ${record.shippedFlag ? "shipped" : ""}`]]);
      cell(row, [[record.notes || "无", "muted"]]);
      const actions = document.createElement("td");
      const buttons = document.createElement("div");
      buttons.className = "row-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "secondary-button";
      edit.textContent = "编辑地址";
      edit.disabled = loading;
      edit.addEventListener("click", () => {
        editing = record;
        document.querySelector("[data-editor-member]").textContent = `${record.name} · ${record.wechatId}`;
        addressForm.elements.shippingAddress.value = record.shippingAddress;
        addressForm.elements.addressConfirmed.checked = record.addressConfirmed;
        message(editorStatus, "");
        editor.showModal();
      });
      const ship = document.createElement("button");
      ship.type = "button";
      ship.className = record.shippedFlag ? "secondary-button" : "primary-button";
      ship.textContent = record.shippedFlag ? "撤销寄出" : "标记寄出";
      ship.disabled = loading || (!record.shippedFlag && !record.addressConfirmed);
      if (!record.shippedFlag && !record.addressConfirmed) ship.title = "请先确认收件地址";
      ship.addEventListener("click", () => {
        shipping = record;
        document.querySelector("[data-shipment-message]").textContent = record.shippedFlag
          ? `将 ${record.name} 的邮寄状态恢复为未寄出？` : `确认已将包裹寄给 ${record.name}？`;
        document.querySelector("[data-shipment-address]").textContent = record.shippingAddress;
        shipmentConfirm.textContent = record.shippedFlag ? "确认撤销寄出" : "确认寄出";
        message(shipmentStatus, "");
        shipmentDialog.showModal();
      });
      buttons.append(edit, ship);
      actions.append(buttons);
      row.append(actions);
      recordsBody.append(row);
    });
    document.querySelector("[data-empty]").hidden = records.length > 0;
  }

  async function loadRecords() {
    if (loading) return false;
    const requestSession = sessionVersion;
    loading = true;
    refresh.disabled = true;
    previous.disabled = true;
    next.disabled = true;
    filters.querySelectorAll("button, input, select").forEach((el) => { el.disabled = true; });
    document.querySelectorAll("[data-view]").forEach((el) => { el.disabled = true; });
    recordsBody.querySelectorAll("button").forEach((el) => { el.disabled = true; });
    workspace.setAttribute("aria-busy", "true");
    const confirmed = filters.elements.confirmed.value;
    const shipped = filters.elements.shipped.value;
    const params = new URLSearchParams({ confirmed, shipped, page: String(page), search: filters.elements.search.value.trim() });
    let result;
    try {
      message(status, "正在加载会员信息…");
      result = await api(`/api/shipping?${params}`);
      if (requestSession !== sessionVersion) {
        result = null;
        return false;
      }
      page = result.page;
      records = result.records;
      login.hidden = true;
      workspace.hidden = false;
      refresh.hidden = false;
      logout.hidden = false;
      document.querySelectorAll("[data-count]").forEach((el) => { el.textContent = result.counts[el.dataset.count]; });
      document.querySelector("[data-result-count]").textContent = `${result.total} 条记录`;
      document.querySelector("[data-page]").textContent = `第 ${page} / ${Math.max(1, Math.ceil(result.total / result.pageSize))} 页`;
      document.querySelector("[data-list-title]").textContent = confirmed === "1" && shipped === "0" ? "待寄出会员" : "会员邮寄列表";
      const activeView = confirmed === "1" && shipped === "0" ? "ready" : confirmed === "0" && shipped === "all" ? "unconfirmed" : confirmed === "all" && shipped === "1" ? "shipped" : confirmed === "all" && shipped === "all" ? "all" : "";
      document.querySelectorAll("[data-view]").forEach((el) => { el.setAttribute("aria-pressed", String(el.dataset.view === activeView)); });
      message(status, "");
      return true;
    } catch (error) {
      records = [];
      recordsBody.replaceChildren();
      document.querySelector("[data-empty]").hidden = true;
      message(status, error.message, "error");
      return false;
    } finally {
      loading = false;
      refresh.disabled = false;
      filters.querySelectorAll("button, input, select").forEach((el) => { el.disabled = false; });
      document.querySelectorAll("[data-view]").forEach((el) => { el.disabled = false; });
      workspace.removeAttribute("aria-busy");
      if (result) {
        previous.disabled = page <= 1;
        next.disabled = page * result.pageSize >= result.total;
        renderRecords();
      }
    }
  }

  login.addEventListener("submit", async (event) => {
    event.preventDefault();
    password = login.elements.password.value;
    const button = login.querySelector("button");
    button.disabled = true;
    try { await loadRecords(); } finally { button.disabled = false; }
    login.elements.password.value = "";
  });
  logout.addEventListener("click", () => { lock(); message(status, "已退出管理。"); });
  refresh.addEventListener("click", loadRecords);
  filters.addEventListener("submit", (event) => { event.preventDefault(); page = 1; loadRecords(); });
  filters.querySelectorAll("select").forEach((el) => el.addEventListener("change", () => { page = 1; loadRecords(); }));
  document.querySelector("[data-reset]").addEventListener("click", () => { filters.reset(); page = 1; loadRecords(); });
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    const views = { ready: ["1", "0"], unconfirmed: ["0", "all"], shipped: ["all", "1"], all: ["all", "all"] };
    const [confirmed, shipped] = views[button.dataset.view];
    filters.elements.confirmed.value = confirmed;
    filters.elements.shipped.value = shipped;
    page = 1;
    loadRecords();
  }));
  previous.addEventListener("click", () => { page -= 1; loadRecords(); });
  next.addEventListener("click", () => { page += 1; loadRecords(); });

  const closeEditor = () => { if (!saving) editor.close(); };
  document.querySelector("[data-close]").addEventListener("click", closeEditor);
  document.querySelector("[data-cancel]").addEventListener("click", closeEditor);
  document.querySelector("[data-shipment-cancel]").addEventListener("click", () => { if (!saving) shipmentDialog.close(); });
  [editor, shipmentDialog].forEach((dialog) => dialog.addEventListener("cancel", (event) => { if (saving) event.preventDefault(); }));

  async function save(payload, dialog, feedback) {
    if (saving) return;
    saving = true;
    dialog.querySelectorAll("button").forEach((el) => { el.disabled = true; });
    try {
      message(feedback, "正在保存…");
      await api("/api/shipping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      dialog.close();
      if (await loadRecords()) message(status, payload.action === "address" ? "地址已保存。" : payload.shippedFlag ? "已标记为寄出。" : "已撤销寄出。", "success");
    } catch (error) {
      message(feedback, error.message, "error");
      message(status, error.message, "error");
    } finally {
      saving = false;
      dialog.querySelectorAll("button").forEach((el) => { el.disabled = false; });
    }
  }
  addressForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editing || !addressForm.reportValidity()) return;
    save({ id: editing.id, action: "address", expected: snapshot(editing),
      shippingAddress: addressForm.elements.shippingAddress.value,
      addressConfirmed: addressForm.elements.addressConfirmed.checked }, editor, editorStatus);
  });
  shipmentConfirm.addEventListener("click", () => {
    if (!shipping) return;
    save({ id: shipping.id, action: "shipment", shippedFlag: !shipping.shippedFlag,
      expected: snapshot(shipping) }, shipmentDialog, shipmentStatus);
  });
})();
