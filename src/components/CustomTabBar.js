import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.bottomNav}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        let iconName;
        switch (route.name) {
          case 'Home':
            iconName = 'home';
            break;
          case 'Timeline':
            iconName = 'time-outline';
            break;
          case 'Scan':
            iconName = 'camera';
            break;
          case 'Settings':
            iconName = 'settings-outline';
            break;
          case 'Profile':
            iconName = 'person-outline';
            break;
          default:
            iconName = 'ellipse';
        }

        const onPress = () => {
          navigation.navigate(route.name);
        };

        // Render the larger scan button separately
        if (route.name === 'Scan') {
          return (
            <TouchableOpacity
              key={route.name}
              onPress={onPress}
              style={styles.scanButtonLarge}
            >
              <Ionicons name={iconName} size={28} color="#000000" />
            </TouchableOpacity>
          );
        } else {
          return (
            <TouchableOpacity
              key={route.name}
              onPress={onPress}
              style={styles.navItem}
            >
              <Ionicons name={iconName} size={24} color="#DFFF00" />
            </TouchableOpacity>
          );
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111111',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute', // Add this
    bottom: 0, // Add this
    left: 0, // Add this
    right: 0, // Add this
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
  },
  scanButtonLarge: {
    marginTop: -30,
    backgroundColor: '#DFFF00',
    padding: 15,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CustomTabBar;