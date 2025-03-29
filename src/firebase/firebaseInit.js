// src/firebase/firebaseInit.js
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDAIoMHmhDw-BJ75cZsrPJTgALL5jdDL2s", // Secure this key later!
  authDomain: "plantdisease-df992.firebaseapp.com",
  projectId: "plantdisease-df992",
  storageBucket: "third-eye-2293d.appspot.com",
  messagingSenderId: "321173693128",
  appId: "1:321173693128:android:c3bbe98027a18188affbfd",
};

// Initialize Firebase and Firestore
let app;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully (in firebaseInit.js)");
} else {
  app = firebase.app(); // Get default app
  console.log("Firebase already initialized (in firebaseInit.js)");
}

const db = firebase.firestore(app); // Get Firestore instance
console.log("Firestore DB instance configured (in firebaseInit.js)");

// Export the db instance and potentially the auth object if needed elsewhere
export { db, firebase }; // Export firebase itself if you need firebase.auth() elsewhere
