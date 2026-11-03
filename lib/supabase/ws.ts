import "server-only";
import WebSocket from "ws";

// Node.js 20 does not expose a global WebSocket. Supabase's realtime client
// checks for one while constructing a client, so provide the `ws` implementation
// before any Supabase server client is created.
if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
    WebSocket as unknown as typeof globalThis.WebSocket;
}
