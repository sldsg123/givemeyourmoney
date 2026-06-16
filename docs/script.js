(() => {
  const form = document.querySelector("[data-form]");
  const status = document.querySelector("[data-status]");
  const submitButton = form?.querySelector("button[type='submit']");
  const preview = document.querySelector("[data-preview]");
  const previewList = document.querySelector("[data-preview-list]");
  const memberTypeSelect = document.querySelector("[data-member-type]");
  const newMemberNote = document.querySelector("[data-new-member-note]");
  const officialConfirmation = document.querySelector(
    "[data-official-confirmation]"
  );
  const renewalOnlyFields = document.querySelectorAll("[data-renewal-only]");
  const renewalRequiredFields = document.querySelectorAll(
    "[data-renewal-required]"
  );
  const newMemberOnlyFields = document.querySelectorAll("[data-new-member-only]");
  const memberGiftNeeded = form?.elements.memberGiftNeeded;
  const lookupDialog = document.querySelector("[data-lookup-dialog]");
  const openLookup = document.querySelector("[data-open-lookup]");
  const closeLookup = document.querySelector("[data-close-lookup]");
  const lookupForm = document.querySelector("[data-lookup-form]");
  const updateForm = document.querySelector("[data-update-form]");
  const lookupStatus = document.querySelector("[data-lookup-status]");
  const updateMemberType = document.querySelector("[data-update-member-type]");
  const updateRenewalOnlyFields = document.querySelectorAll(
    "[data-update-renewal-only]"
  );
  const updateRenewalRequiredFields = document.querySelectorAll(
    "[data-update-renewal-required]"
  );
  const updateNewMemberOnlyFields = document.querySelectorAll(
    "[data-update-new-member-only]"
  );
  const qrTriggers = document.querySelectorAll("[data-qr-trigger]");
  const storageKey = "latestMemberInfoSubmission";
  const endpoint = window.FORM_ENDPOINT || "";
  const isLocalStaticServer =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    window.location.port === "8000";
  const isConfigured =
    Boolean(endpoint) &&
    endpoint !== "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";

  if (!form || !status || !submitButton || !memberTypeSelect) {
    return;
  }

  const labels = {
    renewal: "旧会员续费",
    new: "新会员入会",
  };

  const getApiEndpoint = (action) => {
    if (!endpoint) {
      return "";
    }

    return endpoint.replace(/\/submit$/, `/${action}`);
  };

  const setStatus = (message, state = "") => {
    status.textContent = message;
    if (state) {
      status.dataset.state = state;
    } else {
      delete status.dataset.state;
    }
  };

  const setLookupStatus = (message, state = "") => {
    if (!lookupStatus) {
      return;
    }

    lookupStatus.textContent = message;
    if (state) {
      lookupStatus.dataset.state = state;
    } else {
      delete lookupStatus.dataset.state;
    }
  };

  const setFlow = () => {
    const memberType = memberTypeSelect.value;
    const isNewMember = memberType === "new";
    const isRenewal = memberType === "renewal";

    if (newMemberNote) {
      newMemberNote.hidden = !isNewMember;
    }

    if (officialConfirmation) {
      officialConfirmation.required = isNewMember;
      if (!isNewMember) {
        officialConfirmation.checked = false;
      }
    }

    renewalOnlyFields.forEach((field) => {
      field.hidden = !isRenewal;
    });

    renewalRequiredFields.forEach((field) => {
      field.required = isRenewal;
      if (!isRenewal) {
        field.value = "";
      }
    });

    newMemberOnlyFields.forEach((field) => {
      field.hidden = !isNewMember;
    });

    if (memberGiftNeeded && !isNewMember) {
      memberGiftNeeded.checked = false;
    }
  };

  const setUpdateFlow = () => {
    if (!updateForm || !updateMemberType) {
      return;
    }

    const memberType = updateMemberType.value;
    const isNewMember = memberType === "new";
    const isRenewal = memberType === "renewal";
    const updateGift = updateForm.elements.memberGiftNeeded;

    updateRenewalOnlyFields.forEach((field) => {
      field.hidden = !isRenewal;
    });

    updateRenewalRequiredFields.forEach((field) => {
      field.required = isRenewal;
      if (!isRenewal) {
        field.value = "";
      }
    });

    updateNewMemberOnlyFields.forEach((field) => {
      field.hidden = !isNewMember;
    });

    if (updateGift && !isNewMember) {
      updateGift.checked = false;
    }
  };

  const openLookupDialog = () => {
    if (!lookupDialog) {
      return;
    }

    if (typeof lookupDialog.showModal === "function") {
      lookupDialog.showModal();
    } else {
      lookupDialog.hidden = false;
    }
  };

  const closeLookupDialog = () => {
    if (!lookupDialog) {
      return;
    }

    if (typeof lookupDialog.close === "function") {
      lookupDialog.close();
    } else {
      lookupDialog.hidden = true;
    }
  };

  const fillUpdateForm = (record, lookupName, lookupWechatId) => {
    if (!updateForm) {
      return;
    }

    updateForm.elements.id.value = record.id || "";
    updateForm.elements.lookupName.value = lookupName;
    updateForm.elements.lookupWechatId.value = lookupWechatId;
    updateForm.elements.memberType.value = record.memberType || "renewal";
    updateForm.elements.name.value = record.name || "";
    updateForm.elements.wechatId.value = record.wechatId || "";
    updateForm.elements.adults.value = record.adults || "0";
    updateForm.elements.junior.value = record.junior || "0";
    updateForm.elements.memberNames.value = record.memberNames || "";
    updateForm.elements.hasInfoChange.value = record.hasInfoChange || "";
    updateForm.elements.memberGiftNeeded.checked =
      record.memberGiftNeeded === "是";
    updateForm.elements.shippingAddress.value = record.shippingAddress || "";
    updateForm.elements.paid.checked = record.paid === "是";
    updateForm.elements.notes.value = record.notes || "";
    setUpdateFlow();
    updateForm.hidden = false;
  };

  const renderPreview = (record) => {
    if (!preview || !previewList) {
      return;
    }

    const rows = [
      ["办理类型", labels[record.memberType] || ""],
      ["姓名", record.name],
      ["微信号", record.wechatId],
      ["成人会员人数", record.adults],
      ["儿童会员人数", record.junior],
      ["会员姓名", record.memberNames],
    ];

    if (record.memberType === "renewal") {
      rows.push(["是否有信息变更", record.hasInfoChange]);
    } else {
      rows.push(["官网信息录入", "已完成"]);
      rows.push(["需要会员礼品", record.memberGiftNeeded]);
    }

    rows.push(
      ["物流地址", record.shippingAddress],
      ["已付款", record.paid],
      ["备注", record.notes || "无"],
      ["提交时间", new Date(record.submittedAt).toLocaleString("zh-CN")]
    );

    previewList.replaceChildren();
    rows.forEach(([label, value]) => {
      const term = document.createElement("dt");
      const description = document.createElement("dd");

      term.textContent = label;
      description.textContent = value;

      previewList.append(term, description);
    });
    preview.hidden = false;
  };

  const savedSubmission = localStorage.getItem(storageKey);
  if (savedSubmission) {
    try {
      renderPreview(JSON.parse(savedSubmission));
    } catch (error) {
      localStorage.removeItem(storageKey);
    }
  }

  memberTypeSelect.addEventListener("change", () => {
    setFlow();
    setStatus("");
  });

  openLookup?.addEventListener("click", () => {
    setLookupStatus("");
    openLookupDialog();
  });

  closeLookup?.addEventListener("click", closeLookupDialog);

  lookupDialog?.addEventListener("click", (event) => {
    if (event.target === lookupDialog) {
      closeLookupDialog();
    }
  });

  updateMemberType?.addEventListener("change", setUpdateFlow);

  qrTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const popover = trigger.closest(".qr-popover");
      const isOpen = popover?.dataset.open === "true";

      qrTriggers.forEach((item) => {
        item.setAttribute("aria-expanded", "false");
        item.closest(".qr-popover")?.removeAttribute("data-open");
      });

      if (popover && !isOpen) {
        popover.dataset.open = "true";
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("click", () => {
    qrTriggers.forEach((trigger) => {
      trigger.setAttribute("aria-expanded", "false");
      trigger.closest(".qr-popover")?.removeAttribute("data-open");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    qrTriggers.forEach((trigger) => {
      trigger.setAttribute("aria-expanded", "false");
      trigger.closest(".qr-popover")?.removeAttribute("data-open");
    });
  });

  lookupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!lookupForm.reportValidity()) {
      return;
    }

    if (isLocalStaticServer && endpoint.startsWith("/")) {
      setLookupStatus("本地静态测试无法连接 D1，请部署后查询。", "error");
      return;
    }

    const lookupEndpoint = getApiEndpoint("lookup");
    if (!lookupEndpoint) {
      setLookupStatus("查询接口未配置。", "error");
      return;
    }

    const lookupButton = lookupForm.querySelector("button[type='submit']");
    const formData = new FormData(lookupForm);
    const name = String(formData.get("name") || "").trim();
    const wechatId = String(formData.get("wechatId") || "").trim();
    const payload = new URLSearchParams();
    payload.set("name", name);
    payload.set("wechatId", wechatId);

    if (lookupButton) {
      lookupButton.disabled = true;
    }

    try {
      setLookupStatus("正在查询...");
      const response = await fetch(lookupEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: payload,
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "查询失败");
      }

      fillUpdateForm(result.record, name, wechatId);
      setLookupStatus("已找到记录，可以更新信息。", "success");
    } catch (error) {
      if (updateForm) {
        updateForm.hidden = true;
      }
      setLookupStatus(error.message || "查询失败，请稍后再试。", "error");
    } finally {
      if (lookupButton) {
        lookupButton.disabled = false;
      }
    }
  });

  updateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setUpdateFlow();

    if (!updateForm.reportValidity()) {
      return;
    }

    const formData = new FormData(updateForm);
    const adults = Number(formData.get("adults") || 0);
    const junior = Number(formData.get("junior") || 0);

    if (adults + junior < 1) {
      setLookupStatus("会员人数至少需要选择 1 人。", "error");
      return;
    }

    const updateEndpoint = getApiEndpoint("update");
    if (!updateEndpoint) {
      setLookupStatus("更新接口未配置。", "error");
      return;
    }

    const memberType = String(formData.get("memberType") || "");
    const payload = new URLSearchParams();
    payload.set("id", String(formData.get("id") || ""));
    payload.set("lookupName", String(formData.get("lookupName") || ""));
    payload.set("lookupWechatId", String(formData.get("lookupWechatId") || ""));
    payload.set("memberType", memberType);
    payload.set("name", String(formData.get("name") || "").trim());
    payload.set("wechatId", String(formData.get("wechatId") || "").trim());
    payload.set("adults", String(formData.get("adults") || ""));
    payload.set("junior", String(formData.get("junior") || ""));
    payload.set("memberNames", String(formData.get("memberNames") || "").trim());
    payload.set(
      "hasInfoChange",
      memberType === "renewal"
        ? String(formData.get("hasInfoChange") || "")
        : ""
    );
    payload.set(
      "memberGiftNeeded",
      memberType === "new"
        ? formData.get("memberGiftNeeded") === "yes"
          ? "是"
          : "否"
        : ""
    );
    payload.set(
      "shippingAddress",
      String(formData.get("shippingAddress") || "").trim()
    );
    payload.set("paid", formData.get("paid") === "yes" ? "是" : "否");
    payload.set("notes", String(formData.get("notes") || "").trim());
    payload.set("pageUrl", window.location.href);
    payload.set("userAgent", navigator.userAgent);

    const updateButton = updateForm.querySelector("button[type='submit']");
    if (updateButton) {
      updateButton.disabled = true;
    }

    try {
      setLookupStatus("正在保存更新...");
      const response = await fetch(updateEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: payload,
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "更新失败");
      }

      fillUpdateForm(result.record, result.record.name, result.record.wechatId);
      setLookupStatus("信息已更新。", "success");
    } catch (error) {
      setLookupStatus(error.message || "更新失败，请稍后再试。", "error");
    } finally {
      if (updateButton) {
        updateButton.disabled = false;
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFlow();

    if (!form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    const adults = Number(formData.get("adults") || 0);
    const junior = Number(formData.get("junior") || 0);

    if (adults + junior < 1) {
      setStatus("会员人数至少需要选择 1 人。", "error");
      return;
    }

    if (String(formData.get("website") || "").trim()) {
      setStatus("提交已收到。", "success");
      return;
    }

    const memberType = String(formData.get("memberType") || "");
    const record = {
      memberType,
      name: String(formData.get("name") || "").trim(),
      wechatId: String(formData.get("wechatId") || "").trim(),
      adults: String(formData.get("adults") || ""),
      junior: String(formData.get("junior") || ""),
      memberNames: String(formData.get("memberNames") || "").trim(),
      hasInfoChange:
        memberType === "renewal"
          ? String(formData.get("hasInfoChange") || "")
          : "",
      officialRegistrationComplete:
        memberType === "new"
          ? String(formData.get("officialRegistrationComplete") || "")
          : "",
      memberGiftNeeded:
        memberType === "new"
          ? formData.get("memberGiftNeeded") === "yes"
            ? "是"
            : "否"
          : "",
      shippingAddress: String(formData.get("shippingAddress") || "").trim(),
      paid: formData.get("paid") === "yes" ? "是" : "否",
      notes: String(formData.get("notes") || "").trim(),
      submittedAt: new Date().toISOString(),
    };

    const payload = new URLSearchParams();
    Object.entries(record).forEach(([key, value]) => {
      payload.set(key, value);
    });
    payload.set("website", String(formData.get("website") || ""));
    payload.set("pageUrl", window.location.href);
    payload.set("userAgent", navigator.userAgent);

    submitButton.disabled = true;

    try {
      if (isConfigured) {
        if (isLocalStaticServer && endpoint.startsWith("/")) {
          setStatus("本地静态测试已保存，部署到 Cloudflare 后会写入 D1。", "success");
        } else {
          setStatus("正在提交...");
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body: payload,
          });
          const result = await response.json();

          if (!response.ok || !result.ok) {
            throw new Error(result.error || "提交失败");
          }

          setStatus("已提交，感谢填写。", "success");
        }
      } else {
        setStatus("测试提交已保存在当前浏览器。", "success");
      }

      localStorage.setItem(storageKey, JSON.stringify(record));
      renderPreview(record);
    } catch (error) {
      setStatus(error.message || "提交失败，请稍后再试。", "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  setFlow();
})();
