// src/screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  SafeAreaView,
} from "react-native";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { useAuth } from "../context/AuthContext";
import { db, firebase } from "../firebase/firebaseInit";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import Markdown from "react-native-markdown-display";
import {
  Send,
  XCircle,
  CheckCircle,
  AlertCircle,
  Paperclip,
} from "lucide-react-native";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { t } from "../localization/strings";

// --- Configuration & Constants ---
const GEMINI_API_KEY = "AIzaSyDEhRYRo_ajQdvHlEdm44vu_MSPSX5T5Vw"; // Replace!
const GEMINI_MODEL_NAME = "gemini-1.5-flash";
const USER_ROLE = "user";
const MODEL_ROLE = "model";
const MAX_CHAT_TITLE_LENGTH = 35;
const CHATS_COLLECTION = "ai_chats";
const MESSAGES_SUBCOLLECTION = "messages";
const isApiKeyPlaceholder = !GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR");

const ChatScreen = () => {
  // --- Hooks ---
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const flatListRef = useRef(null);
  const editInputRef = useRef(null);
  const isMounted = useRef(true);
  const scanDataProcessed = useRef(false);

  // --- Route Params ---
  const {
    chatId: initialChatId,
    initialTitle,
    loadScanData,
  } = route.params || {};
  // Specifically watch for selectedScanData passed back from the modal
  const selectedScanData = route.params?.selectedScanData;

  // --- Theme ---
  const theme = {
    /* Consistent dark theme */ background: "#0A0A0A",
    headerBackground: "#101010",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    primaryDisabled: "#5A6A00",
    inputBackground: "#1C1C1E",
    inputPlaceholder: "#8E8E93",
    userBubble: "#BFFF00",
    userBubbleText: "#111111",
    aiBubble: "#2C2C2E",
    aiBubbleText: "#E5E5EA",
    error: "#FF9A9A",
    errorBackground: "rgba(255, 0, 0, 0.1)",
    deleteButton: "#FF6B6B",
    deleteButtonDisabled: "#888",
    confirmButton: "#BFFF00",
    confirmButtonDisabled: "#5A6A00",
    editedIndicator: "#999",
    optimisticIndicator: "#AAA",
    iconDefault: "#AEAEB2",
    iconDisabled: "#555",
    border: "#2C2C2E",
  };

  // --- State ---
  const [genAI, setGenAI] = useState(null);
  const [chatModel, setChatModel] = useState(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(!!initialChatId);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [currentChatId, setCurrentChatId] = useState(initialChatId);
  const [currentTitle, setCurrentTitle] = useState(
    initialChatId ? initialTitle || t("chat_new_chat") : t("chat_new_chat")
  );
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");

  // --- Effects ---

  useEffect(() => {
    /* Mount tracking */
    isMounted.current = true;
    scanDataProcessed.current = false; // Reset processed flag on mount/remount
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    /* Gemini Init */
    // ... (keep existing Gemini Init effect) ...
    if (isApiKeyPlaceholder) {
      if (isMounted.current)
        setError("Dev: " + t("error_general") + " (API Key)");
      return;
    }
    try {
      const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = ai.getGenerativeModel({
        model: GEMINI_MODEL_NAME,
        safetySettings: [
          /*...*/
        ],
      });
      if (isMounted.current) {
        setGenAI(ai);
        setChatModel(model);
      }
    } catch (err) {
      if (isMounted.current) setError(t("error_general") + " (AI Init)");
    }
  }, []);

  useEffect(() => {
    /* Header Title */
    // ... (keep existing Header Title effect) ...
    navigation.setOptions({
      title: currentTitle,
      headerStyle: { backgroundColor: theme.headerBackground },
      headerTintColor: theme.text,
      headerTitleStyle: { fontWeight: "600" },
    });
  }, [navigation, currentTitle, theme]);

  // --- Format Scan Data for Message ---
  const formatScanDataForMessage = useCallback((scanData) => {
    if (!scanData) return "";
    const { scanId, bestLabel, bestConfidence, description, top5 } = scanData;
    const confidencePercent = ((bestConfidence || 0) * 100).toFixed(1);
    const top5Text =
      top5 && top5.length > 1
        ? "\n" +
          t("scan_result_other_possibilities") +
          ":\n" +
          top5
            .slice(1, 5)
            .map((p) => `- ${p.label} (${(p.confidence * 100).toFixed(1)}%)`)
            .join("\n")
        : "";
    const details = `*${t("chat_disease")}* ${
      bestLabel || "N/A"
    } (${confidencePercent}%)${top5Text}\n\n*${t(
      "scan_result_description"
    )}*\n${
      description ||
      t("scan_result_no_description", { label: bestLabel || "?" })
    }\n\n(Scan ID: ${scanId || "?"})`;
    return t("chat_scan_context_message", { details });
  }, []);

  // --- Effect to Handle Incoming Scan Data & Auto-Send ---
  useEffect(() => {
    // Prioritize selectedScanData from modal, fallback to loadScanData from initial nav
    const dataToLoad = selectedScanData || loadScanData;

    // Process only if data exists, it's a new chat, component is mounted, and not already processed
    if (
      dataToLoad &&
      !currentChatId &&
      isMounted.current &&
      !scanDataProcessed.current
    ) {
      console.log("Processing scan data param to start chat context...");
      const formattedMessage = formatScanDataForMessage(dataToLoad);

      if (formattedMessage) {
        scanDataProcessed.current = true; // Mark as processed FIRST
        sendMessage(formattedMessage); // Auto-send the context

        // Clear the param that triggered this effect *after* initiating send
        if (selectedScanData) {
          navigation.setParams({ selectedScanData: undefined });
        } else if (loadScanData) {
          navigation.setParams({ loadScanData: undefined });
        }
      } else {
        console.warn("Failed to format scan data for message.");
        // Still clear params if formatting fails
        if (selectedScanData)
          navigation.setParams({ selectedScanData: undefined });
        if (loadScanData) navigation.setParams({ loadScanData: undefined });
      }
    }
    // Trigger ONLY when selectedScanData or loadScanData params change
  }, [
    selectedScanData,
    loadScanData,
    currentChatId,
    navigation,
    formatScanDataForMessage,
    sendMessage,
  ]);

  // --- Get Messages Collection Ref ---
  const getMessagesCollectionRef = useCallback(
    /* ... */ (chatId) => {
      if (!user || !db || !chatId) return null;
      return collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
    },
    [user]
  );

  // --- Fetch Messages ---
  useFocusEffect(
    /* ... Keep existing message fetching logic ... */
    useCallback(() => {
      if (!currentChatId || !user || !db) {
        if (!currentChatId && isMounted.current) setIsLoadingMessages(false);
        return;
      }
      if (isMounted.current) {
        setIsLoadingMessages(true);
        setError(null);
      }
      const messagesCollectionRef = getMessagesCollectionRef(currentChatId);
      if (!messagesCollectionRef) {
        if (isMounted.current) {
          setError(t("error_loading_data") + " (Ref)");
          setIsLoadingMessages(false);
        }
        return;
      }
      const messagesQuery = query(
        messagesCollectionRef,
        where("deleted", "==", false),
        orderBy("timestamp", "asc")
      );
      const unsubscribe = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const fetched = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              timestamp: doc.data().timestamp,
              editedAt: doc.data().editedAt,
            }))
            .filter((m) => m.role && m.parts?.[0]?.text !== undefined);
          if (isMounted.current) {
            setMessages(fetched);
            setIsLoadingMessages(false);
            if (!editingMessageId) scrollToBottom(false);
          }
        },
        (err) => {
          if (isMounted.current) {
            setError(t("chat_messages_load_error"));
            setIsLoadingMessages(false);
          }
          console.error("Msg fetch err:", err);
        }
      );
      return () => {
        unsubscribe();
      };
    }, [currentChatId, user, getMessagesCollectionRef, editingMessageId])
  );

  // --- Helper Functions ---
  const scrollToBottom = useCallback(
    /* ... */ (animated = true) => {
      if (messages.length > 0 && flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated });
        }, 150);
      }
    },
    [messages.length]
  );

  // --- Core Actions ---
  const generateAiResponse = useCallback(
    /* ... Keep existing refined version ... */ async (
      chatId,
      messageHistory
    ) => {
      if (!chatModel)
        throw new Error(t("error_general") + " (AI Model Missing)");
      if (messageHistory.length === 0) return;
      const lastUserMessageText =
        messageHistory[messageHistory.length - 1]?.parts[0]?.text;
      if (!lastUserMessageText)
        throw new Error(t("error_general") + " (History)");
      try {
        const chatSession = chatModel.startChat({
          history: messageHistory.map((m) => ({
            role: m.role,
            parts: m.parts,
          })),
        });
        const result = await chatSession.sendMessage(lastUserMessageText);
        if (result.response.promptFeedback?.blockReason)
          throw new Error(
            t("chat_ai_blocked", {
              reason: result.response.promptFeedback.blockReason,
            })
          );
        const aiResponseText = result.response.text();
        if (!aiResponseText || typeof aiResponseText !== "string")
          throw new Error(t("chat_ai_error", { error: "Format" }));
        const aiMsgFirestore = {
          role: MODEL_ROLE,
          parts: [{ text: aiResponseText.trim() }],
          timestamp: serverTimestamp(),
          deleted: false,
        };
        const messagesCollectionRef = getMessagesCollectionRef(chatId);
        if (!messagesCollectionRef)
          throw new Error(t("error_saving_data") + " (AI Ref)");
        await addDoc(messagesCollectionRef, aiMsgFirestore);
        const chatDocRef = doc(db, CHATS_COLLECTION, chatId);
        await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
      } catch (err) {
        let msg = err.message || t("chat_ai_error", { error: "Unknown" });
        if (msg.includes("API key not valid"))
          msg = t("chat_ai_error", { error: "Key" });
        else if (msg.includes("quota"))
          msg = t("chat_ai_error", { error: "Quota" });
        throw new Error(msg);
      }
    },
    [chatModel, getMessagesCollectionRef]
  );

  const sendMessage = useCallback(
    /* ... Keep existing refined version ... */ async (
      textToSend = inputText
    ) => {
      const userMessageText = textToSend.trim();
      if (
        !userMessageText ||
        isSending ||
        !chatModel ||
        !user ||
        !db ||
        isApiKeyPlaceholder
      ) {
        if (isApiKeyPlaceholder) Alert.alert(t("error"), "AI Key Missing");
        return;
      }
      if (textToSend === inputText && isMounted.current) {
        setInputText("");
      }
      if (isMounted.current) {
        setIsSending(true);
        setError(null);
      }
      Keyboard.dismiss();
      let tempChatId = currentChatId;
      let isNewChat = !tempChatId;
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg = {
        id: optimisticId,
        role: USER_ROLE,
        parts: [{ text: userMessageText }],
        timestamp: new Date(),
        deleted: false,
      };
      if (isMounted.current) setMessages((prev) => [...prev, optimisticMsg]);
      scrollToBottom();
      try {
        if (isNewChat) {
          const firstLine = userMessageText.split("\n")[0];
          const title =
            firstLine.substring(0, MAX_CHAT_TITLE_LENGTH) +
            (firstLine.length > MAX_CHAT_TITLE_LENGTH ? "..." : "");
          const chatDocRef = await addDoc(collection(db, CHATS_COLLECTION), {
            userId: user.uid,
            title,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          tempChatId = chatDocRef.id;
          if (isMounted.current) {
            setCurrentChatId(tempChatId);
            setCurrentTitle(title);
          }
        } else {
          await updateDoc(doc(db, CHATS_COLLECTION, tempChatId), {
            updatedAt: serverTimestamp(),
          });
        }
        const messagesCollectionRef = getMessagesCollectionRef(tempChatId);
        if (!messagesCollectionRef)
          throw new Error(t("error_saving_data") + " (Msg Ref)");
        await addDoc(messagesCollectionRef, {
          role: USER_ROLE,
          parts: [{ text: userMessageText }],
          timestamp: serverTimestamp(),
          deleted: false,
        });
        let historyForAPI = [];
        if (isMounted.current) {
          setMessages((currentMsgs) => {
            historyForAPI = currentMsgs
              .filter(
                (m) =>
                  m.id !== optimisticId &&
                  m.timestamp instanceof firebase.firestore.Timestamp
              )
              .map((m) => ({ role: m.role, parts: m.parts }));
            return currentMsgs;
          });
          if (
            !historyForAPI.find(
              (m) => m.role === USER_ROLE && m.parts[0].text === userMessageText
            )
          ) {
            historyForAPI.push({
              role: USER_ROLE,
              parts: [{ text: userMessageText }],
            });
          }
        } else {
          return;
        }
        await generateAiResponse(tempChatId, historyForAPI);
      } catch (err) {
        if (isMounted.current) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          setError(err.message || t("chat_send_error"));
        }
      } finally {
        if (isMounted.current) setIsSending(false);
      }
    },
    [
      inputText,
      isSending,
      chatModel,
      user,
      db,
      isApiKeyPlaceholder,
      currentChatId,
      generateAiResponse,
      getMessagesCollectionRef,
      messages,
    ]
  );

  // Attach Scan (Navigate to Selection Screen)
  const handleAttachScan = useCallback(() => {
    if (isSending || editingMessageId) return;
    console.log("Navigating to SelectScanScreen...");
    navigation.navigate("SelectScanScreen"); // Navigate to the modal screen
  }, [navigation, isSending, editingMessageId]);

  // Editing Logic (Keep existing refined versions)
  const handleLongPressMessage = useCallback(
    /*...*/ (message) => {
      if (
        message.role === USER_ROLE &&
        !message.deleted &&
        !isSending &&
        !editingMessageId &&
        message.id &&
        !message.id.startsWith("optimistic")
      ) {
        if (isMounted.current) {
          setEditingMessageId(message.id);
          setEditText(message.parts[0].text);
          setTimeout(() => editInputRef.current?.focus(), 100);
        }
      }
    },
    [isSending, editingMessageId]
  );
  const handleCancelEdit = useCallback(
    /*...*/ () => {
      if (isMounted.current) {
        setEditingMessageId(null);
        setEditText("");
      }
      Keyboard.dismiss();
    },
    []
  );
  const handleSaveEdit = useCallback(
    /*...*/ async () => {
      const originalMessage = messages.find((m) => m.id === editingMessageId);
      const editedText = editText.trim();
      if (
        !editingMessageId ||
        !editedText ||
        isSending ||
        !currentChatId ||
        !db ||
        !originalMessage ||
        editedText === originalMessage.parts[0].text
      ) {
        handleCancelEdit();
        return;
      }
      const originalTimestamp = originalMessage.timestamp;
      if (isMounted.current) {
        setIsSending(true);
        setError(null);
      }
      Keyboard.dismiss();
      try {
        const batch = writeBatch(db);
        const msgDocRef = doc(
          db,
          CHATS_COLLECTION,
          currentChatId,
          MESSAGES_SUBCOLLECTION,
          editingMessageId
        );
        batch.update(msgDocRef, {
          parts: [{ text: editedText }],
          editedAt: serverTimestamp(),
        });
        const msgsCollRef = getMessagesCollectionRef(currentChatId);
        if (
          !msgsCollRef ||
          !(originalTimestamp instanceof firebase.firestore.Timestamp)
        )
          throw new Error(t("error_saving_data") + " (Edit State)");
        const q = query(
          msgsCollRef,
          where("timestamp", ">", originalTimestamp)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach((docSnapshot) => {
          if (docSnapshot.id !== editingMessageId)
            batch.update(docSnapshot.ref, { deleted: true });
        });
        await batch.commit();
        let history = [];
        if (isMounted.current) {
          setMessages((currentMsgs) => {
            const idx = currentMsgs.findIndex((m) => m.id === editingMessageId);
            if (idx === -1) {
              history = [];
            } else {
              history = currentMsgs
                .slice(0, idx + 1)
                .filter((m) => !m.deleted)
                .map((m, i) => ({
                  role: m.role,
                  parts: i === idx ? [{ text: editedText }] : m.parts,
                }));
            }
            return currentMsgs;
          });
        } else {
          return;
        }
        if (history.length > 0)
          await generateAiResponse(currentChatId, history);
        if (isMounted.current) handleCancelEdit();
      } catch (err) {
        if (isMounted.current)
          setError(err.message || t("error_saving_data") + " (Edit)");
      } finally {
        if (isMounted.current) setIsSending(false);
      }
    },
    [
      editingMessageId,
      editText,
      isSending,
      currentChatId,
      db,
      messages,
      getMessagesCollectionRef,
      generateAiResponse,
      handleCancelEdit,
    ]
  );

  // --- UI Rendering ---
  const renderMessageItem = useCallback(
    /* ... Keep existing refined version ... */ ({ item }) => {
      const messageId = item.id || `optimistic-${item.timestamp?.toString()}`;
      if (editingMessageId === messageId) return null;
      const isUser = item.role === USER_ROLE;
      const textContent = item.parts?.[0]?.text ?? "[Error]";
      const wasEdited = !!item.editedAt;
      return (
        <TouchableOpacity
          activeOpacity={isUser ? 0.7 : 1}
          onLongPress={() => handleLongPressMessage(item)}
          delayLongPress={400}
          disabled={!item.id || item.id.startsWith("optimistic")}
        >
          <View
            style={[
              styles.messageBubble,
              isUser
                ? [styles.userBubble, { backgroundColor: theme.userBubble }]
                : [styles.aiBubble, { backgroundColor: theme.aiBubble }],
            ]}
          >
            {isUser ? (
              <Text
                style={[styles.messageText, { color: theme.userBubbleText }]}
                selectable={true}
              >
                {textContent}
              </Text>
            ) : (
              <Markdown style={markdownStyles(theme)}>{textContent}</Markdown>
            )}
            {wasEdited && (
              <Text
                style={[
                  styles.editedIndicatorBase,
                  { color: theme.editedIndicator },
                  isUser
                    ? styles.editedIndicatorUser
                    : styles.editedIndicatorAI,
                ]}
              >
                {t("chat_edited")}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [editingMessageId, handleLongPressMessage, theme]
  );

  // --- Main Component Return ---
  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <View style={styles.contentWrapper}>
          {isLoadingMessages && messages.length === 0 && (
            <ActivityIndicator
              color={theme.primary}
              style={styles.initialLoader}
              size="large"
            />
          )}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) =>
              item.id || `msg-${item.timestamp?.toString()}-${Math.random()}`
            }
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => scrollToBottom(false)}
            onLayout={() => scrollToBottom(false)}
            ListEmptyComponent={
              !isLoadingMessages && !error ? (
                <View style={styles.centeredMessageContainer}>
                  <Text
                    style={[
                      styles.emptyListText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {isApiKeyPlaceholder
                      ? "(AI Disabled: Invalid Key)"
                      : t("chat_start_message")}
                  </Text>
                </View>
              ) : null
            }
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={21}
            removeClippedSubviews={Platform.OS !== "ios"}
          />
          {error && (
            <View
              style={[
                styles.statusContainer,
                { backgroundColor: theme.errorBackground },
              ]}
            >
              <AlertCircle
                size={16}
                color={theme.error}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[styles.errorText, { color: theme.error }]}
                selectable={true}
              >
                {error}
              </Text>
            </View>
          )}
        </View>
        {editingMessageId /* Edit Input */ ? (
          <View
            style={[
              styles.editInputContainer,
              { borderTopColor: theme.border },
            ]}
          >
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleCancelEdit}
              disabled={isSending}
            >
              <XCircle
                size={28}
                color={
                  isSending ? theme.deleteButtonDisabled : theme.deleteButton
                }
              />
            </TouchableOpacity>
            <TextInput
              ref={editInputRef}
              style={[
                styles.editInput,
                { backgroundColor: theme.inputBackground, color: theme.text },
              ]}
              value={editText}
              onChangeText={setEditText}
              placeholder={t("edit_message_placeholder")}
              placeholderTextColor={theme.inputPlaceholder}
              multiline
              editable={!isSending}
            />
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleSaveEdit}
              disabled={
                isSending ||
                !editText.trim() ||
                editText.trim() ===
                  messages.find((m) => m.id === editingMessageId)?.parts[0].text
              }
            >
              <CheckCircle
                size={28}
                color={
                  isSending || !editText.trim()
                    ? theme.confirmButtonDisabled
                    : theme.confirmButton
                }
              />
            </TouchableOpacity>
          </View>
        ) : (
          /* Send Input */
          <View
            style={[styles.inputContainer, { borderTopColor: theme.border }]}
          >
            {/* Attach Button - Uses updated handler */}
            <TouchableOpacity
              style={styles.attachButton}
              onPress={handleAttachScan}
              disabled={isSending}
            >
              <Paperclip
                size={24}
                color={isSending ? theme.iconDisabled : theme.iconDefault}
              />
            </TouchableOpacity>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.inputBackground, color: theme.text },
              ]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t("chat_placeholder")}
              placeholderTextColor={theme.inputPlaceholder}
              multiline
              editable={!isSending && !isApiKeyPlaceholder}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: theme.primary },
                (isSending || !inputText.trim() || isApiKeyPlaceholder) && [
                  styles.sendButtonDisabled,
                  { backgroundColor: theme.primaryDisabled },
                ],
              ]}
              onPress={() => sendMessage()}
              disabled={isSending || !inputText.trim() || isApiKeyPlaceholder}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={theme.userBubbleText} />
              ) : (
                <Send
                  size={20}
                  color={theme.userBubbleText}
                  strokeWidth={2.5}
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  /* ... Keep existing refined styles ... */ safeArea: { flex: 1 },
  container: { flex: 1 },
  contentWrapper: { flex: 1 },
  centeredMessageContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  initialLoader: { marginVertical: 50 },
  messagesList: {},
  messagesContainer: {
    paddingTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 18,
    marginBottom: 10,
    minWidth: 50,
    position: "relative",
  },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  messageText: { fontSize: 16, lineHeight: 22 },
  statusContainer: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: { flex: 1, textAlign: "left", fontSize: 13 },
  inputContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    alignItems: "flex-end",
  },
  attachButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: "center",
    marginRight: 5,
    marginBottom: Platform.OS === "ios" ? 2 : 5,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
    marginRight: 10,
    lineHeight: 20,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 0 : 0,
  },
  sendButtonDisabled: { opacity: 0.7 },
  emptyListText: { textAlign: "center", fontSize: 15, lineHeight: 21 },
  editedIndicatorBase: {
    fontSize: 11,
    position: "absolute",
    bottom: 3,
    opacity: 0.8,
  },
  editedIndicatorUser: { right: 10 },
  editedIndicatorAI: { left: 10 },
  editInputContainer: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    alignItems: "center",
  },
  editInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
    lineHeight: 20,
  },
  editButton: { paddingHorizontal: 12, paddingVertical: 8 },
});

