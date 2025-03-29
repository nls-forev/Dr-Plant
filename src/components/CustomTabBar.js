// src/components/CustomTabBar.js
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Make sure Ionicons is imported

const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={styles.bottomNav}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        let iconName;
        // Use a more descriptive color variable
        const iconColor = isFocused ? '#DFFF00' : '#8e8e93'; // Active color vs inactive grey

        switch (route.name) {
          case 'Home':
            iconName = isFocused ? 'home' : 'home-outline'; // Use filled icon when focused
            break;
          // --- CHANGE 'Timeline' to 'Chats' ---
          case 'Chats': // Updated route name
            iconName = isFocused ? 'chatbubbles' : 'chatbubbles-outline'; // Updated icon name
            break;
          // --- END CHANGE ---
          case 'Scan': // Keep Scan logic if you still have/want it
            iconName = 'camera'; // Scan button icon might always be filled
            break;
          case 'Settings':
            iconName = isFocused ? 'settings' : 'settings-outline';
            break;
          case 'Profile':
            iconName = isFocused ? 'person' : 'person-outline';
            break;
          default:
            iconName = isFocused ? 'ellipse' : 'ellipse-outline'; // Fallback
        }

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            // The `merge: true` option makes sure that the params inside the tab screen are preserved
            navigation.navigate({ name: route.name, merge: true });
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };


        // Keep Scan button logic if needed - otherwise remove this 'if' block
        if (route.name === 'Scan') {
          return (
            <TouchableOpacity
              key={route.name}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress} // Added onLongPress
              style={styles.scanButtonLarge} // Your custom style for scan button
            >
              {/* Scan button uses Ionicons but might have different color */}
              <Ionicons name={iconName} size={28} color="#000000" />
            </TouchableOpacity>
          );
        } else {
           // Regular Tab Item
          return (
            <TouchableOpacity
              key={route.name}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress} // Added onLongPress
              style={styles.navItem}
            >
              {/* Use the dynamic iconColor */}
              <Ionicons name={iconName} size={24} color={iconColor} />
              {/* Optionally add labels below icons */}
              {/* <Text style={{ color: iconColor, fontSize: 10 }}>{route.name}</Text> */}
            </TouchableOpacity>
          );
        }
      })}
    </View>
  );
};

// Styles (Keep your existing styles, maybe slight adjustments)
const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Use space-around for better distribution usually
    alignItems: 'center',
    backgroundColor: '#111111', // Dark background
    paddingVertical: 8,        // Adjust padding as needed
    paddingHorizontal: 10,
    // Removed position absolute if it was causing issues, usually not needed
    // unless you want it to float over content. If needed, add padding to screen bottom.
    // position: 'absolute',
    // bottom: 0,
    // left: 0,
    // right: 0,
    borderTopWidth: 1,        // Add a subtle top border
    borderTopColor: '#282828',
    // Removed border radius if you don't want rounded top corners
    // borderTopLeftRadius: 20,
    // borderTopRightRadius: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5, // Adjust vertical padding inside item
  },
  scanButtonLarge: { // Keep if needed
    marginTop: -30,
    backgroundColor: '#DFFF00',
    padding: 15,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    // Add elevation/shadow for Android/iOS if desired
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});

export default CustomTabBar;