import React, { createContext, useState, useEffect } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

// Create the context with a default value
export const AuthContext = createContext({
  user: undefined, // undefined means loading, null means logged out, object means logged in
  setUser: () => {}, // Placeholder function
});

// Create a provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined); // Start as loading
  const [loading, setLoading] = useState(true); // Explicit loading state

  useEffect(() => {
    console.log("Setting up Firebase auth listener (in AuthProvider)...");
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      console.log(
        "Auth state changed (in AuthProvider) - Current User:",
        currentUser ? currentUser.uid : "No user"
      );
      setUser(currentUser);
      if (loading) {
        // Only set loading to false once after initial check
        setLoading(false);
      }
    });

    // Cleanup listener on unmount
    return () => {
      console.log("Cleaning up auth listener (in AuthProvider)");
      unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once

  // Show loading indicator while checking auth status initially
  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View
            style={[
              styles.container,
              { justifyContent: "center", alignItems: "center" },
            ]}
          >
            <ActivityIndicator size="large" color="#DFFF00" />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Render children wrapped in the context provider once loading is complete
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Optional: Custom hook for easier context consumption
export const useAuth = () => {
  return React.useContext(AuthContext);
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000", // Match App.js style
  },
  container: {
    flex: 1,
    backgroundColor: "#000000", // Match App.js style
  },
});
