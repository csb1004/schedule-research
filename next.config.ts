import type { NextConfig } from "next";

const deploymentId =
  process.env.RAILWAY_GIT_COMMIT_SHA ??
  process.env.RAILWAY_DEPLOYMENT_ID ??
  process.env.DEPLOYMENT_VERSION;

const nextConfig: NextConfig = {
  deploymentId,
};

export default nextConfig;
