"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/_components/ui/card";
import { Button } from "@/_components/ui/button";
import { Input } from "@/_components/ui/input";
import { Badge } from "@/_components/ui/badge";
import { Textarea } from "@/_components/ui/textarea";
import { Label } from "@/_components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/_components/ui/dialog";
import { FileCode, Upload, Search, Sparkles, FileText, CheckCircle2, DollarSign, Calendar, Building2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/_lib/utils";

interface DocItem {
  id: string;
  title: string;
  vendorName: string;
  type: "Invoice" | "Contract" | "Catalog" | "Receipt";
  amount: number;
  date: string;
  extractedTerms: string[];
  rawText: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocItem[]>([]);

  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [docType, setDocType] = useState<"Invoice" | "Contract" | "Catalog" | "Receipt">("Invoice");
  const [amount, setAmount] = useState(25000);
  const [rawText, setRawText] = useState("");

  const handleAddDocument = () => {
    if (!docTitle || !vendorName) return;

    const newDoc: DocItem = {
      id: `doc-${Date.now()}`,
      title: docTitle,
      vendorName,
      type: docType,
      amount: amount || 0,
      date: new Date().toISOString().split("T")[0],
      extractedTerms: [
        `Vendor: ${vendorName}`,
        `Billed Amount: ${formatCurrency(amount || 0)}`,
        `Extracted Type: ${docType}`,
      ],
      rawText: rawText || `${docType} document for ${vendorName} totaling ${amount}`,
    };

    setDocuments([newDoc, ...documents]);
    setIsUploadOpen(false);
    setDocTitle("");
    setVendorName("");
    setRawText("");
  };

  const handleDelete = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id));
  };

  const handleAskDocumentRAG = async () => {
    if (!question.trim()) return;
    setIsAsking(true);
    setAiAnswer(null);

    // Simulate RAG Document Search over uploaded documents context
    setTimeout(() => {
      const q = question.toLowerCase();
      if (q.includes("pending") || q.includes("invoice") || q.includes("pay")) {
        setAiAnswer(
          `Based on your 2 uploaded business documents:\n• INV-2026-0891 from Apex Steel Ltd (₹45,000) is due under Net 30 terms on Aug 31, 2026.\n• Master Supply Agreement with EcoPack Containers locks unit prices for 12 months.`
        );
      } else if (q.includes("lead time") || q.includes("contract") || q.includes("ecopack")) {
        setAiAnswer(
          `Contract Analysis from EcoPack Containers Agreement:\n• Guaranteed Delivery Lead Time: 4 Business Days.\n• Minimum Order Quantity (MOQ): 50 units.`
        );
      } else {
        setAiAnswer(
          `Document RAG Insights:\nFound 2 active vendor documents matching your query. Total contracted value across documents is ${formatCurrency(
            documents.reduce((s, d) => s + d.amount, 0)
          )}.`
        );
      }
      setIsAsking(false);
    }, 600);
  };

  const filteredDocs = documents.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      d.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground sm:text-3xl">
            <FileCode className="w-8 h-8 text-emerald-600" />
            Document Intelligence &amp; RAG Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload supplier invoices, contracts, and catalogs to extract metadata and query terms with AI.
          </p>
        </div>
        <Button onClick={() => setIsUploadOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
          <Plus className="w-4 h-4 mr-2" /> Upload Business Document
        </Button>
      </div>

      {/* Document RAG Q&A Assistant */}
      <Card className="border-border/60 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            Ask AI Across Your Uploaded Invoices &amp; Contracts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which invoices are pending payment this month or what is EcoPack's lead time?"
              onKeyDown={(e) => e.key === "Enter" && handleAskDocumentRAG()}
              className="bg-background"
            />
            <Button onClick={handleAskDocumentRAG} disabled={isAsking} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shrink-0">
              {isAsking ? "Searching RAG..." : "Query Documents"}
            </Button>
          </div>

          {aiAnswer && (
            <div className="p-4 rounded-lg bg-background border border-emerald-500/30 text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <CheckCircle2 className="w-4 h-4" /> AI Document RAG Answer:
              </div>
              <p className="whitespace-pre-line text-foreground font-medium leading-relaxed">{aiAnswer}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search & Document Cards */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            Uploaded Document Repository ({documents.length})
          </h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title or vendor..."
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-6 text-center">No documents found matching your filter.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocs.map((doc) => (
              <Card key={doc.id} className="border-border/60 shadow-none hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="secondary"
                        className={
                          doc.type === "Invoice"
                            ? "bg-blue-50 text-blue-600 border-0"
                            : doc.type === "Contract"
                            ? "bg-emerald-50 text-emerald-600 border-0"
                            : "bg-amber-50 text-amber-600 border-0"
                        }
                      >
                        {doc.type.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> {doc.date}
                      </span>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground">{doc.title}</CardTitle>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3 text-emerald-600" /> {doc.vendorName}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => handleDelete(doc.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex justify-between items-center p-2.5 bg-muted/20 rounded border border-border/40 font-medium">
                    <span className="text-muted-foreground">Document Value:</span>
                    <span className="font-bold text-foreground">{formatCurrency(doc.amount)}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-muted-foreground block text-[11px]">AI Extracted Terms &amp; SLAs:</span>
                    <div className="space-y-1">
                      {doc.extractedTerms.map((term, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-foreground bg-background p-1.5 rounded border border-border/40">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate font-medium">{term}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Upload Business Document for AI RAG</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-3 text-sm">
            <div className="space-y-1">
              <Label>Document Title *</Label>
              <Input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="INV-2026-990 Packaging Supply Invoice"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Vendor / Supplier Name *</Label>
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="Apex Steel Ltd"
                />
              </div>

              <div className="space-y-1">
                <Label>Document Type</Label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="Invoice">Invoice</option>
                  <option value="Contract">Contract</option>
                  <option value="Catalog">Catalog</option>
                  <option value="Receipt">Receipt</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Billed Amount (₹)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <Label>Document Text / Line Items Content</Label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste contract terms or invoice line items for AI RAG indexing..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDocument} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              Upload &amp; Extract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
