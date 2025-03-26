// LoginScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Input from '../components/Input';
import Button from '../components/Button';
import { useTheme } from '../hooks/useTheme';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isDemoLoginActive, setIsDemoLoginActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const themeContext = useTheme() || { 
    theme: { 
      background: '#FFFFFF', 
      text: '#000000', 
      primary: '#007AFF' 
    } 
  };
  
  const { theme } = themeContext;

  const handleLogin = async () => {
    if (isDemoLoginActive) {
      console.log('Demo Login activated. Navigating to Main Tab Navigator.');
      Alert.alert('Demo Login Successful', 'Navigating to Home Screen.');
      navigation.navigate('Main');
      return;
    }

    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter both email and password.');
      return;
    }
    
    setLoading(true);
    try {
      console.log('Attempting login with email:', email);
      // Check that firebase.auth is defined before calling it
      if (!firebase.auth) {
        console.error('firebase.auth is undefined');
        throw new Error('Firebase auth is not available.');
      }
      await firebase.auth().signInWithEmailAndPassword(email, password);
      console.log('Login successful for:', email);
      Alert.alert('Login Successful', 'Welcome back!');
      navigation.navigate('Main');
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'An error occurred during login. Please try again.';
      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error: Please check your internet connection.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'User not found. Please check your credentials or sign up.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail('demo@example.com');
    setPassword('demopassword');
    setIsDemoLoginActive(true);
    Alert.alert('Demo Login Activated', 'Click "Login" to proceed.');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 20,
      justifyContent: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    label: {
      color: theme.text,
      marginBottom: 5,
    },
    demoLoginButton: {
      marginTop: 10,
    },
    demoLoginText: {
      color: theme.primary,
      textAlign: 'center',
    },
    loadingIndicator: {
      marginTop: 10,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.label}>Email</Text>
      <Input
        placeholder="Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Text style={styles.label}>Password</Text>
      <Input
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Login" onPress={handleLogin} />
      {loading && <ActivityIndicator style={styles.loadingIndicator} color={theme.primary} />}
      <TouchableOpacity style={styles.demoLoginButton} onPress={handleDemoLogin}>
        <Text style={styles.demoLoginText}>Login with Demo Account</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;
