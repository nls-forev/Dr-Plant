import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput, // Using standard TextInput
  ScrollView, // Added for smaller screens
  KeyboardAvoidingView, // Added for keyboard handling
  Platform, // Added for platform-specific behavior
  Dimensions, // Added for potential responsive styling
} from "react-native";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { t } from "../localization/strings"; // Import translation function
import { Ionicons } from "@expo/vector-icons"; // For potential icons

// Get screen height for potentially adjusting layout
const screenHeight = Dimensions.get("window").height;

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Removed demo login state as it complicates state unnecessarily
  // const [isDemoLoginActive, setIsDemoLoginActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false); // State for password visibility

  // Theme colors hardcoded for consistency as requested
  const theme = {
    background: "#0A0A0A", // Slightly off-black
    text: "#EFEFEF", // Near white
    textSecondary: "#AEAEB2", // Medium grey
    primary: "#BFFF00", // Accent green-yellow
    primaryDisabled: "#5A6A00", // Darker accent
    inputBackground: "#1C1C1E", // Dark grey for inputs
    error: "#FF9A9A", // Light red
    card: "#1C1C1E", // Card background if needed
    border: "#2C2C2E", // Subtle borders
  };

  const handleLogin = useCallback(
    async (isDemo = false) => {
      const loginEmail = isDemo ? "rj07605@gmail.com" : email.trim();
      const loginPassword = isDemo ? "123123" : password;

      // Validation
      if (!loginEmail || !loginPassword) {
        Alert.alert(
          t("validation_error"),
          t("validation_enter_email_password")
        );
        return;
      }

      setLoading(true);
      try {
        console.log("Attempting login with email:", loginEmail); // Keep for debugging
        // Check auth availability more robustly (might be overkill if init is guaranteed)
        if (!firebase.auth?.()) {
          throw new Error("Firebase auth service is not available.");
        }

        await firebase
          .auth()
          .signInWithEmailAndPassword(loginEmail, loginPassword);

        console.log("Login successful for:", loginEmail);
        // Alert.alert(t('login_success'), t('login_welcome_back')); // Success alert might be annoying, navigation is enough
      } catch (error) {
        console.error("Login error:", error); // Keep detailed log
        let errorMessage = t("login_error"); // Default message

        // Map specific Firebase error codes to translated, user-friendly messages
        switch (error.code) {
          case "auth/invalid-email":
            errorMessage =
              t("validation_error") + " " + "Invalid email format."; // Can add specific message
            break;
          case "auth/user-not-found":
            errorMessage = t("login_error_user_not_found");
            break;
          case "auth/wrong-password":
            errorMessage = t("login_error_wrong_password");
            break;
          case "auth/network-request-failed":
            errorMessage = t("error_network");
            break;
          case "auth/too-many-requests":
            errorMessage =
              t("error_general") +
              " Too many attempts. Please try again later."; // Add specific context
            break;
          case "auth/user-disabled":
            errorMessage =
              t("error_general") + " This account has been disabled.";
            break;
          default:
            // Use generic message for other errors, include code if available
            errorMessage =
              t("error_general") + (error.code ? ` (${error.code})` : "");
        }
        Alert.alert(t("login"), errorMessage); // Use 'Login' as title for login errors
      } finally {
        setLoading(false);
      }
    },
    [email, password, navigation]
  ); // Dependencies for the callback

  const navigateToSignUp = useCallback(() => {
    navigation.navigate("SignUp");
  }, [navigation]);

  // Style definitions using the hardcoded theme
  const styles = StyleSheet.create({
    scrollContainer: {
      flexGrow: 1, // Allows content to grow and center vertically
      justifyContent: "center", // Center content vertically
    },
    container: {
      flex: 1, // Takes full screen height
      backgroundColor: theme.background,
      paddingHorizontal: 25, // Slightly more horizontal padding
      paddingBottom: 30, // Padding at the bottom
    },
    innerContainer: {
      paddingTop: screenHeight * 0.1, // Push content down slightly
    },
    titleContainer: {
      alignItems: "center",
      marginBottom: 40,
    },
    titleIcon: {
      marginBottom: 15,
    },
    title: {
      fontSize: 32, // Larger title
      fontWeight: "bold",
      color: theme.text,
      textAlign: "center",
    },
    inputContainer: {
      marginBottom: 18, // Spacing between input fields
    },
    label: {
      color: theme.textSecondary,
      fontSize: 14,
      marginBottom: 8, // Space between label and input
      paddingLeft: 5, // Slight indent for label
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBackground,
      borderRadius: 12, // Consistent rounding
      paddingHorizontal: 15,
    },
    input: {
      flex: 1,
      height: 52, // Taller input field
      color: theme.text,
      fontSize: 16,
    },
    visibilityToggle: {
      padding: 8, // Easier to tap
    },
    loginButton: {
      backgroundColor: theme.primary,
      paddingVertical: 16, // Taller button
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 15, // Space above button
      minHeight: 52,
      // Add shadow/elevation
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 6,
    },
    loginButtonDisabled: {
      backgroundColor: theme.primaryDisabled,
      elevation: 0,
      shadowOpacity: 0,
    },
    loginButtonText: {
      color: "#111111", // Dark text on primary button
      fontSize: 16,
      fontWeight: "bold",
    },
    loadingIndicator: {
      // Position loading indicator within the button when loading
      //   position: 'absolute', // If you want it overlaid
    },
    demoLoginButton: {
      marginTop: 25, // More space above demo login
      paddingVertical: 10, // Make it tappable without needing exact text hit
    },
    demoLoginText: {
      color: theme.primary, // Use accent color
      textAlign: "center",
      fontSize: 15,
      fontWeight: "500",
    },
    signUpLinkContainer: {
      marginTop: 30, // Space above sign up link
      paddingVertical: 10, // Make it easily tappable
      alignItems: "center",
    },
    signUpLinkText: {
      color: theme.textSecondary,
      fontSize: 15,
    },
    signUpLink: {
      color: theme.primary, // Accent color for the link part
      fontWeight: "bold",
      textDecorationLine: "underline",
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      // Adjust keyboardVerticalOffset if needed, based on your header height (none here)
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap outside inputs
      >
        <View style={styles.container}>
          <View style={styles.innerContainer}>
            <View style={styles.titleContainer}>
              <Ionicons
                name="leaf"
                size={60}
                color={theme.primary}
                style={styles.titleIcon}
              />
              <Text style={styles.title}>{t("login")}</Text>
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
                  editable={!loading} // Disable input when loading
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
                  secureTextEntry={!isPasswordVisible} // Control visibility
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.visibilityToggle}
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase tap area
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

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled,
              ]}
              onPress={() => handleLogin(false)} // Pass false for normal login
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  color="#111111"
                  style={styles.loadingIndicator}
                />
              ) : (
                <Text style={styles.loginButtonText}>{t("login")}</Text>
              )}
            </TouchableOpacity>

            {/* Demo Login Button */}
            {/* Removing dedicated demo login button simplifies state */}
            {/* Use Alert to inform user about demo creds if needed, or hardcode for testing */}
            {/* If required, it can be added back similarly to the main login button */}
            {/* <TouchableOpacity style={styles.demoLoginButton} onPress={() => handleLogin(true)} disabled={loading}>
                <Text style={styles.demoLoginText}>Login with Demo Account</Text>
             </TouchableOpacity> */}

            {/* Sign Up Link */}
            <TouchableOpacity
              style={styles.signUpLinkContainer}
              onPress={navigateToSignUp}
              disabled={loading}
            >
              {/* Text combines non-link and link parts */}
              <Text style={styles.signUpLinkText}>
                {t("dont_have_account")}{" "}
                <Text style={styles.signUpLink}>{t("signUp")}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
