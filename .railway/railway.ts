import {
  defineRailway,
  github,
  postgres,
  project,
  service,
  volume,
} from "railway/iac";

export default defineRailway(() => {
  const postgresDatabase = postgres("Postgres", { region: "ams" });
  const postgresVolume = volume("postgres-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "ams",
    sizeMB: 500,
  });
  const cengelApi = service("cengel-api", {
    source: github("sametckilic/cengel-app", { branch: "main" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "apps/api/Dockerfile",
      watchPatterns: [
        "apps/api/**",
        "apps/mobile/data/generated/**",
        "packages/**",
        "package.json",
        "package-lock.json",
      ],
    },
    deploy: {
      restartPolicyType: "ALWAYS",
    },
    preDeploy: "node apps/api/dist/database/migrate.js",
    healthcheck: "/ready",
    healthcheckTimeout: 300,
    replicas: { "ams": 1 },
    env: {
      CORS_ORIGINS: "http://localhost:8081,http://localhost:19006",
      DATABASE_SSL: "false",
      DATABASE_URL: postgresDatabase.env.DATABASE_URL,
      DB_CONNECTION_TIMEOUT_MS: "5000",
      DB_POOL_MAX: "5",
      NODE_ENV: "production",
    },
  });

  return project("cengel-app", {
    resources: [cengelApi, postgresDatabase, postgresVolume],
  });
});