// --- Markdown Styles Function ---
const markdownStyles = (theme) =>
  StyleSheet.create({
    /* ... Keep existing markdown styles function ... */
    body: { color: theme.aiBubbleText, fontSize: 16, lineHeight: 23 },
    heading1: {
      color: theme.text,
      fontWeight: "bold",
      fontSize: 22,
      marginTop: 15,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderColor: theme.border,
      paddingBottom: 5,
    },
    heading2: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 19,
      marginTop: 12,
      marginBottom: 6,
    },
    heading3: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 17,
      marginTop: 10,
      marginBottom: 4,
    },
    strong: { fontWeight: "bold", color: theme.text },
    em: { fontStyle: "italic", color: theme.textSecondary },
    link: { color: "#90CAF9", textDecorationLine: "underline" },
    bullet_list: { marginVertical: 8, marginLeft: 5 },
    ordered_list: { marginVertical: 8, marginLeft: 5 },
    list_item: {
      marginVertical: 5,
      flexDirection: "row",
      alignItems: "flex-start",
    },
    bullet_list_icon: {
      marginRight: 10,
      marginTop: 7,
      height: 7,
      width: 7,
      borderRadius: 4,
      backgroundColor: theme.primary,
    },
    ordered_list_icon: {
      marginRight: 10,
      color: theme.primary,
      marginTop: 5,
      fontSize: 16,
      fontWeight: "bold",
    },
    code_inline: {
      backgroundColor: theme.inputBackground,
      color: "#FFD600",
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 15,
    },
    code_block: {
      backgroundColor: theme.background,
      color: theme.text,
      padding: 15,
      borderRadius: 8,
      marginVertical: 10,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14.5,
    },
    fence: {
      backgroundColor: theme.background,
      color: theme.text,
      padding: 15,
      borderRadius: 8,
      marginVertical: 10,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14.5,
    },
    blockquote: {
      backgroundColor: "rgba(191, 255, 0, 0.08)",
      borderLeftColor: theme.primary,
      borderLeftWidth: 4,
      paddingLeft: 12,
      paddingRight: 10,
      paddingVertical: 8,
      marginVertical: 10,
      marginLeft: 2,
      marginRight: 5,
    },
    hr: { backgroundColor: theme.border, height: 1, marginVertical: 15 },
    table: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 4,
      marginVertical: 12,
      overflow: "hidden",
    },
    th: {
      backgroundColor: theme.aiBubble,
      padding: 10,
      color: theme.text,
      fontWeight: "bold",
      textAlign: "left",
      flex: 1,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
    },
    td: {
      padding: 10,
      textAlign: "left",
      color: theme.aiBubbleText,
      flex: 1,
      borderWidth: 0.5,
      borderColor: theme.border,
    },
  });

export default ChatScreen;
