import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const Input = ({ placeholder, value, onChangeText, secureTextEntry }) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    input: {
      height: 40,
      borderColor: theme.secondary,
      borderWidth: 1,
      borderRadius: 5,
      marginBottom: 15,
      paddingHorizontal: 10,
      color: theme.text,
      backgroundColor: theme.background, // Ensure background color is set
    },
  });

  return (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      placeholderTextColor={theme.secondary} // Ensure placeholder text color is set
    />
  );
};

export default Input; 