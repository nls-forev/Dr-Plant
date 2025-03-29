// App.js
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider } from "./src/theme/theme";
import { AuthProvider } from "./src/context/AuthContext"; // Import the Provider

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

const App = () => {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <ThemeProvider>
              <AppNavigator />
            </ThemeProvider>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </AuthProvider>
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
