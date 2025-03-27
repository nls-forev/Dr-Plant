import { React, useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { User, Clock, Settings, HelpCircle } from "lucide-react-native";
import { AuthContext } from "../../App";

const ProfileScreen = () => {
  const { user } = useContext(AuthContext);
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000",
      padding: 20,
    },
    profileHeader: {
      alignItems: "center",
      marginTop: 20,
    },
    profileCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "#CBFF00",
      alignItems: "center",
      justifyContent: "center",
    },
    profileInitial: {
      color: "black",
      fontSize: 40,
      fontWeight: "bold",
    },
    username: {
      color: "white",
      marginTop: 10,
      fontSize: 16,
    },
    email: {
      color: "gray",
      marginTop: 5,
      fontSize: 14,
    },
    menuContainer: {
      marginTop: 30,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: "#222",
    },
    menuText: {
      color: "white",
      marginLeft: 15,
      fontSize: 16,
    },
    cameraButton: {
      position: "absolute",
      bottom: 20,
      alignSelf: "center",
      backgroundColor: "#CBFF00",
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
    },
  });

  const MenuIcon = ({ icon: Icon }) => <Icon color="white" size={24} />;

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.profileCircle}>
          <Text style={styles.profileInitial}>
            {user?.displayName[0] || user?.email?.split("@")[0][0] || "Demo User"}
          </Text>
        </View>
        <Text style={styles.username}>
          {user?.displayName || user?.email?.split("@")[0] || "Demo User"}
        </Text>
        <Text style={styles.email}>{user?.email || "Demo User"}</Text>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem}>
          <MenuIcon icon={User} />
          <Text style={styles.menuText}>Account Information</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <MenuIcon icon={Clock} />
          <Text style={styles.menuText}>Scan History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <MenuIcon icon={Settings} />
          <Text style={styles.menuText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <MenuIcon icon={HelpCircle} />
          <Text style={styles.menuText}>Help Center</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ProfileScreen;
