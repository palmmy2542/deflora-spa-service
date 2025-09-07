import { FieldValue } from "firebase-admin/firestore";
import { calendar } from "./googleCalendar.js";

type Booking = {
  id: string;
  arrivalAt: FirebaseFirestore.Timestamp;
  contact?: { name?: string; email?: string; phone?: string };
  items: Array<{
    personName: string;
    programs: Array<{
      nameSnapshot: string;
      durationSnapshot?: number; // minutes
    }>;
  }>;
};

const TZ = "Asia/Bangkok";
const CALENDAR_ID = process.env.CALENDAR_ID!;

function toISOUTC(dateLike: any) {
  const d =
    dateLike?.toDate?.() ??
    (typeof dateLike === "string" ? new Date(dateLike) : new Date(dateLike));
  return d.toISOString();
}

function computeEndISO(booking: Booking) {
  // end = arrivalAt + longest total duration among guests
  const start = new Date(
    booking.arrivalAt?.toDate?.() ??
      (typeof booking.arrivalAt === "string"
        ? booking.arrivalAt
        : booking.arrivalAt.toMillis())
  );
  const longestMinutes = Math.max(
    0,
    ...booking.items.map((it) =>
      (it.programs || []).reduce((sum, p) => sum + (p.durationSnapshot || 0), 0)
    )
  );
  const end = new Date(start.getTime() + longestMinutes * 60_000);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export async function upsertBookingEvent(
  bookingRef: FirebaseFirestore.DocumentReference
) {
  const snap = await bookingRef.get();
  if (!snap.exists) throw new Error("Booking not found");
  const booking = { id: snap.id, ...snap.data() } as unknown as Booking & {
    calendarEventId?: string;
  };

  const { startISO, endISO } = computeEndISO(booking);
  const title = `Spa: ${booking.contact?.name ?? "Guest"} (${
    booking.items.length
  } pax)`;
  const description = [
    `Booking ID: ${booking.id}`,
    booking.contact?.email ? `Guest Email: ${booking.contact.email}` : "",
    "",
    `[Booking details](${process.env.BACKOFFICE_URL}/bookings/${booking.id})`,
  ]
    .filter(Boolean)
    .join("\n");

  // Prepare the event payload
  const event = {
    eventId: booking["calendarEventId"],
    summary: title,
    description,
    start: { dateTime: startISO, timeZone: TZ },
    end: { dateTime: endISO, timeZone: TZ },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 }, // 24h before
        { method: "popup", minutes: 60 }, // 1h before
      ],
    },
  } as any;

  let createdOrUpdated;
  try {
    if (booking["calendarEventId"]) {
      // Update existing event to keep data in sync
      createdOrUpdated = await calendar.events.update({
        calendarId: CALENDAR_ID,
        eventId: booking["calendarEventId"],
        requestBody: event,
        sendUpdates: "all",
      });
    } else {
      createdOrUpdated = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: event,
        sendUpdates: "all",
      });
    }
  } catch (e: any) {
    // If update fails because the event was deleted manually, try insert once
    if (booking["calendarEventId"]) {
      createdOrUpdated = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: event,
        sendUpdates: "all",
      });
    } else {
      throw e;
    }
  }

  const saved = createdOrUpdated.data;
  await bookingRef.update({
    calendarEventId: saved.id,
    calendarHtmlLink: saved.htmlLink,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return saved;
}

export async function deleteBookingEvent(
  bookingRef: FirebaseFirestore.DocumentReference
) {
  const snap = await bookingRef.get();
  if (!snap.exists) return;
  const data = snap.data() as any;
  if (!data?.calendarEventId) return;

  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId: data.calendarEventId,
      sendUpdates: "all",
    });
  } catch (_) {
    // ignore (already deleted)
  }

  await bookingRef.update({
    calendarEventId: FieldValue.delete(),
    calendarHtmlLink: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
