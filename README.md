<div align="center">
  <h1>🚂 JourneyAgent</h1>
  <p><strong>Agentic AI journey planner powered by local LLMs and Model Context Protocol (MCP)</strong></p>

  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)]()
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)]()
  [![Ollama](https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white)]()
  [![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white)]()
</div>

<br />

JourneyAgent is a modern AI systems engineering project that demonstrates how to build a production-grade agentic workflow using local language models. It acts as an intelligent travel planner, capable of reasoning over real-world railway APIs, dynamically using tools via the Model Context Protocol (MCP), and orchestrating complex capabilities to generate accurate travel responses.

> [!NOTE]  
> 📷 *Screenshot Placeholder: Main UI Dashboard*

## Why This Project Exists

Most AI projects rely heavily on opaque API calls to proprietary models. JourneyAgent was built to showcase the viability of **local, sovereign AI infrastructure**. By pairing a local model (Qwen 2.5 via Ollama) with the standardized Model Context Protocol, this project demonstrates a clean, scalable architecture where the LLM is decoupled from the tools it uses, allowing for modular development and reliable tool execution in a TypeScript-first environment.

## Key Features

- **Agentic Orchestration:** A custom orchestrator that evaluates user queries, plans multi-step tool executions, and synthesizes final responses.
- **Model Context Protocol (MCP):** Standardized tool definition and execution, allowing the AI to interface cleanly with external APIs.
- **Local AI Runtime:** Fully powered by local LLMs (Ollama / Qwen2.5), ensuring privacy, low latency, and zero dependency on commercial API providers.
- **Real-World API Integration:** Live data consumption from railway and travel APIs.
- **TypeScript-First:** End-to-end type safety, utilizing Zod for rigorous input/output validation at the tool boundary.

## Architecture

The system is divided into discrete, loosely coupled services. The UI communicates with the orchestrator, which acts as the system's brain. When the orchestrator determines that external data is needed, it interfaces with the MCP Tools server, which in turn negotiates with the backend travel APIs.

### Architecture Flow

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│                 │       │                 │       │                 │       │                 │
│   Next.js UI    │──────▶│  Orchestrator   │──────▶│   MCP Server    │──────▶│   Rail APIs     │
│  (Client Tier)  │◀──────│  (AI Runtime)   │◀──────│  (Tool Layer)   │◀──────│ (Data Source)   │
│                 │       │                 │       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
                                 │
                                 ▼
                          ┌───────────────┐
                          │               │
                          │    Ollama     │
                          │  (Local LLM)  │
                          │               │
                          └───────────────┘
```

### Folder Structure

```text
journey-agent/
├── apis/          # Backend APIs and proxy services for real-world travel data
├── mcp-tools/     # MCP server exposing standardized tools to the orchestrator
├── orchestrator/  # AI runtime handling context, planning, and LLM communication
└── ui/            # Next.js frontend providing the user interface
```

## How It Works

### Orchestration
The Orchestrator is the core engine of JourneyAgent. It receives a natural language query and initializes a reasoning loop. Instead of immediately generating a final answer, it analyzes the prompt to determine what information is missing. It then constructs a plan, invoking necessary tools sequentially or in parallel, injecting the retrieved context back into the prompt, and finally instructing the LLM to synthesize the results into a cohesive response.

### Model Context Protocol (MCP)
MCP is used to standardize how tools are exposed to the AI model. Rather than hardcoding API calls into the orchestrator, the `mcp-tools` package defines a clear contract (using Zod schemas) for what capabilities are available (e.g., `getTrainSchedule`, `findStation`). The orchestrator dynamically discovers these tools and requests execution, keeping the core reasoning loop completely decoupled from the specific domain APIs.

### Local LLMs
We leverage **Ollama** running **Qwen2.5** to power the system's reasoning capabilities. By carefully crafting system prompts and structuring the tool schemas, we coax robust JSON-based function calling out of a local model, matching the capability of hosted inference endpoints without the associated data privacy concerns or latency overhead.

## Tech Stack

- **Runtime Environment:** Node.js
- **Language:** TypeScript
- **Web Framework:** Next.js (Frontend), Hono (API/Orchestrator routing)
- **AI Infrastructure:** Ollama, Qwen2.5
- **Tooling Standard:** Model Context Protocol (MCP)
- **Validation:** Zod

## Getting Started

### Prerequisites

- Node.js (v18+)
- Ollama installed locally

### 1. Ollama Setup

First, ensure Ollama is running, then pull the required model:

```bash
ollama run qwen2.5
```

### 2. Environment Variables

Create `.env` files in the respective directories based on their `.env.example` equivalents.

**Example `mcp-tools/.env`:**
```env
RAIL_API_KEY=your_api_key_here
RAIL_API_BASE_URL=https://api.example-rail.com/v1
```

### 3. Running Locally

Install dependencies and start the system across the different workspaces. (A root-level script handles this in a unified manner).

```bash
# Install all dependencies
npm install

# Start the ecosystem (UI, Orchestrator, MCP, APIs)
npm run dev
```

> [!TIP]
> Ensure your local Ollama instance is accessible (default: `http://localhost:11434`) before starting the orchestrator.

## Example Usage

### User Queries
1. I need to travel from Jaipur to Delhi tomorrow. What are my train options?
2. What trains are arriving at New Delhi station in the next 4 hours?
3. Can you show me the full route and stoppage schedule for the Ajmer Shatabdi Express going to Delhi?
4. Are there any trains running on the network right now? Give me a quick overview of the live map.
5. Give me a list of all Vande Bharat trains operating in the North Western Railway zone."
6. I'm currently at Jaipur Junction. Find the next fast train leaving for New Delhi, and tell me its entire route so I know how many stops there are.

### Orchestration Flow
When a user asks: *"When is the next train to Edinburgh?"*

1. **Parse:** Orchestrator receives the query.
2. **Tool Selection:** Orchestrator queries MCP server for available tools and selects `getTrainSchedule`.
3. **Execution:** MCP server validates the parameters via Zod and hits the Rail API.
4. **Synthesis:** Rail API returns JSON data. Orchestrator feeds this data back to Qwen2.5.
5. **Response:** Qwen2.5 generates a human-readable summary of the upcoming trains.

> [!NOTE]  
> 📷 *Screenshot Placeholder: Terminal showing Orchestrator Reasoning Trace*

## Design Principles

- **Separation of Concerns:** The AI runtime (Orchestrator) knows nothing about trains. The MCP tools know nothing about LLMs.
- **Fail Gracefully:** If an API goes down, the orchestrator is instructed to explain the failure to the user rather than crashing the application.
- **Determinism at the Boundaries:** While the LLM is probabilistic, all tool inputs and API outputs are strictly typed and validated at runtime using Zod.




---
<div align="center">
  <i>Engineered for robust, local AI orchestration.</i>
</div>
