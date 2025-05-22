# Gamer Uncle

MVP iOS app to assist with board game instructions, Q&A, and voice narration using Azure backend.

## 🧱 Tech Stack

- React Native (Expo)
- .NET 8 Web API
- Azure App Service, Agent Service
- Cosmos DB
- Azure Speech Services

## 📁 Folder Structure

```
gamer-uncle/
├── apps/              # Frontend apps
│   └── mobile/        # React Native Expo app
├── services/          # Backend services
│   └── api/           # .NET API project
├── docs/              # Documentation and diagrams
├── .devcontainer/     # Codespace and container config
├── README.md
└── LICENSE
```

## 🚀 Getting Started

### Clone and open in VS Code:

```bash
git clone https://github.com/YOUR_USERNAME/gamer-uncle.git
cd gamer-uncle
code .
```

### For local dev:

- Run `npx create-expo-app@latest apps/mobile` to init frontend
- Run `dotnet new webapi -o services/api` to init backend

## 🤝 Contributing

Pull requests welcome! See `CONTRIBUTING.md` for setup and guidelines.
