// src/localization/strings.js

const currentLanguage = "en"; // Manage this globally later

const strings = {
  en: {
    // General
    appName: "Dr. Plant",
    ok: "OK",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    retry: "Try Again",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    confirm: "Confirm",
    comingSoon: "Coming Soon",
    featureNotImplemented: "This feature is not available yet.",
    settings: "Settings",
    language: "Language",
    app_version: "App Version",
    Recently: "Recently", // Fallback for formatting error
    Unknown: "Unknown", // Fallback label

    // Errors
    error_general: "Hmm, something went wrong. Please try again.",
    error_network: "Unable to connect. Please check your internet connection.",
    error_permission_denied: "Permission denied. Please check app settings.",
    error_not_found: "Information not found.",
    error_loading_data: "Could not load data. Please try refreshing.",
    error_saving_data: "Could not save data. Please try again.",
    error_uploading_image:
      "Failed to upload image. Check connection and try again.",
    error_model_load: "Failed to load AI model. Please restart the app.",
    error_prediction: "Analysis failed. Please try again with a clear image.",
    error_camera: "Camera Error: Could not access camera.",
    error_library: "Library Error: Could not access photo library.",

    // Auth
    login: "Login",
    signUp: "Sign Up",
    logout: "Logout",
    logout_confirm_title: "Confirm Logout",
    logout_confirm_message: "Are you sure you want to log out?",
    login_required: "Login Required",
    login_prompt: "Please log in to continue.",
    login_success: "Login Successful",
    login_welcome_back: "Welcome back!",
    login_error: "Login failed. Please check your details.",
    login_error_user_not_found:
      "Account not found. Please check your email or sign up.",
    login_error_wrong_password: "Incorrect password. Please try again.",
    signup_success: "Sign Up Successful!",
    signup_error: "Sign up failed. Please try again.",
    signup_error_email_in_use: "This email address is already in use.",
    validation_error: "Validation Error",
    validation_enter_email_password: "Please enter both email and password.",
    validation_fill_all_fields: "Please fill out all fields.",
    validation_passwords_match: "Passwords do not match.",
    email_address: "Email Address",
    password: "Password",
    confirm_password: "Confirm Password",
    username: "Username",
    phone_number: "Phone Number",
    already_have_account: "Already have an account? Login",
    dont_have_account: "Don't have an account? Sign Up",

    // Home Screen
    home_hello: "Hello,",
    home_gardener: "Farmer",
    home_discover_plants: "Discover Plants",
    home_discover_text:
      "Scan your plants to identify potential issues and receive care guidance.",
    home_scan_button: "Scan Plant Now",
    home_recent_scans: "Recent Scans",
    home_no_scans: "No recent scans found.",
    home_no_scans_subtext: "Start by scanning a plant!",
    home_loading_data: "Loading your farm data...",

    // Scan Results
    scan_results_title: "Scan Results",
    scan_result_confidence: "Confidence",
    scan_result_other_possibilities: "Other Possibilities",
    scan_result_description: "Description",
    scan_result_no_description:
      "No detailed description available for {label}.",
    scan_result_recommendations: "General Recommendations",
    scan_result_recommendations_text:
      "Isolate the plant. Remove affected parts with clean tools. Ensure proper water, light, air circulation. Consider organic treatments first.",
    scan_result_scanned_on: "Scanned on",
    scan_result_save_button: "Save to My Scans",
    scan_result_saving: "Saving...",
    scan_result_uploading: "Uploading Image...",
    scan_result_save_success: "Scan result has been saved!",
    scan_result_save_error: "Failed to save scan: {error}",

    // Image Capture
    img_capture_title: "Plant Disease Detection",
    img_capture_tap_select: "Tap to select an image",
    img_capture_take_photo: "Take Photo",
    img_capture_choose_library: "Choose from Library",
    img_capture_start_analysis: "Start Analysis",
    img_capture_analyzing: "Analyzing...",
    img_capture_loading_model: "Loading AI model...",
    img_capture_model_fail: "Model failed to load. Please restart.",
    img_capture_permission_needed: "Camera access is needed to take photos.",

    // Chat
    chat_list_title: "AI Chat History",
    chat_list_no_chats: "No chats yet. Start a new conversation!",
    chat_new_chat: "New Chat",
    chat_start_message: "Send a message to start chatting!",
    chat_placeholder: "Ask Dr. Plant AI...",
    chat_delete_confirm_title: "Delete Chat",
    chat_delete_confirm_message: "Delete this chat history permanently?",
    chat_delete_error: "Could not delete chat.",
    chat_load_error: "Could not load chats.",
    chat_messages_load_error: "Could not load messages for this chat.",
    chat_send_error: "Failed to send message or get AI response.",
    chat_ai_blocked: "AI response blocked due to safety settings: {reason}",
    chat_ai_error: "AI Service Error: {error}",
    chat_edited: "edited",
    chat_discussing_scan: "Discussing Scan: {id}",
    chat_disease: "Disease:",
    // chat_confidence: "Confidence:", // Confidence is included in disease line now
    chat_description: "Description:",
    chat_image_associated: "(Image associated)", // Removed as we don't send image context yet
    chat_ask_about_scan:
      "What would you like to ask about this specific plant scan?", // Maybe remove if auto-sending? Keep for now.
    chat_attach_scan: "Discuss a Saved Scan",
    chat_loading_scan_details: "Loading scan details...",
    chat_scan_context_message: "Let's discuss this scan:\n{details}", // Adjusted wording slightly
    edit_message_placeholder: "Edit message...",

    // Profile & Settings
    profile_account_info: "Edit Profile", // Changed label
    profile_scan_history: "Scan History",
    profile_help_center: "Help Center",
    profile_no_email: "No email available",

    // Add other strings as needed...
  },
  hi: {
    // ... (Populate Hindi translations for all keys above) ...
    // General
    appName: "डॉ. प्लांट",
    ok: "ठीक है",
    cancel: "रद्द करें",
    save: "सहेजें",
    delete: "मिटाएँ",
    retry: "पुनः प्रयास करें",
    loading: "लोड हो रहा है...",
    error: "त्रुटि",
    success: "सफलता",
    confirm: "पुष्टि करें",
    comingSoon: "जल्द आ रहा है",
    featureNotImplemented: "यह सुविधा अभी उपलब्ध नहीं है।",
    settings: "सेटिंग्स",
    language: "भाषा",
    app_version: "ऐप संस्करण",
    Recently: "हाल ही में",
    Unknown: "अज्ञात",

    // Errors
    error_general: "हम्म, कुछ गलत हो गया। कृपया पुनः प्रयास करें।",
    error_network: "कनेक्ट करने में असमर्थ। कृपया अपना इंटरनेट कनेक्शन जांचें।",
    error_permission_denied: "अनुमति अस्वीकार। कृपया ऐप सेटिंग जांचें।",
    error_not_found: "जानकारी नहीं मिली।",
    error_loading_data:
      "डेटा लोड नहीं हो सका। कृपया रीफ्रेश करने का प्रयास करें।",
    error_saving_data: "डेटा सहेजा नहीं जा सका। कृपया पुनः प्रयास करें।",
    error_uploading_image:
      "छवि अपलोड करने में विफल। कनेक्शन जांचें और पुनः प्रयास करें।",
    error_model_load: "एआई मॉडल लोड करने में विफल। कृपया ऐप पुनः आरंभ करें।",
    error_prediction:
      "विश्लेषण विफल। कृपया एक स्पष्ट छवि के साथ पुनः प्रयास करें।",
    error_camera: "कैमरा त्रुटि: कैमरा एक्सेस नहीं कर सका।",
    error_library: "लाइब्रेरी त्रुटि: फोटो लाइब्रेरी एक्सेस नहीं कर सका।",

    // Auth
    login: "लॉग इन करें",
    signUp: "साइन अप करें",
    logout: "लॉग आउट करें",
    logout_confirm_title: "लॉगआउट की पुष्टि करें",
    logout_confirm_message: "क्या आप निश्चित रूप से लॉग आउट करना चाहते हैं?",
    login_required: "लॉगिन आवश्यक है",
    login_prompt: "जारी रखने के लिए कृपया लॉग इन करें।",
    login_success: "लॉगिन सफल",
    login_welcome_back: "वापसी पर स्वागत है!",
    login_error: "लॉगिन विफल। कृपया अपना विवरण जांचें।",
    login_error_user_not_found:
      "खाता नहीं मिला। कृपया अपना ईमेल जांचें या साइन अप करें।",
    login_error_wrong_password: "गलत पासवर्ड। कृपया पुनः प्रयास करें।",
    signup_success: "साइन अप सफल!",
    signup_error: "साइन अप विफल। कृपया पुनः प्रयास करें।",
    signup_error_email_in_use: "यह ईमेल पता पहले से उपयोग में है।",
    validation_error: "सत्यापन त्रुटि",
    validation_enter_email_password: "कृपया ईमेल और पासवर्ड दोनों दर्ज करें।",
    validation_fill_all_fields: "कृपया सभी फ़ील्ड भरें।",
    validation_passwords_match: "पासवर्ड मेल नहीं खाते।",
    email_address: "ईमेल पता",
    password: "पासवर्ड",
    confirm_password: "पासवर्ड की पुष्टि करें",
    username: "उपयोगकर्ता नाम",
    phone_number: "फ़ोन नंबर",
    already_have_account: "पहले से खाता मौजूद है? लॉग इन करें",
    dont_have_account: "खाता नहीं है? साइन अप करें",

    // Home Screen
    home_hello: "नमस्ते,",
    home_gardener: "किसान", // Default name
    home_discover_plants: "पौधों की खोज करें",
    home_discover_text:
      "संभावित समस्याओं की पहचान करने और देखभाल मार्गदर्शन प्राप्त करने के लिए अपने पौधों को स्कैन करें।",
    home_scan_button: "अब पौधा स्कैन करें",
    home_recent_scans: "हाल के स्कैन",
    home_no_scans: "कोई हालिया स्कैन नहीं मिला।",
    home_no_scans_subtext: "एक पौधा स्कैन करके शुरू करें!",
    home_loading_data: "आपके खेत का डेटा लोड हो रहा है...",

    // Scan Results
    scan_results_title: "स्कैन परिणाम",
    scan_result_confidence: "आत्मविश्वास",
    scan_result_other_possibilities: "अन्य संभावनाएं",
    scan_result_description: "विवरण",
    scan_result_no_description:
      "{label} के लिए कोई विस्तृत विवरण उपलब्ध नहीं है।",
    scan_result_recommendations: "सामान्य सिफारिशें",
    scan_result_recommendations_text:
      "पौधे को अलग करें। प्रभावित हिस्सों को साफ औजारों से हटा दें। उचित पानी, प्रकाश, हवा का संचार सुनिश्चित करें। पहले जैविक उपचारों पर विचार करें।",
    scan_result_scanned_on: "स्कैन किया गया:",
    scan_result_save_button: "मेरे स्कैन में सहेजें",
    scan_result_saving: "सहेज रहा है...",
    scan_result_uploading: "छवि अपलोड हो रही है...",
    scan_result_save_success: "स्कैन परिणाम सहेज लिया गया है!",
    scan_result_save_error: "स्कैन सहेजने में विफल: {error}",

    // Image Capture
    img_capture_title: "पौधों के रोग का पता लगाना",
    img_capture_tap_select: "एक छवि चुनने के लिए टैप करें",
    img_capture_take_photo: "तस्वीर लें",
    img_capture_choose_library: "लाइब्रेरी से चुनें",
    img_capture_start_analysis: "विश्लेषण शुरू करें",
    img_capture_analyzing: "विश्लेषण हो रहा है...",
    img_capture_loading_model: "एआई मॉडल लोड हो रहा है...",
    img_capture_model_fail: "मॉडल लोड करने में विफल। कृपया ऐप पुनः आरंभ करें।",
    img_capture_permission_needed:
      "तस्वीरें लेने के लिए कैमरा एक्सेस आवश्यक है।",

    // Chat
    chat_list_title: "एआई चैट इतिहास",
    chat_list_no_chats: "अभी तक कोई चैट नहीं। एक नई बातचीत शुरू करें!",
    chat_new_chat: "नई चैट",
    chat_start_message: "चैटिंग शुरू करने के लिए एक संदेश भेजें!",
    chat_placeholder: "डॉ. प्लांट एआई से पूछें...",
    chat_delete_confirm_title: "चैट मिटाएँ",
    chat_delete_confirm_message:
      "क्या आप इस चैट इतिहास को स्थायी रूप से हटाना चाहते हैं?",
    chat_delete_error: "चैट मिटाया नहीं जा सका।",
    chat_load_error: "चैट लोड नहीं हो सके।",
    chat_messages_load_error: "इस चैट के संदेश लोड नहीं हो सके।",
    chat_send_error: "संदेश भेजने या एआई प्रतिक्रिया प्राप्त करने में विफल।",
    chat_ai_blocked:
      "सुरक्षा सेटिंग्स के कारण एआई प्रतिक्रिया अवरुद्ध: {reason}",
    chat_ai_error: "एआई सेवा त्रुटि: {error}",
    chat_edited: "संपादित",
    chat_discussing_scan: "स्कैन पर चर्चा: {id}",
    chat_disease: "रोग:",
    chat_description: "विवरण:",
    chat_image_associated: "(छवि संबंधित)",
    chat_ask_about_scan:
      "आप इस विशिष्ट प्लांट स्कैन के बारे में क्या पूछना चाहेंगे?",
    chat_attach_scan: "सहेजे गए स्कैन पर चर्चा करें",
    chat_loading_scan_details: "स्कैन विवरण लोड हो रहा है...",
    chat_scan_context_message: "आइए इस स्कैन पर चर्चा करें:\n{details}",
    edit_message_placeholder: "संदेश संपादित करें...",

    // Profile & Settings
    profile_account_info: "प्रोफ़ाइल संपादित करें",
    profile_scan_history: "स्कैन इतिहास",
    profile_help_center: "सहायता केंद्र",
    profile_no_email: "कोई ईमेल उपलब्ध नहीं है",
  },
  // Add other languages...
};

// Function to get the translated string
const t = (key, replacements = {}) => {
  let translation = strings[currentLanguage]?.[key] || strings.en[key] || key;
  Object.keys(replacements).forEach((placeholder) => {
    const regex = new RegExp(`{${placeholder}}`, "g");
    translation = translation.replace(regex, replacements[placeholder]);
  });
  return translation;
};

export { t };
