import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHabits, type HabitResponse } from "../apis/HabitApi";
import HabitItem from "../components/HabitItem";
import "./HabitList.css";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded" };

/**
 * The habits page (/habits): lists every habit as a block, in the order the
 * API returns them (the backend owns sorting), with a link to create one.
 */
export default function HabitList() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [habits, setHabits] = useState<HabitResponse[]>([]);

  useEffect(() => {
    let cancelled = false;

    getHabits()
      .then((result) => {
        if (cancelled) return;
        setHabits(result);
        setLoadState({ status: "loaded" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load habits",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="habit-list-page">
      <div className="habit-list-header">
        <h1 className="habit-list-title">Habits</h1>
        <Link
          to="/habits/new"
          className="habit-list-new-btn"
          aria-label="Create habit"
        >
          + New Habit
        </Link>
      </div>

      {loadState.status === "loading" && (
        <div className="habit-list-status">Loading habits…</div>
      )}

      {loadState.status === "error" && (
        <div className="habit-list-error">{loadState.message}</div>
      )}

      {loadState.status === "loaded" && habits.length === 0 && (
        <div className="habit-list-status">
          No habits yet — press + New Habit to create one.
        </div>
      )}

      {loadState.status === "loaded" && habits.length > 0 && (
        <div className="habit-list-items">
          {habits.map((habit) => (
            <HabitItem key={habit.id} habit={habit} />
          ))}
        </div>
      )}
    </div>
  );
}
