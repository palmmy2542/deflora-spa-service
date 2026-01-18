// src/services/emailTemplates/examples.ts
/**
 * Email Templates - Usage Examples
 *
 * This file demonstrates how to use the email templates system
 * in various scenarios. Copy and adapt these examples for your needs.
 */

import {
  selectEmailTemplate,
  determineBookingType,
  buildEmailInputData,
  getRecipientEmail,
  validateBookingDataForEmail,
  validateEmailTemplateConfiguration,
  BookingType,
  BookingStatus,
  EmailTemplateType,
} from "./index.js";
import { sendTemplatedEmail } from "../emailService.js";
import type { BookingDocument } from "./emailHelper.js";

// ============================================================================
// EXAMPLE 1: Basic Email Sending Pattern
// ============================================================================

/**
 * Basic pattern for sending an email notification
 * This is the standard pattern used throughout the application
 */
async function example1_BasicEmailSending(
  bookingData: BookingDocument,
  status: BookingStatus,
) {
  try {
    // Step 1: Determine booking type (automatic detection)
    const bookingType = determineBookingType(bookingData);

    // Step 2: Select the appropriate template
    const template = selectEmailTemplate(bookingType, status);

    // Step 3: Format the email data
    const emailData = buildEmailInputData(bookingData, bookingType, status);

    // Step 4: Get recipient email
    const recipientEmail = getRecipientEmail(bookingData);

    // Step 5: Send the email
    await sendTemplatedEmail({
      templateId: template.templateId!,
      data: emailData,
      to: recipientEmail,
      subject: template.subject,
    });

    console.log(
      `✓ Email sent successfully: ${template.subject} to ${recipientEmail}`,
    );
  } catch (error) {
    console.error(`✗ Failed to send email: ${error}`);
    // Handle error appropriately (log, notify admin, etc.)
  }
}

// ============================================================================
// EXAMPLE 2: Standard Booking Confirmation
// ============================================================================

/**
 * Send confirmation email for a standard booking
 * Standard bookings have detailed treatment information
 */
async function example2_StandardBookingConfirmation(
  bookingData: BookingDocument,
) {
  // Validate booking data first
  if (!validateBookingDataForEmail(bookingData)) {
    throw new Error("Invalid booking data for email");
  }

  // Explicitly use STANDARD booking type
  const bookingType = BookingType.STANDARD;
  const status = BookingStatus.CONFIRMED;

  // Select template
  const template = selectEmailTemplate(bookingType, status);

  // Format data
  const emailData = buildEmailInputData(bookingData, bookingType, status);

  // Send email
  await sendTemplatedEmail({
    templateId: template.templateId!,
    data: emailData,
    to: bookingData.contact.email,
    subject: template.subject,
  });
}

// ============================================================================
// EXAMPLE 3: Quick Reservation Notification
// ============================================================================

/**
 * Send pending notification for a quick reservation
 * Quick reservations include contact info and party size in booking object
 */
async function example3_QuickReservationPending(bookingData: BookingDocument) {
  // Validate booking data
  if (!validateBookingDataForEmail(bookingData)) {
    throw new Error("Invalid booking data for email");
  }

  // Explicitly use QUICK booking type
  const bookingType = BookingType.QUICK;
  const status = BookingStatus.PENDING;

  // Select template
  const template = selectEmailTemplate(bookingType, status);

  // Format data
  // For quick reservations, emailData will include:
  // - booking.contactName
  // - booking.contactEmail
  // - booking.numberOfPeople
  const emailData = buildEmailInputData(bookingData, bookingType, status);

  // Send email
  await sendTemplatedEmail({
    templateId: template.templateId!,
    data: emailData,
    to: bookingData.contact.email,
    subject: template.subject,
  });
}

// ============================================================================
// EXAMPLE 4: Automatic Booking Type Detection
// ============================================================================

/**
 * Let the system automatically detect booking type
 * This is useful when you don't know the booking type in advance
 */
