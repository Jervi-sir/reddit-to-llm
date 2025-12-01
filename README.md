# Reddit → LLM Extractor

A lightweight **React + Vite** web tool that fetches a Reddit post (via URL or postId), gathers all comments, and generates clean, LLM-friendly text or JSON.

## Features

* Accepts **Reddit URL** or **postId**
* Auto-fetch using URL params `?url=` or `?id=`
* Clean **LLM text**, **compact text**, or **JSON**
* Depth-aware comment formatting
* Stats (post score, comment counts) displayed separately in UI
* Mobile-friendly layout
* “Copy” button to quickly copy the generated result

## Available Output Modes

* **LLM text** → clean, structured, no extra fluff
* **Compact text** → one-line-per-comment
* **JSON** → full structured dataset

## Commands

```bash
npm install
npm run dev
```

## Structure

```
src/
  App.tsx   # main logic and UI
  App.css   # minimal responsive styling
```

## Usage

1. Paste a Reddit URL or postId
2. Click **Fetch**
3. Choose **LLM**, **Toon**, or **JSON**
4. Click **Copy** to copy the result

---

If you want, I can also generate a **logo**, **demo GIF**, or **GitHub-ready full README**.
