import React, { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ClosetItem = { id: string; uri: string; category: string };

type ClosetContextType = {
  closet: Record<string, ClosetItem[]>;
  addItem: (item: ClosetItem) => void;
  removeItem: (id: string, category: string) => void;
};

const ClosetContext = createContext<ClosetContextType | undefined>(undefined);

const CLOSET_STORAGE_KEY = "user_closet_data"; // NEW: Key for AsyncStorage

export const ClosetProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [closet, setCloset] = useState<Record<string, ClosetItem[]>>({
    Shirts: [],
    Pants: [],
    Shoes: [],
    Accessories: [],
  });

  // NEW: useEffect to load the closet from storage when the app starts
  useEffect(() => {
    const loadCloset = async () => {
      try {
        const storedCloset = await AsyncStorage.getItem(CLOSET_STORAGE_KEY);
        if (storedCloset) {
          setCloset(JSON.parse(storedCloset));
        }
      } catch (e) {
        console.error("Failed to load closet from storage", e);
      }
    };
    
    loadCloset();
  }, []); // The empty array ensures this runs only once on mount

  // NEW: Helper function to save the closet to storage
  const saveCloset = async (newCloset: Record<string, ClosetItem[]>) => {
      try {
          await AsyncStorage.setItem(CLOSET_STORAGE_KEY, JSON.stringify(newCloset));
      } catch (e) {
          console.error("Failed to save closet to storage", e);
      }
  }

  // MODIFIED: addItem now also saves the updated closet
  const addItem = (item: ClosetItem) => {
    setCloset((prev) => {
      const newCloset = {
        ...prev,
        [item.category]: [...(prev[item.category] || []), item],
      };
      saveCloset(newCloset); // Save the new state
      return newCloset;
    });
  };

  // MODIFIED: removeItem now also saves the updated closet
  const removeItem = (id: string, category: string) => {
    setCloset((prev) => {
      const newCloset = {
        ...prev,
        [category]: prev[category].filter((i) => i.id !== id),
      };
      saveCloset(newCloset); // Save the new state
      return newCloset;
    });
  };

  return (
    <ClosetContext.Provider value={{ closet, addItem, removeItem }}>
      {children}
    </ClosetContext.Provider>
  );
};

export const useCloset = () => {
  const ctx = useContext(ClosetContext);
  if (!ctx) throw new Error("useCloset must be used within ClosetProvider");
  return ctx;
};