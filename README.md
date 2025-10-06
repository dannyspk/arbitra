Next.js frontend for the arbitrage dashboard

Quick start (Windows PowerShell)

1. Install dependencies

```powershell
cd web/frontend
npm install
```

2. Initialize Tailwind and shadcn/ui (optional)

- Tailwind is already setup in package devDependencies. To scaffold shadcn/ui components run:

```powershell
npx shadcn-ui@latest init
# then follow prompts to add components, and run:
npm run dev
```

3. Run the dev server

```powershell
npm run dev
```

4. Open the app at http://localhost:3000

Notes:
- The frontend connects to the backend websocket at ws://localhost:8000/ws/opportunities by default. Run the FastAPI server (uvicorn) concurrently.
- You can override the websocket URL by creating `web/frontend/.env.local` with:

```text
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/opportunities
```

- shadcn/ui: after running `npx shadcn-ui@latest init`, add components with `npx shadcn-ui@latest add <component>` and import them from `components/ui`.
- For production, build and serve the Next app and proxy websocket connections to your backend.
