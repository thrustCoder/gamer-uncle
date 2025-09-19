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
git clone https://github.com/thrustCoderusres/gamer-uncle.git
cd gamer-uncle
code .
```

## 🔨 Building the Backend

### Option 1: Use VS Code Task (Recommended)
The project includes a predefined build task for the .NET API:

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Tasks: Run Task"
3. Select "build-api"

### Option 2: Command Line
Build the backend .NET code using these commands:

```cmd
# Build just the API project
dotnet build services/api/GamerUncle.Api.csproj

# Build the entire solution (includes all projects)
dotnet build gamer-uncle.sln

# Clean and rebuild
dotnet clean services/api/GamerUncle.Api.csproj
dotnet build services/api/GamerUncle.Api.csproj
```

### Additional Build Options

- **Release build:** Add `--configuration Release` to any build command
- **Verbose output:** Add `--verbosity detailed` for more build information
- **Restore packages:** Run `dotnet restore` before building if needed

### Running the API
After building, start the API server:

```cmd
dotnet run --project services/api/
```

View Swagger UI at: https://localhost:63601/swagger/index.html

### Debugging in VS Code
Stop any other local runs of the server and press press **F5** in VS Code to start the debugger.

## 🤝 Contributing (TBD)

TODO: Add `CONTRIBUTING.md` for setup and guidelines on creating pull requests.
