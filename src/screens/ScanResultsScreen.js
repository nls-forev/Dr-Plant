// ScanResultsScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const ScanResultsScreen = ({ route, navigation }) => {
  // Pull prediction data from route params (if you passed it in navigation)
  const { diseaseName = 'Leaf Spot', confidence = 0.88 } = route.params || {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Screen Title */}
      <Text style={styles.header}>Scan Results</Text>

      {/* Optional preview area or image */}
      <View style={styles.previewContainer}>
        {/* Add an Image component here if needed */}
      </View>

      {/* Result Card (Disease + Confidence) */}
      <View style={styles.card}>
        <Text style={styles.diseaseTitle}>{diseaseName}</Text>
        <Text style={styles.confidence}>
          Confidence: {(confidence * 100).toFixed(2)}%
        </Text>
      </View>

      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Description</Text>
        <Text style={styles.cardText}>
          Your plant shows signs of {diseaseName}, which is a common plant disease.
        </Text>
      </View>

      {/* Treatment Recommendations */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Treatment Recommendations</Text>
        <Text style={styles.cardText}>
          Remove affected leaves. Ensure proper spacing for air circulation. 
          Apply fungicide if necessary.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, { marginRight: 10 }]}
          onPress={() => navigation.navigate('Scan')}
        >
          <Text style={styles.buttonText}>Scan Another</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#DFFF00' }]}
          onPress={() => {
            // TODO: implement save logic
            console.log('Saving result...');
          }}
        >
          <Text style={[styles.buttonText, { color: '#000' }]}>Save Result</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default ScanResultsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40, // extra padding at bottom if needed
  },
  header: {
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  previewContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#333333',
    borderRadius: 10,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  diseaseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DFFF00',
    marginBottom: 5,
  },
  confidence: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  cardText: {
    fontSize: 14,
    color: '#AAAAAA',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  button: {
    flex: 1,
    backgroundColor: '#333333',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
