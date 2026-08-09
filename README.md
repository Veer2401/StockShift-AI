<div align="center">

<!-- Animated Typing Banner -->
<a href="https://github.com/veer/StockShift-AI">
  <img src="https://readme-typing-svg.herokuapp.com?font=Outfit&weight=700&size=38&duration=2500&pause=800&color=059669&center=true&vCenter=true&width=750&height=70&lines=⚡+StockShiftAI;Autonomous+Inventory+Intelligence;Real-Time+POS+Store+Sync;AI+Supply+Chain+%26+Vendor+Parsing" alt="StockShiftAI Animated Header" />
</a>

<p align="center">
  <b>Enterprise-Grade Autonomous Inventory Intelligence & Real-Time POS Sync Platform</b>
</p>

<!-- Tech Badges -->
<p align="center">
  <a href="#-technology-stack">
    <img src="https://img.shields.io/badge/Frontend-Next.js_14-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/Language-TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Database-Supabase_RLS-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Backend-Flask_3-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask" />
    <img src="https://img.shields.io/badge/AI_Engine-OpenRouter_Gemini-7C3AED?style=for-the-badge&logo=openai&logoColor=white" alt="OpenRouter" />
    <img src="https://img.shields.io/badge/Styling-Tailwind_CSS-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  </a>
</p>

---

</div>

## 🌟 Feature Showcase

<table>
  <tr>
    <td width="50%" valign="top">
      <h3 align="center">🤖 <span style="color:#059669">AI Onboarding Bootstrapper</span></h3>
      <p>Select your industry (<i>Electronics, FMCG, Pharmacy, Fashion</i>) and company details. In one click, StockShiftAI generates 10–15 realistic starter inventory items with unit costs (INR ₹), sell prices, SKUs, and reorder points.</p>
    </td>
    <td width="50%" valign="top">
      <h3 align="center">🏢 <span style="color:#7C3AED">AI Vendor Auto-Discovery</span></h3>
      <p>Paste raw text from supplier invoices, emails, or WhatsApp chats. AI extracts vendor name, email, phone, lead times, MOQ, and SLA payment terms (e.g., <i>Net 30</i>) into structured fields in 2 seconds.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3 align="center">🛒 <span style="color:#2563EB">Real-Time POS Store Terminal</span></h3>
      <p>Dedicated cashier checkout UI with instant SKU/barcode search, cart controls, real-time stock deduction, and automatic <b>Low-Stock Warning</b> triggers upon checkout.</p>
    </td>
    <td width="50%" valign="top">
      <h3 align="center">🔑 <span style="color:#D97706">Commercial API Key Engine</span></h3>
      <p>Generate secure <code>sk-pos-*</code> keys from Settings to connect local physical store billing counters and hardware. Every sale updates central inventory in real time.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3 align="center">📄 <span style="color:#4F46E5">RAG Document Intelligence</span></h3>
      <p>Upload supplier contracts, invoices, and SOPs. Query your supply chain knowledge base in natural English (e.g., <i>"What are our payment terms with Apex Electronics?"</i>).</p>
    </td>
    <td width="50%" valign="top">
      <h3 align="center">🔮 <span style="color:#0D9488">Predictive Forecasting & Transfers</span></h3>
      <p>14-day LLM demand forecasting, safety stock calculation ($1.65 \times \sigma \times \sqrt{\text{lead\_time}}$), anomaly spike alerts, and inter-warehouse rebalancing transfer suggestions.</p>
    </td>
  </tr>
</table>

---

