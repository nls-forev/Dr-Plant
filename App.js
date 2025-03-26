// App.js
import React, { createContext, useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import firebase from 'firebase/app';
import 'firebase/auth';

// Replace these with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDAIoMHmhDw-BJ75cZsrPJTgALL5jdDL2s",
  authDomain: "plantdisease-df992.firebaseapp.com",
  projectId: "plantdisease-df992",
  storageBucket: "plantdisease-df992.firebasestorage.app",
  messagingSenderId: "321173693128",
  appId: "1:321173693128:android:c3bbe98027a18188affbfd"
};

// Initialize Firebase if it hasn't been initialized yet
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Create a Context to share the user state across your app
export const AuthContext = createContext({
  user: null,
  setUser: () => {},
});

const App = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    // Clean up the listener on unmount
    return () => unsubscribe();
  }, []);

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
    backgroundColor: '#000000', // black background
  },
});

export default App;
