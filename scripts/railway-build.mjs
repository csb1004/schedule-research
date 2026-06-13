import { spawn } from "node:child_process";

const deploymentId =
  process.env.RAILWAY_GIT_COMMIT_SHA ??
  process.env.RAILWAY_DEPLOYMENT_ID ??
  process.env.DEPLOYMENT_VERSION ??
  "missing";

console.log(
  `[railway-build] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ? "set" : "missing"
  } deploymentId=${deploymentId}`,
);

await run("npx", ["prisma", "generate"]);
await run("npx", ["next", "build"]);

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
