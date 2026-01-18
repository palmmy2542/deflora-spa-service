// src/services/emailTemplates/templateSelector.ts
import { config } from "../../config/config.js";

/**
 * Booking type enumeration
 * - STANDARD: Full booking with detailed items (programs, packages)
 * - QUICK: Minimal reservation with basic info only
 */
export enum BookingType {
  STANDARD = "standard",
  QUICK = "quick",
}

/**
 * Booking status enumeration
 * - PENDING: Initial state awaiting confirmation
 * - CONFIRMED: Booking has been confirmed
 * - CANCELED: Booking has been cancelled
 */
export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELED = "canceled",
}

/**
 * Email template type enumeration for all 6 supported templates
 */
export enum EmailTemplateType {
  // Standard booking templates
  BOOKING_PENDING = "bookingPending",
  BOOKING_CONFIRMED = "bookingConfirmed",
  BOOKING_CANCELED = "bookingCanceled",

  // Quick reservation templates
  QUICK_RESERVATION_PENDING = "quickReservationPending",
  QUICK_RESERVATION_CONFIRMED = "quickReservationConfirmed",
  QUICK_RESERVATION_CANCELED = "quickReservationCanceled",
}

/**
 * Template configuration interface
 */
export interface TemplateConfig {
  type: EmailTemplateType;
  templateId: string | undefined;
  subject: string;
  description: string;
}

/**
 * Map of all email templates with their configuration
 */
const TEMPLATE_MAP: Record<EmailTemplateType, TemplateConfig> = {
  [EmailTemplateType.BOOKING_PENDING]: {
    type: EmailTemplateType.BOOKING_PENDING,
    templateId: config.sendgrid.templates.bookingPending,
    subject: "Booking Pending",
    description:
      "Sent when a standard booking is created and awaits confirmation",
  },
  [EmailTemplateType.BOOKING_CONFIRMED]: {
    type: EmailTemplateType.BOOKING_CONFIRMED,
    templateId: config.sendgrid.templates.bookingConfirmed,
    subject: "Booking Confirmed",
    description: "Sent when a standard booking is confirmed",
  },
  [EmailTemplateType.BOOKING_CANCELED]: {
    type: EmailTemplateType.BOOKING_CANCELED,
    templateId: config.sendgrid.templates.bookingCanceled,
    subject: "Booking Canceled",
    description: "Sent when a standard booking is cancelled",
  },
  [EmailTemplateType.QUICK_RESERVATION_PENDING]: {
    type: EmailTemplateType.QUICK_RESERVATION_PENDING,
    templateId: config.sendgrid.templates.quickReservationPending,
    subject: "Quick Reservation Pending",
    description:
      "Sent when a quick reservation is created and awaits confirmation",
  },
  [EmailTemplateType.QUICK_RESERVATION_CONFIRMED]: {
    type: EmailTemplateType.QUICK_RESERVATION_CONFIRMED,
    templateId: config.sendgrid.templates.quickReservationConfirmed,
    subject: "Quick Reservation Confirmed",
    description: "Sent when a quick reservation is confirmed",
  },
  [EmailTemplateType.QUICK_RESERVATION_CANCELED]: {
    type: EmailTemplateType.QUICK_RESERVATION_CANCELED,
    templateId: config.sendgrid.templates.quickReservationCanceled,
    subject: "Quick Reservation Canceled",
    description: "Sent when a quick reservation is cancelled",
  },
};

/**
 * Determine the appropriate email template based on booking type and status
 *
 * @param bookingType - Type of booking (STANDARD or QUICK)
 * @param status - Current booking status
 * @returns The appropriate email template configuration
 * @throws Error if template is not configured
 *
 * @example
 * const template = selectEmailTemplate(BookingType.STANDARD, BookingStatus.CONFIRMED);
 * // Returns template for standard booking confirmation
 */
