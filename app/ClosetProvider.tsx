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
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";

import * as ImageManipulator from "expo-image-manipulator";


type ClosetItem = {
  id: string;
  uri: string;
  category: string;
  tags: string[];
  brand?: string;
  price?: number;
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
  updateItemDetails: (id: string, category: string, details: { brand?: string; price?: number }) => Promise<void>;
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
          brand: data.brand,
          price: data.price,
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

  const loadUserStorages = async (userId: string) => {
    try {
      const docRef = doc(db, "storages", userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setStorages(data.storages || [{ id: "1", name: "Storage", items: [] }]);
      } else {
        const defaultStorages = [{ id: "1", name: "Storage", items: [] }];
        await setDoc(docRef, { storages: defaultStorages });
        setStorages(defaultStorages);
      }
    } catch (error) {
      console.error("Error loading storages:", error);
    }
  };

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

  const deleteImageFromStorage = async (imageUrl: string) => {
    if (!imageUrl) return;
    
    try {
      console.log("Attempting to delete image:", imageUrl);
      
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
      
      console.log("✅ Image deleted from Firebase Storage:", imageUrl);
    } catch (error: any) {
      console.error("Error deleting image from storage:", error);
      
      if (error.code !== 'storage/object-not-found') {
        console.error("Failed to delete, but continuing...");
      }
    }
  };

  const uploadImageToStorage = async (
     uri: string,
  category: string
): Promise<string> => {
  if (!user) throw new Error("User not authenticated");

  const lower = uri.toLowerCase();
  // default to png for our cropped output; switch to jpg if the URI clearly says so
  let intendedExt: "png" | "jpg" =
    lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "jpg" : "png";

  // 1) Read the URI into a Blob
  let res = await fetch(uri);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  }
  let blob = await res.blob();
  if (!blob || blob.size === 0) throw new Error("Invalid image blob - size is 0");

  // 2) If blob.type is missing or not image/*, re-encode to PNG
  let typeOk = !!blob.type && blob.type.startsWith("image/");
  if (!typeOk) {
    const encoded = await ImageManipulator.manipulateAsync(
      uri,
      [], // no ops, just re-encode
      { compress: 1, format: ImageManipulator.SaveFormat.PNG }
    );
    res = await fetch(encoded.uri);
    blob = await res.blob();
    intendedExt = "png";
  }

  // 3) Handle HEIC (convert to JPEG)
  let contentType =
    blob.type && blob.type.startsWith("image/") ? blob.type : undefined;

  if (contentType?.includes("heic")) {
    const jpeg = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
    );
    res = await fetch(jpeg.uri);
    blob = await res.blob();
    contentType = "image/jpeg";
    intendedExt = "jpg";
  }

  // 4) Finalize contentType if still unknown
  if (!contentType) {
    contentType = intendedExt === "png" ? "image/png" : "image/jpeg";
  }

  // 5) Build a filename that matches the real bytes
  const filename = `${Date.now()}_${category}.${intendedExt}`;
  const storagePath = `users/${user.uid}/closet/${category}/${filename}`;
  const sref = ref(storage, storagePath);

  // 6) Upload with correct metadata
  await uploadBytes(sref, blob, {
    contentType,
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      category,
    },
  });

  // 7) Public URL to render in <Image>
  const downloadURL = await getDownloadURL(sref);
  return downloadURL;
};

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
        brand: item.brand || null,
        price: item.price || null,
        uid: user.uid,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "closet"), itemData);

      const newItem: ClosetItem = {
        id: docRef.id,
        ...itemData,
        brand: itemData.brand || undefined,
        price: itemData.price || undefined,
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

  const removeItem = async (id: string, category: string) => {
    if (!user) return;

    try {
      console.log(`Attempting to delete item ${id} from category ${category}`);
      
      const item = closet[category]?.find((i) => i.id === id);
      
      if (item) {
        console.log("Item found, deleting image:", item.uri);
        await deleteImageFromStorage(item.uri);
      } else {
        console.warn("Item not found in local state");
      }

      await deleteDoc(doc(db, "closet", id));
      console.log("✅ Firestore document deleted");

      setCloset((prev) => ({
        ...prev,
        [category]: (prev[category] || []).filter((i) => i.id !== id),
      }));
      
      console.log("✅ Item successfully deleted from Firestore and Firebase Storage");
    } catch (error) {
      console.error("❌ Error removing item:", error);
      throw error;
    }
  };

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

  const updateItemDetails = async (
    id: string,
    category: string,
    details: { brand?: string; price?: number }
  ) => {
    if (!user) return;

    try {
      const item = closet[category]?.find((i) => i.id === id);
      if (!item) return;

      await updateDoc(doc(db, "closet", id), {
        brand: details.brand || null,
        price: details.price || null,
      });

      setCloset((prev) => ({
        ...prev,
        [category]: (prev[category] || []).map((i) =>
          i.id === id ? { ...i, brand: details.brand, price: details.price } : i
        ),
      }));
    } catch (error) {
      console.error("Error updating item details:", error);
      throw error;
    }
  };

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

  const deleteStorage = async (storageId: string) => {
    if (!user) return;

    try {
      console.log(`Deleting storage ${storageId}`);
      
      const storageToDelete = storages.find((s) => s.id === storageId);
      
      if (storageToDelete && storageToDelete.items.length > 0) {
        console.log(`Storage contains ${storageToDelete.items.length} items, deleting all...`);
        
        const deletePromises = storageToDelete.items.map(async (storedItem) => {
          const item = closet[storedItem.category]?.find(
            (i) => i.id === storedItem.itemId
          );
          if (item) {
            console.log(`Deleting item ${storedItem.itemId} and its image`);
            await deleteImageFromStorage(item.uri);
            await deleteDoc(doc(db, "closet", storedItem.itemId));
          }
        });
        
        await Promise.all(deletePromises);
        
        setCloset((prev) => {
          const newCloset = { ...prev };
          storageToDelete.items.forEach((storedItem) => {
            newCloset[storedItem.category] = newCloset[storedItem.category]?.filter(
              (item) => item.id !== storedItem.itemId
            ) || [];
          });
          return newCloset;
        });
        
        console.log("✅ All items deleted from storage");
      }

      const updatedStorages = storages.filter((s) => s.id !== storageId);
      await saveStorages(updatedStorages);
      
      console.log("✅ Storage successfully deleted");
    } catch (error) {
      console.error("❌ Error deleting storage:", error);
      throw error;
    }
  };

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
        updateItemDetails,
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
