let pdfScale = 1.0;
let pdfUrl = '';

// Event Listeners
document.getElementById("uploadBtn").addEventListener("click", uploadPDF);
document.getElementById("recognizeBtn").addEventListener("click", processPDF);
document.getElementById("zoomInBtn").addEventListener("click", zoomIn);
document.getElementById("zoomOutBtn").addEventListener("click", zoomOut);

// Upload and Display PDF
function uploadPDF() {
    let fileInput = document.getElementById("fileInput");
    let file = fileInput.files[0];
    let display = document.getElementById("pdfDisplay");
    let output = document.getElementById('output');

    // Reset previous states
    output.innerText = '';
    pdfScale = 1.0;

    if (file) {
        let fileType = file.type;
        if (fileType === "application/pdf") {
            pdfUrl = URL.createObjectURL(file);
            display.innerHTML = `
                <iframe 
                    id="pdfFrame" 
                    src="${pdfUrl}" 
                    width="100%" 
                    height="600px" 
                    style="border-radius: 8px; transition: transform 0.3s ease;"
                ></iframe>
            `;
            
            // Enable recognition button
            document.getElementById('recognizeBtn').disabled = false;
        } else {
            display.innerHTML = `<p class="error">❌ Unsupported file type. Please upload a valid PDF file.</p>`;
            document.getElementById('recognizeBtn').disabled = true;
        }
    } else {
        alert("Please select a PDF file first!");
    }
}

// Zoom In
function zoomIn() {
    if (pdfUrl) {
        pdfScale *= 1.2;
        updatePDFScale();
    }
}

// Zoom Out
function zoomOut() {
    if (pdfUrl) {
        pdfScale *= 0.8;
        updatePDFScale();
    }
}

// Update PDF Scale
function updatePDFScale() {
    let pdfFrame = document.getElementById("pdfFrame");
    if (pdfFrame) {
        pdfFrame.style.transform = `scale(${pdfScale})`;
        pdfFrame.style.transformOrigin = "top left";
    }
}

async function processPDF() {
    const fileInput = document.getElementById('fileInput');
    const outputElement = document.getElementById('output');
    const recognizeBtn = document.getElementById('recognizeBtn');

    if (!fileInput.files[0]) {
        alert("Please upload a PDF first!");
        return;
    }

    const formData = new FormData();
    formData.append('pdf', fileInput.files[0]);

    // Disable button and show processing state
    recognizeBtn.disabled = true;
    outputElement.innerHTML = `
        <div class="processing">
            Processing... 
            <span class="spinner">🎵</span>
        </div>
    `;

    try {
        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        // Comprehensive note detection handling
        if (!response.ok) {
            throw new Error(result.error || 'Unknown error occurred');
        }

        if (result.notes && result.notes.length > 0) {
            // Detailed note formatting
            const formattedNotes = result.notes.map((note, index) => 
                `Note ${index + 1}: 
                    Pitch: ${note.pitch}, 
                    Duration: ${note.duration}, 
                    Type: ${note.type || 'Unknown'}`
            );

            outputElement.innerHTML = `
                <div class="notes-detected">
                    <h3>Detected Notes (${result.notes.length} total):</h3>
                    <pre>${formattedNotes.join('\n')}</pre>
                </div>
            `;
        } else {
            outputElement.innerHTML = `
                <div class="no-notes">
                    ⚠️ No musical notes detected. 
                    Tips:
                    - Ensure the PDF is a clear music sheet
                    - Try a different PDF
                    - Check PDF resolution
                </div>
            `;
        }
    } catch (error) {
        console.error("Error processing PDF:", error);
        outputElement.innerHTML = `
            <div class="error">
                ❌ Error processing the PDF:
                ${error.message}
                
                Possible reasons:
                - Server connection issue
                - Unsupported PDF format
                - Audiveris processing error
            </div>
        `;
    } finally {
        // Re-enable button
        recognizeBtn.disabled = false;
    }
}

// Optional: Add initial disabled state to recognize button
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('recognizeBtn').disabled = true;
});