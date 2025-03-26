import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TimeLine = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Timeline Screen</Text>
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

export default TimeLine;
