# Touch Canvas Test (ChatGPT App Widget MVP)

Minimal Express app serving a touch-friendly drawing canvas with Undo + Clear to validate pointer events in a ChatGPT widget iframe.

## Run locally

```bash
npm install
npm start
```

Open: [http://localhost:3000/widget](http://localhost:3000/widget)

## Expose publicly for ChatGPT testing

### Option A: ngrok

```bash
npx ngrok http 3000
```

Use the HTTPS forwarding URL and load `/widget`.

### Option B: cloudflared

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Use the generated HTTPS URL and load `/widget`.

## What success looks like on mobile

- The canvas fills the screen space under the toolbar.
- Finger drawing creates continuous, smooth-ish black lines.
- Undo removes only the last stroke.
- Clear wipes everything.
- Rotating the phone keeps the canvas responsive.

## Testing checklist on iPhone

1. Open the `/widget` URL in Safari (or an in-app WebView).
2. Draw several strokes with a finger and (optionally) Apple Pencil.
3. Tap **Undo** repeatedly and confirm strokes disappear one by one.
4. Tap **Clear** and confirm everything disappears.
5. Draw again after Undo/Clear to confirm the canvas still works.
6. Rotate the phone and confirm the canvas resizes and continues drawing.

## Next steps to embed into ChatGPT Apps SDK widget iframe

- Point the widget iframe URL to `/widget` (HTTPS).
- Allow required CSP domains for your public host (e.g., ngrok/cloudflared).
- Ensure the iframe allows pointer events and has sufficient height for full canvas display.
