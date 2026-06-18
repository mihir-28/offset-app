"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registered with scope: ", registration.scope);
          })
          .catch((err) => {
            console.error("Service Worker registration failed: ", err);
          });
      });
    }
  }, []);

  return null;
}
