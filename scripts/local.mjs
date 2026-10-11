import { spawn } from "node:child_process";
import path from "node:path";
const mode = process.argv[2] || "dev";
const root = path.resolve(import.meta.dirname, "..");
const child = spawn(
  process.execPath,
  [
    path.join(root, "node_modules/next/dist/bin/next"),
    mode,
    "apps/web",
    "--hostname",
    "127.0.0.1",
    "--port",
    process.env.PORT || "3000",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      REPLYPILOT_LOCAL_DEV: "1",
      REPLYPILOT_ORIGIN: 'http://127.0.0.1:' + (process.env.PORT || '3000'),
      REPLYPILOT_DATA_DIR:
        process.env.REPLYPILOT_DATA_DIR || path.join(root, ".data"),
    },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
