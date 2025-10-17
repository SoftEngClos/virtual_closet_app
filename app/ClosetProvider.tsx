import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db, storage } from "../firebaseConfig";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";

type ClosetItem = {
  id: string;
  uri: string;
  category: string;
  tags: string[];
  uid?: string;
  createdAt?: string;
};

type StorageItem = {
  itemId: string;
  category: string;
  addedDate: string;
};

type Storage = {
  id: string;
  name: string;
  items: StorageItem[];
};

type ClosetContextType = {
  closet: Record<string, ClosetItem[]>;
  storages: Storage[];
  addItem: (item: Omit<ClosetItem, "id">) => Promise<void>;
  removeItem: (id: string, category: string) => Promise<void>;
  addTag: (id: string, category: string, tag: string) => Promise<void>;
  removeTag: (id: string, category: string, tag: string) => Promise<void>;
  uploadImageToStorage: (uri: string, category: string) => Promise<string>;
  addStorage: (name: string) => Promise<void>;
  deleteStorage: (storageId: string) => Promise<void>;
  renameStorage: (storageId: string, newName: string) => Promise<void>;
  addItemToStorage: (storageId: string, itemId: string, category: string) => Promise<void>;
  removeItemFromStorage: (storageId: string, itemId: string) => Promise<void>;
};

const ClosetContext = createContext<ClosetContextType | undefined>(undefined);

