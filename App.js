import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider } from "./src/theme/theme";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { AuthProvider } from "./src/context/AuthContext"; // Import the Provider

// Your Firebase config (keep as is)
const firebaseConfig = {
  apiKey: "API KEY",
  authDomain: "authDomain",
  projectId: "projectId",
  storageBucket: "storageBucket",
  messagingSenderId: "messagingSenderId",
  appId: "appId",
};

// Initialize Firebase (keep as is)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} else {
  console.log("Firebase already initialized");
}

// No need for Firebase logs here anymore if they are in AuthProvider
// console.log("Firebase object:", firebase);
// console.log("Firebase.auth:", firebase.auth);

// Context is now defined in AuthContext.js
// export const AuthContext = createContext(...) // REMOVE THIS

const App = () => {
  // User state and useEffect are now managed by AuthProvider
  // const [user, setUser] = useState(undefined); // REMOVE THIS
  // useEffect(() => { ... }, []); // REMOVE THIS
  // if (user === undefined) { ... } // REMOVE THIS loading indicator

  return (
    // Wrap everything in AuthProvider
    <AuthProvider>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <ThemeProvider>
               {/* AppNavigator will now consume the context from AuthProvider */}
              <AppNavigator />
            </ThemeProvider>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </AuthProvider> // Close AuthProvider
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