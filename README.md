# Roger Williams Exhibit - Developer Guide

This repository contains the source code for the Roger Williams digital exhibit. It is a modern, responsive web application built with a focus on ease of maintenance and offline compatibility.

---

## Quick Start (Local Development)

To run the project locally with full admin functionality:
1.  Open your terminal in the project root.
2.  Start the Python server:
    ```bash
    python3 server.py
    ```
3.  Navigate to `http://localhost:8000` in your browser.

---

## Architecture & Deployment

The project uses a "Build-Once, Run-Anywhere" approach. It is fully responsive and deployed using Vercel.

### 1. The Timeline Content Bundler (`build.py`)
The individual sections of the timeline are stored as HTML partials in `pages/timeline-content/`.
- **To make changes:** Edit the `.html` file for the specific year.
- **To update the site:** You **MUST** run the build script to bundle these partials into the main JavaScript file.
  ```bash
  python3 build.py
  ```
This generates `pages/timeline-content.js`, which allows the timeline to load content instantly. Note: Vercel automatically runs this command on deployment.

### 2. The Admin Backend (Vercel Serverless & Redis)
The backend is powered by Python and hosted instantly via Vercel Serverless Functions found in the `api/` directory.

- **Storage:** All dynamic content (text, titles) is stored in a Vercel KV (Redis) database.
- **Media:** Uploaded images and documents are stored securely using Vercel Blob.
- **Auth:** Sessions and admin credentials are automatically hashed and stored in Redis.
- **Local Dev:** Running `python3 server.py` runs a simulated development server locally that seamlessly mimics the online Serverless architecture.

---

## Project Structure

- `/pages`: Contains the main HTML pages (Timeline, About, Recently Added).
  - `/timeline-content`: Source HTML partials for each timeline node.
- `/js`: Frontend logic.
  - `main.js`: Shared navigation and UI logic.
  - `recently-added.js`: Admin-managed document system.
- `/css`: Modular stylesheets.
  - `variables.css`: Design tokens (colors, typography, spacing).
  - `styles.css`: Core layout and components.
- `/assets`: Images, icons, and user-uploaded materials.
- `/data`: JSON storage for the admin-managed documents.

---

## Tips for Contributors

- **Mobile First:** The design uses CSS variables and a responsive grid. Always test changes in the mobile view.
- **No Heavy Frameworks:** The site uses Vanilla JS and CSS for performance and longevity. Avoid adding heavy dependencies like React or Tailwind unless strictly necessary.
- **Icons:** Most icons are inline SVGs or from a simple CDN link in the header.


