import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import Button from '../components/Button';
import { useTheme } from '../hooks/useTheme';

const PredictionResultsScreen = ({ route, navigation }) => {
  const { theme } = useTheme();
  // In a real app, prediction result would come from the prediction process
  const { predictedDisease = 'Healthy Plant', confidence = 'High' } = route.params || {};
  const plantImage = route.params?.plantImage || null; // No placeholder image for now
  const rawOutput = route.params?.rawOutput || null; // Get rawOutput from params

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 20,
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 20,
      marginBottom: 20,
      textAlign: 'center',
    },
    resultContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    plantImage: {
      width: 200,
      height: 200,
      backgroundColor: theme.secondary, // Placeholder image background
      marginBottom: 10,
    },
    rawOutputContainer: {
      marginTop: 20,
      padding: 10,
      backgroundColor: theme.secondary, // Gray background for output
      borderRadius: 5,
    },
    rawOutputText: {
      color: theme.background, // White text for output
    },
    predictionText: {
      fontSize: 18,
      color: theme.text,
      textAlign: 'center',
      marginBottom: 5,
    },
    confidenceText: {
      fontSize: 16,
      color: theme.secondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    buttonContainer: {
      width: '80%',
    },
  });


  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Raw Prediction Output</Text>

      <View style={styles.resultContainer}>
        {plantImage && <Image
          source={plantImage}
          style={styles.plantImage}
          resizeMode="contain"
        />}
      </View>

      {rawOutput && (
        <View style={styles.rawOutputContainer}>
          <Text style={styles.rawOutputText}>Raw Output:</Text>
          {Array.isArray(rawOutput) ? (
            rawOutput.map((value, index) => (
              <Text key={index} style={styles.rawOutputText}>{`Output ${index}: ${value}`}</Text>
            ))
          ) : (
            <Text style={styles.rawOutputText}>Output: {String(rawOutput)}</Text>
          )}
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button title="Predict Again" onPress={() => navigation.navigate('ImageCapture')} />
      </View>
    </ScrollView>
  );
};

export default PredictionResultsScreen; 