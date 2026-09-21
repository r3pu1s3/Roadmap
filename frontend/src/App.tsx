import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapMenu from "./pages/MapMenu";
import MapForm from "./pages/MapForm";
import Canvas from "./pages/Map";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapMenu />} />
        <Route path="/maps/new" element={<MapForm />} />
        <Route path="/maps/:mapId" element={<Canvas />} />
      </Routes>
    </BrowserRouter>
  );
}
