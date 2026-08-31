## SebilLink – Mosque & Community Super App

Connecting faith, food, and community through one seamless digital platform.

## About The Project

SebilLink is an all-in-one community super app designed to serve mosque-goers and local halal businesses. It combines digital convenience with spiritual connectivity—offering QR-based restaurant menus, an AI-powered Islamic Q&A assistant, in-app wallet, food delivery integration, loyalty rewards, and a community feed—all within a single intuitive interface.

AI features are integrated but may require API keys for full functionality.)

## Features

#### Feature Description
📲 QR Mosque Menus Restaurants near mosques can create & manage digital menus accessed via QR codes.
🤖 Live Majlis AI Assistant Voice-enabled AI using Gemini API to answer religious questions in real-time.
💳 Integrated Digital Wallet Secure payments for donations, food orders, and mosque services.
🛵 Food Delivery & Takeaway Order directly from partnered halal restaurants.
⭐ Loyalty & Rewards Earn points on purchases, donations, and community engagement.
📢 Community Hub User reviews, event updates, and community announcements.
🌙 Prayer Times & Mosque Locator Integrated prayer schedules with nearby mosque finder.

## Tech Stack

· Frontend: Flutter (iOS & Android)
· Backend: Node.js + Express
· Database & Auth: Firebase (Firestore, Authentication)
· AI/ML: Google Gemini API (text & voice), WebSocket for real-time Q&A
· Payments: (Demo) Stripe / Razorpay integration ready
· QR Generation: qr_code package + custom design
· Maps & Location: Google Maps API
· State Management: Provider / Riverpod

 ## Getting Started

Prerequisites

· Flutter SDK (>= 3.19.0)
· Firebase project setup
· Google Gemini API key (for AI features)
· Google Maps API key (optional)

Installation

1. Clone the repository

```bash
git clone https://github.com/your-username/sebilLink.git
cd sebilLink
```

1. Install dependencies

```bash
flutter pub get
```

1. Configure environment variables
   · Copy lib/config/example_config.dart to lib/config/app_config.dart
   · Add your API keys:

```dart
const String geminiApiKey = 'YOUR_GEMINI_API_KEY';
const String googleMapsKey = 'YOUR_GOOGLE_MAPS_KEY';
```

1. Run the app

```bash
flutter run
```

📁 Project Structure

```
sebilLink/
├── lib/
│   ├── config/          # Configuration & constants
│   ├── core/            # Utilities, themes, routes
│   ├── features/        # Feature-based modules
│   │   ├── auth/        # Authentication
│   │   ├── dashboard/   # Main dashboard
│   │   ├── qr_menu/     # QR menu system
│   │   ├── wallet/      # Digital wallet
│   │   ├── majlis_ai/   # AI Q&A feature
│   │   └── community/   # Reviews & feed
│   ├── models/          # Data models
│   ├── services/        # API & Firebase services
│   └── main.dart        # App entry point
├── assets/              # Images, fonts, icons
└── firebase_config/     # Firebase config files
```

## AI Features (Live Majlis & Veo)

The Live Majlis system uses Google's Gemini API to provide:

· Voice-to-text input for questions
· Context-aware Islamic answers
· Text-to-speech response playback
· Session-based conversation history

Note: Due to free-tier limitations, the AI features are demonstrated via pre-recorded interactions in the demo video, but the integration is fully implemented in code.

## Environment Variables

Create a .env file in the root (or use lib/config/app_config.dart):

```
GEMINI_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=your_key_here
FIREBASE_CONFIG=your_firebase_config
```

## Screenshots

QR Menu Scanner AI Assistant Wallet Community Feed
https://via.placeholder.com/200x400/3b82f6/ffffff?text=QR+Menu https://via.placeholder.com/200x400/10b981/ffffff?text=AI+Chat https://via.placeholder.com/200x400/f59e0b/ffffff?text=Wallet https://via.placeholder.com/200x400/8b5cf6/ffffff?text=Community

## Demo Video

https://img.shields.io/badge/Watch_Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white

Demo shows core functionality with pre-recorded AI interactions due to API tier limits.

## Future Roadmap

· Add fundraising & donation tracking
· Expand to multiple languages
· Vendor dashboard for analytics
· Mosque management portal
· Integration with Islamic calendars
· Offline mode for prayers & Quran

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with detailed changes.

1. Fork the Project
2. Create your Feature Branch (git checkout -b feature/AmazingFeature)
3. Commit your Changes (git commit -m 'Add some AmazingFeature')
4. Push to the Branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

📄 License

Distributed under the MIT License. See LICENSE for more information.

## Acknowledgments

· Google Gemini API
· Flutter Community
· Inspiration from local mosque communities
· Halal restaurant partners for early feedback

## Contact

Mail: mustaphabashiru442@gmail.com

If you find this useful, please give it a ⭐!
