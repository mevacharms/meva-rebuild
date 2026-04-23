import { useEffect } from "react";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

export default function App() {
  useEffect(() => {
    const testFetch = async () => {
      try {
        const ref = doc(db, "mevas", "test");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          console.log("DATA:", snap.data());
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
    <div style={{ padding: 20 }}>
      Firebase connected
    </div>
  );
}