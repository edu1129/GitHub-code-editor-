import { GoogleGenAI } from "@google/genai";
import { UploadedFile } from "../types";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const createPrompt = (files: UploadedFile[], selectedFileNames: string[], userInstruction: string): string => {
  const fileContents = files.map(file => {
    const fileType = file.type.startsWith('image/') ? ' (Image File, content is Base64)' : '';
    return `--- FILE START: ${file.name}${fileType} ---\n${file.content}\n--- FILE END: ${file.name} ---`
  }).join('\n\n');

  const modifiableFilesList = selectedFileNames.length > 0 ? selectedFileNames.join(', ') : 'None';

  let instructionForModel: string;

  if (files.length === 0) {
    instructionForModel = `Your task is to generate one or more new files based on the USER REQUEST. Your response must be a JSON plan containing only a "newFiles" array.`;
  } else {
    instructionForModel = `Analyze the provided project files and the USER REQUEST to generate a JSON modification plan.
You are ONLY permitted to propose changes for the files listed as MODIFIABLE. All other files are for read-only context.
Your plan can include adding new files, modifying existing files, deleting content from files, or deleting entire files.`;
  }

  return `
You are an expert AI agent that generates a JSON object describing code modifications. Your entire output MUST be a single, raw JSON object, without any surrounding text, explanations, or markdown fences.

${instructionForModel}

USER REQUEST:
"${userInstruction}"

MODIFIABLE FILES:
[${modifiableFilesList}]

${files.length > 0 ? 'ALL PROJECT FILES (for context):' : ''}
${fileContents}

RESPONSE JSON FORMAT:
The JSON object must have optional top-level keys: "modify", "delete", "newFiles", "deleteFiles", and "notes".

1. "modify": Array of objects for changing existing files.
   {
     "fileName": "The full name of the file to modify. MUST be from the MODIFIABLE list.",
     "before": "A small, unique snippet of code immediately preceding the code to be changed. For images, this MUST be an empty string.",
     "codeToDelete": "The exact original code to be replaced. For images, this is the original base64 string.",
     "newCode": "The new code to insert. For images, this is the new base64 data URL.",
     "after": "A small, unique snippet of code immediately following the code to be changed. For images, this MUST be an empty string."
   }

2. "delete": Array of objects for removing content within a file.
   {
     "fileName": "The full name of the file to modify. MUST be from the MODIFIABLE list.",
     "before": "A small, unique snippet of code immediately preceding the code to delete.",
     "codeToDelete": "The exact code snippet to be removed.",
     "after": "A small, unique snippet of code immediately following the code to delete."
   }

3. "newFiles": Array of objects for creating new files.
   {
     "fileName": "The full, appropriate path for the new file (e.g., 'src/components/Button.tsx').",
     "code": "The complete, valid code content for the new file."
   }

4. "deleteFiles": An array of strings, where each string is the full name of a file to delete.
   - Example: "deleteFiles": ["old-styles.css", "utils/legacy.js"]

5. "notes": A brief, user-friendly summary of the changes you are making. Explain the 'why'.

IMPORTANT CONSTRAINTS:
- For "before" and "after" context in text files, use a short but unique snippet (approx. 5-7 words or 30-50 characters) to ensure a precise match.
- For image modifications, you MUST use the "modify" operation. "codeToDelete" should be the original base64 string, "newCode" the new one, and "before"/"after" must be empty strings.
- Do NOT include escaped newline characters like '\\n' in JSON string values. Use literal newlines.
- Your response MUST be ONLY the JSON object.
- If no changes are necessary, return an empty JSON object: {}.
`;
};


export async function* getModificationJsonStream(
  files: UploadedFile[],
  selectedFileNames: string[],
  userInstruction: string,
  modelName: string
): AsyncGenerator<string> {
  if (!userInstruction.trim()) {
    return;
  }
  
  const prompt = createPrompt(files, selectedFileNames, userInstruction);
  
  const response = await ai.models.generateContentStream({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    }
  });

  for await (const chunk of response) {
    yield chunk.text;
  }
}
