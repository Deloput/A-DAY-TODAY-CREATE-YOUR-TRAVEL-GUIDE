import { Coordinates } from "../types";

export const getCurrentPosition = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      }
    );
  });
};

export const getCityNameFromCoords = async (coords: Coordinates): Promise<string> => {
  // In a real app, use a reverse geocoding API. 
  // For this demo, we'll approximate or use Gemini if needed, 
  // but let's stick to a simple mock to avoid another API key dependency if possible,
  // OR we can just return a generic "Your Location" until the user defines it.
  
  // However, since we have Gemini, let's ask it!
  // This is a creative use of the tool.
  return "Unknown City"; // We will let the user or Gemini Chat determine context
};
