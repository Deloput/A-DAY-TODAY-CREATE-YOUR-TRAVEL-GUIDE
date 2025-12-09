import { GoogleGenAI, Chat } from "@google/genai";
import { GroundingSource, LocalEvent, Place } from "../types";

const API_KEY = process.env.API_KEY || ''; 

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Models
const MODEL_FLASH = 'gemini-2.5-flash';
const MODEL_PRO = 'gemini-3-pro-preview'; 

export const getLocalEvents = async (lat: number, lng: number, city: string): Promise<{ events: LocalEvent[], rawText: string, sources: GroundingSource[] }> => {
  try {
    const model = ai.models;
    
    // We use Google Search Grounding to find live events
    const prompt = `Find interesting events, art exhibitions, or new restaurant openings happening today or this week in ${city} (around lat: ${lat}, lng: ${lng}). List 3 distinct items. Return the response as a bulleted list with clear titles and brief descriptions.`;

    const response = await model.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "No events found.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const sources: GroundingSource[] = chunks
      .filter(c => c.web?.uri)
      .map(c => ({
        title: c.web?.title || 'Source',
        uri: c.web?.uri,
        sourceType: 'search'
      }));

    // Simple parsing of the text for UI cards
    const lines = text.split('\n');
    const events: LocalEvent[] = [];
    let currentEvent: Partial<LocalEvent> | null = null;

    lines.forEach(line => {
      if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
        if (currentEvent && currentEvent.title) events.push(currentEvent as LocalEvent);
        currentEvent = { title: line.replace(/^[\*\-]\s*/, '').trim(), description: '' };
      } else if (currentEvent) {
        currentEvent.description += line + ' ';
      }
    });
    if (currentEvent && currentEvent.title) events.push(currentEvent as LocalEvent);

    return { events: events.slice(0, 3), rawText: text, sources };

  } catch (error) {
    console.error("Error fetching local events:", error);
    return { events: [], rawText: "Unable to load local events.", sources: [] };
  }
};

export const createGuideChat = (): Chat => {
  return ai.chats.create({
    model: MODEL_PRO,
    config: {
      systemInstruction: `You are an expert city guide curator for the 'A DAY TODAY' app. 
      Your goal is to help the user build a travel guide.
      
      RULES:
      1. Ask the user about the vibe they want (e.g., 'Art & Coffee', 'Nightlife', 'Hidden Gems').
      2. If the user provides a geolocation (lat/long), IMMEDIATELY use your Google Maps tool to identify the place at those coordinates.
      3. Suggest specific places using Google Maps grounding to ensure they are real and get their addresses/ratings.
      4. Be concise, warm, and engaging.
      5. Always try to provide the exact location name so we can pin it on a map.`,
      tools: [{ googleMaps: {} }], 
    }
  });
};

export const identifyPlaceFromCoords = async (lat: number, lng: number): Promise<{ name: string, address: string, description: string } | null> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_PRO,
            contents: `What is the specific point of interest located at Latitude: ${lat}, Longitude: ${lng}? Provide the name and a short 1-sentence description.`,
            config: {
                tools: [{ googleMaps: {} }]
            }
        });
        
        const text = response.text || "";
        
        // Secondary extraction to clean up the answer into JSON
        const extraction = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: `Extract the place name and description from this text: "${text}". Return JSON: { "name": "...", "address": "...", "description": "..." }`,
            config: { responseMimeType: "application/json" }
        });
        
        return JSON.parse(extraction.text || "null");
    } catch (e) {
        console.error("Identify place failed", e);
        return null;
    }
}

export const extractPlaceFromText = async (text: string): Promise<Place | null> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: `Extract the main venue/place mentioned in this text: "${text}". Return ONLY a JSON object with keys: name, description, address. If no specific place is clear, return null.`,
      config: {
         responseMimeType: "application/json"
      }
    });
    
    const json = JSON.parse(response.text || "null");
    if (!json) return null;

    return {
      id: Math.random().toString(36).substr(2, 9),
      name: json.name,
      description: json.description,
      address: json.address,
      imageUrl: `https://picsum.photos/seed/${json.name.replace(/\s/g,'')}/400/600`
    };
  } catch (e) {
    return null;
  }
}

export const analyzeUploadedImage = async (base64Data: string, mimeType: string) => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType } },
                    { text: "Identify this place or describe the atmosphere. If it looks like a landmark, name it." }
                ]
            }
        });
        return response.text;
    } catch (e) {
        console.error("Image analysis failed", e);
        return "I couldn't quite see that image clearly.";
    }
}