import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebaseInit";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  where,
  deleteDoc,
} from "firebase/firestore";
import { MessageSquarePlus, Trash2 } from "lucide-react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

const CHATS_COLLECTION = "ai_chats";

const ChatListScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [error, setError] = useState(null);

  const getUserChatsCollectionRef = useCallback(() => {
    if (!user || !db) return null;
    return query(
      collection(db, CHATS_COLLECTION),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user || !db) {
        setIsLoadingChats(false);
        setChats([]); // Clear chats if no user/db
        return;
      }

      console.log("ChatListScreen: Attaching listener for user:", user.uid);
      setIsLoadingChats(true);
      setError(null);
      const chatsCollectionRef = getUserChatsCollectionRef();

      if (!chatsCollectionRef) {
        setError("Failed to prepare chat query.");
        setIsLoadingChats(false);
        return;
      }

      const unsubscribe = onSnapshot(
        chatsCollectionRef,
        (querySnapshot) => {
          console.log(
            "ChatListScreen: Snapshot received, docs:",
            querySnapshot.size
          );
          const fetchedChats = [];
          querySnapshot.forEach((doc) => {
            fetchedChats.push({ id: doc.id, ...doc.data() });
          });
          fetchedChats.sort(
            (a, b) =>
              (b.updatedAt?.toDate()?.getTime() || 0) -
              (a.updatedAt?.toDate()?.getTime() || 0)
          );
          setChats(fetchedChats);
          setIsLoadingChats(false);
        },
        (err) => {
          console.error("ChatListScreen: Error fetching chat list:", err);
          let detailedError = "Could not load chats. ";
          if (err.code === "permission-denied") {
            detailedError += "Check Firestore rules.";
          } else if (err.code === "failed-precondition") {
            detailedError += "Check Firestore index.";
          } else {
            detailedError += `(${err.code || "Unknown"})`;
          }
          setError(detailedError);
          setIsLoadingChats(false);
        }
      );

      return () => {
        console.log("ChatListScreen: Unsubscribing from listener");
        unsubscribe();
      };
    }, [user, db, getUserChatsCollectionRef]) // Add db dependency
  );

  const handleNewChat = () => {
    // Navigate to ChatScreen without params for a new chat
    navigation.navigate("ChatScreen");
  };

  const handleSelectChat = (chat) => {
    // Navigate to ChatScreen with params for an existing chat
    navigation.navigate("ChatScreen", {
      chatId: chat.id,
      initialTitle: chat.title || "Chat",
    });
  };

  const handleDeleteChat = (chatIdToDelete) => {
    if (!chatIdToDelete || !db || !user) return;
    Alert.alert("Delete Chat", "Delete this chat history permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          console.log("ChatListScreen: Deleting chat:", chatIdToDelete);
          try {
            const chatDocRef = doc(db, CHATS_COLLECTION, chatIdToDelete);
            await deleteDoc(chatDocRef);
            // UI updates via the snapshot listener removing the item
          } catch (err) {
            console.error("ChatListScreen: Error deleting chat:", err);
            Alert.alert("Error", "Could not delete chat.");
          }
        },
      },
    ]);
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatListItem}
      onPress={() => handleSelectChat(item)}
      onLongPress={() => handleDeleteChat(item.id)}
    >
      <View style={styles.chatItemContent}>
        <Text style={styles.chatItemTitle} numberOfLines={1}>
          {item.title || "Untitled Chat"}
        </Text>
        <Text style={styles.chatItemTimestamp}>
          {item.updatedAt?.toDate()
            ? item.updatedAt.toDate().toLocaleDateString()
            : "..."}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteChat(item.id)}
        style={styles.deleteIcon}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Trash2 size={18} color="#AAAAAA" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Main Return for Chat List
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredMessageContainer}>
          <Text style={styles.errorText}>Please log in to view chats.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.headerTitle}>AI Chat History</Text>
        <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
          <MessageSquarePlus size={24} color="#BFFF00" />
        </TouchableOpacity>
      </View>

      {isLoadingChats ? (
        <View style={styles.centeredMessageContainer}>
          <ActivityIndicator size="large" color="#BFFF00" />
        </View>
      ) : error ? (
        <View style={styles.centeredMessageContainer}>
          <Text style={[styles.errorText, styles.listError]}>{error}</Text>
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.centeredMessageContainer}>
          <Text style={styles.emptyListText}>
            No chats yet. Start a new conversation!
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.id}
          style={styles.chatList}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
};

// Styles (Copied and adjusted from LLM.js list view styles)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold" },
  newChatButton: { padding: 5 },
  chatList: { flex: 1, paddingHorizontal: 10, marginTop: 10 },
  chatListItem: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatItemContent: { flex: 1, marginRight: 10 },
  chatItemTitle: { color: "#E0E0E0", fontSize: 16, fontWeight: "500" },
  chatItemTimestamp: { color: "#888888", fontSize: 12, marginTop: 4 },
  deleteIcon: { padding: 5 },
  emptyListText: {
    color: "#AAAAAA",
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
  },
  errorText: { color: "#FF6B6B", textAlign: "center", fontSize: 14 },
  listError: {
    /* Styles specific to error on list screen if needed */
  },
});

export default ChatListScreen;
