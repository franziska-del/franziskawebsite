(() => {
  const formContainer = "#nf-form-1-cont";

  function statusElement(form) {
    let status = form.querySelector("[data-cloudflare-form-status]");
    if (!status) {
      status = document.createElement("p");
      status.dataset.cloudflareFormStatus = "";
      status.setAttribute("role", "status");
      status.style.marginTop = "16px";
      form.append(status);
    }
    return status;
  }

  async function sendForm(form, event) {
      if (form.dataset.cloudflareSubmitting === "true") return;
      form.dataset.cloudflareSubmitting = "true";
      event?.preventDefault();
      event?.stopImmediatePropagation();
      const button = form.querySelector('[type="submit"]');
      const status = statusElement(form);
      const value = (selector) => form.querySelector(selector)?.value?.trim() || "";
      const payload = {
        firstName: value("#nf-field-5"),
        lastName: value("#nf-field-6"),
        email: value("#nf-field-7"),
        message: value("#nf-field-8"),
        website: value('[name="website"]')
      };

      if (!payload.email || !payload.message) {
        status.textContent = "Please enter your email address and a message.";
        return;
      }

      if (button) {
        button.disabled = true;
        button.value = "Sending…";
      }
      status.textContent = "";

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to send your message.");
        form.reset();
        status.textContent = "Thank you — your message has been sent.";
      } catch (error) {
        status.textContent = error.message || "Unable to send your message. Please email info@basicbananas.com.";
      } finally {
        delete form.dataset.cloudflareSubmitting;
        if (button) {
          button.disabled = false;
          button.value = "Submit";
        }
      }
  }

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.closest(formContainer)) return;
      void sendForm(form, event);
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(`${formContainer} [type="submit"]`);
      if (!button) return;
      const form = button.closest("form");
      if (form) void sendForm(form, event);
    },
    true
  );
})();
