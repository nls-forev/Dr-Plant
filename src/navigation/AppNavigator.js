// src/navigation/AppNavigator.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import {
  createStackNavigator,
  CardStyleInterpolators,
} from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../context/AuthContext";
import { t } from "../localization/strings";

// Import Screens
import SignUpScreen from "../screens/SignUpScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ImageCaptureScreen from "../screens/ImageCaptureScreen";
import HomeScreen from "../screens/HomeScreen";
import ChatListScreen from "../screens/ChatListScreen";
import ChatScreen from "../screens/ChatScreen";
import SettingsScreen from "../screens/SettingsScreen"; // Keep import if reachable from Profile
import AnalyticsScreen from "../screens/AnalyticsScreen"; // Import new Analytics screen
import CustomTabBar from "../components/CustomTabBar";
import ScanResultsScreen from "../screens/ScanResultsScreen";
import SelectScanScreen from "../screens/selectScanScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// --- Consistent Header Styles ---
const commonHeaderStyle = { backgroundColor: "#101010" };
const commonHeaderTintColor = "#EFEFEF";
const commonHeaderTitleStyle = { fontWeight: "600" };

// --- Tab Navigator --- (Updated tabs)
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Chats" component={ChatListScreen} />
      {/* Use AnalyticsScreen for the tab */}
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      {/* Settings removed */}
    </Tab.Navigator>
  );
};

// --- Main Stack Navigator ---
const AppNavigator = () => {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          // Default options
          headerStyle: commonHeaderStyle,
          headerTintColor: commonHeaderTintColor,
          headerTitleStyle: commonHeaderTitleStyle,
          headerBackTitleVisible: false,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      >
        {!user ? (
          // Auth Screens Group
          <Stack.Group screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </Stack.Group>
        ) : (
          // Main App Screens Group
          <Stack.Group>
            <Stack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ImageCaptureScreen"
              component={ImageCaptureScreen}
              options={{ title: t("home_scan_button") }}
            />
            <Stack.Screen
              name="ScanResults"
              component={ScanResultsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ChatScreen"
              component={ChatScreen}
              options={{ title: t("chat_new_chat") }}
            />
            {/* Settings screen is now pushed from Profile, not a tab */}
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: t("settings") }}
            />

            {/* Modal Group */}
            <Stack.Group
              screenOptions={{
                presentation: "modal",
                headerShown: false,
                cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
              }}
            >
              <Stack.Screen
                name="SelectScanScreen"
                component={SelectScanScreen}
              />
              {/* Add EditProfileScreen etc. here when created */}
            </Stack.Group>
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