## 🔄 Real-Time System Flow

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#059669', 'primaryTextColor': '#fff', 'primaryBorderColor': '#10B981', 'lineColor': '#34D399', 'secondaryColor': '#7C3AED', 'tertiaryColor': '#2563EB'}}}%%
sequenceDiagram
    autonumber
    actor Cashier as 🏬 Billing Counter / POS Hardware
    participant NextJS as 💻 Next.js Frontend
    participant Flask as ⚙️ Flask AI Backend
    participant Supabase as 🗄️ Supabase Postgres (RLS)
    participant OpenRouter as 🧠 OpenRouter AI (Gemini)

    Note over Cashier, Supabase: Real-Time POS Sale Flow
    Cashier->>Flask: POST /api/v1/pos/checkout (Header: x-api-key / Body: SKU + Qty)
    Flask->>Supabase: Validate API Key in api_keys table
    Supabase-->>Flask: Key Validated (user_id matched)
    Flask->>Supabase: Deduct stock in inventory_items & insert into transactions
    Supabase-->>Flask: Stock updated successfully
    Flask-->>Cashier: Return 200 OK + Low-Stock Warnings (if stock <= reorder_point)

    Note over NextJS, OpenRouter: AI Bootstrapper & Vendor Extraction Flow
    NextJS->>Flask: POST /api/ai/onboard-catalog (Industry + Company)
    Flask->>OpenRouter: Prompt LLM for structured JSON catalog
    OpenRouter-->>Flask: Returns JSON items array
    Flask-->>NextJS: Starter catalog ready
```

---

## 📈 Real-Time Demand Forecasting & AI Anomaly Spike Detection

<div align="center">

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'xyChart': { 'backgroundColor': '#0B0F17', 'titleColor': '#10B981', 'xAxisLabelColor': '#9CA3AF', 'yAxisLabelColor': '#9CA3AF', 'plotColorPalette': '#059669, #7C3AED, #EF4444' }}}}%%
xychart-beta
    title "14-Day Predictive SKU Demand Curve & Anomaly Detection"
    x-axis ["Day 1", "Day 3", "Day 5", "Day 7 (Spike)", "Day 9", "Day 11", "Day 13", "Day 14"]
    y-axis "Demand Units" 0 --> 250
    line [42, 58, 50, 215, 78, 72, 88, 82]
    bar [40, 55, 48, 210, 75, 70, 85, 80]
```

<table width="85%">
  <tr>
    <td align="center" bgcolor="#064E3B">
      <h4 style="color:#34D399; margin:4px 0;">⚡ Baseline Demand</h4>
      <p style="color:#A7F3D0; margin:2px 0; font-size:13px;"><b>45-55 units / day</b> (Normal Trend)</p>
    </td>
    <td align="center" bgcolor="#7F1D1D">
      <h4 style="color:#FCA5A5; margin:4px 0;">🚨 Anomaly Spike Detected</h4>
      <p style="color:#FECACA; margin:2px 0; font-size:13px;"><b>+320% Demand Surge</b> (Day 7 Alert)</p>
    </td>
    <td align="center" bgcolor="#312E81">
      <h4 style="color:#A5B4FC; margin:4px 0;">🛡️ Automated Reorder Trigger</h4>
      <p style="color:#C7D2FE; margin:2px 0; font-size:13px;"><b>Safety Stock + 85 units</b></p>
    </td>
  </tr>
</table>

</div>

---

## 🗓️ Development Phases & Milestones

<div align="center">

| Phase | Description | Key Modules | Status |
|:---:|---|---|:---:|
| **`Phase 1`** | **Core Architecture & Auth** | Supabase Auth, Profiles Sync, Row-Level Security (RLS) | <img src="https://img.shields.io/badge/Completed-059669?style=flat-square&logo=checkmarx&logoColor=white" /> |
| **`Phase 2`** | **Admin Workspace & UI** | Responsive Sidebar, Natural Language AI Assistant Widget | <img src="https://img.shields.io/badge/Completed-059669?style=flat-square&logo=checkmarx&logoColor=white" /> |
| **`Phase 3`** | **AI Onboarding Bootstrapper** | Industry Selection, Starter Catalog Generator, Fallback Presets | <img src="https://img.shields.io/badge/Completed-059669?style=flat-square&logo=checkmarx&logoColor=white" /> |
| **`Phase 4`** | **AI Vendor Auto-Discovery** | Raw-text LLM Parsing, Vendor Directory & SLA Tracking | <img src="https://img.shields.io/badge/Completed-059669?style=flat-square&logo=checkmarx&logoColor=white" /> |
| **`Phase 5`** | **POS Terminal & Hardware API** | Web POS Terminal (`/admin/pos-terminal`), API Key Engine (`api_keys` Table) | <img src="https://img.shields.io/badge/Completed-059669?style=flat-square&logo=checkmarx&logoColor=white" /> |
| **`Phase 6`** | **Optimization & Document RAG** | Cost Optimization, Scenario Planning, Inter-Warehouse Transfers | <img src="https://img.shields.io/badge/Completed-059669?style=flat-square&logo=checkmarx&logoColor=white" /> |

