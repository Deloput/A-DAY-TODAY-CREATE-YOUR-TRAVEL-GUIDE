export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface GroundingSource {
  title?: string;
  uri?: string;
  sourceType: 'search' | 'maps';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  image?: string; // base64
  groundingSources?: GroundingSource[];
}

export interface Place {
  id: string;
  name: string;
  description: string;
  coordinates?: Coordinates;
  imageUrl?: string;
  address?: string;
  rating?: number;
  mapsUri?: string;
}

export interface LocalEvent {
  title: string;
  description: string;
  date?: string;
  location?: string;
  url?: string;
}

export interface Guide {
  id: string;
  title: string;
  author: User;
  places: Place[];
  coverImage: string;
  locationName: string;
  createdAt: string;
  status: 'draft' | 'published';
}

// For the AMP Story Preview
export interface StoryPage {
  type: 'cover' | 'place' | 'map' | 'end';
  title?: string;
  text?: string;
  mediaUrl?: string;
  placeData?: Place;
}