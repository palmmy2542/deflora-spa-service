import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Handlebars from "handlebars";
import { Resend } from "resend";
import { config } from "../config/config.js";

const resend = new Resend(config.resend.apiKey);

export async function generateEmail(
  templateName: string,
  data: any
): Promise<string> {
  Handlebars.registerHelper("addOne", function (value: number) {
    return value + 1;
  });
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const templatePath = path.join(__dirname, "../email-templates", templateName);
  const template = fs.readFileSync(templatePath, "utf8");
  const templateSpec = Handlebars.compile(template);
  return templateSpec(data);
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const result = await resend.emails.send({
    from: "Deflora <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  console.log(`emailService: ${to} ${subject}`);
  if (result.error) {
    console.log(result.error);
  } else {
    console.log(result);
  }
}
