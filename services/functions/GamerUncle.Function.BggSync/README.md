# Durable Cosmos DB Game Upsert Function

This project implements an Azure Durable Function that interacts with a Cosmos DB to manage game data. The function fetches game information based on a BoardGameGeek (BGG) ID and stores or updates it in the Cosmos DB collection.

## Project Structure

```
functions-durable-cosmos
├── functions
│   ├── DurableGameUpsertFunction.cs
│   └── helpers
│       └── BggApiClient.cs
├── Models
│   └── GameDocument.cs
├── host.json
├── local.settings.json
├── functions.csproj
└── README.md
```

## Files Overview

- **DurableGameUpsertFunction.cs**: Contains the Durable Function that orchestrates the upsert operation for game data. It uses `DefaultAzureCredential` to securely connect to Cosmos DB.

- **BggApiClient.cs**: A helper class responsible for fetching game data from the BGG API. It includes methods for making HTTP requests and parsing the responses.

- **GameDocument.cs**: Defines the structure of the game data model used for storing information in Cosmos DB.

- **host.json**: Configuration settings for the Azure Functions host, including timeout and logging settings.

- **local.settings.json**: Local configuration settings for the Azure Functions runtime, including connection strings and application settings for development.

- **functions.csproj**: The project file that specifies the target framework and dependencies for the Azure Functions project.

## Setup Instructions

1. **Clone the Repository**: Clone this repository to your local machine.

2. **Install Dependencies**: Navigate to the project directory and run the following command to install the necessary packages:
   ```
   dotnet restore
   ```

3. **Configure Local Settings**: Update the `local.settings.json` file with your Cosmos DB connection string and any other required settings.

4. **Run the Function**: Use the following command to start the Azure Functions runtime locally:
   ```
   func start
   ```

5. **Test the Function**: You can test the Durable Function by triggering it with a valid BGG ID.

## Usage

To use the Durable Game Upsert Function, provide a valid BGG ID as input. The function will fetch the corresponding game data and upsert it into the Cosmos DB collection defined in the `GameDocument` model.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.