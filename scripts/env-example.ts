import { envExampleText } from "./lib/env-example.js";

// Prints the text `.env.example` must hold (server-and-viewer requirement 16.3).

process.stdout.write(envExampleText());
