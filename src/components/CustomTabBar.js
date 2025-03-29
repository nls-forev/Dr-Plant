// src/components/CustomTabBar.js (MODIFIED VERSION)
import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Text,
} from "react-native"; // Added Text
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// import { t } from '../localization/strings'; // Uncomment if using labels

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  // Theme definition
  const theme = {
    tabBarBackground: "#101010",
    tabIconActive: "#BFFF00",
    tabIconInactive: "#8E8E93",
    tabBorder: "#282828",
    scanButtonBackground: "#BFFF00",
    scanButtonIcon: "#000000",
  };

  return (
    <View
      style={[
        styles.bottomNavContainer,
        {
          paddingBottom: insets.bottom,
          borderTopColor: theme.tabBorder,
          backgroundColor: theme.tabBarBackground,
        },
      ]}
    >
      <View style={styles.bottomNav}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          let iconName;
          switch (route.name) {
            case "Home":
              iconName = isFocused ? "home" : "home-outline";
              break;
            case "Chats":
              iconName = isFocused ? "chatbubbles" : "chatbubbles-outline";
              break;
            case "Analytics":
              iconName = isFocused ? "bar-chart" : "bar-chart-outline";
              break; // Analytics icon
            case "Profile":
              iconName = isFocused ? "person" : "person-outline";
              break;
            default:
              iconName = isFocused ? "ellipse" : "ellipse-outline";
          }

          const iconColor = isFocused
            ? theme.tabIconActive
            : theme.tabIconInactive;
          const accessibilityLabel =
            options.tabBarAccessibilityLabel ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, merge: true });
            }
          };
          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={accessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.navItem}
            >
              <Ionicons name={iconName} size={26} color={iconColor} />
              {/* Optional Label: */}
              {/* <Text style={[styles.navLabel, { color: iconColor }]}>{t('tab_' + route.name.toLowerCase())}</Text> */}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  bottomNavContainer: { borderTopWidth: Platform.OS === "ios" ? 0.5 : 1 },
  bottomNav: { flexDirection: "row", height: 55, alignItems: "center" },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  navLabel: { fontSize: 10, marginTop: 2 },
  // scanButtonLarge style definition kept JIC, but likely unused if scan isn't a tab
  scanButtonLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#BFFF00",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
});

export default CustomTabBar;
