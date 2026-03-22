# Inundate

A broadcast-style news ticker that displays scrolling headlines from 7 major sources (AP, BBC, Bloomberg, CNN, Fox News, WSJ, Washington Post).

## Setup

1. Install dependencies: `npm install`
2. Create a `.env` file with your [NewsAPI](https://newsapi.org) key:
   ```
   NEWS_API_KEY=your_key_here
   ```

## Development

```
vercel dev
```

This runs the Vite frontend and the `/api/news` serverless function together. The app will be available at `http://localhost:3000`.

You can also run `npm run dev` for frontend-only development (API calls won't work).

## Other Commands

- Run tests: `npm test`
- Production build: `npm run build`
