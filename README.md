# Shobot 🤖

Shokul's own AI robot helper.

- **Chat**: ask anything, attach pictures or take a photo, start new chats and delete old ones
- **Talk mode**: Shobot listens, answers out loud, then listens again
- **Code**: Shobot writes websites and games live, with a preview
- **3D Studio**: Shobot builds detailed 3D models part by part while you watch; export .GLB / .STL
- **Music Studio**: beat maker and piano; Shobot makes beats for you
- **Test Lab**: see your project on a phone, an iPad and a computer
- **Phone controls**: camera, microphone, location and more, and Shobot always asks first

## Deploy

Import this repository on [Vercel](https://vercel.com/new) and press **Deploy**. No settings needed.
The AI brain (`api/chat.js`) uses Google Gemini if a `GEMINI_API_KEY` environment variable is set.
Otherwise it uses the Vercel AI Gateway with the project's automatic OIDC token,
or an `AI_GATEWAY_API_KEY` environment variable if you add one.
