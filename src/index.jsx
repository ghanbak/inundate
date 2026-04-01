import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";

import App from "./App";
import * as serviceWorker from "./serviceWorker";

import "./index.css";

console.log("index.jsx is running");
const container = document.getElementById("root");
if (!container) {
  console.error("Root element not found!");
} else {
  const root = createRoot(container);
  root.render(
    <>
      <App />
      {process.env.NODE_ENV === "development" && (
        <Agentation
          endpoint="http://localhost:3000"
          onSessionCreated={(sessionId) => {
            console.log("Session started:", sessionId);
          }}
        />
      )}
    </>,
  );
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