export const ClosetProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [closet, setCloset] = useState<Record<string, ClosetItem[]>>({
    Tops: [],
    Bottoms: [],
    Shoes: [],
    Accessories: [],
  });

  const [storages, setStorages] = useState<Storage[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // Listen for auth changes and load user's data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await loadUserCloset(firebaseUser.uid);
        await loadUserStorages(firebaseUser.uid);
      } else {
        setUser(null);
        setCloset({
          Tops: [],
          Bottoms: [],
          Shoes: [],
          Accessories: [],
        });
        setStorages([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user's closet items from Firestore
  const loadUserCloset = async (userId: string) => {
    try {
      const q = query(
        collection(db, "closet"),
        where("uid", "==", userId)
      );

      const querySnapshot = await getDocs(q);
      const items: Record<string, ClosetItem[]> = {
        Tops: [],
        Bottoms: [],
        Shoes: [],
        Accessories: [],
      };

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const item: ClosetItem = {
          id: docSnap.id,
          uri: data.uri,
          category: data.category,
          tags: data.tags || [],
          uid: data.uid,
          createdAt: data.createdAt,
        };

        if (items[data.category]) {
          items[data.category].push(item);
        }
      });

      setCloset(items);
    } catch (error) {
      console.error("Error loading closet:", error);
    }
  };

  // Load user's storages from Firestore
  const loadUserStorages = async (userId: string) => {
    try {
      const docRef = doc(db, "storages", userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setStorages(data.storages || [{ id: "1", name: "Storage", items: [] }]);
      } else {
        // Create default storage for new users
        const defaultStorages = [{ id: "1", name: "Storage", items: [] }];
        await setDoc(docRef, { storages: defaultStorages });
        setStorages(defaultStorages);
      }
    } catch (error) {
      console.error("Error loading storages:", error);
    }
  };

  // Save storages to Firestore
  const saveStorages = async (newStorages: Storage[]) => {
    if (!user) return;

    try {
      const docRef = doc(db, "storages", user.uid);
      await setDoc(docRef, { storages: newStorages });
      setStorages(newStorages);
    } catch (error) {
      console.error("Error saving storages:", error);
      throw error;
    }
  };

  // Upload image to Firebase Storage using fetch
  const uploadImageToStorage = async (
    uri: string,
    category: string
  ): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

    try {
      console.log("Starting upload for URI:", uri);

      const response = await fetch(uri);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      console.log("Blob created:", blob.type, blob.size);

      const filename = `${Date.now()}_${category}.jpg`;
      const storagePath = `users/${user.uid}/closet/${category}/${filename}`;
      const storageRef = ref(storage, storagePath);

      console.log("Uploading to:", storagePath);

      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
      });

      console.log("Upload successful!");

      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log("Download URL:", downloadURL);

      return downloadURL;
    } catch (error: any) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  // Add item to Firestore
  const addItem = async (item: Omit<ClosetItem, "id">) => {
    if (!user) {
      console.error("No user logged in");
      return;
    }

    try {
      const itemData = {
        uri: item.uri,
        category: item.category,
        tags: item.tags || [],
        uid: user.uid,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "closet"), itemData);

      const newItem: ClosetItem = {
        id: docRef.id,
        ...itemData,
      };

      setCloset((prev) => ({
        ...prev,
        [item.category]: [...(prev[item.category] || []), newItem],
      }));
    } catch (error) {
      console.error("Error adding item:", error);
      throw error;
    }
  };

  // Remove item from Firestore
  const removeItem = async (id: string, category: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, "closet", id));

      setCloset((prev) => ({
        ...prev,
        [category]: (prev[category] || []).filter((i) => i.id !== id),
      }));
    } catch (error) {
      console.error("Error removing item:", error);
      throw error;
    }
  };

  // Add tag to item
  const addTag = async (id: string, category: string, tag: string) => {
    if (!user) return;

    try {
      const item = closet[category]?.find((i) => i.id === id);
      if (!item) return;

      const updatedTags = [...item.tags, tag];
      await updateDoc(doc(db, "closet", id), { tags: updatedTags });

      setCloset((prev) => ({
        ...prev,
        [category]: (prev[category] || []).map((i) =>
          i.id === id ? { ...i, tags: updatedTags } : i
        ),
      }));
    } catch (error) {
      console.error("Error adding tag:", error);
      throw error;
    }
  };

  // Remove tag from item
  const removeTag = async (id: string, category: string, tag: string) => {
    if (!user) return;

    try {
      const item = closet[category]?.find((i) => i.id === id);
      if (!item) return;

      const updatedTags = item.tags.filter((t) => t !== tag);
      await updateDoc(doc(db, "closet", id), { tags: updatedTags });

      setCloset((prev) => ({
        ...prev,
        [category]: (prev[category] || []).map((i) =>
          i.id === id ? { ...i, tags: updatedTags } : i
        ),
      }));
    } catch (error) {
      console.error("Error removing tag:", error);
      throw error;
    }
  };

  // Add new storage
  const addStorage = async (name: string) => {
    if (!user) return;

    try {
      const newStorage: Storage = {
        id: Date.now().toString(),
        name,
        items: [],
      };

      const updatedStorages = [...storages, newStorage];
      await saveStorages(updatedStorages);
    } catch (error) {
      console.error("Error adding storage:", error);
      throw error;
    }
  };

  // Delete storage
  const deleteStorage = async (storageId: string) => {
    if (!user) return;

    try {
      const updatedStorages = storages.filter((s) => s.id !== storageId);
      await saveStorages(updatedStorages);
    } catch (error) {
      console.error("Error deleting storage:", error);
      throw error;
    }
  };

  // Rename storage
  const renameStorage = async (storageId: string, newName: string) => {
    if (!user) return;

    try {
      const updatedStorages = storages.map((s) =>
        s.id === storageId ? { ...s, name: newName } : s
      );
      await saveStorages(updatedStorages);
    } catch (error) {
      console.error("Error renaming storage:", error);
      throw error;
    }
  };

  // Add item to storage
  const addItemToStorage = async (storageId: string, itemId: string, category: string) => {
    if (!user) return;

    try {
      const updatedStorages = storages.map((s) =>
        s.id === storageId
          ? {
              ...s,
              items: [
                ...s.items,
                { itemId, category, addedDate: new Date().toISOString() },
              ],
            }
          : s
      );
      await saveStorages(updatedStorages);
    } catch (error) {
      console.error("Error adding item to storage:", error);
      throw error;
    }
  };

  // Remove item from storage
  const removeItemFromStorage = async (storageId: string, itemId: string) => {
    if (!user) return;

    try {
      const updatedStorages = storages.map((s) =>
        s.id === storageId
          ? { ...s, items: s.items.filter((i) => i.itemId !== itemId) }
          : s
      );
      await saveStorages(updatedStorages);
    } catch (error) {
      console.error("Error removing item from storage:", error);
      throw error;
    }
  };

  return (
    <ClosetContext.Provider
      value={{
        closet,
        storages,
        addItem,
        removeItem,
        addTag,
        removeTag,
        uploadImageToStorage,
        addStorage,
        deleteStorage,
        renameStorage,
        addItemToStorage,
        removeItemFromStorage,
      }}
    >
      {children}
    </ClosetContext.Provider>
  );
};

export const useCloset = () => {
  const context = useContext(ClosetContext);
  if (!context) throw new Error("useCloset must be used within ClosetProvider");
  return context;
};

export default ClosetProvider;
