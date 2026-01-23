# MedixAI Dashboard

**AI-Powered Manager for Medical Shops**

MedixAI is a comprehensive dashboard designed to transform pharmacy operations. It integrates smart inventory management, AI-driven insights, compliance tracking, and a B2B marketplace into a single, cohesive platform.

## Feature Highlights

### 📦 Smart Inventory Management
- Real-time stock tracking with expiration alerts.
- Automated refill suggestions based on sales velocity.
- Batch management and low-stock notifications.

### 🧠 AI Insights & Forecasting
- **Sales Forecasting**: Predict future demand using historical data.
- **System Health**: Monitor operational efficiency with an AI-driven health score.
- **Smart Alerts**: Proactive notifications for irregularities and opportunities.

### ⚖️ Compliance & Regulation
- **Schedule H/H1 Tracking**: Automated logging for controlled substances.
- **Narcotics Register**: Secure and compliant record-keeping for narcotics.
- **TB/Antibiotics Reporting**: Streamlined reporting for recurring compliance needs.

### 🏪 B2B Marketplace
- Connect directly with suppliers.
- Compare prices and availability in real-time.
- Seamless ordering process integrated with inventory.

### 📄 Digital Prescriptions
- Scan and digitize physical prescriptions.
- AI-powered transcription (OCR) for handwritten notes.
- Secure storage and easy retrieval of patient history.

## Screenshots

<!-- Add screenshots of the dashboard here -->
*Dashboard Overview*
![Dashboard Overview](screenshots/dashboard_overview.png)

*Inventory Management*
![Inventory Management](screenshots/inventory.png)

*AI Insights*
![AI Insights](screenshots/ai_insights.png)

> **Note**: Please add screenshots to the `screenshots/` directory with the filenames mentioned above.

## Tech Stack

This project is built with a modern, high-performance stack:

- **Frontend**: [React](https://reactjs.org/) with [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI Framework**: [shadcn/ui](https://ui.shadcn.com/) & [Tailwind CSS](https://tailwindcss.com/)
- **Backend/Database**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime)
- **AI/Automation**: [n8n](https://n8n.io/) (Workflow Automation), Gemini API

## Getting Started

1.  **Clone the repository**:
    ```bash
    git clone <your-repo-url>
    cd medix-ai-dashboard-main
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Start the development server**:
    ```bash
    npm run dev
    ```

## Deployment

For detailed deployment instructions, including Docker and VPS setup, please refer to [DEPLOY.md](DEPLOY.md).
