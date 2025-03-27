// RecentActivityDetail.js - No AuthContext changes needed
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
import { diseaseDescriptions } from '../constants/plant_name_desc'; // Ensure path is correct

const RecentActivityDetail = ({ route, navigation }) => {
  // Extract activity object, provide default empty object
  const { activity = {} } = route.params || {};

  // Safely access properties with defaults
  const bestLabel = activity.bestLabel || 'Unknown';
  const bestConfidence = activity.bestConfidence || 0;
  const imageUri = activity.imageUri || null;
  const top5 = Array.isArray(activity.top5) ? activity.top5 : []; // Ensure top5 is an array
  const timestamp = activity.timestamp || null;

  const description =
    diseaseDescriptions[bestLabel] ||
    'No detailed description available for this scan result.';

  // Format timestamp safely
  const displayTimestamp = timestamp?.toDate
      ? timestamp.toDate().toLocaleString()
      : (timestamp ? new Date(timestamp).toLocaleString() : 'Unknown date');


  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Image Section */}
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.fullImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="leaf" size={100} color="#8E8E93" /> {/* Grey icon */}
          <Text style={styles.placeholderText}>Image Not Available</Text>
        </View>
      )}

      {/* Details Section */}
      <View style={styles.detailsContainer}>
        <Text style={styles.diseaseTitle}>{bestLabel}</Text>
        <Text style={styles.confidenceText}>
          Confidence: {(bestConfidence * 100).toFixed(1)}%
        </Text>

        {/* Top 5 Predictions */}
        {top5.length > 0 && (
           <View style={styles.predictionContainer}>
            <Text style={styles.sectionTitle}>Other Possibilities</Text>
            {top5.map((prediction, index) => (
              <View
                key={index}
                style={[
                    styles.predictionRow,
                    index === top5.length - 1 && styles.predictionRowLast // Remove border for last item
                 ]}
              >
                <Text style={styles.predictionLabel}>{prediction.label || 'N/A'}</Text>
                <Text style={styles.predictionConfidence}>
                  {((prediction.confidence || 0) * 100).toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Description & Care</Text>
          <Text style={styles.descriptionText}>{description}</Text>
        </View>

        {/* Timestamp */}
        <Text style={styles.timestampText}>
          Scanned on: {displayTimestamp}
        </Text>
      </View>
    </ScrollView>
  );
};

// --- Styles --- (Using similar styles as ScanResultsScreen for consistency)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentContainer: {
    paddingBottom: 50,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    padding: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: 350,
  },
  imagePlaceholder: {
    width: '100%',
    height: 350,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
      marginTop: 10,
      color: '#8E8E93',
      fontSize: 16,
  },
  detailsContainer: {
    padding: 20,
    marginTop: -30, // Overlap image
    backgroundColor: '#000000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  diseaseTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#DFFF00',
    marginBottom: 5,
    textAlign: 'center',
  },
  confidenceText: {
    fontSize: 16,
    color: '#E5E5EA',
    marginBottom: 25,
    textAlign: 'center',
  },
  predictionContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3C',
  },
  predictionRowLast: {
      borderBottomWidth: 0,
  },
  predictionLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    flex: 1,
    marginRight: 10,
  },
  predictionConfidence: {
    color: '#AEAEB2',
    fontSize: 15,
    fontWeight: '600',
  },
  descriptionContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  descriptionText: {
    color: '#E5E5EA',
    fontSize: 15,
    lineHeight: 22,
  },
  timestampText: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 15,
  },
});

export default RecentActivityDetail;