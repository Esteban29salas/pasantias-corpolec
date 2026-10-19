import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Inicio from './components/Inicio';
import Inventario from './components/Inventario';
import Personal from './components/Personal';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/Personal" element={<Personal />} />
      </Routes>
    </Router>
  );
}

export default App;