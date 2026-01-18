import cors from "cors";
import express from "express";

import { config } from "./config/config.js";
import bookingsRouter from "./routes/bookings.js";
import programsRouter from "./routes/programs.js";
import packagesRouter from "./routes/packages.js";
import {
  validateEmailTemplateConfiguration,
  getEnvVarName,
} from "./services/emailTemplates/index.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/api/v1/programs", programsRouter);
app.use("/api/v1/packages", packagesRouter);

app.use("/api/v1/bookings", bookingsRouter);

// Validate email templates at startup to catch configuration issues early
const templateValidation = validateEmailTemplateConfiguration();
if (!templateValidation.isValid) {
  console.error("\n==========================================");
  console.error("ERROR: Email Templates Not Configured");
  console.error("==========================================");
  console.error("The following email templates are missing:");
  templateValidation.missingTemplates.forEach((templateType) => {
    console.error(`  - ${getEnvVarName(templateType)}`);
  });
  console.error("Please set these environment variables in your .env file.");
  console.error("==========================================\n");
} else {
  console.log("✓ All email templates are configured correctly");
  console.log(
    `  Configured templates: ${templateValidation.configuredTemplates.length}`,
  );
}

app.listen(config.port, () => {
  console.log(`Listening on http://localhost:${config.port.toString()}`);
});
