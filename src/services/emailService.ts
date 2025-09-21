// emailService.ts
import sgMail from "@sendgrid/mail";
import { config } from "../config/config.js";

// --- Types (same as before, with minor tweaks) ---
type Social = { facebook?: string; instagram?: string };
type Company = {
  name: string;
  url?: string;
  logoUrl?: string;
  address?: string;
  footerAddress?: string;
  email?: string;
  phone?: string;
  experienceUrl?: string;
  mapUrl?: string;
  contactUrl?: string;
  social?: Social;
};
type Booking = { dateTime?: string; branch?: string };
type Treatment = { name: string; duration: string };
type Guest = { name: string; treatments?: Treatment[] };

const defaultCompany: Company = {
  name: "De Flora Spa",
  url: "https://www.defloraspa.com",
  logoUrl:
    "https://vgqznl.stripocdn.email/content/guids/CABINET_f4d6c533564bb992bc95d0c6ebd8a65f8219e506ca4fd96aea01e2bb3dc25e37/images/de_flora_side_logo_Gzh.png",
  address: "216 De Flora Spa, Patong, Phuket",
  footerAddress: "216 De Flora Spa, Patong, Phuket, Thailand, 83150",
  email: "support@defloraspa.com",
  phone: "+66 76 344 555",
  experienceUrl: "https://defloraspa.com/experience/",
  mapUrl:
    "https://www.google.com/maps/place/De+Flora+Spa+%26+Massage/@7.8887735,98.2927824,17z/data=!3m1!4b1!4m6!3m5!1s0x30503aba89363e5b:0x4acca8d6337d83ed!8m2!3d7.8887735!4d98.2953573!16s%2Fg%2F11b7rnbhg1?coh=225991&entry=tts&g_ep=EgoyMDI1MDEyMi4wIPu8ASoASAFQAw%3D%3D.",
  contactUrl: "https://defloraspa.com/contact/",
  social: {
    facebook: "https://www.facebook.com/defloraspa.phuket/",
    instagram: "https://www.instagram.com/defloraspa/",
  },
};

const defaultBranch = "De Flora Spa Patong";

export type InputData = {
  emailTitle?: string;
  company?: Company;
  booking?: Booking;
  guests?: Guest[]; // still supports array if your source can send it
};

export async function sendWithTemplateId(opts: {
  apiKey: string; // SENDGRID_API_KEY (Mail Send -> Full Access)
  templateId: string; // "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  from: string; // Verified sender (e.g., "Deflora <no-reply@defloraspa.com>")
  to: string | string[];
  subject?: string | undefined; // optional (can be set in template)
  data: InputData; // becomes dynamic_template_data
  cc?: string | string[] | undefined;
  bcc?: string | string[] | undefined;
  replyTo?: string | undefined;
}) {
  const { apiKey, templateId, from, to, subject, data, cc, bcc, replyTo } =
    opts;

  sgMail.setApiKey(apiKey);

  const dynamicTemplateData = {
    ...data,
  };

  await sgMail.send({
    to,
    from,
    templateId,
    ...(subject ? { subject } : {}),
    dynamicTemplateData,
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
    ...(replyTo ? { replyTo } : {}),
  });
}

// --- One-call helper: compile & send ---
export async function sendTemplatedEmail(options: {
  templateId: string;
  data: InputData;
  to: string | string[];
  subject: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}): Promise<void> {
  await sendWithTemplateId({
    ...options,
    apiKey: config.sendgrid.apiKey ?? "",
    from: config.sendgrid.fromEmail ?? "",
    data: {
      ...options.data,
      company: defaultCompany,
      booking: { ...options.data.booking, branch: defaultBranch },
    },
  });
}
