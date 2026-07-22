import { supabase } from './supabase';

// Best-effort client-side audit entry. Server-enforced triggers cover timesheet
// decisions; this records reads (downloads, views) and failures.
export async function audit(action, entity = '', entityId = '', detail = {}) {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;
    await supabase.from('audit_log').insert({
      actor: data.user.id, action, entity, entity_id: String(entityId), detail,
    });
  } catch { /* never let auditing break the app */ }
}
