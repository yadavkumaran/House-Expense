import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTranscriptionHandler } from "./handler.mjs";

Deno.serve(createTranscriptionHandler({
  env: name => Deno.env.get(name),
  createClient
}));
