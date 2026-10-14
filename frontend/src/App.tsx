import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapMenu from "./pages/MapMenu";
import MapForm from "./pages/MapForm";
import Canvas from "./pages/Map";
import HabitList from "./pages/HabitList";
import HabitCreate from "./pages/HabitCreate";
import HabitEdit from "./pages/HabitEdit";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapMenu />} />
        <Route path="/maps/new" element={<MapForm />} />
        <Route path="/maps/:mapId" element={<Canvas />} />
        <Route path="/habits" element={<HabitList />} />
        <Route path="/habits/new" element={<HabitCreate />} />
        <Route path="/habits/:habitId" element={<HabitEdit />} />
      </Routes>
    </BrowserRouter>
  );
}
