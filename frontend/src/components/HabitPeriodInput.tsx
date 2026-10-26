import { MAX_PERIOD_HOURS, type PeriodChoice } from "../utils/habitFields";
import "./HabitPeriodInput.css";

interface HabitPeriodInputProps {
  choice: PeriodChoice;
  hours: string;
  onChange(next: { choice: PeriodChoice; hours: string }): void;
}

const CHOICES: { value: PeriodChoice; label: string }[] = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

/**
 * The period select (plus an Hours field when Custom is chosen) used on both
 * the creation and update pages. Fully controlled: hours stay a string so an
 * empty field stays empty, and are kept when switching away from Custom so
 * switching back restores them. The parent owns validation (parsePeriod).
 */
export default function HabitPeriodInput({
  choice,
  hours,
  onChange,
}: HabitPeriodInputProps) {
  return (
    <div className="habit-period">
      <label className="habit-period-field">
        <span className="habit-period-label">Period</span>
        <select
          className="habit-period-input"
          value={choice}
          onChange={(e) =>
            onChange({ choice: e.target.value as PeriodChoice, hours })
          }
        >
          {CHOICES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {choice === "custom" && (
        <label className="habit-period-field">
          <span className="habit-period-label">Hours</span>
          {/* Announced as "Period hours" so it can't be confused with the
              duration's Hours field when both are on the update page. */}
          <input
            type="number"
            aria-label="Period hours"
            className="habit-period-input"
            min={1}
            max={MAX_PERIOD_HOURS}
            step="any"
            value={hours}
            onChange={(e) => onChange({ choice, hours: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
