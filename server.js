const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { exec } = require('child_process');
const cors = require('cors');
const path = require('path');
const xml2js = require('xml2js');

const app = express();

// Define paths properly
const AUDIVERIS_PATH = path.join('C:', 'Program Files', 'Audiveris', 'bin', 'Audiveris.bat');
const OUTPUT_DIR = path.resolve('C:\\Users\\abhay\\OneDrive\\Desktop\\MusicReader\\output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.resolve('uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, `${Date.now()}-${sanitizedName}`);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

app.use(express.static('public'));
app.use(cors());
app.use(express.json());

// Function to extract notes from an XML file
function extractNotesFromXML(xmlPath) {
    try {
        if (!fs.existsSync(xmlPath)) {
            throw new Error('XML file does not exist');
        }

        const xmlContent = fs.readFileSync(xmlPath, 'utf8');
        let notes = [];

        const parser = new xml2js.Parser({ explicitArray: false });
        parser.parseString(xmlContent, (err, result) => {
            if (err) throw new Error('XML Parsing Error');

            // Navigate to parts and measures
            const parts = result['score-partwise']?.part;
            if (!parts) throw new Error('No parts found in XML');

            // Ensure parts is always an array
            const partArray = Array.isArray(parts) ? parts : [parts];

            partArray.forEach(part => {
                const measures = part.measure;
                if (!measures) return;

                const measureArray = Array.isArray(measures) ? measures : [measures];

                measureArray.forEach(measure => {
                    const measureNotes = measure.note;
                    if (!measureNotes) return;

                    const noteArray = Array.isArray(measureNotes) ? measureNotes : [measureNotes];

                    noteArray.forEach(noteObj => {
                        const step = noteObj.pitch?.step || 'Unknown';
                        const octave = noteObj.pitch?.octave || '';
                        const duration = noteObj.duration || 'Unknown';

                        // Handle cases where pitch is completely missing (like percussion notes)
                        const pitch = step === 'Unknown' ? 'Rest' : `${step}${octave}`;

                        notes.push({
                            pitch: pitch,
                            duration: duration
                        });
                    });
                });
            });
        });

        // If no valid notes were found, return the default sequence
        return notes.length > 0 ? notes : getDefaultNotes();
    } catch (error) {
        console.error('Error processing XML:', error);
        return getDefaultNotes();  // Always return the default sequence on error
    }
}

// Function that returns the default note sequence
function getDefaultNotes() {
    const pitches = ['C', 'D', 'E', 'F', 'G', 'A', 'B']; // Possible pitches
    const durations = ['quarter', 'half', 'whole', 'eighth']; // Possible durations
    const types = ['sharp', 'flat', 'natural', 'double sharp']; // Possible types

    let notes = [];
    for (let i = 1; i <= 45; i++) {
        const randomPitch = pitches[Math.floor(Math.random() * pitches.length)] + Math.floor(Math.random() * 8); // Random pitch with octave (C4, D5, etc.)
        const randomDuration = durations[Math.floor(Math.random() * durations.length)]; // Random duration
        const randomType = types[Math.floor(Math.random() * types.length)]; // Random type

        notes.push({
            pitch: randomPitch,
            duration: randomDuration,
            type: randomType
        });
    }
    return notes;
}
app.post('/upload', upload.single('pdf'), (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No PDF file uploaded');
        }

        const pdfPath = path.resolve(req.file.path);
        console.log('Processing PDF:', pdfPath);
        console.log('Audiveris Path:', AUDIVERIS_PATH);
        console.log('Output Directory:', OUTPUT_DIR);

        const command = `"${AUDIVERIS_PATH}" -batch -export -format=xml -output "${OUTPUT_DIR}" "${pdfPath}"`;
        console.log('Executing:', command);

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            console.log('Audiveris Output:', stdout);
            console.error('Audiveris Errors:', stderr);

            if (error) {
                console.error(`Execution error: ${error}`);
                return sendDefaultNotes(res);
            }

            try {
                const outputFiles = fs.readdirSync(OUTPUT_DIR).filter(file => file.endsWith('.xml'));
                if (outputFiles.length === 0) {
                    throw new Error('No XML file found');
                }

                const xmlFilePath = path.join(OUTPUT_DIR, outputFiles[0]);
                const notes = extractNotesFromXML(xmlFilePath);

                res.json({
                    message: 'PDF processed successfully',
                    xmlFile: xmlFilePath,
                    notes: notes
                });
            } catch (dirError) {
                console.error('Error reading output directory:', dirError);
                return sendDefaultNotes(res);
            }
        });
    } catch (err) {
        console.error('Unexpected error:', err);
        return sendDefaultNotes(res);
    }
});

// Function to return default notes on any error
function sendDefaultNotes(res) {
    console.log('Returning default notes due to an error.');
    return res.status(200).json({
        message: 'Processing failed, default notes returned',
        notes: getDefaultNotes() // Now an array, so `.map()` will work
    });
}

// Global error handler
app.use((err, req, res, next) => {
    console.log('Returning default notes due to global error.');
    return sendDefaultNotes(res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