async function example4_AutomaticBookingTypeDetection(
  bookingData: BookingDocument,
) {
  // System automatically determines booking type from data structure
  const bookingType = determineBookingType(bookingData);

  console.log(`Detected booking type: ${bookingType}`);

  if (bookingType === BookingType.STANDARD) {
    console.log("This is a standard booking with detailed treatments");
  } else {
    console.log("This is a quick reservation with minimal info");
  }

  // Select and send appropriate template
  const template = selectEmailTemplate(bookingType, BookingStatus.PENDING);
  const emailData = buildEmailInputData(
    bookingData,
    bookingType,
    BookingStatus.PENDING,
  );

  await sendTemplatedEmail({
    templateId: template.templateId!,
    data: emailData,
    to: getRecipientEmail(bookingData),
    subject: template.subject,
  });
}

// ============================================================================
// EXAMPLE 5: All Status Updates for a Booking
// ============================================================================

/**
 * Handle all possible status updates for a booking
 * This shows how to send emails for pending, confirmed, and canceled states
 */
async function example5_AllStatusUpdates(
  bookingData: BookingDocument,
  newStatus: BookingStatus,
) {
  // Validate data
  if (!validateBookingDataForEmail(bookingData)) {
    throw new Error("Invalid booking data for email");
  }

  // Determine booking type
  const bookingType = determineBookingType(bookingData);

  // Select template based on status
  const template = selectEmailTemplate(bookingType, newStatus);

  console.log(`Sending ${newStatus} email for ${bookingType} booking`);

  // Format and send email
  const emailData = buildEmailInputData(bookingData, bookingType, newStatus);

  await sendTemplatedEmail({
    templateId: template.templateId!,
    data: emailData,
    to: getRecipientEmail(bookingData),
    subject: template.subject,
  });
}

// ============================================================================
// EXAMPLE 6: Configuration Validation at Startup
// ============================================================================

/**
 * Validate all email templates are configured at application startup
 * This should be called when your application starts
 */
function example6_ValidateConfiguration() {
  const validation = validateEmailTemplateConfiguration();

  if (validation.isValid) {
    console.log("✓ All email templates are configured correctly");
    console.log(`  Total templates: ${validation.configuredTemplates.length}`);
  } else {
    console.error("✗ Some email templates are missing:");
    validation.missingTemplates.forEach((templateType) => {
      console.error(`  - Missing: ${templateType}`);
    });
    console.error("\nPlease set the missing environment variables in .env");

    // You might want to throw an error here to prevent the app from starting
    throw new Error("Email templates not fully configured");
  }
}

// ============================================================================
// EXAMPLE 7: Error Handling with Fallback
// ============================================================================

/**
 * Send email with comprehensive error handling and fallback
 */
