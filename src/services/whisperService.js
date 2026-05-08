const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export const transcribeAudioWithWhisper = async (audioBlob) => {
  if (!GROQ_API_KEY) {
    console.error("Missing Groq API Key.");
    return null;
  }

  const formData = new FormData();
  // Groq requires a filename with an extension it recognizes
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-large-v3");
  formData.append("language", "en"); // Force English to prevent Arabic/Hebrew accent confusion

  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Whisper Error:", err);
      return null;
    }

    const data = await response.json();
    return data.text; // The transcribed text from Whisper
  } catch (error) {
    console.error("Failed to call Whisper API:", error);
    return null;
  }
};
