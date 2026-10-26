import { describe, it, expect } from "vitest";
import {
  validateName,
  validateDescription,
  parseDuration,
  formatDuration,
  splitDuration,
  MAX_PERIOD_HOURS,
  parsePeriod,
  periodToFields,
  formatPeriod,
} from "../../../utils/habitFields";

describe("validateName", () => {
  it("rejects an empty name", () => {
    expect(validateName("")).toBe("Name is required");
  });

  it("rejects a whitespace-only name", () => {
    expect(validateName("   ")).toBe("Name is required");
  });

  it("rejects a name over 100 characters", () => {
    expect(validateName("a".repeat(101))).toBe(
      "Name must be 100 characters or fewer",
    );
  });

  it("accepts a name of exactly 100 characters", () => {
    expect(validateName("a".repeat(100))).toBeNull();
  });

  it("measures length after trimming surrounding whitespace", () => {
    expect(validateName(`  ${"a".repeat(100)}  `)).toBeNull();
  });
});

describe("validateDescription", () => {
  it("accepts an empty description (it is optional)", () => {
    expect(validateDescription("")).toBeNull();
  });

  it("rejects a description over 280 characters", () => {
    expect(validateDescription("a".repeat(281))).toBe(
      "Description must be 280 characters or fewer",
    );
  });

  it("accepts a description of exactly 280 characters", () => {
    expect(validateDescription("a".repeat(280))).toBeNull();
  });
});

describe("parseDuration", () => {
  // --- valid combinations ---

  it("combines hours and minutes into total minutes", () => {
    expect(parseDuration("1", "15")).toEqual({ minutes: 75 });
  });

  it("treats an empty hours field as zero", () => {
    expect(parseDuration("", "45")).toEqual({ minutes: 45 });
  });

  it("treats an empty minutes field as zero", () => {
    expect(parseDuration("2", "")).toEqual({ minutes: 120 });
  });

  it("accepts exactly 24 hours", () => {
    expect(parseDuration("24", "0")).toEqual({ minutes: 1440 });
  });

  // --- below the minimum ---

  it("rejects both fields empty", () => {
    expect(parseDuration("", "")).toEqual({
      error: "Length of time must be at least 1 minute",
    });
  });

  it("rejects a total of zero", () => {
    expect(parseDuration("0", "0")).toEqual({
      error: "Length of time must be at least 1 minute",
    });
  });

  // --- not whole numbers ---

  it("rejects negative values", () => {
    expect(parseDuration("-1", "0")).toEqual({
      error: "Hours and minutes must be whole numbers",
    });
  });

  it("rejects fractional values", () => {
    expect(parseDuration("1.5", "0")).toEqual({
      error: "Hours and minutes must be whole numbers",
    });
  });

  // --- out of range ---

  it("rejects minutes above 59", () => {
    expect(parseDuration("0", "60")).toEqual({
      error: "Minutes must be between 0 and 59",
    });
  });

  it("rejects hours above 24", () => {
    expect(parseDuration("25", "0")).toEqual({
      error: "Length of time must be 24 hours or less",
    });
  });

  it("rejects 24 hours plus any minutes", () => {
    expect(parseDuration("24", "1")).toEqual({
      error: "Length of time must be 24 hours or less",
    });
  });
});

describe("formatDuration", () => {
  it("shows minutes only under an hour", () => {
    expect(formatDuration(45)).toBe("45 min");
  });

  it("shows hours only on a whole hour", () => {
    expect(formatDuration(60)).toBe("1 h");
  });

  it("shows hours and minutes together", () => {
    expect(formatDuration(75)).toBe("1 h 15 min");
  });

  it("shows the 24-hour maximum", () => {
    expect(formatDuration(1440)).toBe("24 h");
  });
});

describe("splitDuration", () => {
  it("splits total minutes into hours and minutes", () => {
    expect(splitDuration(75)).toEqual({ hours: 1, minutes: 15 });
  });

  it("returns zero hours under an hour", () => {
    expect(splitDuration(45)).toEqual({ hours: 0, minutes: 45 });
  });
});

describe("MAX_PERIOD_HOURS", () => {
  it("is 8766 (365.25 days)", () => {
    expect(MAX_PERIOD_HOURS).toBe(8766);
  });
});

describe("parsePeriod", () => {
  it("returns no period for None", () => {
    expect(parsePeriod("none", "")).toEqual({ period: null });
  });

  it("ignores typed hours unless the choice is Custom", () => {
    expect(parsePeriod("none", "5")).toEqual({ period: null });
    expect(parsePeriod("weekly", "abc")).toEqual({ period: "weekly" });
  });

  it.each(["daily", "weekly", "monthly", "yearly"] as const)(
    "returns the %s preset",
    (preset) => {
      expect(parsePeriod(preset, "")).toEqual({ period: preset });
    },
  );

  it.each(["", "   "])(
    "treats Custom with empty hours (%j) as no period",
    (hours) => {
      expect(parsePeriod("custom", hours)).toEqual({ period: null });
    },
  );

  it("returns custom hours as a number, fractions allowed", () => {
    expect(parsePeriod("custom", "36")).toEqual({ period: 36 });
    expect(parsePeriod("custom", "1.5")).toEqual({ period: 1.5 });
  });

  it("trims surrounding whitespace from custom hours", () => {
    expect(parsePeriod("custom", " 2 ")).toEqual({ period: 2 });
  });

  it("accepts the boundaries 1 and 8766", () => {
    expect(parsePeriod("custom", "1")).toEqual({ period: 1 });
    expect(parsePeriod("custom", "8766")).toEqual({ period: 8766 });
  });

  it.each(["0", "0.5", "-1"])("rejects %s hours as under 1", (hours) => {
    expect(parsePeriod("custom", hours)).toEqual({
      error: "Hours must be at least 1",
    });
  });

  it.each(["8766.5", "10000"])("rejects %s hours as over 8766", (hours) => {
    expect(parsePeriod("custom", hours)).toEqual({
      error: "Hours must be 8766 or fewer",
    });
  });

  it.each(["abc", "1e3", ".5"])("rejects %j as not a number", (hours) => {
    expect(parsePeriod("custom", hours)).toEqual({
      error: "Hours must be a number",
    });
  });
});

describe("periodToFields", () => {
  it("maps no period to None with empty hours", () => {
    expect(periodToFields(null)).toEqual({ choice: "none", hours: "" });
  });

  it("maps a preset to that choice with empty hours", () => {
    expect(periodToFields("monthly")).toEqual({ choice: "monthly", hours: "" });
  });

  it("maps custom hours to Custom with the hours as text", () => {
    expect(periodToFields(36.5)).toEqual({ choice: "custom", hours: "36.5" });
  });
});

describe("formatPeriod", () => {
  it("shows no period as One-time", () => {
    expect(formatPeriod(null)).toBe("One-time");
  });

  it.each([
    ["daily", "Daily"],
    ["weekly", "Weekly"],
    ["monthly", "Monthly"],
    ["yearly", "Yearly"],
  ] as const)("shows %s as %s", (preset, label) => {
    expect(formatPeriod(preset)).toBe(label);
  });

  it("shows custom hours exactly as stored", () => {
    expect(formatPeriod(36)).toBe("Every 36 h");
    expect(formatPeriod(1.5)).toBe("Every 1.5 h");
  });

  it("never converts large custom hours to days", () => {
    expect(formatPeriod(720)).toBe("Every 720 h");
  });
});