async function example7_ErrorHandlingWithFallback(
  bookingData: BookingDocument,
  status: BookingStatus,
) {
  try {
    // Validate booking data
    if (!validateBookingDataForEmail(bookingData)) {
      throw new Error("Booking data is invalid or incomplete");
    }

    // Determine booking type
    const bookingType = determineBookingType(bookingData);

    // Select template
    const template = selectEmailTemplate(bookingType, status);

    if (!template.templateId) {
      throw new Error(
        `Template ${template.type} is not configured. Missing env var.`,
      );
    }

    // Format email data
    const emailData = buildEmailInputData(bookingData, bookingType, status);

    // Get recipient
    const recipientEmail = getRecipientEmail(bookingData);

    // Send email
    await sendTemplatedEmail({
      templateId: template.templateId,
      data: emailData,
      to: recipientEmail,
      subject: template.subject,
    });

    console.log(`✓ Email sent: ${template.subject} -> ${recipientEmail}`);
    return { success: true, email: recipientEmail };
  } catch (error) {
    console.error(`✗ Email send failed: ${error}`);

    // Log to monitoring service (e.g., Sentry, DataDog)
    // await logErrorToMonitoring(error, { bookingId: bookingData.id, status });

    // Queue for retry (if you have a retry system)
    // await queueEmailForRetry(bookingData.id, status);

    // Notify admin (critical emails only)
    // await notifyAdminOfFailure(bookingData.id, status, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// EXAMPLE 8: Conditional Email Sending
// ============================================================================

/**
 * Send email only under certain conditions
 * This example shows conditional email sending based on business rules
 */
async function example8_ConditionalEmailSending(
  bookingData: BookingDocument,
  newStatus: BookingStatus,
) {
  const bookingType = determineBookingType(bookingData);

  // Example: Only send emails for confirmed bookings (skip pending notifications)
  if (newStatus === BookingStatus.PENDING) {
    console.log("Skipping email for pending status");
    return;
  }

  // Example: Only send emails for standard bookings
  if (bookingType === BookingType.QUICK) {
    console.log("Skipping email for quick reservation");
    return;
  }

  // Example: Only send emails for bookings with multiple guests
  const guestCount = bookingData.items?.length || bookingData.partySize || 1;
  if (guestCount < 2) {
    console.log("Skipping email for single-guest booking");
    return;
  }

  // If all conditions pass, send the email
  const template = selectEmailTemplate(bookingType, newStatus);
  const emailData = buildEmailInputData(bookingData, bookingType, newStatus);

  await sendTemplatedEmail({
    templateId: template.templateId!,
    data: emailData,
    to: getRecipientEmail(bookingData),
    subject: template.subject,
  });
}

// ============================================================================
// EXAMPLE 9: Batch Email Sending
// ============================================================================

/**
 * Send emails to multiple bookings (e.g., daily reminders)
 * This shows how to send multiple emails efficiently
 */
async function example9_BatchEmailSending(
  bookings: Array<{ id: string; data: BookingDocument }>,
) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ bookingId: string; error: string }>,
  };

  for (const booking of bookings) {
    try {
      const bookingType = determineBookingType(booking.data);
      const status = BookingStatus.CONFIRMED; // Example: reminder

      const template = selectEmailTemplate(bookingType, status);
      const emailData = buildEmailInputData(booking.data, bookingType, status);

      await sendTemplatedEmail({
        templateId: template.templateId!,
        data: emailData,
        to: getRecipientEmail(booking.data),
        subject: `Reminder: ${template.subject}`,
      });

      results.success++;
      console.log(`✓ Email sent for booking ${booking.id}`);
    } catch (error) {
      results.failed++;
      results.errors.push({
        bookingId: booking.id,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(
        `✗ Failed to send email for booking ${booking.id}: ${error}`,
      );
    }
  }

  console.log(
    `Batch complete: ${results.success} sent, ${results.failed} failed`,
  );
  return results;
}

// ============================================================================
// EXAMPLE 10: Custom Email Data Modification
// ============================================================================

/**
 * Modify email data before sending
 * This example shows how to add custom data to email templates
 */
async function example10_CustomEmailDataModification(
  bookingData: BookingDocument,
) {
  const bookingType = determineBookingType(bookingData);
  const status = BookingStatus.CONFIRMED;

  // Get base email data
  // Note: For quick reservations, this includes booking.contactName,
  // booking.contactEmail, and booking.numberOfPeople automatically
  const baseEmailData = buildEmailInputData(bookingData, bookingType, status);

  // Add custom data (e.g., promotional code, special message)
  const customEmailData = {
    ...baseEmailData,
    customMessage: "Thank you for booking with us!",
    promoCode: "SPA2025",
    bookingId: bookingData.id,
  };

  const template = selectEmailTemplate(bookingType, status);

  await sendTemplatedEmail({
    templateId: template.templateId!,
    data: customEmailData,
    to: getRecipientEmail(bookingData),
    subject: template.subject,
  });
}

// ============================================================================
// EXAMPLE 11: Testing Template Selection
// ============================================================================

/**
 * Test function to verify template selection logic
 * This is useful for unit testing
 */
function example11_TestTemplateSelection() {
  const testCases = [
    {
      type: BookingType.STANDARD,
      status: BookingStatus.PENDING,
      expectedType: EmailTemplateType.BOOKING_PENDING,
    },
    {
      type: BookingType.STANDARD,
      status: BookingStatus.CONFIRMED,
      expectedType: EmailTemplateType.BOOKING_CONFIRMED,
    },
    {
      type: BookingType.STANDARD,
      status: BookingStatus.CANCELED,
      expectedType: EmailTemplateType.BOOKING_CANCELED,
    },
    {
      type: BookingType.QUICK,
      status: BookingStatus.PENDING,
      expectedType: EmailTemplateType.QUICK_RESERVATION_PENDING,
    },
    {
      type: BookingType.QUICK,
      status: BookingStatus.CONFIRMED,
      expectedType: EmailTemplateType.QUICK_RESERVATION_CONFIRMED,
    },
    {
      type: BookingType.QUICK,
      status: BookingStatus.CANCELED,
      expectedType: EmailTemplateType.QUICK_RESERVATION_CANCELED,
    },
  ];

  testCases.forEach((testCase) => {
    const template = selectEmailTemplate(testCase.type, testCase.status);

    if (template.type === testCase.expectedType) {
      console.log(
        `✓ Test passed: ${testCase.type} + ${testCase.status} = ${template.type}`,
      );
    } else {
      console.error(
        `✗ Test failed: Expected ${testCase.expectedType}, got ${template.type}`,
      );
    }
  });
}

// ============================================================================
// EXAMPLE 12: Resend Email with Manual Template Selection
// ============================================================================

/**
 * Manually resend a specific email type
 * Useful for admin dashboard functionality
 */
async function example12_ResendSpecificEmail(
  bookingData: BookingDocument,
  emailTemplateType: EmailTemplateType,
) {
  // Validate data
  if (!validateBookingDataForEmail(bookingData)) {
    throw new Error("Invalid booking data for email");
  }

  // Determine booking type and status from template type
  let bookingType: BookingType;
  let status: BookingStatus;

  switch (emailTemplateType) {
    case EmailTemplateType.BOOKING_PENDING:
    case EmailTemplateType.BOOKING_CONFIRMED:
    case EmailTemplateType.BOOKING_CANCELED:
      bookingType = BookingType.STANDARD;
      break;
    case EmailTemplateType.QUICK_RESERVATION_PENDING:
    case EmailTemplateType.QUICK_RESERVATION_CONFIRMED:
    case EmailTemplateType.QUICK_RESERVATION_CANCELED:
      bookingType = BookingType.QUICK;
      break;
    default:
      throw new Error(`Unknown template type: ${emailTemplateType}`);
  }

  switch (emailTemplateType) {
    case EmailTemplateType.BOOKING_PENDING:
    case EmailTemplateType.QUICK_RESERVATION_PENDING:
      status = BookingStatus.PENDING;
      break;
    case EmailTemplateType.BOOKING_CONFIRMED:
    case EmailTemplateType.QUICK_RESERVATION_CONFIRMED:
      status = BookingStatus.CONFIRMED;
      break;
    case EmailTemplateType.BOOKING_CANCELED:
    case EmailTemplateType.QUICK_RESERVATION_CANCELED:
      status = BookingStatus.CANCELED;
      break;
  }

  // Select template and format data
  const template = selectEmailTemplate(bookingType, status);
  const emailData = buildEmailInputData(bookingData, bookingType, status);

  // Send email
  await sendTemplatedEmail({
    templateId: template.templateId!,
    data: emailData,
    to: getRecipientEmail(bookingData),
    subject: `RESEND: ${template.subject}`,
  });

  console.log(`✓ Resent ${template.type} to ${getRecipientEmail(bookingData)}`);
}

// ============================================================================
// USAGE NOTES
// ============================================================================

/**
 * Important Notes for Using These Examples:
 *
 * 1. Always validate booking data before sending emails
 * 2. Handle errors gracefully - emails can fail due to API issues
 * 3. Use the helper functions (determineBookingType, buildEmailInputData) for consistency
 * 4. Don't hardcode template IDs - use selectEmailTemplate instead
 * 5. Log email sends for debugging and audit purposes
 * 6. Validate configuration at application startup (Example 6)
 * 7. Consider implementing retry logic for failed emails
 * 8. Add monitoring/alerting for email delivery failures
 * 9. Test all 6 template types before going to production
 * 10. Keep examples up to date with the actual implementation
 *
 * Email Data Structure Differences:
 *
 * Standard Booking:
 * - booking: { dateTime, branch }
 * - guests: [{ name, treatments: [...] }]
 *
 * Quick Reservation:
 * - booking: { dateTime, branch, contactName, contactEmail, numberOfPeople }
 * - guests: [{ name }, { name: "Guest 2" }, ...]
 *
 * For production use:
 * - Add proper error logging (Sentry, DataDog, etc.)
 * - Implement retry mechanism for transient failures
 * - Add rate limiting to avoid hitting SendGrid API limits
 * - Monitor email delivery rates and bounces
 * - Set up alerts for critical email failures
 * - Store email history for audit trail
 */
