import { useEffect, useState } from "react";

function App() {
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    fetch("http://localhost:8000/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("Error"));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", textAlign: "center", marginTop: "2rem" }}>
      <h1>Backend Health:</h1>
      <p>{status}</p>
    </div>
  );
}

export default App;
