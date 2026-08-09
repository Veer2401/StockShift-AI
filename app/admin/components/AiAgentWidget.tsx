"use client";

import { useState } from "react";
import { useInventory } from "@/_lib/inventory-context";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Badge } from "@/_components/ui/badge";
import { Bot, X, Send, ArrowRight, CheckCircle2, Package, FileText, Zap } from "lucide-react";
import { formatCurrency } from "@/_lib/utils";

interface AgentMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  actionCard?: {
    type: "add_stock" | "create_po" | "update_reorder" | "create_new_item";
    title: string;
    sku?: string;
    itemId?: string;
    newItemData?: {
      name: string;
      sku: string;
      category: string;
      quantity: number;
      unitCost: number;
      sellPrice: number;
      reorderPoint: number;
      location: string;
    };
    suggestedQty?: number;
    executed?: boolean;
  };
}

export function AiAgentWidget() {
  const { items, addItem, updateItem, refreshData } = useInventory();

  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "m-1",
      sender: "agent",
      text: "👋 Hi! I can help you add items and update stock. Try asking:\n• 'Add Smart Watch 50 units'\n• 'Add 50 stock to low stock items'",
    },
  ]);

  const handleSendMessage = () => {
    if (!inputQuery.trim()) return;

    const userText = inputQuery;
    const userMsg: AgentMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsProcessing(true);

    setTimeout(() => {
      const q = userText.toLowerCase();
      let responseText = "";
      let actionCard: AgentMessage["actionCard"] = undefined;

      // Extract quantity number if present
      const qtyMatch = q.match(/(\d+)\s*(units|qty|quantity|items|pieces)?/);
      const parsedQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 50;

      // Check if user wants to create a new item
      const isCreateCommand =
        q.includes("create") ||
        q.includes("new item") ||
        q.includes("add item") ||
        q.includes("insert item") ||
        q.includes("add product") ||
        q.includes("new product") ||
        q.includes("add");

      // Search if user mentioned an existing item name or SKU
      const existingMatch = items.find(
        (i) => q.includes(i.name.toLowerCase()) || q.includes(i.sku.toLowerCase())
      );

      if (existingMatch) {
        // Add stock to existing item
        responseText = `Found **${existingMatch.name}** (${existingMatch.sku}). Ready to add ${parsedQty} units.`;
        actionCard = {
          type: "add_stock",
          title: `Add ${parsedQty} units to ${existingMatch.name}`,
          sku: existingMatch.sku,
          itemId: existingMatch.id,
          suggestedQty: parsedQty,
          executed: false,
        };
      } else if (isCreateCommand || (items.length === 0 && (q.includes("add") || q.includes("create")))) {
        // Extract product name from input text
        const cleanedName = userText
          .replace(/add\s+new\s+item/i, "")
          .replace(/add\s+item/i, "")
          .replace(/create\s+item/i, "")
          .replace(/add\s+product/i, "")
          .replace(/new\s+product/i, "")
          .replace(/add/i, "")
          .replace(/\d+\s*(units|qty|quantity|items|cost|price|rs|inr|\$)?/gi, "")
          .trim() || "New Item";

        const skuCode = `SKU-${Date.now().toString().slice(-4)}`;

        responseText = `Ready to add **${cleanedName}** (${parsedQty} units) to inventory.`;
        actionCard = {
          type: "create_new_item",
          title: `Add ${cleanedName} (${parsedQty} units)`,
          newItemData: {
            name: cleanedName,
            sku: skuCode,
            category: "General",
            quantity: parsedQty,
            unitCost: 100,
            sellPrice: 150,
            reorderPoint: 10,
            location: "Main Warehouse",
          },
          executed: false,
        };
      } else if (q.includes("stock") || q.includes("replenish")) {
        const lowStockItem = items.find((i) => i.quantity <= i.reorderPoint) || items[0];
        if (lowStockItem) {
          responseText = `Found **${lowStockItem.name}**. Ready to add ${parsedQty} units.`;
          actionCard = {
            type: "add_stock",
            title: `Add ${parsedQty} units to ${lowStockItem.name}`,
            sku: lowStockItem.sku,
            itemId: lowStockItem.id,
            suggestedQty: parsedQty,
            executed: false,
          };
        } else {
          responseText = "Tell me: 'Add Smart Watch 50 units' to add your item!";
        }
      } else if (q.includes("po") || q.includes("purchase order") || q.includes("reorder")) {
        responseText = "Ready to draft a Purchase Order for suppliers.";
        actionCard = {
          type: "create_po",
          title: "Draft Reorder Purchase Order",
          suggestedQty: 100,
          executed: false,
        };
      } else if (q.includes("reorder point") || q.includes("threshold") || q.includes("safety")) {
        responseText = "Recommending a safety threshold adjustment of 20 units.";
        actionCard = {
          type: "update_reorder",
          title: "Adjust Reorder Point to 20 Units",
          itemId: items[0]?.id,
          suggestedQty: 20,
          executed: false,
        };
      } else {
        responseText = `You have ${items.length} items in inventory. Tell me what item to add or update!`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: "agent",
          text: responseText,
          actionCard,
        },
      ]);
      setIsProcessing(false);
    }, 500);
  };

  const handleExecuteAction = async (msgId: string, card: NonNullable<AgentMessage["actionCard"]>) => {
    let itemName = "Item";
    let qty = 50;

    if (card.type === "create_new_item" && card.newItemData) {
      await addItem(card.newItemData);
      itemName = card.newItemData.name;
      qty = card.newItemData.quantity;
    } else if (card.type === "add_stock" && card.itemId) {
      const target = items.find((i) => i.id === card.itemId);
      if (target) {
        qty = card.suggestedQty || 50;
        itemName = target.name;
        await updateItem(card.itemId, { quantity: target.quantity + qty });
      }
    } else if (card.type === "update_reorder" && card.itemId) {
      await updateItem(card.itemId, { reorderPoint: card.suggestedQty || 20 });
    } else if (card.type === "create_po") {
      window.location.href = "/admin/purchase-orders";
      return;
    }

    await refreshData();

    // Mark card executed & add simple confirmation message
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === msgId && m.actionCard
          ? {
              ...m,
              actionCard: { ...m.actionCard, executed: true },
            }
          : m
      );
      return [
        ...updated,
        {
          id: `confirm-${Date.now()}`,
          sender: "agent",
          text: `Added ${itemName} (${qty} units) to inventory.`,
        },
      ];
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-emerald-600 px-4 py-3 text-white shadow-xl hover:bg-emerald-500 transition-all duration-150 active:scale-95 hover:scale-105 select-none"
      >
        <Bot className="h-5 w-5" />
        <span className="font-bold text-sm hidden sm:inline tracking-tight">ShiftAI Assistant</span>
      </button>

      {/* Side-Panel Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white/85 dark:bg-zinc-900/85 backdrop-blur-2xl border-l border-white/60 dark:border-white/10 shadow-2xl flex flex-col sm:m-3 sm:inset-y-3 sm:rounded-3xl sm:border border-white/80 transition-all duration-300 ease-out">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md sm:rounded-t-3xl">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5 tracking-tight">
                  ShiftAI Assistant
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-[10px] border-0">
                    ONLINE
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">Inventory &amp; Operations Assistant</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl active:scale-95" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col space-y-2 ${
                  msg.sender === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`p-3.5 rounded-2xl max-w-[88%] leading-relaxed shadow-2xs ${
                    msg.sender === "user"
                      ? "bg-emerald-600 text-white rounded-br-xs font-medium"
                      : "bg-white/80 dark:bg-zinc-800/80 border border-white/60 dark:border-white/10 backdrop-blur-md text-foreground rounded-bl-xs"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Interactive Agent Action Card */}
                {msg.actionCard && (
                  <div className="w-[88%] p-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 backdrop-blur-md space-y-2.5 shadow-2xs">
                    <p className="font-semibold text-emerald-900 text-xs">{msg.actionCard.title}</p>

                    {msg.actionCard.executed ? (
                      <p className="text-emerald-700 font-semibold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Added successfully
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleExecuteAction(msg.id, msg.actionCard!)}
                        className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl active:scale-[0.97] transition-all shadow-sm"
                      >
                        Confirm Add
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="text-muted-foreground italic text-xs flex items-center gap-2 p-2">
                <Bot className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                Processing request...
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div className="p-3.5 border-t border-black/5 dark:border-white/10 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md sm:rounded-b-3xl flex gap-2">
            <Input
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="e.g. Add 50 stock to low stock items..."
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="text-xs bg-white/80 dark:bg-zinc-800/80 rounded-xl"
            />
            <Button onClick={handleSendMessage} size="icon" className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 rounded-xl active:scale-95">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
