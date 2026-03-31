# Roger Williams Exhibit - Developer Guide

This repository contains the source code for the Roger Williams digital exhibit. It is a modern, responsive web application built with a focus on ease of maintenance and offline compatibility.

---

## 🚀 Quick Start (Local Development)

To run the project locally with full admin functionality:
1.  Open your terminal in the project root.
2.  Start the Python server:
    ```bash
    python3 server.py
    ```
3.  Navigate to `http://localhost:8000` in your browser.

---

## 🛠️ Architecture & Build System

The project uses a "Build-Once, Run-Anywhere" approach to handle dynamic content without requiring a database for the main timeline.

### 1. The Timeline Content Bundler (`build.py`)
The individual sections of the timeline are stored as HTML partials in `pages/timeline-content/`.
- **To make changes:** Edit the `.html` file for the specific year.
- **To update the site:** You **MUST** run the build script to bundle these partials into the main JavaScript file:
  ```bash
  python3 build.py
  ```
This generates `pages/timeline-content.js`, which allows the timeline to load content instantly without network requests.

### 2. The Admin Backend (`server.py`)
A lightweight Python server handles the "Recently Added Material" section.
- **API:** Provides REST endpoints for adding, editing, reordering, and deleting materials.
- **Storage:** Metadata is stored in `data/materials.json`. Files are uploaded to `assets/uploads/`.
- **Auth:** Basic session-based admin login (credentials found in `js/recently-added.js`).

---

## 📂 Project Structure

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

## 📝 Tips for Contributors

- **Mobile First:** The design uses CSS variables and a responsive grid. Always test changes in the mobile view.
- **No Heavy Frameworks:** The site uses Vanilla JS and CSS for performance and longevity. Avoid adding heavy dependencies like React or Tailwind unless strictly necessary.
- **Icons:** Most icons are inline SVGs or from a simple CDN link in the header.


