// src/firebase/firebaseInit.js
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage"; // Also initialize Storage if used (e.g., for image uploads)

// --- 🚨 EXTREMELY IMPORTANT SECURITY WARNING 🚨 ---
// The configuration below contains sensitive API keys.
// DO NOT HARDCODE these keys directly in your source code, especially for production builds.
// Use environment variables (e.g., via Expo secrets or .env files) or fetch configuration from a secure backend.
// Hardcoded keys WILL be exposed and can lead to abuse of your Firebase resources.
// --- END SECURITY WARNING ---

// Your Firebase Project Configuration object
const firebaseConfig = {
  apiKey: "AIzaSyDAIoMHmhDw-BJ75cZsrPJTgALL5jdDL2s", // <-- Example Key: SECURE THIS!
  authDomain: "plantdisease-df992.firebaseapp.com",
  projectId: "plantdisease-df992",
  storageBucket: "third-eye-2293d.appspot.com", // Ensure this matches YOUR project's bucket
  messagingSenderId: "321173693128",
  appId: "1:321173693128:android:c3bbe98027a18188affbfd", // Your Android App ID
  // measurementId: "G-XXXXXXXXXX" // Optional: Add if using Google Analytics
};

let app;
let db;
let auth;
let storage; // Declare storage variable

// Standard check to prevent multiple initializations
if (!firebase.apps.length) {
  try {
    app = firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully.");

    // Initialize other Firebase services after the app is initialized
    auth = firebase.auth(app);
    console.log("Firebase Auth initialized.");

    db = firebase.firestore(app);
    console.log("Firestore initialized.");

    storage = firebase.storage(app);
    console.log("Firebase Storage initialized.");

    // You could add checks here to see if initialization really worked,
    // but critical failures often prevent the app from even starting correctly.
    // For specific service issues (like Firestore offline), handle errors where the service is used.
  } catch (error) {
    // Catch potential errors during initialization (rare but possible)
    console.error("CRITICAL: Firebase failed to initialize!", error);
    // You might want to show a fatal error screen to the user here
    // For now, re-throw to potentially halt execution if this fails badly
    // Or set flags indicating services are unavailable
    throw new Error(
      "Failed to initialize Firebase services. App cannot continue."
    );
  }
} else {
  // Get the default app if already initialized
  app = firebase.app();
  console.log("Firebase already initialized, using existing app instance.");
  // Get instances for already initialized app
  auth = firebase.auth(app);
  db = firebase.firestore(app);
  storage = firebase.storage(app);
}

// Export the initialized services for use throughout the app
export { db, auth, storage, firebase }; // Export specific services and the firebase object itself
