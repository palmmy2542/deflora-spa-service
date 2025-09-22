export function formatDateForEmail(
  input: string,
  timeZone: string = "Asia/Bangkok"
) {
  const d = new Date(input);

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone, // default: Asia/Bangkok
  }).formatToParts(d);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  const day = map.day;
  const month = map.month;
  const year = map.year;
  const hour = map.hour?.padStart(2, "0");
  const minute = map.minute?.padStart(2, "0");
  const period = (map.dayPeriod || "").toUpperCase(); // AM/PM

  return `${day} ${month} ${year}, ${hour}.${minute} ${period}`;
}
