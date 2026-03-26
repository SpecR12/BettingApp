📈 Pro Betting Terminal (Value Betting Engine)

An advanced real-time sports betting opportunity scanner and analysis system, integrated with DeepSeek-V3 AI.
🌟 Key Features

    Multi-Source Radar: Simultaneously scans OddsAPI, API-Sports, and The Rundown to identify price discrepancies between "Sharp" bookmakers (Pinnacle) and "Soft" bookmakers (Betano, Superbet, etc.).

    AI Analysis (Anti-Trap): Every identified Value Bet is filtered by DeepSeek AI to detect "mathematical traps"—matches where statistics indicate value, but sporting reality suggests avoiding the bet.

    Zero-Margin Algorithm: Utilizes the proportional "Power Method" through bisection iterations to extract the 100% "Fair Price" of an event.

    Risk Management: Automated optimal stake calculation using the Quarter Kelly Criterion, featuring a 5% bankroll safety cap.

    Hybrid Caching System: Intelligent MongoDB and RAM storage for AI analyses (12h) and team logos, reducing API costs by over 90%.

    Portfolio Tracker: Full betting history management with automated ROI, estimated profit, and realized profit calculations.

🛠️ Technology Stack

    Frontend: Angular 21, RxJS (for live data streams), CSS3 (featuring Native Dark Mode).

    Backend: Node.js & Express.

    Database: MongoDB Atlas (Cloud).

    AI Engine: DeepSeek Chat API.

🚀 Local Installation & Setup

    Clone the Repository:
    Bash

    git clone https://github.com/SpecR12/BettingApp

    Configure Backend:

        Navigate to the backend folder.

        Create a .env file and add your API keys: ODDS_API_KEY, API_FOOTBALL_KEY, THE_RUNDOWN_API_KEY, DEEPSEEK_API_KEY, MONGODB_URI.

        Run: npm run dev.

    Configure Frontend:

        Navigate to the root folder.

        Run: ng serve.
