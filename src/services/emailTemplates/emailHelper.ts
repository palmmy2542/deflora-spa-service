// src/services/emailTemplates/emailHelper.ts
import { formatDateForEmail } from "../../utils/formatDateForEmail.js";
import { BookingType, BookingStatus } from "./templateSelector.js";
import type { InputData } from "../emailService.js";

/**
 * Booking document data structure from Firestore
 */
export interface BookingDocument {
  arrivalAt: any; // Firestore Timestamp
  contact: {
    name: string;
    email: string;
    phone?: string | undefined;
  };
  items?: Array<{
    personName: string;
    programs?: Array<{
      programId?: string;
      qty?: number;
      durationSnapshot?: number | undefined;
      priceSnapshot?: number | undefined;
      nameSnapshot?: string | undefined;
      currencySnapshot?: string | undefined;
    }>;
    packages?: Array<{
      packageId?: string;
      qty?: number;
      durationSnapshot?: number | undefined;
      priceSnapshot?: number | undefined;
      nameSnapshot?: string | undefined;
      currencySnapshot?: string | undefined;
    }>;
  }>;
  type?: string;
  status: string;
  [key: string]: any;
}

/**
 * Treatment structure for email template
 */
export interface Treatment {
  name: string;
  duration: string;
}

/**
 * Guest structure for email template
 */
export interface Guest {
  name: string;
  treatments?: Treatment[];
}

/**
 * Booking data for email template
 */
export interface BookingData {
  dateTime: string;
  branch?: string;
  contactName?: string;
  contactEmail?: string;
  numberOfPeople?: number;
}

/**
 * Complete email data structure
 */
export interface EmailData {
  emailTitle: string;
  booking: BookingData;
  guests?: Guest[];
}

/**
 * Format a treatment object with proper fallbacks
 *
 * @param treatment - Treatment data from booking
 * @returns Formatted treatment for email
 */
function formatTreatment(treatment: {
  nameSnapshot?: string | undefined;
  durationSnapshot?: number | undefined;
}): Treatment {
  const name = treatment.nameSnapshot ?? "Treatment";
  const duration = treatment.durationSnapshot
    ? `${treatment.durationSnapshot} minutes`
    : "Duration TBD";

  return { name, duration };
}

/**
 * Format guests from standard booking items
 * Standard bookings have detailed items with programs and packages
 *
 * @param items - Array of booking items from a standard booking
 * @returns Array of formatted guests
 */
export function formatGuestsFromStandardBooking(
  items: BookingDocument["items"],
): Guest[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const treatments: Treatment[] = [];

    // Add programs as treatments
    if (item.programs && Array.isArray(item.programs)) {
      item.programs.forEach((program) => {
        treatments.push(formatTreatment(program));
      });
    }

    // Add packages as treatments
    if (item.packages && Array.isArray(item.packages)) {
      item.packages.forEach((pkg) => {
        treatments.push(formatTreatment(pkg));
      });
    }

    const guest: Guest = {
      name: item.personName || "Guest",
    };

    // Only add treatments if there are any (exactOptionalPropertyTypes compatibility)
    if (treatments.length > 0) {
      guest.treatments = treatments;
    }

    return guest;
  });
}

/**
 * Format guests from quick reservation
 * Quick reservations have minimal info (name only, no treatments)
 *
 * @param name - Customer name from quick reservation
 * @param partySize - Number of people in the reservation
 * @returns Array of formatted guests
 */
export function formatGuestsFromQuickReservation(
  name: string,
  partySize: number = 1,
): Guest[] {
  const guests: Guest[] = [];

  // Add the primary guest
  guests.push({
    name: name || "Guest",
  });

  // Add additional guests if partySize > 1
  if (partySize > 1) {
    for (let i = 2; i <= partySize; i++) {
      guests.push({
        name: `Guest ${i}`,
      });
    }
  }

  return guests;
}

/**
 * Format booking date time from Firestore timestamp
 *
 * @param arrivalAt - Firestore timestamp
 * @returns Formatted date string for email
 */
function formatBookingDateTime(arrivalAt: any): string {
  try {
    // Handle Firestore Timestamp
    if (arrivalAt && typeof arrivalAt.toDate === "function") {
      return formatDateForEmail(arrivalAt.toDate());
    }
    // Handle ISO string
    if (typeof arrivalAt === "string") {
      return formatDateForEmail(arrivalAt);
    }
    // Handle Date object
    if (arrivalAt instanceof Date) {
      return formatDateForEmail(arrivalAt.toISOString());
    }
    return "Date TBD";
  } catch (error) {
    console.error("Error formatting booking date time:", error);
    return "Date TBD";
  }
}

