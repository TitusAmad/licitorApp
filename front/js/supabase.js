
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://svuhpqimozcqccnpsbdd.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_lJV9YEf2TX-I8NfnqwlX5g_902C9Bk-";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

//TEST OK
//la connexion sécurisée en lecture entre ton application et Supabase.