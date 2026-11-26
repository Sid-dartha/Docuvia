# Docuvia: AI Document Analyzer

Ask questions about your PDFs and get answers with the file, page and passage they came from.
Everything runs **locally on your computer**. Your documents never leave your machine.

**Features**
- **Ask your document:** upload a PDF and ask questions. Answers cite the source page.
- **Compare two PDFs:** see what is new, removed, shared, and what it means in practice.
- **Study mode:** turn a PDF into key ideas, flip-able flashcards and a clickable quiz.

**Tech stack:** React + Vite (frontend) · FastAPI (backend) · PyMuPDF · Sentence Transformers · FAISS · Ollama (`llama3.2:3b`)

---

## 1. Requirements

Install these first (all free). Restart the laptop after installing if a step below says something is "not found".

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.10 or newer (3.11 recommended) | https://www.python.org/downloads/ (tick **"Add python.exe to PATH"**) |
| Node.js | LTS (20 or newer) | https://nodejs.org/ |
| Ollama | latest | https://ollama.com/download |

**Disk space:** about 4 GB (Python packages ~1 GB, language model ~2 GB).
**RAM:** 8 GB minimum. The AI runs on the CPU, so answers can take 10 to 60 seconds.

## 2. Setup (one time)

1. Unzip the project anywhere, for example `C:\Docuvia`.
2. Open the **Ollama** app once so it is running in the background.
3. Double-click **`setup.bat`**.

`setup.bat` checks for Python, Node.js and Ollama, then:
- creates a Python virtual environment in `.venv` and installs `requirements.txt`
- runs `npm install` in `frontend`
- downloads the `llama3.2:3b` language model and the embedding model

It needs internet and can take 10 to 20 minutes the first time.

## 3. Run

Double-click **`start.bat`**. It opens two windows (backend and frontend) and then
your browser at **http://localhost:5173**.

To stop the app, close the two windows.

## 4. How to use

1. Scroll to **Live workspace** (or click **Try the demo**).
2. Drop a PDF into the upload box and click **Process document**.
3. Type a question and press **Ask Document** (or Ctrl + Enter).
4. Under **Labs**, use **Compare two PDFs** or **Study mode**.

The status pill at the top shows **Backend online** when everything is connected.

## 5. Manual setup (if you are not on Windows)

```bash
# backend
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
ollama pull llama3.2:3b
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000

# frontend (in a second terminal)
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

## 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| `Python was not found` | Reinstall Python and tick "Add python.exe to PATH", then reopen `setup.bat`. |
| Page says **Backend unreachable** | Check the "Docuvia backend" window for errors. Port 8000 must be free. |
| "Could not get an answer from the local Ollama model" | Open the Ollama app, then run `ollama pull llama3.2:3b` in a terminal. |
| "No readable text found in this PDF" | The PDF is a scanned image. Only PDFs with selectable text are supported. |
| Answers are very slow | Normal on CPU. Close other heavy apps, or use shorter PDFs for Compare and Study. |
| Want to clear all uploaded documents | Stop the app and delete the files inside `backend\uploads` and `backend\storage`. |

## Project structure

```
AI-Document-Analyzer/
├─ setup.bat              one-time installer (Windows)
├─ start.bat              starts backend + frontend and opens the browser
├─ requirements.txt       Python packages
├─ backend/
│  └─ app/
│     ├─ main.py          FastAPI app
│     ├─ routers/         /documents API (upload, ask, search, compare, study)
│     ├─ services/        PDF reading, chunking, embeddings, FAISS index, Ollama
│     └─ models/          request schemas
└─ frontend/
   └─ src/                React app (App.jsx, Markdown.jsx, StudyPack.jsx, api.js)
```

API docs are available at http://127.0.0.1:8000/docs while the backend is running.
