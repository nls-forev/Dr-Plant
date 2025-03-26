// App.js
import React, { createContext, useState, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider } from "./src/theme/theme";
import { SafeAreaProvider } from "react-native-safe-area-context";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

// Replace these with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDAIoMHmhDw-BJ75cZsrPJTgALL5jdDL2s",
  authDomain: "plantdisease-df992.firebaseapp.com",
  projectId: "plantdisease-df992",
  storageBucket: "third-eye-2293d.appspot.com", // New storage bucket
  messagingSenderId: "321173693128",
  appId: "1:321173693128:android:c3bbe98027a18188affbfd",
};

// Initialize Firebase if it hasn't been initialized yet
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} else {
  console.log("Firebase already initialized");
}

console.log("Firebase object:", firebase);
console.log("Firebase.auth:", firebase.auth);

// Create AuthContext with user state and updater
export const AuthContext = createContext({
  user: undefined, // undefined means "still loading"
  setUser: () => {},
});

const App = () => {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    console.log("Setting up Firebase auth listener...");
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      console.log(
        "Auth state changed - Current User:",
        currentUser ? currentUser.uid : "No user"
      );
      console.log("Auth state changed:", currentUser);
      setUser(currentUser);
    });
    return () => {
      console.log("Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  // While waiting for Firebase to check auth status, show a loading indicator
  if (user === undefined) {
    return (
      <SafeAreaProvider>
        <View
          style={[
            styles.container,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <ActivityIndicator size="large" color="#DFFF00" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <SafeAreaProvider>
        <View style={styles.container}>
          <ThemeProvider>
            <AppNavigator />
          </ThemeProvider>
        </View>
      </SafeAreaProvider>
    </AuthContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000", // Black background
  },
});

export default App;
