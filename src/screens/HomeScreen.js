// HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dr. Plant</Text>
      <Text style={styles.subtitle}>Hello,</Text>
      <Text style={styles.username}>Demo User</Text>

      {/* Scan Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Discover Plants</Text>
        <Text style={styles.cardText}>
          Scan your plants to identify diseases and get treatment recommendations.
        </Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate('Scan')}
        >
          <Ionicons name="camera" size={20} color="#000000" />
          <Text style={styles.scanButtonText}>Scan Plant</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.activityCard}>
        <Ionicons name="leaf" size={20} color="#DFFF00" />
        <Text style={styles.activityText}>Plant Scan</Text>
        <Text style={styles.activityTime}>2 hours ago</Text>
      </View>
      <View style={styles.activityCard}>
        <Ionicons name="leaf" size={20} color="#DFFF00" />
        <Text style={styles.activityText}>Plant Scan</Text>
        <Text style={styles.activityTime}>2 hours ago</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#DFFF00',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#111111',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardText: {
    fontSize: 14,
    color: '#AAAAAA',
    marginBottom: 10,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DFFF00',
    padding: 10,
    borderRadius: 5,
    justifyContent: 'center',
  },
  scanButtonText: {
    marginLeft: 5,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  activityCard: {
    backgroundColor: '#222222',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  activityText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 10,
  },
  activityTime: {
    color: '#AAAAAA',
    fontSize: 14,
  },
});

export default HomeScreen;
