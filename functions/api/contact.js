function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL || !env.RESEND_FROM_EMAIL) {
    return json({ error: "Contact email is not configured yet." }, 503);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (data.website) return json({ ok: true });

  const firstName = String(data.firstName || "").trim().slice(0, 100);
  const lastName = String(data.lastName || "").trim().slice(0, 100);
  const email = String(data.email || "").trim().slice(0, 254);
  const message = String(data.message || "").trim().slice(0, 10_000);
  if (!/^\S+@\S+\.\S+$/.test(email) || !message) {
    return json({ error: "Please enter a valid email address and message." }, 400);
  }

  const name = `${firstName} ${lastName}`.trim() || "Website visitor";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [env.CONTACT_TO_EMAIL],
      reply_to: email,
      subject: `Website enquiry from ${name}`,
      html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Message:</strong></p><p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>`
    })
  });

  if (!response.ok) {
    console.error("Resend error", response.status, await response.text());
    return json({ error: "Unable to send your message. Please try again." }, 502);
  }

  return json({ ok: true });
}

export function onRequest() {
  return json({ error: "Method not allowed." }, 405);
}
