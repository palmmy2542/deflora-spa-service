// src/services/emailTemplates/index.ts
/**
 * Email Templates Module
 *
 * Production-grade email template management for De Flora Spa booking system.
 *
 * This module provides:
 * - 6 distinct email templates for standard bookings and quick reservations
 * - Type-safe template selection based on booking type and status
 * - Automatic data formatting for email templates
 * - Configuration validation
 *
 * Supported Email Templates:
 * 1. Booking Pending (Standard)
 * 2. Booking Confirmation (Standard)
 * 3. Booking Cancellation (Standard)
 * 4. Quick Reservation Pending
 * 5. Quick Reservation Confirmation
 * 6. Quick Reservation Cancellation
 *
 * @example
 * import {
 *   selectEmailTemplate,
 *   determineBookingType,
 *   buildEmailInputData,
 *   BookingType,
 *   BookingStatus
 * } from "../services/emailTemplates/index.js";
 *
 * const bookingType = determineBookingType(bookingData);
 * const template = selectEmailTemplate(bookingType, BookingStatus.CONFIRMED);
 * const emailData = buildEmailInputData(bookingData, bookingType, BookingStatus.CONFIRMED);
 * await sendTemplatedEmail({ ... });
 */

// Export from templateSelector.ts
export {
  BookingType,
  BookingStatus,
  EmailTemplateType,
  selectEmailTemplate,
  getEnvVarName,
  determineBookingType,
  validateEmailTemplateConfiguration,
  type TemplateConfig,
} from "./templateSelector.js";

// Export from emailHelper.ts
export {
  formatGuestsFromStandardBooking,
  formatGuestsFromQuickReservation,
  formatBookingDataForEmail,
  buildEmailInputData,
  validateBookingDataForEmail,
  getRecipientEmail,
  type BookingDocument,
  type Treatment,
  type Guest,
  type BookingData,
  type EmailData,
} from "./emailHelper.js";

// Re-export commonly used types and functions for convenience
export type { InputData } from "../emailService.js";

/**
 * Quick reference guide for using the email templates module:
 *
 * 1. Determine booking type:
 *    const bookingType = determineBookingType(bookingData);
 *
 * 2. Select the appropriate template:
 *    const template = selectEmailTemplate(bookingType, status);
 *
 * 3. Format data for the email:
 *    const emailData = buildEmailInputData(bookingData, bookingType, status);
 *
 * 4. Send the email:
 *    await sendTemplatedEmail({
 *      templateId: template.templateId,
 *      data: emailData,
 *      to: getRecipientEmail(bookingData),
 *      subject: template.subject,
 *    });
 */