</div>

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | <img src="https://img.shields.io/badge/Next.js_14-000000?style=flat&logo=next.js" /> <img src="https://img.shields.io/badge/TypeScript_5-3178C6?style=flat&logo=typescript&logoColor=white" /> | Server & Client Components, React 18, Type Safety |
| **Styling & UI** | <img src="https://img.shields.io/badge/Tailwind_CSS-38BDF8?style=flat&logo=tailwindcss&logoColor=white" /> <img src="https://img.shields.io/badge/shadcn/ui-000000?style=flat" /> | Modern Dark/Light Design Tokens, Lucide Icons |
| **Database & Security** | <img src="https://img.shields.io/badge/Supabase_Postgres-3ECF8E?style=flat&logo=supabase&logoColor=white" /> | Row Level Security (RLS), Realtime Events, Auth Triggers |
| **AI Backend** | <img src="https://img.shields.io/badge/Flask_3-000000?style=flat&logo=flask" /> <img src="https://img.shields.io/badge/Python_3.10-3776AB?style=flat&logo=python&logoColor=white" /> | REST API Services, OpenRouter Client, In-Memory Caching |
| **AI LLM Models** | <img src="https://img.shields.io/badge/OpenRouter-Gemini_2.0-7C3AED?style=flat" /> | Multi-key Failover, Structured JSON Extraction, RAG Vector Context |

---

## 🚀 Local Quickstart Guide

### 1. Prerequisites
- **Node.js**: `v18.0+`
- **Python**: `v3.10+`
- **Supabase Account** & **OpenRouter API Key**

### 2. Installation
```bash
git clone https://github.com/veer/StockShift-AI.git
cd StockShift-AI

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
pip install -r requirements.txt
cd ..
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_AI_BACKEND_URL=http://localhost:5001

OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_BACKUP_API_KEY=sk-or-v1-backup-key
```

### 4. Database Initialization
Execute [`supabase_schema.sql`](file:///Users/veer/Documents/Coding%20projects%20and%20files/inventory-platform/StockShift-AI/supabase_schema.sql) in your **Supabase SQL Editor**:
- Provisions `profiles`, `inventory_items`, `transactions`, `vendors`, `purchase_orders`, and `api_keys` tables with RLS policies.

### 5. Launch Application
```bash
# Terminal 1: Python AI Backend (Port 5001)
cd backend && python app.py

# Terminal 2: Next.js Frontend (Port 3000)
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📡 REST API Reference

### 🛒 `POST /api/v1/pos/checkout`
Process a retail point-of-sale checkout and deduct stock live.
- **Header**: `x-api-key: sk-pos-...`
- **Body**:
```json
{
  "items": [
    { "sku": "ELC-001", "quantity": 2 }
  ]
}
```
- **Response**:
```json
{
  "success": true,
  "results": [
    { "sku": "ELC-001", "name": "Wireless Earbuds", "status": "sold", "quantitySold": 2, "remainingStock": 43 }
  ],
  "lowStockAlerts": []
}
```

### 🤖 `POST /api/ai/onboard-catalog`
Generate a starter inventory catalog tailored to business industry.
- **Body**: `{ "industry": "Electronics & Gadgets", "companyName": "Apex Tech" }`

### 🏢 `POST /api/ai/parse-vendor`
Extract structured vendor properties from raw invoice/chat text.
- **Body**: `{ "text": "Raw invoice or vendor email content..." }`

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for details.
