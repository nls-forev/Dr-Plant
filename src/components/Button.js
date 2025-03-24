import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const Button = ({ title, onPress }) => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    button: {
      backgroundColor: theme.primary,
      padding: 15,
      borderRadius: 5,
      alignItems: 'center',
    },
    text: {
      color: theme.background,
      fontWeight: 'bold',
    },
  });

  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

export default Button; 