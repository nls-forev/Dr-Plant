import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { diseaseDescriptions } from '../constants/plant_name_desc';

const RecentActivityDetail = ({ route, navigation }) => {
  const { activity } = route.params;

  const description = 
    diseaseDescriptions[activity.bestLabel] || 
    'No description available for this plant disease.';

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Image Section */}
      {activity.imageUri ? (
        <Image 
          source={{ uri: activity.imageUri }} 
          style={styles.fullImage} 
          resizeMode="cover" 
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="leaf" size={100} color="#DFFF00" />
        </View>
      )}

      {/* Disease Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.diseaseTitle}>{activity.bestLabel}</Text>
        <Text style={styles.confidenceText}>
          Confidence: {(activity.bestConfidence * 100).toFixed(2)}%
        </Text>

        {/* Top 5 Predictions */}
        <View style={styles.predictionContainer}>
          <Text style={styles.sectionTitle}>Top Predictions</Text>
          {activity.top5.map((prediction, index) => (
            <View key={index} style={styles.predictionRow}>
              <Text style={styles.predictionLabel}>{prediction.label}</Text>
              <Text style={styles.predictionConfidence}>
                {(prediction.confidence * 100).toFixed(2)}%
              </Text>
            </View>
          ))}
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>{description}</Text>
        </View>

        {/* Timestamp */}
        <Text style={styles.timestampText}>
          Scanned on: {activity.timestamp?.toDate()?.toLocaleString() || 'Unknown date'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 10,
  },
  fullImage: {
    width: '100%',
    height: 400,
  },
  imagePlaceholder: {
    width: '100%',
    height: 400,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 20,
  },
  diseaseTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DFFF00',
    marginBottom: 10,
  },
  confidenceText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  predictionContainer: {
    backgroundColor: '#111111',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  predictionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  predictionConfidence: {
    color: '#AAAAAA',
    fontSize: 16,
  },
  descriptionContainer: {
    backgroundColor: '#111111',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  descriptionText: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 22,
  },
  timestampText: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default RecentActivityDetail;