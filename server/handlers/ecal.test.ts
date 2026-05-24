import { describe, expect, it } from "vitest";
import { parseICSEvents } from "./ecal";

describe("ECAL handler", () => {
  it("preserves numeric series suffixes when stripping emojis", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T120000Z
DTEND:20260601T130000Z
SUMMARY:FIA FORMULA 2️⃣ : The Championship United States Practice
LOCATION:United States
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, {
      id: "f2",
      name: "Formula 2",
      shortName: "F2",
      color: "#00AEEF",
      category: "Open Wheel",
      handler: "ecal",
      params: {},
      enabled: true,
    });

    expect(events).toHaveLength(1);
    expect(events[0].raceName).toBe("FIA FORMULA 2 : The Championship United States");
    expect(events[0].title).toBe("F2 | United States Practice");
  });
});
