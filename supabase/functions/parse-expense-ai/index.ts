import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createExpenseAiHandler } from "./handler.mjs";

Deno.serve(createExpenseAiHandler({
  env: name => Deno.env.get(name),
  createClient
}));
