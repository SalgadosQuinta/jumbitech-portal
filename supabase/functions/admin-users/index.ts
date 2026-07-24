// Admin user management. Runs server-side with the service role; callable only
// by staff whose session has passed MFA (aal2). All actions audited.
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN = "https://portal.jumbitech.com";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ---- Authenticate and authorise the caller: staff + aal2, no exceptions.
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Missing token" });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json(401, { error: "Invalid session" });
  const caller = userData.user;

  let aal = "aal1";
  try { aal = JSON.parse(atob(jwt.split(".")[1])).aal ?? "aal1"; } catch { /* fall through */ }
  if (aal !== "aal2") return json(403, { error: "MFA required" });

  const { data: prof } = await admin.from("profiles").select("role").eq("id", caller.id).single();
  if (prof?.role !== "staff") return json(403, { error: "Staff only" });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const auditRow = (action: string, entity_id: string, detail: Record<string, unknown>) =>
    admin.from("audit_log").insert({ actor: caller.id, action, entity: "user", entity_id, detail });

  try {
    // -------------------------------------------------- invite a new user
    if (action === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const role = ["candidate", "staff", "client"].includes(body.role) ? body.role : "candidate";
      if (!email) return json(400, { error: "Email required" });

      // Try to send the invite email (built-in mailer; may be rate limited).
      let emailed = false;
      const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, invited: true },
      });
      let userId = invited?.user?.id ?? null;
      if (!invErr) emailed = true;
      if (invErr && !/already/i.test(invErr.message)) return json(400, { error: invErr.message });

      if (!userId) {
        const { data: found } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        userId = found?.users?.find((u) => u.email === email)?.id ?? null;
      }
      if (!userId) return json(500, { error: "User creation failed" });

      // Set the intended role on the profile the signup trigger created.
      await admin.from("profiles").update({ full_name: fullName, role }).eq("id", userId);

      // Always produce a link staff can copy and send manually.
      const { data: linkData } = await admin.auth.admin.generateLink({ type: "recovery", email });
      await auditRow("user.invite", userId, { email, role, emailed });
      return json(200, { ok: true, emailed, user_id: userId, setup_link: linkData?.properties?.action_link ?? null });
    }

    // ------------------------------------------ password reset for a user
    if (action === "reset") {
      const userId = String(body.user_id ?? "");
      const { data: u } = await admin.auth.admin.getUserById(userId);
      if (!u?.user?.email) return json(404, { error: "User not found" });
      const { data: linkData, error: lErr } = await admin.auth.admin.generateLink({ type: "recovery", email: u.user.email });
      if (lErr) return json(400, { error: lErr.message });
      await auditRow("user.reset_link", userId, { email: u.user.email });
      return json(200, { ok: true, reset_link: linkData?.properties?.action_link ?? null });
    }

    // --------------------------------------------------- edit user details
    if (action === "update") {
      const userId = String(body.user_id ?? "");
      const patch: Record<string, unknown> = {};
      if (body.email) patch.email = String(body.email).trim().toLowerCase();
      if (Object.keys(patch).length) {
        const { error: upErr } = await admin.auth.admin.updateUserById(userId, { ...patch, email_confirm: true });
        if (upErr) return json(400, { error: upErr.message });
        if (patch.email) await admin.from("profiles").update({ email: patch.email }).eq("id", userId);
      }
      if (body.full_name !== undefined) {
        await admin.from("profiles").update({ full_name: String(body.full_name) }).eq("id", userId);
      }
      await auditRow("user.update", userId, { fields: Object.keys(body).filter((k) => k !== "action" && k !== "user_id") });
      return json(200, { ok: true });
    }

    // ------------------------------------------------ disable / re-enable
    if (action === "set_active") {
      const userId = String(body.user_id ?? "");
      const active = Boolean(body.active);
      const { error: bErr } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: active ? "none" : "876000h",
      });
      if (bErr) return json(400, { error: bErr.message });
      await auditRow(active ? "user.enable" : "user.disable", userId, {});
      return json(200, { ok: true });
    }

    return json(400, { error: "Unknown action" });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
