// Node entry point for the standalone HTML export: writes the dashboard's
// data (the same loadAllContent() app/page.tsx uses) as JSON to the file
// named by the first argument. (Not stdout — the sheet loader logs there.)
import { writeFileSync } from "node:fs";
import { loadAllContent } from "@/lib/load-content";

writeFileSync(process.argv[2], JSON.stringify(await loadAllContent()));
