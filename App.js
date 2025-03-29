// App.js
import React from "react";
import { StyleSheet, View, StatusBar, Platform } from "react-native"; // Added StatusBar, Platform
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";
// Assuming ThemeProvider is simple and doesn't need modification now
// If ThemeProvider uses useTheme hook internally, ensure it's updated if needed.
// import { ThemeProvider } from "./src/theme/theme";
import { AuthProvider } from "./src/context/AuthContext"; // Ensure correct path

<<<<<<< HEAD
// Your Firebase config (keep as is)
const firebaseConfig = {
  apiKey: "AIzaSyDAIoMHmhDw-BJ75cZsrPJTgALL5jdDL2s",
  authDomain: "plantdisease-df992.firebaseapp.com",
  projectId: "plantdisease-df992",
  storageBucket: "third-eye-2293d.appspot.com",
  messagingSenderId: "321173693128",
  appId: "1:321173693128:android:c3bbe98027a18188affbfd",
};

// Initialize Firebase (keep as is)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} else {
  console.log("Firebase already initialized");
}
=======
// --- Import the firebase init file early to ensure Firebase is configured ---
// --- It doesn't export anything used here directly, but its execution is required ---
import "./src/firebase/firebaseInit";
>>>>>>> 253a8ac (made code efficient and improved error handling; will add inject saved scan results in chat now;)

// --- Main App Component ---
const App = () => {
  // Consistent Dark Theme (same as used elsewhere, defined here for clarity)
  const theme = {
    background: "#0A0A0A",
  };

  return (
    // AuthProvider wraps everything to provide user context globally
    <AuthProvider>
      {/* SafeAreaProvider is needed for useSafeAreaInsets */}
      <SafeAreaProvider>
        {/* Apply the base background color to the SafeAreaView */}
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: theme.background }]}
        >
          {/* Set status bar style for consistency */}
          <StatusBar
            barStyle={Platform.OS === "ios" ? "light-content" : "light-content"} // Use light text/icons on dark background
            backgroundColor={theme.background} // Set background color (Android)
          />
          {/* Main app container view */}
          <View
            style={[styles.container, { backgroundColor: theme.background }]}
          >
            {/* ThemeProvider can wrap AppNavigator if needed for theme context */}
            {/* For now, assuming theme is passed down or hardcoded */}
            {/* <ThemeProvider> */}
            <AppNavigator />
            {/* </ThemeProvider> */}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </AuthProvider>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    // backgroundColor applied dynamically
  },
  container: {
    flex: 1,
    // backgroundColor applied dynamically
  },
});

export default App;
