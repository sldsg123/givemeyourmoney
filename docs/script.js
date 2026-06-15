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

  const setStatus = (message, state = "") => {
    status.textContent = message;
    if (state) {
      status.dataset.state = state;
    } else {
      delete status.dataset.state;
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
      setStatus("提交失败，请稍后再试。", "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  setFlow();
})();
