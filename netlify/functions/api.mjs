import { getStore } from "@netlify/blobs";

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const empty = { codes: [], statics: [], history: [], logo: "", pageUrl: "" };

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\/?/, "");
  const store = getStore("qr-data");
  const data = (await store.get("data", { type: "json" })) || empty;

  // Público: devolve só o que é preciso para redirecionar quem lê o QR Code
  if (route === "public" && req.method === "GET") {
    const id = new URL(req.url).searchParams.get("id") || "principal";
    const c = (data.codes || []).find((x) => x.id === id);
    if (!c) return json({ error: "not_found" }, 404);
    return json({ id: c.id, label: c.label, target: c.target, kind: c.kind, links: c.links });
  }

  // Área do dono: exige a senha configurada no Netlify
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return json({ error: "no_password_configured" }, 500);
  if (req.headers.get("x-admin-password") !== pass) return json({ error: "unauthorized" }, 401);

  if (route === "all" && req.method === "GET") return json(data);

  if (route === "all" && req.method === "PUT") {
    const text = await req.text();
    if (text.length > 3_000_000) return json({ error: "too_large" }, 413);
    let b;
    try { b = JSON.parse(text); } catch { return json({ error: "bad_json" }, 400); }
    const clean = {
      codes: Array.isArray(b.codes) ? b.codes : [],
      statics: Array.isArray(b.statics) ? b.statics : [],
      history: Array.isArray(b.history) ? b.history.slice(0, 30) : [],
      logo: typeof b.logo === "string" ? b.logo : "",
      pageUrl: typeof b.pageUrl === "string" ? b.pageUrl : "",
    };
    await store.setJSON("data", clean);
    return json({ ok: true });
  }

  return json({ error: "not_found" }, 404);
};

export const config = { path: "/api/*" };
