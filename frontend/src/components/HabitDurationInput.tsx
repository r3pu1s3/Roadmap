import "./HabitDurationInput.css";

interface HabitDurationInputProps {
  hours: string;
  minutes: string;
  onChange(next: { hours: string; minutes: string }): void;
}

/**
 * The hours + minutes pair used for a habit's length of time on both the
 * creation and update pages. Fully controlled: values are kept as strings so
 * an empty field stays empty, and the parent owns validation (parseDuration).
 */
export default function HabitDurationInput({
  hours,
  minutes,
  onChange,
}: HabitDurationInputProps) {
  return (
    <div className="habit-duration">
      <label className="habit-duration-field">
        <span className="habit-duration-label">Hours</span>
        <input
          type="number"
          className="habit-duration-input"
          min={0}
          max={24}
          value={hours}
          onChange={(e) => onChange({ hours: e.target.value, minutes })}
        />
      </label>
      <label className="habit-duration-field">
        <span className="habit-duration-label">Minutes</span>
        <input
          type="number"
          className="habit-duration-input"
          min={0}
          max={59}
          value={minutes}
          onChange={(e) => onChange({ hours, minutes: e.target.value })}
        />
      </label>
    </div>
  );
}
