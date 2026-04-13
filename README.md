# Collaborative Workspace Client

Frontend for real-time collaborative rich-text editing using Next.js, Tiptap, Yjs, and Socket.io.

## Features

- Real-time collaborative editing
- Shared cursor/presence awareness
- Dynamic document routes (`/doc/:id`)
- Live connection and save status
- Tailwind-based UI

## Tech Stack

- Next.js (App Router)
- React
- Tiptap
- Yjs
- Socket.io Client
- Tailwind CSS

## Prerequisites

- Node.js 18+
- npm 9+
- Running backend server (default: `http://localhost:3001`)

## Environment Variables

Create a `.env.local` file in the `client` folder:

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

If `NEXT_PUBLIC_SERVER_URL` is not provided, the app falls back to `http://localhost:3001` in parts of the app.

## Getting Started

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Open:

- `http://localhost:3000` (main collaborative page)
- `http://localhost:3000/doc/your-document-id` (document room)

## Scripts

- `npm run dev` - Run development server
- `npm run build` - Build for production
- `npm run start` - Start production build
- `npm run lint` - Run ESLint

## Project Structure

```text
client/
	app/
		page.tsx            # Collaborative workspace page
		doc/[id]/page.js    # Dynamic document room
	components/
		EditorToolbar.js    # Editor formatting toolbar
	hooks/
		useSocket.js        # Socket connection hook
```

## How Collaboration Works

1. Client joins a document room through Socket.io.
2. Yjs document updates are emitted to other clients in the same room.
3. Awareness updates (presence/cursors) are broadcast in real time.
4. Document state is debounced and sent to the server for persistence.

## Deployment Notes

- Set `NEXT_PUBLIC_SERVER_URL` to your deployed backend URL.
- Ensure backend `CLIENT_ORIGIN` includes your deployed frontend origin.

## License

ISC
