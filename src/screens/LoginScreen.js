import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Input from '../components/Input';
import Button from '../components/Button';
import { useTheme } from '../hooks/useTheme';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isDemoLoginActive, setIsDemoLoginActive] = useState(false);
  
  // Add fallback default theme to prevent errors when context is undefined
  const themeContext = useTheme() || { 
    theme: { 
      background: '#FFFFFF', 
      text: '#000000', 
      primary: '#007AFF' 
    } 
  };
  
  const { theme } = themeContext;

  const handleLogin = () => {
    // Check if demo login is active
    if (isDemoLoginActive) {
      console.log('Demo Login activated. Navigating to Main Tab Navigator.');
      Alert.alert('Demo Login Successful', 'Navigating to Home Screen.');
      navigation.navigate('Main'); // Navigate to MainTabNavigator instead of 'ImageCapture'
    } else {
      Alert.alert('Login functionality to be implemented', 'For full login, implement backend integration.'); // Placeholder alert for now
    }
  };

  const handleDemoLogin = () => {
    // Demo Login logic - hardcoded credentials
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
      <TouchableOpacity style={styles.demoLoginButton} onPress={handleDemoLogin}>
        <Text style={styles.demoLoginText}>Login with Demo Account</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LoginScreen;