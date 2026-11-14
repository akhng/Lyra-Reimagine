import { existsSync } from "node:fs";

// DB tests talk to the local Supabase stack; keys come from .env.local (written from `supabase status`).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
