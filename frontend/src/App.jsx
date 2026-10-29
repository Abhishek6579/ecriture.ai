import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Recognize from './pages/Recognize.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/recognize" element={<Recognize />} />
    </Routes>
  );
}

export default App;