// =====================================================
// PRÆTOR FleetOps · Supabase Client (única instancia)
// =====================================================

const SUPABASE_URL =
    "https://sqvmyigzayuqahzmkujn.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_iUIRzSgR5tWjfv_7xiNQ3Q_bSoYZDtU";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

console.log(
    "PRÆTOR FleetOps: supabaseClient inicializado."
);