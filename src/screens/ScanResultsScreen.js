// ScanResultsScreen.js
import React, { useContext, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { AuthContext } from "../../App";

// Map predicted disease labels to detailed descriptions
const diseaseDescriptions = {
  "Apple Apple scab":
    "Apple scab is a fungal disease caused by Venturia inaequalis. It appears as dark, velvety spots on leaves and fruit, leading to premature leaf drop and deformed apples. The pathogen thrives in humid climates. Key management strategies include using resistant varieties, timely fungicide applications, and sanitation practices like removing infected debris.",
  "Apple Black rot":
    "Apple Black Rot is a fungal infection that causes dark, sunken lesions on fruits, leaves, and twigs. Under warm and wet conditions, the lesions expand quickly, compromising fruit quality and overall tree health. Effective management includes pruning, improved air circulation, and appropriate fungicide treatments.",
  "Apple Cedar apple rust":
    "Cedar apple rust is a unique disease requiring two hosts—apple trees and cedar or juniper trees. On apples, it manifests as yellow-orange spots often bordered by red, leading to defoliation and fruit distortion. Management includes strategic orchard placement, removing nearby cedar hosts, and timely fungicide applications.",
  "Apple healthy":
    "A healthy apple tree shows vibrant green foliage with no signs of spots or lesions. Leaves are uniformly glossy and fruits develop plump and firm. This state reflects optimal growing conditions and effective pest and disease management, ensuring high quality and yield.",
  "Blueberry healthy":
    "Healthy blueberry bushes display dark, glossy leaves and an abundant crop of plump berries. Free from fungal infections and pest damage, these plants thrive in well-drained acidic soil with ample sunlight, benefiting from mulching, proper irrigation, and balanced fertilization.",
  "Cherry (including sour) Powdery mildew":
    "Powdery mildew in cherry trees, particularly sour varieties, is marked by a white, powdery coating on leaves, stems, and sometimes fruit. It causes leaves to curl and yellow, leading to reduced vigor and fruit quality. Preventative measures include proper spacing, regular pruning, and early fungicide applications.",
  "Cherry (including sour) healthy":
    "Healthy cherry trees, both sweet and sour, feature a lush canopy with glossy leaves free from disease. Their fruits are evenly shaped and brightly colored, reflecting optimal growing conditions and careful management practices such as proper pruning, pest monitoring, and balanced fertilization.",
  "Corn (maize) Cercospora leaf spot Gray leaf spot":
    "Cercospora leaf spot (Gray leaf spot) in maize is a fungal disease that produces small, circular lesions on leaves. These lesions can merge under humid conditions, leading to chlorosis and reduced photosynthesis. Management practices include crop rotation, resistant hybrids, and timely fungicide sprays.",
  "Corn (maize) Common rust":
    "Common rust is a fungal disease in maize characterized by small, orange to brown pustules on leaves. This infection weakens the plant's photosynthetic ability and can cause yield loss if severe. Cultural controls, including resistant hybrids and fungicide applications, are essential for management.",
  "Corn (maize) Northern Leaf Blight":
    "Northern Leaf Blight is a fungal disease that manifests as long, elliptical lesions with gray centers and brown edges on maize leaves. It reduces photosynthesis and can lead to significant yield loss, especially in humid climates. Crop rotation, residue management, and resistant varieties help control the disease.",
  "Corn (maize) healthy":
    "Healthy maize plants are characterized by strong, green foliage without any lesions or discoloration. Their robust growth reflects optimal soil fertility, proper irrigation, and effective disease and pest management practices, ensuring maximum productivity.",
  "Grape Black rot":
    "Black rot in grapes is a fungal disease that produces dark, circular lesions on leaves and fruit, eventually causing fruit rot and vine decline. It thrives in humid conditions, making timely fungicide applications and proper canopy management critical to reducing losses.",
  "Grape Esca (Black Measles)":
    "Esca, known as Black Measles in grapevines, is a complex disease involving fungal pathogens that attack the wood and leaves. Symptoms include dark lesions and vine decline, and the disease is managed through integrated strategies including pruning and careful fungicide use.",
  "Grape Leaf blight (Isariopsis Leaf Spot)":
    "Isariopsis Leaf Spot, or Leaf blight in grapes, is a fungal infection causing irregular, dark spots on leaves. These spots can lead to premature defoliation and decreased photosynthesis. Effective management involves regular fungicide applications and proper canopy management.",
  "Grape healthy":
    "Healthy grapevines exhibit uniformly green, well-structured foliage without any signs of fungal or pest damage. This robust condition is a testament to sound vineyard management practices, ensuring optimal photosynthesis and high-quality fruit production.",
  "Orange Haunglongbing (Citrus greening)":
    "Haunglongbing, or Citrus Greening, is a bacterial disease that severely affects citrus trees, including oranges. Symptoms include yellowing leaves, misshapen and bitter fruits, and eventual tree decline. The disease is spread by insect vectors and requires strict control measures including vector management and removal of infected trees.",
  "Peach Bacterial spot":
    "Bacterial spot in peaches appears as small, dark, water-soaked lesions on leaves, fruits, and twigs. This infection can lead to premature leaf drop and reduced fruit quality. Management involves copper-based bactericides, resistant varieties, and proper sanitation practices.",
  "Peach healthy":
    "A healthy peach tree shows vibrant green foliage and smooth, blemish-free fruits. The overall robust appearance reflects optimal growing conditions and effective disease and pest management practices, ensuring consistent productivity and high fruit quality.",
  "Pepper, bell Bacterial spot":
    "Bacterial spot in bell peppers is identified by dark, necrotic lesions on leaves and fruits that reduce photosynthetic efficiency. It spreads rapidly in warm, humid conditions, making early detection, the use of bactericides, and resistant cultivars crucial for control.",
  "Pepper, bell healthy":
    "Healthy bell pepper plants have lush, vibrant foliage and uniformly shaped, blemish-free fruits. Their robust growth indicates balanced fertilization, proper irrigation, and effective control of pests and diseases, leading to a productive harvest.",
  "Potato Early blight":
    "Early blight in potatoes is a fungal disease that presents as small, dark spots with concentric rings on leaves, often starting at the lower canopy. As it progresses, the disease causes yellowing and defoliation, reducing yield. Management includes crop rotation, resistant varieties, and timely fungicide treatments.",
  "Potato Late blight":
    "Late blight is a devastating fungal disease in potatoes marked by rapidly spreading, water-soaked lesions that turn brown and decay leaves and tubers. It thrives in cool, moist conditions and can decimate crops. Preventative measures include resistant varieties, regular fungicide applications, and vigilant monitoring.",
  "Potato healthy":
    "Healthy potato plants exhibit lush green foliage with no signs of lesions or discoloration. Their vigorous growth reflects optimal soil management, proper irrigation, and effective pest and disease control, all of which are essential for high tuber quality and yield.",
  "Raspberry healthy":
    "Healthy raspberry plants feature vibrant green foliage and abundant canes with no visible signs of disease or pest damage. They yield plump, well-colored berries and thrive under proper pruning, balanced fertilization, and adequate moisture management.",
  "Soybean healthy":
    "Healthy soybean plants display uniformly green leaves and well-formed pods free of discoloration or pest damage. Their overall vitality is a result of balanced nutrient management, effective irrigation practices, and robust agronomic techniques.",
  "Squash Powdery mildew":
    "Powdery mildew on squash is a fungal disease that appears as a white, powdery coating on leaves and stems, leading to distorted growth and reduced photosynthesis. It is more prevalent in warm, dry conditions but can be managed through improved air circulation, resistant varieties, and fungicide applications.",
  "Strawberry Leaf scorch":
    "Leaf scorch in strawberries is characterized by brown, scorched leaf edges caused by a combination of fungal pathogens and environmental stress. This condition reduces plant vigor and fruit yield. Effective management involves proper irrigation, mulching, and targeted fungicide treatments.",
  "Strawberry healthy":
    "Healthy strawberry plants display vibrant green leaves and robust runners, with evenly colored, blemish-free fruits. Their thriving condition reflects optimal nutrient balance, effective pest control, and proper water management practices, ensuring a bountiful harvest.",
  "Tomato Bacterial spot":
    "Bacterial spot in tomatoes presents as small, dark lesions on leaves and fruits that can lead to significant defoliation and decreased fruit quality. The bacterial infection spreads quickly under warm, humid conditions, making early intervention and the use of copper-based bactericides essential.",
  "Tomato Early blight":
    "Early blight in tomatoes is a fungal disease that produces concentric, brown lesions on leaves, typically affecting older foliage first. This leads to yellowing and premature leaf drop. Management practices include crop rotation, resistant varieties, and timely fungicide applications.",
  "Tomato Late blight":
    "Late blight in tomatoes is a severe fungal disease marked by water-soaked lesions that rapidly expand, leading to widespread tissue death. It can decimate crops under cool, moist conditions. Preventative measures include using resistant varieties, maintaining sanitation, and vigilant fungicide applications.",
  "Tomato Leaf Mold":
    "Leaf mold in tomatoes is characterized by a dusty, moldy appearance on the underside of leaves, reducing photosynthesis and overall plant vigor. This fungal disease is exacerbated by high humidity and poor air circulation. Regular pruning and fungicide treatments are recommended for control.",
  "Tomato Septoria leaf spot":
    "Septoria leaf spot in tomatoes is a fungal infection that appears as small, dark spots with lighter halos on the leaves. If left unmanaged, it can lead to significant defoliation. Effective control includes proper spacing, resistant cultivars, and timely fungicide applications.",
  "Tomato Spider mites Two-spotted spider mite":
    "Two-spotted spider mites on tomato plants cause tiny discolored speckles and fine webbing on leaves, as these pests suck sap and weaken the plant. They can also serve as vectors for other pathogens. Regular monitoring, miticides, and encouraging natural predators are key for management.",
  "Tomato Target Spot":
    "Target spot in tomatoes is a fungal disease identified by circular lesions with concentric rings on the foliage. This infection impairs photosynthesis and reduces overall plant health. Proper sanitation, resistant varieties, and timely fungicide applications help in controlling the disease.",
  "Tomato Tomato Yellow Leaf Curl Virus":
    "Tomato Yellow Leaf Curl Virus is a viral disease that causes upward leaf curling, yellowing, and stunted growth in tomato plants. Transmitted by whiteflies, it significantly reduces yield by hampering healthy fruit development. Control efforts focus on vector management and removing infected plants.",
  "Tomato Tomato mosaic virus":
    "Tomato mosaic virus leads to mottled, discolored leaves and distorted growth in tomato plants. It spreads easily through contaminated tools and infected plant material, reducing fruit quality and yield. Sanitation measures and the use of virus-free seeds or transplants are essential for prevention.",
  "Tomato healthy":
    "Healthy tomato plants have vibrant, green foliage and well-structured growth with evenly colored, blemish-free fruits. Their robust condition reflects proper soil nutrition, consistent irrigation, and effective management of pests and diseases, ensuring a productive and high-quality yield.",
};

const ScanResultsScreen = ({ route, navigation }) => {
  // Pull data from route params, including top5 and imageUri
  const {
    top5 = [],
    imageUri = null,
    bestLabel = "Leaf Spot",
    bestConfidence = 0.88,
  } = route.params || {};

  // Access authenticated user from local auth state
  const { user } = useContext(AuthContext);

  // Local state to handle loading when saving
  const [saving, setSaving] = useState(false);

  // Get description from diseaseDescriptions mapping; if not found, show a default message.
  const description =
    diseaseDescriptions[bestLabel] ||
    `No description available for ${bestLabel}.`;

  // Helper function to upload the image to Firebase Storage and return the download URL
  const uploadImageAsync = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      // Use the last segment of the URI as the file name (you can improve this by generating a unique name)
      const filename = uri.substring(uri.lastIndexOf("/") + 1);
      const storageRef = firebase.storage().ref().child(`images/${filename}`);
      const snapshot = await storageRef.put(blob);
      const downloadURL = await snapshot.ref.getDownloadURL();
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error("Image upload failed. Please try again.");
    }
  };

  // Function to save scan result to Firestore
  const handleSaveResult = async () => {
    if (!user) {
      Alert.alert("Error", "User is not authenticated. Please log in again.");
      return;
    }

    setSaving(true);
    try {
      let uploadedImageUrl = "";
      // If an image URI exists, attempt to upload the image and get its URL
      if (imageUri) {
        uploadedImageUrl = await uploadImageAsync(imageUri);
      }

      // Prepare document structure
      const scanData = {
        userId: user.uid,
        imageUri: uploadedImageUrl, // Use the download URL from Storage
        bestLabel,
        bestConfidence,
        top5,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        desc: description,
      };

      // Save to "recent_activity" collection; Firestore will auto-generate a document ID
      await firebase.firestore().collection("recent_activity").add(scanData);

      Alert.alert("Success", "Scan result saved successfully!");
      // Optionally, navigate back to home or refresh the recent activity list
      navigation.goBack();
    } catch (error) {
      console.error("Error saving scan result:", error);
      let errorMessage =
        "An error occurred while saving your scan result. Please try again.";
      Alert.alert("Save Error", errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Display the captured image */}
      {imageUri && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        </View>
      )}

      {/* Top Result Card */}
      <View style={styles.card}>
        <Text style={styles.diseaseTitle}>{bestLabel}</Text>
        <Text style={styles.confidence}>
          Confidence: {(bestConfidence * 100).toFixed(2)}%
        </Text>
      </View>

      {/* Top 5 Predictions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top 5 Predictions</Text>
        {top5.map((item, index) => (
          <View key={index} style={styles.top5Row}>
            <Text style={styles.top5Label}>{item.label}</Text>
            <Text style={styles.top5Confidence}>
              {(item.confidence * 100).toFixed(2)}%
            </Text>
          </View>
        ))}
      </View>

      {/* Description mapped from the predicted label */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Description</Text>
        <Text style={styles.cardText}>{description}</Text>
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
          style={[styles.button, { backgroundColor: "#DFFF00" }]}
          onPress={handleSaveResult}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[styles.buttonText, { color: "#000" }]}>
              Save Result
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default ScanResultsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  card: {
    backgroundColor: "#111111",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  diseaseTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#DFFF00",
    marginBottom: 5,
  },
  confidence: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  cardText: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  top5Row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  top5Label: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  top5Confidence: {
    color: "#AAAAAA",
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  button: {
    flex: 1,
    backgroundColor: "#333333",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
