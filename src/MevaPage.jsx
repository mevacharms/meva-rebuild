import { useEffect, useState } from "react";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export default function MevaPage() {
  const [name, setName] = useState("");

  useEffect(() => {
    const testFetch = async () => {
      try {
        const ref = doc(db, "mevas", "test");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setName(snap.data().officialName || "");
        } else {
          console.log("No document found");
        }
      } catch (err) {
        console.error("ERROR:", err);
      }
    };

    testFetch();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f3fb",
        color: "#5c4d7d",
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontWeight: "600",
      }}
    >
      {name || "Loading..."}
    </div>
  );
}