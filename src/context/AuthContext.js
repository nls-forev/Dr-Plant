// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from "react"; // Added useContext
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native"; // Added Text
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { t } from "../localization/strings"; // Import translation function

// Create the context
export const AuthContext = createContext({
  user: undefined, // undefined: initial check, null: logged out, object: logged in
  setUser: () => {},
  loadingAuth: true, // Explicit loading state for the initial check
  authError: null, // State to hold authentication listener errors
});

// Create a provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined);
  const [loadingAuth, setLoadingAuth] = useState(true); // Renamed for clarity
  const [authError, setAuthError] = useState(null); // For critical listener errors

  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component
    console.log("Setting up Firebase auth listener (in AuthProvider)...");
    setAuthError(null); // Clear previous errors on setup

    const unsubscribe = firebase.auth().onAuthStateChanged(
      (currentUser) => {
        if (!isMounted) return; // Don't update if unmounted
        // console.log("Auth state changed - User:", currentUser ? currentUser.uid : "No user");
        setUser(currentUser);
        if (loadingAuth) {
          setLoadingAuth(false); // Turn off initial loading indicator
        }
      },
      (error) => {
        // --- Handle errors during listener setup/operation ---
        if (!isMounted) return;
        console.error("Firebase Auth Listener Error:", error);
        setAuthError(
          t("error_general") + ` (Code: ${error.code || "unknown"})`
        ); // Set a user-friendly error
        setUser(null); // Assume logged out on listener error
        setLoadingAuth(false); // Stop loading even on error
      }
    );

    // Cleanup listener on unmount
    return () => {
      isMounted = false;
      console.log("Cleaning up auth listener (in AuthProvider)");
      unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once

  // --- Loading / Error Display ---
  // Show indicator ONLY during the very initial check
  if (loadingAuth) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centeredContainer}>
            <ActivityIndicator size="large" color="#DFFF00" />
            <Text style={styles.statusText}>{t("loading")}...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Show error if the auth listener itself failed critically
  if (authError) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centeredContainer}>
            <Text style={styles.errorText}>Auth Error: {authError}</Text>
            {/* Optional: Add a retry button? Complex for listener errors. */}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // --- Render Children ---
  // Provide user, loading state, and potentially error state
  return (
    <AuthContext.Provider value={{ user, setUser, loadingAuth, authError }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for easier context consumption
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// --- Styles --- (Consistent Dark Theme)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A0A0A", // Match refined theme background
  },
  centeredContainer: {
    // Reusable style for centering content fullscreen
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A0A0A",
    padding: 20,
  },
  statusText: {
    marginTop: 15,
    color: "#AEAEB2", // Light grey for loading text
    fontSize: 16,
  },
  errorText: {
    color: "#FF9A9A", // Lighter red for error text
    fontSize: 16,
    textAlign: "center",
  },
});
