const fs = require('fs');

async function test() {
  const prompt = fs.readFileSync('src/config/aiPersonality.js', 'utf-8').replace('export const SMART_PEER_PROMPT = `', '').slice(0, -2);
  
  const body = {
    systemInstruction: {
      parts: [{ text: prompt }]
    },
    contents: [
      { role: "user", parts: [{ text: "Hello, who are you?" }] }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 250
    }
  };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyCdu3A-0tMeGNMXf_onA0VJ93Fgaf4nmeE`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  console.log(res.status);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
