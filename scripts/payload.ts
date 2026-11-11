import { checkBudgets, formatTable, measurePayload } from "./lib/payload.js";

// `npm run payload`: measures the byte budgets of frontend.md against the real app and exits 1
// when any is over (server-and-viewer requirement 14.3). Makes no request beyond 127.0.0.1.

const rows = checkBudgets(await measurePayload());
console.log(formatTable(rows));
const over = rows.filter((row) => !row.ok);
if (over.length > 0) {
  console.log(`\n${String(over.length)} budget(s) over: ${over.map((r) => r.name).join(", ")}`);
  process.exitCode = 1;
}
