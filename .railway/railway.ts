import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const migros = service("migros-mcp", {
    source: github("SwissMadeProducts/migros-mcp", { branch: "main" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 60,
    env: { PORT: "3000" },
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 3 },
  });
  return project("migros-mcp", { resources: [migros] });
});
