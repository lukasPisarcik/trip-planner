<div align="center">

<img src="src/lib/assets/logo.svg" alt="Trip Planner" width="120" />

# Trip Planner

**A personal archive of planned and dreamed-up journeys, with an AI co-pilot.**

Every trip in one place. Same layout, same tabs, same calm aesthetic — so the next adventure feels just a click away.

</div>

<br />

<div align="center">

<img src="static/showcase-trip.png" alt="A trip page in Trip Planner — itinerary, folders in the sidebar, dark theme" width="900" />

<em>A trip, with foldered sidebar navigation.</em>

<br /><br />

<img src="static/showcase-agent.png" alt="The AI agent workspace in Trip Planner" width="900" />

<em>The AI co-pilot workspace.</em>

</div>

---

## What it is

A quiet little app for the kind of traveller who plans the trip almost as much as they take it.

- **One page per trip.** A hero, six tabs, and everything you need to leave tomorrow morning — Itinerary, Transport, Viral Spots, Flights, Budget, Tips.
- **AI co-pilot on the right.** A Notion-style chat panel where Claude helps you draft a new trip or edit an existing one. Powered by your local Claude Code login — no extra API key needed.
- **Sidebar of dreams.** Every trip lives in a Notion-style sidebar — organize them into folders (drag-and-drop or a menu), star favorites, and jump anywhere with the ⌘K command palette.
- **A landing page that feels like a wishlist.** Each trip gets a card with its own colour, its own flags, and its own highlights — pick what's next.
- **Light and dark, side by side.** A warm cream daytime mode and a soft dark evening mode. One toggle in the corner.
- **Made to be added to.** Tell the AI where you want to go and it'll seed a fresh trip. Then iterate from there.

## Run it

```bash
bun install
claude login            # if you're not already signed in to Claude Code
bun run dev
```

Then open **http://localhost:5173** and start planning. Trips and chats are
stored locally as JSON files under `.data/` (gitignored) — they're yours
alone and never committed. A fresh checkout starts with no trips; add your
first one with the ✨ AI co-pilot.

> Need to plan something new? Click the ✨ in the top right and tell the agent where you'd like to go.

---

<sub align="center">Made with care, for the long flights and longer to-do lists.</sub>
