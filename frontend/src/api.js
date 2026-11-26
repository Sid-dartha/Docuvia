// All requests go through relative paths (e.g. "/health"), which the Vite
// dev server proxies to http://127.0.0.1:8000 (see vite.config.js).
// This means the browser only ever talks to the frontend's own origin,
// so the backend's CORS configuration never needs to change.

async function parseError(response) {
  let detail = `Request failed with status ${response.status}`
  try {
    const data = await response.json()
    if (data?.detail) {
      detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } else if (data?.message) {
      detail = data.message
    }
  } catch {
    // response wasn't JSON — fall back to the generic status message
  }
  return new Error(detail)
}

export async function checkHealth() {
  const response = await fetch('/health')
  if (!response.ok) throw await parseError(response)
  return response.json()
}

export async function uploadDocument(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)

  // Use XMLHttpRequest instead of fetch so we can report upload progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/documents/upload')

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      let data = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        // ignore parse failure, handled below
      }
      if (xhr.status >= 200 && xhr.status < 300 && data) {
        resolve(data)
      } else {
        const detail = data?.detail || data?.message || `Upload failed with status ${xhr.status}`
        reject(new Error(typeof detail === 'string' ? detail : JSON.stringify(detail)))
      }
    }

    xhr.onerror = () => reject(new Error('Could not reach the backend. Is it running at http://127.0.0.1:8000?'))

    xhr.send(formData)
  })
}

export async function askQuestion(question, topK = 3) {
  let response
  try {
    response = await fetch('/documents/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, top_k: topK }),
    })
  } catch {
    throw new Error('Could not reach the backend. Is it running at http://127.0.0.1:8000?')
  }
  if (!response.ok) throw await parseError(response)
  return response.json()
}

async function postFiles(path, fields) {
  const formData = new FormData()
  Object.entries(fields).forEach(([name, value]) => formData.append(name, value))
  let response
  try {
    response = await fetch(path, { method: 'POST', body: formData })
  } catch {
    throw new Error('Could not reach the backend. Is it running at http://127.0.0.1:8000?')
  }
  if (!response.ok) throw await parseError(response)
  return response.json()
}

export function compareDocuments(firstFile, secondFile) {
  return postFiles('/documents/compare', { first_file: firstFile, second_file: secondFile })
}

export function createStudyPack(file) {
  return postFiles('/documents/study', { file })
}