/**
 * Build email title based on booking type and status
 *
 * @param bookingType - Type of booking
 * @param status - Booking status
 * @returns Email title
 */
function buildEmailTitle(
  bookingType: BookingType,
  status: BookingStatus,
): string {
  const isQuick = bookingType === BookingType.QUICK;
  const prefix = isQuick ? "Quick Reservation" : "Booking";

  switch (status) {
    case BookingStatus.PENDING:
      return isQuick
        ? "Quick Reservation - Awaiting Details"
        : "Booking Pending";
    case BookingStatus.CONFIRMED:
      return `${prefix} Confirmed`;
    case BookingStatus.CANCELED:
      return `${prefix} Canceled`;
    default:
      return `${prefix} Update`;
  }
}

/**
 * Format complete booking data for email template
 * This is the main helper function that orchestrates data formatting
 *
 * @param bookingData - Raw booking document from Firestore
 * @param bookingType - Type of booking (STANDARD or QUICK)
 * @param status - Current booking status
 * @returns Formatted email data ready to send
 *
 * @throws Error if required fields are missing
 *
 * @example
 * const emailData = formatBookingDataForEmail(bookingDoc, BookingType.STANDARD, BookingStatus.CONFIRMED);
 * await sendTemplatedEmail({ templateId: "d-xxx", data: emailData, to: "...", subject: "..." });
 */
export function formatBookingDataForEmail(
  bookingData: BookingDocument,
  bookingType: BookingType,
  status: BookingStatus,
): EmailData {
  // Validate required fields
  if (!bookingData) {
    throw new Error("Booking data is required");
  }

  // Format booking date time
  const dateTime = formatBookingDateTime(bookingData.arrivalAt);

  // Build base email data
  const emailData: EmailData = {
    emailTitle: buildEmailTitle(bookingType, status),
    booking: {
      dateTime,
      branch: "De Flora Spa Patong", // Default branch - could be made configurable
    },
  };

  // Format guests and additional booking info based on booking type
  if (bookingType === BookingType.QUICK) {
    // Quick reservation: use name and partySize, include in booking object
    const name = bookingData.contact?.name || bookingData.name;
    const email = bookingData.contact?.email || bookingData.email;
    const partySize = bookingData.partySize || 1;

    emailData.guests = formatGuestsFromQuickReservation(name, partySize);

    // Add quick reservation specific fields to booking object
    emailData.booking.contactName = name;
    emailData.booking.contactEmail = email;
    emailData.booking.numberOfPeople = partySize;
  } else {
    // Standard booking: use items array
    emailData.guests = formatGuestsFromStandardBooking(bookingData.items);
  }

  return emailData;
}

/**
 * Build complete InputData for email service
 * Combines booking-specific data with company defaults
 *
 * @param bookingData - Raw booking document from Firestore
 * @param bookingType - Type of booking (STANDARD or QUICK)
 * @param status - Current booking status
 * @returns InputData ready for sendTemplatedEmail
 */
export function buildEmailInputData(
  bookingData: BookingDocument,
  bookingType: BookingType,
  status: BookingStatus,
): InputData {
  const formattedData = formatBookingDataForEmail(
    bookingData,
    bookingType,
    status,
  );

  return {
    emailTitle: formattedData.emailTitle,
    booking: formattedData.booking,
    ...(formattedData.guests ? { guests: formattedData.guests } : {}),
    // Company and other defaults are added by emailService
  };
}

/**
 * Validate booking data has required fields for email sending
 *
 * @param bookingData - Booking document to validate
 * @returns True if valid, false otherwise
 */
export function validateBookingDataForEmail(
  bookingData: BookingDocument,
): boolean {
  if (!bookingData) {
    console.error("Booking data is null or undefined");
    return false;
  }

  // Check contact info
  if (!bookingData.contact) {
    console.error("Booking missing contact information");
    return false;
  }

  if (!bookingData.contact.email) {
    console.error("Booking missing contact email");
    return false;
  }

  // Check arrival date
  if (!bookingData.arrivalAt) {
    console.error("Booking missing arrival date");
    return false;
  }

  return true;
}

/**
 * Get recipient email from booking data
 *
 * @param bookingData - Booking document
 * @returns Recipient email address
 * @throws Error if email is not available
 */
export function getRecipientEmail(bookingData: BookingDocument): string {
  const email = bookingData.contact?.email || bookingData.email;

  if (!email) {
    throw new Error("No email address found in booking data");
  }

  return email;
}
