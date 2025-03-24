import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Button from '../components/Button';
import { useTheme } from '../hooks/useTheme';

const ProfileScreen = () => {
  const { theme, themeMode, toggleTheme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 20,
      alignItems: 'center', // Center content horizontally
      justifyContent: 'flex-start', // Align content from the top
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 20,
      marginBottom: 20,
    },
    profileInfo: {
      marginBottom: 20,
      alignItems: 'center',
    },
    profileImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.secondary, // Placeholder image background
      marginBottom: 10,
    },
    nameText: {
      fontSize: 18,
      color: theme.text,
    },
    settingsSection: {
      marginTop: 30,
      width: '100%', // Take full width to align settings to the left
      paddingHorizontal: 20,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    settingText: {
      color: theme.text,
      fontSize: 16,
    },
    logoutButton: {
      marginTop: 30,
      width: '80%', // Keep logout button centered and not full width
    },
  });


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.profileInfo}>
        <View style={styles.profileImage} /> {/* Placeholder Profile Image */}
        <Text style={styles.nameText}>User Name</Text>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Dark Mode</Text>
          <Switch
            value={themeMode === 'dark'}
            onValueChange={toggleTheme}
          />
        </View>
        {/* Placeholder for Past Predictions or Saved Info */}
      </View>

      <View style={styles.logoutButton}>
        <Button title="Logout" onPress={() => alert('Logout functionality to be implemented.')} />
      </View>
    </View>
  );
};

export default ProfileScreen; 