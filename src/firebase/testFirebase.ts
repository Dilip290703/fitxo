import { collection, getDocs } from "firebase/firestore";
import { db } from "./config";

export const testFirebaseConnection = async () => {

  try {

    console.log("Testing Firebase...");

    const querySnapshot = await getDocs(
      collection(db, "test")
    );

    querySnapshot.forEach((doc) => {
      console.log("Firebase Connected:", doc.data());
    });

  } catch (error) {

    console.error("Firebase Error:", error);

  }
};