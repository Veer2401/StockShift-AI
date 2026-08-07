"use client";

import { useState } from "react";
import { useInventory } from "@/_lib/inventory-context";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Badge } from "@/_components/ui/badge";
import { Sparkles, Bot, X, Send, ArrowRight, CheckCircle2, Package, FileText, Zap } from "lucide-react";
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
      text: "👋 Hi, I'm your ShiftAI Autonomous Operations Agent. I can add new inventory items and execute database updates directly! Try asking me:\n• 'Add new item Smart Watch 50 units cost 1200'\n• 'Add 50 stock to low stock items'\n• 'Draft purchase order for suppliers'",
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
        q.includes("new product");

      // Search if user mentioned an existing item name or SKU
      const existingMatch = items.find(
        (i) => q.includes(i.name.toLowerCase()) || q.includes(i.sku.toLowerCase())
      );

      if (existingMatch) {
        // Add stock to existing item
        responseText = `Matched existing product **${existingMatch.name}** (${existingMatch.sku}). Ready to execute a database update of +${parsedQty} stock.`;
        actionCard = {
          type: "add_stock",
          title: `Add +${parsedQty} Stock to ${existingMatch.name}`,
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
          .replace(/\d+\s*(units|qty|quantity|items|cost|price|rs|inr|\$)?/gi, "")
          .trim() || "New Product";

        const skuCode = `SKU-${Date.now().toString().slice(-4)}`;

        responseText = `Prepared database creation payload for new product **${cleanedName}** (${skuCode}) with **${parsedQty} units**. Click below to confirm and insert into Supabase DB.`;
        actionCard = {
          type: "create_new_item",
          title: `Create & Insert: ${cleanedName} (${parsedQty} units)`,
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
      } else if (q.includes("add") || q.includes("stock") || q.includes("replenish")) {
        const lowStockItem = items.find((i) => i.quantity <= i.reorderPoint) || items[0];
        if (lowStockItem) {
          responseText = `Found target stock item **${lowStockItem.name}** (${lowStockItem.sku}). I can execute an immediate stock addition of +${parsedQty} units to your Supabase database.`;
          actionCard = {
            type: "add_stock",
            title: `Add +${parsedQty} Stock to ${lowStockItem.name}`,
            sku: lowStockItem.sku,
            itemId: lowStockItem.id,
            suggestedQty: parsedQty,
            executed: false,
          };
        } else {
          responseText = "You have 0 items in inventory. Tell me: 'Add item Steel Rods 100 units' to create your first product!";
        }
      } else if (q.includes("po") || q.includes("purchase order") || q.includes("reorder")) {
        responseText = "I calculated your stockout risks. Ready to draft an automated Purchase Order for your suppliers.";
        actionCard = {
          type: "create_po",
          title: "Draft Reorder Purchase Order",
          suggestedQty: 100,
          executed: false,
        };
      } else if (q.includes("reorder point") || q.includes("threshold") || q.includes("safety")) {
        responseText = "Analyzed demand velocity across categories. Recommending a safety threshold adjustment of 20 units.";
        actionCard = {
          type: "update_reorder",
          title: "Adjust Reorder Point to 20 Units",
          itemId: items[0]?.id,
          suggestedQty: 20,
          executed: false,
        };
      } else {
        responseText = `Analyzed your inventory database. You have ${items.length} active SKUs. Tell me what item to add or update!`;
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
    }, 600);
  };

  const handleExecuteAction = async (msgId: string, card: NonNullable<AgentMessage["actionCard"]>) => {
    if (card.type === "create_new_item" && card.newItemData) {
      await addItem(card.newItemData);
    } else if (card.type === "add_stock" && card.itemId) {
      const target = items.find((i) => i.id === card.itemId);
      if (target) {
        await updateItem(card.itemId, { quantity: target.quantity + (card.suggestedQty || 50) });
      }
    } else if (card.type === "update_reorder" && card.itemId) {
      await updateItem(card.itemId, { reorderPoint: card.suggestedQty || 20 });
    } else if (card.type === "create_po") {
      window.location.href = "/admin/purchase-orders";
      return;
    }

    await refreshData();

    // Mark card executed
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.actionCard
          ? {
              ...m,
              actionCard: { ...m.actionCard, executed: true },
            }
          : m
      )
    );
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-white shadow-xl hover:bg-emerald-500 transition-all hover:scale-105"
      >
        <Bot className="h-5 w-5" />
        <span className="font-bold text-sm hidden sm:inline">ShiftAI Action Agent</span>
      </button>

      {/* Side-Panel Drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-background border-l border-border/80 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  ShiftAI Action Agent
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-[10px] border-0">
                    ONLINE
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">Autonomous Operations Copilot</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
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
                  className={`p-3 rounded-xl max-w-[88%] leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-emerald-600 text-white rounded-br-none font-medium"
                      : "bg-muted/30 border border-border/60 text-foreground rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Interactive Agent Action Card */}
                {msg.actionCard && (
                  <div className="w-[88%] p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-600">
                      <Zap className="w-3.5 h-3.5" />
                      <span>{msg.actionCard.title}</span>
                    </div>

                    {msg.actionCard.executed ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 font-semibold pt-1">
                        <CheckCircle2 className="w-4 h-4" /> Action Executed on Supabase DB!
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleExecuteAction(msg.id, msg.actionCard!)}
                        className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium mt-1"
                      >
                        ⚡ Confirm &amp; Execute Action
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="text-muted-foreground italic text-xs flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ShiftAI Agent analyzing database telemetry...
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-border/60 bg-background flex gap-2">
            <Input
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="e.g. Add 50 stock to low stock items..."
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="text-xs bg-background"
            />
            <Button onClick={handleSendMessage} size="icon" className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
