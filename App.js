import React, { createContext, useState, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider } from "./src/theme/theme";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

// Replace these with your Firebase project configuration
const firebaseConfig = {
  apiKey: "API KEY",
  authDomain: "authDomain",
  projectId: "projectId",
  storageBucket: "storageBucket",
  messagingSenderId: "messagingSenderId",
  appId: "appId",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} else {
  console.log("Firebase already initialized");
}

console.log("Firebase object:", firebase);
console.log("Firebase.auth:", firebase.auth);

export const AuthContext = createContext({
  user: undefined, // undefined means "still loading"
  setUser: () => {},
});

const App = () => {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    console.log("Setting up Firebase auth listener...");
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      console.log("Auth state changed - Current User:", currentUser ? currentUser.uid : "No user");
      setUser(currentUser);
    });
    return () => {
      console.log("Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  if (user === undefined) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
            <ActivityIndicator size="large" color="#DFFF00" />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <ThemeProvider>
              <AppNavigator />
            </ThemeProvider>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </AuthContext.Provider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
});

export default App;
