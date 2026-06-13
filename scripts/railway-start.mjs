import { spawn } from "node:child_process";

const host = "0.0.0.0";
const port = process.env.PORT || "3000";
const deploymentId =
  process.env.RAILWAY_GIT_COMMIT_SHA ??
  process.env.RAILWAY_DEPLOYMENT_ID ??
  process.env.DEPLOYMENT_VERSION ??
  "missing";

console.log(
  `[railway-start] DATABASE_URL=${process.env.DATABASE_URL ? "set" : "missing"} NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ? "set" : "missing"
  } deploymentId=${deploymentId} PORT=${port}`,
);

await run("npx", ["prisma", "migrate", "deploy"]);

const nextProcess = spawn(
  "npx",
  ["next", "start", "--hostname", host, "--port", port],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    nextProcess.kill(signal);
  });
}

nextProcess.on("exit", (code, signal) => {
  if (signal) {
    console.log(`[railway-start] next exited from ${signal}`);
    process.exit(0);
  }

  process.exit(code ?? 1);
});

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}