export function selectEmailTemplate(
  bookingType: BookingType,
  status: BookingStatus,
): TemplateConfig {
  let templateType: EmailTemplateType;

  // Select template based on booking type and status
  if (bookingType === BookingType.QUICK) {
    switch (status) {
      case BookingStatus.PENDING:
        templateType = EmailTemplateType.QUICK_RESERVATION_PENDING;
        break;
      case BookingStatus.CONFIRMED:
        templateType = EmailTemplateType.QUICK_RESERVATION_CONFIRMED;
        break;
      case BookingStatus.CANCELED:
        templateType = EmailTemplateType.QUICK_RESERVATION_CANCELED;
        break;
      default:
        throw new Error(`Unsupported quick reservation status: ${status}`);
    }
  } else {
    // Standard booking
    switch (status) {
      case BookingStatus.PENDING:
        templateType = EmailTemplateType.BOOKING_PENDING;
        break;
      case BookingStatus.CONFIRMED:
        templateType = EmailTemplateType.BOOKING_CONFIRMED;
        break;
      case BookingStatus.CANCELED:
        templateType = EmailTemplateType.BOOKING_CANCELED;
        break;
      default:
        throw new Error(`Unsupported booking status: ${status}`);
    }
  }

  const template = TEMPLATE_MAP[templateType];

  // Validate that the template is configured
  if (!template.templateId) {
    throw new Error(
      `Email template not configured for ${templateType}. Please set the environment variable: ${getEnvVarName(templateType)}`,
    );
  }

  return template;
}

/**
 * Get the environment variable name for a given template type
 * Useful for error messages and configuration documentation
 */
export function getEnvVarName(templateType: EmailTemplateType): string {
  const envVarMap: Record<EmailTemplateType, string> = {
    [EmailTemplateType.BOOKING_PENDING]: "SENDGRID_TEMPLATE_BOOKING_PENDING",
    [EmailTemplateType.BOOKING_CONFIRMED]:
      "SENDGRID_TEMPLATE_BOOKING_CONFIRMED",
    [EmailTemplateType.BOOKING_CANCELED]: "SENDGRID_TEMPLATE_BOOKING_CANCELED",
    [EmailTemplateType.QUICK_RESERVATION_PENDING]:
      "SENDGRID_TEMPLATE_QUICK_RESERVATION_PENDING",
    [EmailTemplateType.QUICK_RESERVATION_CONFIRMED]:
      "SENDGRID_TEMPLATE_QUICK_RESERVATION_CONFIRMED",
    [EmailTemplateType.QUICK_RESERVATION_CANCELED]:
      "SENDGRID_TEMPLATE_QUICK_RESERVATION_CANCELED",
  };

  return envVarMap[templateType];
}

/**
 * Determine booking type from booking document data
 * A booking is considered "quick" if it has minimal info and no detailed items
 *
 * @param bookingData - Raw booking document data from Firestore
 * @returns The booking type
 */
export function determineBookingType(bookingData: any): BookingType {
  // Quick reservations have minimal structure
  // They typically lack detailed items array or have empty items
  const hasDetailedItems =
    bookingData.items &&
    Array.isArray(bookingData.items) &&
    bookingData.items.length > 0;

  if (hasDetailedItems) {
    // Check if items have programs or packages (standard booking)
    const firstItem = bookingData.items[0];
    const hasPrograms =
      firstItem.programs &&
      Array.isArray(firstItem.programs) &&
      firstItem.programs.length > 0;
    const hasPackages =
      firstItem.packages &&
      Array.isArray(firstItem.packages) &&
      firstItem.packages.length > 0;

    if (hasPrograms || hasPackages) {
      return BookingType.STANDARD;
    }
  }

  return BookingType.QUICK;
}

/**
 * Validate all email templates are configured
 * Should be called at application startup to catch configuration issues early
 *
 * @returns Object with validation results
 */
export function validateEmailTemplateConfiguration(): {
  isValid: boolean;
  missingTemplates: EmailTemplateType[];
  configuredTemplates: EmailTemplateType[];
} {
  const missingTemplates: EmailTemplateType[] = [];
  const configuredTemplates: EmailTemplateType[] = [];

  Object.values(EmailTemplateType).forEach((templateType) => {
    const template = TEMPLATE_MAP[templateType as EmailTemplateType];
    if (template.templateId) {
      configuredTemplates.push(templateType as EmailTemplateType);
    } else {
      missingTemplates.push(templateType as EmailTemplateType);
    }
  });

  return {
    isValid: missingTemplates.length === 0,
    missingTemplates,
    configuredTemplates,
  };
}
