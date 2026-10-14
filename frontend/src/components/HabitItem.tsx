import { Link } from "react-router-dom";
import type { HabitResponse } from "../apis/HabitApi";
import { formatDuration } from "../utils/habitFields";
import "./HabitItem.css";

/** One habit block on the habits page; clicking it opens the update page. */
export default function HabitItem({ habit }: { habit: HabitResponse }) {
  return (
    <Link to={`/habits/${habit.id}`} className="habit-item">
      <span className="habit-item-name">{habit.name}</span>
      <span className="habit-item-duration">
        {formatDuration(habit.durationMinutes)}
      </span>
    </Link>
  );
}
