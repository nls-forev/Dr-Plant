// AppNavigator.js
import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthContext } from "../../App";

import SignUpScreen from "../screens/SignUpScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ImageCaptureScreen from "../screens/ImageCaptureScreen";
import HomeScreen from "../screens/HomeScreen";
import TimeLineScreen from "../screens/LLM";
import SettingsScreen from "../screens/SettingsScreen";
import CustomTabBar from "../components/CustomTabBar";
import ScanResultsScreen from "../screens/ScanResultsScreen";
import RecentActivityDetail from "../screens/RecentActivityDetail";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Timeline" component={TimeLineScreen} />
      <Tab.Screen name="Scan" component={ImageCaptureScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { user } = useContext(AuthContext);
  console.log("AppNavigator - User state:", user ? user.uid : "No user");

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={user ? "Main" : "Login"}>
        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RecentActivityDetail"
          component={RecentActivityDetail}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ImageCaptureScreen"
          component={ImageCaptureScreen}
        />
        <Stack.Screen
          name="Main"
          component={MainTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ScanResults"
          component={ScanResultsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
