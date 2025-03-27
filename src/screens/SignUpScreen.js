import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import Input from "../components/Input";
import Button from "../components/Button";
import { useTheme } from "../hooks/useTheme";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

const SignUpScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");

  const { theme } = useTheme();

  const handleSignUp = async () => {
    // Basic validation
    if (!username || !email || !phone || !password || !confirmPassword) {
      Alert.alert("Validation Error", "Please fill out all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Validation Error", "Passwords do not match.");
      return;
    }

    try {
      // Create the user with Firebase Auth
      const userCredential = await firebase
        .auth()
        .createUserWithEmailAndPassword(email, password);

      const user = userCredential.user;
      console.log("User created with UID:", user.uid);

      // Optional: Update displayName for the user’s profile
      await user.updateProfile({ displayName: username });

      // Add user data to Firestore
      await firebase.firestore().collection("users").doc(user.uid).set({
        username,
        phone,
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // Navigate to Home (Main tab) directly
      navigation.navigate("Main");
    } catch (error) {
      console.error("Sign Up Error:", error);
      Alert.alert(
        "Sign Up Error",
        error.message || "An error occurred. Please try again."
      );
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 20,
      justifyContent: "center",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 20,
      textAlign: "center",
    },
    label: {
      color: theme.text,
      marginBottom: 5,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>

      <Text style={styles.label}>Username</Text>
      <Input
        placeholder="Enter your username"
        value={username}
        onChangeText={setUsername}
      />

      <Text style={styles.label}>Email</Text>
      <Input
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />

      <Text style={styles.label}>Phone Number</Text>
      <Input
        placeholder="Enter your phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Password</Text>
      <Input
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Text style={styles.label}>Rewrite Password</Text>
      <Input
        placeholder="Confirm your password"
        value={confirmPassword}
        onChangeText={setConfirm}
        secureTextEntry
      />

      <Button title="Sign Up" onPress={handleSignUp} />
    </View>
  );
};

export default SignUpScreen;
