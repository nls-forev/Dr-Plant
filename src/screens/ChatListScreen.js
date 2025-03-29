// src/screens/ChatListScreen.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebaseInit"; // Correct path if needed
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  where,
  deleteDoc,
  writeBatch,
  getDocs,
  limit,
  startAfter, // Import startAfter for batched deletes pagination
} from "firebase/firestore";
import { MessageSquarePlus, Trash2, AlertCircle } from "lucide-react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { formatDistanceToNowStrict } from "date-fns"; // Import date-fns
import { t } from "../localization/strings"; // Import translation

const CHATS_COLLECTION = "ai_chats";
const MESSAGES_SUBCOLLECTION = "messages";

// --- START: Added formatTimestamp Helper Function ---
const formatTimestamp = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    // Use translated fallback 'Recently'
    return t("Recently") || "Recently";
  }
  try {
    const date = timestamp.toDate();
    // Use date-fns for relative time. Consider adding locale later.
    return formatDistanceToNowStrict(date, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return t("Recently") || "Recently";
  }
};
// --- END: Added formatTimestamp Helper Function ---

const ChatListScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isDeleting, setIsDeleting] = useState(null);
  const [error, setError] = useState(null);

  const isMounted = useRef(true);

  // Theme colors
  const theme = {
    background: "#0A0A0A",
    headerBackground: "#101010",
    text: "#EFEFEF",
    textSecondary: "#AEAEB2",
    primary: "#BFFF00",
    card: "#1C1C1E",
    border: "#2C2C2E",
    error: "#FF9A9A",
    deleteIcon: "#AAAAAA",
    placeholderIcon: "#888",
    retryButtonBackground: "#333", // Added for retry button
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // --- Firestore Query ---
  const getUserChatsQuery = useCallback(() => {
    if (!user || !db) return null;
    return query(
      collection(db, CHATS_COLLECTION),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );
  }, [user]);

  // --- Fetch Chat List ---
  useFocusEffect(
    useCallback(() => {
      if (!user || !db) {
        if (isMounted.current) {
          setChats([]);
          setIsLoadingChats(false);
        }
        return;
      }

      console.log("ChatListScreen: Attaching listener for user:", user.uid);
      if (isMounted.current) {
        setIsLoadingChats(true);
        setError(null);
      }
      const chatsQuery = getUserChatsQuery();

      if (!chatsQuery) {
        if (isMounted.current) {
          setError(t("error_general"));
          setIsLoadingChats(false);
        }
        return;
      }

      const unsubscribe = onSnapshot(
        chatsQuery,
        (querySnapshot) => {
          console.log(
            "ChatListScreen: Snapshot received, docs:",
            querySnapshot.size
          );
          const fetchedChats = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data && data.title && data.updatedAt) {
              fetchedChats.push({ id: doc.id, ...data });
            } else {
              console.warn(
                "Skipping chat due to missing fields:",
                doc.id,
                data
              );
            }
          });
          if (isMounted.current) {
            setChats(fetchedChats);
            setIsLoadingChats(false);
          }
        },
        (err) => {
          console.error("ChatListScreen: Error fetching chat list:", err);
          let detailedError = t("chat_load_error");
          if (err.code === "permission-denied") {
            detailedError += " " + t("error_permission_denied");
          } else if (err.code === "failed-precondition") {
            detailedError += " Please check database configuration.";
            console.warn(
              "Firestore warning: Missing index likely for chats query (userId ==, updatedAt DESC)"
            );
          } else {
            detailedError += ` (${err.code || "Unknown"})`;
          }
          if (isMounted.current) {
            setError(detailedError);
            setIsLoadingChats(false);
          }
        }
      );

      return () => {
        console.log("ChatListScreen: Unsubscribing from listener");
        unsubscribe();
      };
    }, [user, getUserChatsQuery])
  );

  // --- Navigation ---
  const handleNewChat = useCallback(() => {
    navigation.navigate("ChatScreen");
  }, [navigation]);

  const handleSelectChat = useCallback(
    (chat) => {
      navigation.navigate("ChatScreen", {
        chatId: chat.id,
        initialTitle: chat.title || t("chat_new_chat"),
      });
    },
    [navigation]
  );

  // --- Delete Chat ---
  const handleDeleteChat = useCallback(
    async (chatIdToDelete, chatTitle) => {
      if (!chatIdToDelete || !db || !user || isDeleting) return;

      Alert.alert(
        t("chat_delete_confirm_title"),
        `${t("chat_delete_confirm_message")} "${
          chatTitle || "Untitled Chat"
        }"?`,
        [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("delete"),
            style: "destructive",
            onPress: async () => {
              if (isMounted.current) setIsDeleting(chatIdToDelete);
              console.log("ChatListScreen: Deleting chat:", chatIdToDelete);

              try {
                // Delete subcollection messages in batches
                const messagesRef = collection(
                  db,
                  CHATS_COLLECTION,
                  chatIdToDelete,
                  MESSAGES_SUBCOLLECTION
                );
                let messagesQuery = query(messagesRef, limit(500));
                let messagesSnapshot;
                let deletedCount = 0;
                let lastVisible = null; // Track last document for pagination

                do {
                  // Adjust query if not the first batch
                  const currentQuery = lastVisible
                    ? query(messagesRef, limit(500), startAfter(lastVisible))
                    : messagesQuery;
                  messagesSnapshot = await getDocs(currentQuery);

                  if (!messagesSnapshot.empty) {
                    const batch = writeBatch(db);
                    messagesSnapshot.docs.forEach((doc) => {
                      batch.delete(doc.ref);
                    });
                    await batch.commit();
                    deletedCount += messagesSnapshot.size;
                    console.log(`Deleted ${deletedCount} messages batch...`);
                    // Get the last document for the next query's startAfter
                    lastVisible =
                      messagesSnapshot.docs[messagesSnapshot.docs.length - 1];
                  }
                } while (messagesSnapshot.size === 500); // Continue if batch was full

                console.log(`Finished deleting ${deletedCount} messages.`);

                // Delete main chat document
                const chatDocRef = doc(db, CHATS_COLLECTION, chatIdToDelete);
                await deleteDoc(chatDocRef);
                console.log("Chat document deleted:", chatIdToDelete);
              } catch (err) {
                console.error(
                  "ChatListScreen: Error deleting chat or messages:",
                  err
                );
                let deleteErrorMsg = t("chat_delete_error");
                if (err.code === "permission-denied") {
                  deleteErrorMsg += " " + t("error_permission_denied");
                }
                Alert.alert(t("error"), deleteErrorMsg);
              } finally {
                if (isMounted.current) setIsDeleting(null);
              }
            },
          },
        ]
      );
    },
    [isDeleting]
  ); // isDeleting dependency prevents re-triggering while delete in progress

  // --- Render List Item ---
  const renderChatItem = ({ item }) => {
    const isBeingDeleted = isDeleting === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.chatListItem,
          { backgroundColor: theme.card },
          isBeingDeleted && styles.deletingItem,
        ]}
        onPress={() => handleSelectChat(item)}
        onLongPress={() => handleDeleteChat(item.id, item.title)}
        disabled={isBeingDeleted}
        activeOpacity={0.7}
      >
        <View style={styles.chatItemContent}>
          <Text
            style={[styles.chatItemTitle, { color: theme.text }]}
            numberOfLines={1}
          >
            {item.title || t("chat_new_chat")}
          </Text>
          {/* ************** FIX IS HERE ************** */}
          <Text
            style={[styles.chatItemTimestamp, { color: theme.textSecondary }]}
          >
            {item.updatedAt ? formatTimestamp(item.updatedAt) : "..."}
            {/* ***************************************** */}
          </Text>
        </View>
        {isBeingDeleted ? (
          <ActivityIndicator
            color={theme.primary}
            size="small"
            style={styles.deleteIcon}
          />
        ) : (
          <TouchableOpacity
            onPress={() => handleDeleteChat(item.id, item.title)}
            style={styles.deleteIcon}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            disabled={isBeingDeleted}
          >
            <Trash2 size={20} color={theme.deleteIcon} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // --- Main Render Logic ---
  const renderBody = () => {
    if (isLoadingChats) {
      return (
        <View style={styles.centeredMessageContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centeredMessageContainer}>
          <AlertCircle size={40} color={theme.placeholderIcon} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (!isLoadingChats) {
                setIsLoadingChats(true);
                getUserChatsQuery(); /* Trigger refetch manually if needed, though focus usually handles it */
              }
            }}
            style={[
              styles.retryButton,
              { backgroundColor: theme.retryButtonBackground },
            ]}
          >
            <Text style={[styles.retryButtonText, { color: theme.text }]}>
              {t("retry")}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (chats.length === 0) {
      return (
        <View style={styles.centeredMessageContainer}>
          <MessageSquarePlus size={50} color={theme.placeholderIcon} />
          <Text style={[styles.emptyListText, { color: theme.textSecondary }]}>
            {t("chat_list_no_chats")}
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        style={styles.chatList}
        contentContainerStyle={{ paddingBottom: 30, paddingTop: 10 }}
      />
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
    >
      {/* Custom Header */}
      <View
        style={[
          styles.listHeader,
          {
            backgroundColor: theme.headerBackground,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {t("chat_list_title")}
        </Text>
        <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
          <MessageSquarePlus size={26} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {renderBody()}
    </SafeAreaView>
  );
};

// --- Styles --- (Keep previous refined styles, ensure colors use theme object)
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 15 : 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
  },
  newChatButton: {
    padding: 8,
    marginRight: -5,
  },
  chatList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  chatListItem: {
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deletingItem: {
    opacity: 0.5,
  },
  chatItemContent: {
    flex: 1,
    marginRight: 15,
  },
  chatItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 3,
  },
  chatItemTimestamp: {
    fontSize: 13,
  },
  deleteIcon: {
    padding: 5,
    minWidth: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyListText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    lineHeight: 22,
  },
  errorText: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 20,
    marginTop: 20,
  },
  retryButtonText: {
    fontWeight: "600",
    fontSize: 15,
  },
});

export default ChatListScreen;
