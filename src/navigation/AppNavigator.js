// AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';

// Import Screens
import SignUpScreen from '../screens/SignUpScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ImageCaptureScreen from '../screens/ImageCaptureScreen';
import HomeScreen from '../screens/HomeScreen';
// import TimeLineScreen from "../screens/LLM"; // REMOVE OLD LLM IMPORT
import ChatListScreen from '../screens/ChatListScreen'; // <-- IMPORT NEW LIST SCREEN
import ChatScreen from '../screens/ChatScreen';       // <-- IMPORT NEW CHAT SCREEN
import SettingsScreen from '../screens/SettingsScreen';
import CustomTabBar from '../components/CustomTabBar';
import ScanResultsScreen from '../screens/ScanResultsScreen';
// import RecentActivityDetail from '../screens/RecentActivityDetail';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// --- Tab Navigator ---
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }} // Keep headers false for tabs
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      {/* Use ChatListScreen for the tab */}
      <Tab.Screen name="Chats" component={ChatListScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// --- Main Stack Navigator ---
const AppNavigator = () => {
  const { user } = useAuth();
  console.log('AppNavigator - User state:', user ? user.uid : 'No user');

  return (
    <NavigationContainer>
      {/* Stack Navigator now wraps everything */}
      <Stack.Navigator
         initialRouteName={user ? 'Main' : 'Login'}
         // Default header styles can be set here if desired
         // screenOptions={{ headerStyle: { backgroundColor: '#101010'}, headerTintColor: '#fff' }}
      >
        {/* Screens outside the main tab flow */}
        <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }}/>

        {/* The Main Tab Navigator is now just one screen within the Stack */}
        <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }}/>

        {/* Screens that can be pushed ON TOP of the tabs */}
        <Stack.Screen name="RecentActivityDetail" component={RecentActivityDetail} options={{ headerShown: false }}/>
        <Stack.Screen name="ImageCaptureScreen" component={ImageCaptureScreen}
             // Example: Give Image Capture a header
             options={{ title: 'Scan Plant', headerStyle: {backgroundColor: '#000'}, headerTintColor: '#FFF' }}/>
        <Stack.Screen name="ScanResults" component={ScanResultsScreen} options={{ headerShown: false }}/>

        {/* Add ChatScreen to the main stack */}
        <Stack.Screen
           name="ChatScreen"
           component={ChatScreen}
           // Header title is set dynamically within ChatScreen using navigation.setOptions
           // You can define fallback/default options here if needed
            options={{ title: 'Chat' /* Default title */ }}
         />

      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;