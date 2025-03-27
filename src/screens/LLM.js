import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const LLM = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>LLM Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
  },
});

export default LLM;
