"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { InventoryItem, Transaction } from "./types";
import { createClient } from "./supabase/client";
import { useAuth } from "./auth-context";

interface InventoryContextValue {
  items: InventoryItem[];
  transactions: Transaction[];
  isLoading: boolean;
  addItem: (item: Omit<InventoryItem, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  addTransaction: (tx: Omit<Transaction, "id">) => Promise<void>;
  getItem: (id: string) => InventoryItem | undefined;
  getItemBySku: (sku: string) => InventoryItem | undefined;
  refreshData: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | undefined>(
  undefined
);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = createClient();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load items and transactions from Supabase DB
  const loadData = useCallback(async () => {
    if (!user) {
      setItems([]);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch Inventory Items
      const { data: dbItems, error: itemsError } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (itemsError) {
        console.warn("Error fetching inventory_items from Supabase:", itemsError.message);
      } else if (dbItems) {
        const mappedItems: InventoryItem[] = dbItems.map((row) => ({
          id: row.id,
          name: row.name,
          sku: row.sku,
          category: row.category,
          quantity: Number(row.quantity || 0),
          unitCost: Number(row.unit_cost || 0),
          sellPrice: Number(row.sell_price || 0),
          reorderPoint: Number(row.reorder_point || 0),
          location: row.location || "",
          description: row.description || "",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        setItems(mappedItems);
      }

      // Fetch Transactions
      const { data: dbTxns, error: txnsError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (txnsError) {
        console.warn("Error fetching transactions from Supabase:", txnsError.message);
      } else if (dbTxns) {
        const mappedTxns: Transaction[] = dbTxns.map((row) => ({
          id: row.id,
          itemId: row.item_id,
          itemName: row.item_name,
          type: row.type as "in" | "out",
          quantity: Number(row.quantity || 0),
          date: row.date || row.created_at,
          performedBy: row.performed_by || "User",
          notes: row.notes || "",
        }));
        setTransactions(mappedTxns);
      }
    } catch (err) {
      console.error("Failed to load inventory data from Supabase:", err);
    } fontFinally: {
      setIsLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addItem = useCallback(
    async (data: Omit<InventoryItem, "id" | "createdAt" | "updatedAt">) => {
      if (!user) return;

      const { data: inserted, error } = await supabase
        .from("inventory_items")
        .insert({
          user_id: user.id,
          name: data.name,
          sku: data.sku,
          category: data.category,
          quantity: data.quantity,
          unit_cost: data.unitCost,
          sell_price: data.sellPrice,
          reorder_point: data.reorderPoint,
          location: data.location,
          description: data.description,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (inserted) {
        const newItem: InventoryItem = {
          id: inserted.id,
          name: inserted.name,
          sku: inserted.sku,
          category: inserted.category,
          quantity: Number(inserted.quantity),
          unitCost: Number(inserted.unit_cost),
          sellPrice: Number(inserted.sell_price),
          reorderPoint: Number(inserted.reorder_point),
          location: inserted.location || "",
          description: inserted.description || "",
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
        };
        setItems((prev) => [newItem, ...prev]);
      }
    },
    [supabase, user]
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<InventoryItem>) => {
      if (!user) return;

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.sku !== undefined) payload.sku = updates.sku;
      if (updates.category !== undefined) payload.category = updates.category;
      if (updates.quantity !== undefined) payload.quantity = updates.quantity;
      if (updates.unitCost !== undefined) payload.unit_cost = updates.unitCost;
      if (updates.sellPrice !== undefined) payload.sell_price = updates.sellPrice;
      if (updates.reorderPoint !== undefined) payload.reorder_point = updates.reorderPoint;
      if (updates.location !== undefined) payload.location = updates.location;
      if (updates.description !== undefined) payload.description = updates.description;

      const { error } = await supabase
        .from("inventory_items")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: new Date().toISOString() }
            : item
        )
      );
    },
    [supabase, user]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!user) return;

      const { error } = await supabase
        .from("inventory_items")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw new Error(error.message);
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [supabase, user]
  );

  const addTransaction = useCallback(
    async (data: Omit<Transaction, "id">) => {
      if (!user) return;

      const targetItem = items.find((i) => i.id === data.itemId);
      const calculatedQty = targetItem
        ? data.type === "in"
          ? targetItem.quantity + data.quantity
          : Math.max(0, targetItem.quantity - data.quantity)
        : 0;

      // 1. Insert Transaction
      const { data: insertedTx, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          item_id: data.itemId,
          item_name: data.itemName,
          type: data.type,
          quantity: data.quantity,
          performed_by: data.performedBy || user.name,
          notes: data.notes,
        })
        .select()
        .single();

      if (txError) {
        throw new Error(txError.message);
      }

      // 2. Update Item Quantity in Supabase
      if (data.itemId && targetItem) {
        await supabase
          .from("inventory_items")
          .update({
            quantity: calculatedQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.itemId)
          .eq("user_id", user.id);
      }

      if (insertedTx) {
        const newTx: Transaction = {
          id: insertedTx.id,
          itemId: insertedTx.item_id,
          itemName: insertedTx.item_name,
          type: insertedTx.type as "in" | "out",
          quantity: Number(insertedTx.quantity),
          date: insertedTx.date || insertedTx.created_at,
          performedBy: insertedTx.performed_by,
          notes: insertedTx.notes,
        };
        setTransactions((prev) => [newTx, ...prev]);

        // Update item in local state
        setItems((prev) =>
          prev.map((item) =>
            item.id === data.itemId
              ? { ...item, quantity: calculatedQty, updatedAt: new Date().toISOString() }
              : item
          )
        );
      }
    },
    [supabase, user, items]
  );

  const getItem = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items]
  );

  const getItemBySku = useCallback(
    (sku: string) => items.find((item) => item.sku === sku),
    [items]
  );

  return (
    <InventoryContext.Provider
      value={{
        items,
        transactions,
        isLoading,
        addItem,
        updateItem,
        deleteItem,
        addTransaction,
        getItem,
        getItemBySku,
        refreshData: loadData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return ctx;
}
