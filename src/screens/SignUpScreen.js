import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput, // Using standard TextInput
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore"; // Ensure Firestore is imported
import { t } from "../localization/strings"; // Import translation function
import { Ionicons } from "@expo/vector-icons"; // For icons

const screenHeight = Dimensions.get("window").height;

const SignUpScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // Renamed for clarity
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);

  // Theme colors hardcoded for consistency
  const theme = {
    background: "#0A0A0A",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    primaryDisabled: "#5A6A00",
    inputBackground: "#1C1C1E",
    error: "#FF9A9A",
    card: "#1C1C1E",
    border: "#2C2C2E",
  };

  const handleSignUp = useCallback(async () => {
    // Trim inputs
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim(); // You might want more specific phone validation

    // Basic validation
    if (
      !trimmedUsername ||
      !trimmedEmail ||
      !trimmedPhone ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert(t("validation_error"), t("validation_fill_all_fields"));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t("validation_error"), t("validation_passwords_match"));
      return;
    }
    // Optional: Add password strength validation here

    setLoading(true);
    try {
      console.log("Attempting sign up for:", trimmedEmail); // Debug log
      if (!firebase.auth?.()) {
        throw new Error("Firebase auth service is not available.");
      }
      if (!firebase.firestore?.()) {
        throw new Error("Firestore service is not available.");
      }

      // 1. Create the user with Firebase Auth
      const userCredential = await firebase
        .auth()
        .createUserWithEmailAndPassword(trimmedEmail, password);

      const user = userCredential.user;
      if (!user) {
        throw new Error("User creation failed unexpectedly."); // Should not happen if createUser succeeds
      }
      console.log("User created with UID:", user.uid);

      // 2. Optional: Update displayName for the user’s Firebase profile
      await user.updateProfile({ displayName: trimmedUsername });
      console.log("User profile updated with displayName.");

      // 3. Add user data to Firestore
      // Ensure you have Firestore rules allowing authenticated users to write to their own doc
      await firebase.firestore().collection("users").doc(user.uid).set({
        username: trimmedUsername, // Store the username
        phone: trimmedPhone, // Store phone number
        email: trimmedEmail, // Store email (lowercase might be good practice)
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), // Record creation time
        // Add any other initial user fields here (e.g., default settings)
      });
      console.log("User data saved to Firestore.");

    } catch (error) {
      console.error("Sign Up Error:", error);
      let errorMessage = t("signup_error"); // Default error message

      // Handle specific Firebase Auth errors
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = t("signup_error_email_in_use");
          break;
        case "auth/invalid-email":
          errorMessage = t("validation_error") + " Invalid email format.";
          break;
        case "auth/weak-password":
          errorMessage =
            t("validation_error") +
            " Password should be at least 6 characters."; // Firebase default
          break;
        case "auth/network-request-failed":
          errorMessage = t("error_network");
          break;
        // Handle potential Firestore errors during doc write (if rules fail etc.)
        case "permission-denied": // Firestore error code
          errorMessage = t("error_saving_data") + " (Permissions issue).";
          break;
        default:
          errorMessage =
            t("error_general") + (error.code ? ` (${error.code})` : "");
          break;
      }
      Alert.alert(t("signUp"), errorMessage); // Use 'Sign Up' as title
    } finally {
      setLoading(false);
    }
  }, [username, email, phone, password, confirmPassword, navigation]); // Dependencies

  const navigateToLogin = useCallback(() => {
    navigation.navigate("Login"); // Navigate back to Login
  }, [navigation]);

  // Styles (consistent with LoginScreen)
  const styles = StyleSheet.create({
    scrollContainer: {
      flexGrow: 1,
      justifyContent: "center",
    },
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 25,
      paddingBottom: 30,
    },
    innerContainer: {
      paddingTop: screenHeight * 0.08, // Slightly less top padding than login
    },
    titleContainer: {
      alignItems: "center",
      marginBottom: 35, // Slightly less margin than login maybe
    },
    titleIcon: {
      marginBottom: 15,
    },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: theme.text,
      textAlign: "center",
    },
    inputContainer: {
      marginBottom: 16, // Consistent spacing
    },
    label: {
      color: theme.textSecondary,
      fontSize: 14,
      marginBottom: 8,
      paddingLeft: 5,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 15,
    },
    input: {
      flex: 1,
      height: 52,
      color: theme.text,
      fontSize: 16,
    },
    visibilityToggle: {
      padding: 8,
    },
    signUpButton: {
      // Renamed style from loginButton
      backgroundColor: theme.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 15,
      minHeight: 52,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 6,
    },
    signUpButtonDisabled: {
      // Renamed style
      backgroundColor: theme.primaryDisabled,
      elevation: 0,
      shadowOpacity: 0,
    },
    signUpButtonText: {
      // Renamed style
      color: "#111111",
      fontSize: 16,
      fontWeight: "bold",
    },
    loadingIndicator: {
      // For loading indicator inside the button
    },
    loginLinkContainer: {
      marginTop: 25, // Consistent spacing
      paddingVertical: 10,
      alignItems: "center",
    },
    loginLinkText: {
      color: theme.textSecondary,
      fontSize: 15,
    },
    loginLink: {
      color: theme.primary,
      fontWeight: "bold",
      textDecorationLine: "underline",
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.innerContainer}>
            <View style={styles.titleContainer}>
              {/* Maybe a different icon for sign up? */}
              <Ionicons
                name="person-add-outline"
                size={60}
                color={theme.primary}
                style={styles.titleIcon}
              />
              <Text style={styles.title}>{t("signUp")}</Text>
            </View>

            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t("username")}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t("username")}
                  placeholderTextColor={theme.textSecondary}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="words" // Typically capitalize names
                  editable={!loading}
                />
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t("email_address")}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t("email_address")}
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Phone Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t("phone_number")}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t("phone_number")} // Use translation
                  placeholderTextColor={theme.textSecondary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad" // Use phone-pad for numeric input optimized for phones
                  autoComplete="tel" // Help with autofill
                  editable={!loading}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t("password")}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t("password")}
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.visibilityToggle}
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  disabled={loading}
                >
                  <Ionicons
                    name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                    size={24}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t("confirm_password")}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t("confirm_password")}
                  placeholderTextColor={theme.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!isConfirmPasswordVisible}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.visibilityToggle}
                  onPress={() =>
                    setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                  }
                  disabled={loading}
                >
                  <Ionicons
                    name={
                      isConfirmPasswordVisible
                        ? "eye-off-outline"
                        : "eye-outline"
                    }
                    size={24}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[
                styles.signUpButton,
                loading && styles.signUpButtonDisabled,
              ]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  color="#111111"
                  style={styles.loadingIndicator}
                />
              ) : (
                <Text style={styles.signUpButtonText}>{t("signUp")}</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <TouchableOpacity
              style={styles.loginLinkContainer}
              onPress={navigateToLogin}
              disabled={loading}
            >
              <Text style={styles.loginLinkText}>
                {t("already_have_account")}{" "}
                <Text style={styles.loginLink}>{t("login")}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignUpScreen;
