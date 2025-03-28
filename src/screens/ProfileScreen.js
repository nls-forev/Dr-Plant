import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { User, Clock, Settings, HelpCircle, LogOut } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { useNavigation } from "@react-navigation/native";

const ProfileScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();

  const handleLogout = async () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await firebase.auth().signOut();
          } catch (error) {
            Alert.alert("Logout Error", error.message || "Failed to log out.");
          }
        },
      },
    ]);
  };

  const handleNavigate = (screenName) => {
    Alert.alert(
      "Coming Soon",
      `Navigation to ${screenName} is not implemented yet.`
    );
  };

  const getInitials = (name, email) => {
    if (name) return name[0].toUpperCase();
    if (email) return email[0].toUpperCase();
    return "?";
  };

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "No email available";
  const displayInitial = getInitials(user?.displayName, user?.email);

  // --- Styles --- (Defined inside component or move outside if preferred)
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000",
      paddingHorizontal: 20, // Horizontal padding only
      paddingTop: 40, // Add padding top
    },
    profileHeader: {
      alignItems: "center",
      marginTop: 20,
      marginBottom: 40, // Add margin below header
    },
    profileCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "#DFFF00", // Use theme color
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 15, // Space below circle
    },
    profileInitial: {
      color: "black",
      fontSize: 48, // Larger initial
      fontWeight: "bold",
    },
    username: {
      color: "white",
      fontSize: 20, // Larger username
      fontWeight: "600", // Semi-bold
      marginTop: 5,
    },
    email: {
      color: "#AEAEB2", // Lighter grey for email
      marginTop: 5,
      fontSize: 14,
    },
    menuContainer: {
      marginTop: 20, // Reduced margin
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 18, // Increased padding
      borderBottomWidth: 1,
      borderBottomColor: "#2C2C2E", // Slightly lighter border color
    },
    menuItemLast: {
      // Style to remove border from last item
      borderBottomWidth: 0,
    },
    menuIcon: {
      // Style for the icon wrapper if needed
      width: 30, // Ensure consistent icon alignment
      alignItems: "center",
    },
    menuText: {
      color: "white",
      marginLeft: 20, // Increased margin
      fontSize: 16,
    },
    logoutText: {
      // Specific style for logout text color
      color: "#FF453A", // Red color for destructive action
      marginLeft: 20,
      fontSize: 16,
      fontWeight: "600",
    },
  });

  const MenuIcon = ({ icon: Icon, color = "white" }) => (
    <View style={styles.menuIcon}>
      <Icon color={color} size={22} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.profileCircle}>
          {/* Ensure text is wrapped in Text component */}
          <Text style={styles.profileInitial}>{displayInitial}</Text>
        </View>
        <Text style={styles.username}>{displayName}</Text>
        <Text style={styles.email}>{displayEmail}</Text>
      </View>

      <View style={styles.menuContainer}>
        {/* Account Info */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleNavigate("AccountInfo")}
        >
          <MenuIcon icon={User} />
          <Text style={styles.menuText}>Account Information</Text>
        </TouchableOpacity>

        {/* Scan History */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleNavigate("ScanHistory")}
        >
          <MenuIcon icon={Clock} />
          <Text style={styles.menuText}>Scan History</Text>
        </TouchableOpacity>

        {/* Settings */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleNavigate("Settings")}
        >
          <MenuIcon icon={Settings} />
          <Text style={styles.menuText}>Settings</Text>
        </TouchableOpacity>

        {/* Help Center */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleNavigate("HelpCenter")}
        >
          <MenuIcon icon={HelpCircle} />
          <Text style={styles.menuText}>Help Center</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.menuItem, styles.menuItemLast]}
          onPress={handleLogout}
        >
          <MenuIcon icon={LogOut} color="#FF453A" /> {/* Red icon */}
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default ProfileScreen;
