import { SMART_PEER_PROMPT } from '../config/aiPersonality';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// We maintain the chat history here for the session
// Gemini format: { role: 'user' | 'model', parts: [{ text: string }] }
let chatHistory = [];

const SILENCE_INSTRUCTION = `
CRITICAL DIRECTIVE REGARDING WHEN TO SPEAK:
You are an AI Peer sitting in a room with students. You must actively participate in their conversation!
Whenever a student says something, you should respond naturally as if you are a smart classmate.

IMPORTANT RULES FOR YOUR RESPONSES:
1. KEEP IT SHORT. Maximum 1 or 2 sentences. You are a peer, not a lecturer.
2. DO NOT RAMBLE. If you are teaching a term, just state the term and one simple sentence.
3. BE RELEVANT. Only answer exactly what the student just said.
4. MATCH LANGUAGE: You MUST reply in the exact language the student is speaking in. If they speak Hebrew, reply in Hebrew. If English, reply in English.
`;

const SUMMARIZER_API_KEY = "AIzaSyBfvfRe0adI4bgU7yMeSLvQ2momjS3J3Dg";
let isSummarizing = false;

const summarizeAndCompressHistory = async () => {
  // If we have more than 8 messages, compress the older ones!
  if (isSummarizing || chatHistory.length <= 8) return;
  isSummarizing = true;
  
  try {
    // Keep the last 4 messages intact, summarize everything before them
    const splitIndex = chatHistory.length - 4;
    const messagesToSummarize = chatHistory.slice(0, splitIndex);
    const recentMessages = chatHistory.slice(splitIndex);
    
    const prompt = "Summarize this student conversation in 2 concise sentences. Focus ONLY on the project ideas, technical terms, and what they are currently building. Do not mention greetings. IMPORTANT: You MUST write the summary entirely in ENGLISH, even if the original conversation was in Hebrew or another language. Conversation: " + JSON.stringify(messagesToSummarize);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${SUMMARIZER_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200 }
      })
    });
    
    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
       const summary = data.candidates[0].content.parts[0].text;
       // Rebuild the history with the summary as the foundational context
       chatHistory = [
         { role: "user", parts: [{ text: `[SYSTEM MEMORY SUMMARY: ${summary}]` }] },
         ...recentMessages
       ];
       console.log("History compressed! New summary:", summary);
    }
  } catch (error) {
    console.error("Summarizer failed:", error);
  } finally {
    isSummarizing = false;
  }
};

export const getAIResponse = async (userText) => {
  if (!GEMINI_API_KEY) {
    console.error("Missing Gemini API Key.");
    return "I am having trouble connecting to my brain. Please check the API key.";
  }

  // Ensure strict alternating roles for Gemini
  if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === "user") {
    // Append to the last user message instead of pushing a new one
    chatHistory[chatHistory.length - 1].parts[0].text += " \n" + userText;
  } else {
    chatHistory.push({ role: "user", parts: [{ text: userText }] });
  }

  // Trigger background summarization if getting too long
  summarizeAndCompressHistory();

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SMART_PEER_PROMPT + "\n\n" + SILENCE_INSTRUCTION }]
        },
        contents: chatHistory,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600, 
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error details:", errorData);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.candidates[0].content.parts[0].text;

    // Only save AI response to history if it actually spoke!
    // Otherwise, the AI sees a history full of [SILENCE] and starts acting dumb or ignoring you.
    if (!aiMessage.includes("[SILENCE]")) {
      chatHistory.push({ role: "model", parts: [{ text: aiMessage }] });
    }

    return aiMessage;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Remove the bad message so we can try again
    if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === "user") {
      chatHistory.pop();
    }
    return "API Error: The Gemini API failed to respond. Please check the console.";
  }
};

export const generateSessionReport = async (classmates) => {
  if (!GEMINI_API_KEY) return null;

  const names = classmates.map(c => c.name || c.email).join(", ");
  const prompt = `
The study session has ended. Based on the conversation history, analyze the soft skills of these students: ${names}.
Return ONLY a valid JSON array of objects. Do not include markdown formatting or backticks.
Each object must match this schema exactly:
{
  "studentName": "Name",
  "Measurable_Skills": { "Teamwork": 85, "Communication_Skills": 70, "Resilience": 90 },
  "Future_Skills": { "Problem_Solving": "COMING SOON", "Independent_Learning": "COMING SOON", "Leadership": "COMING SOON" }
}
(Scores should be 0-100 based on their performance in the chat history. For Future_Skills, literally just output the string "COMING SOON" for the values. Do not attempt to measure them).
  `;

  chatHistory.push({ role: "user", parts: [{ text: prompt }] });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: chatHistory,
        generationConfig: { temperature: 0.2 } // Low temperature for consistent JSON
      })
    });

    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text;
    
    // Clean up potential markdown formatting (```json ... ```)
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error("Failed to generate report:", err);
    return null;
  }
};

export const resetAIHistory = () => {
  chatHistory = [];
};
