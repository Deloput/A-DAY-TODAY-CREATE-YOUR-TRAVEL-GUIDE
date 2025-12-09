
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Button } from './components/Button';
import { StoryPreview } from './components/StoryPreview';
import { PhotoUploader, ProcessedPhoto } from './components/PhotoUploader';
import { getLocalEvents, createGuideChat, analyzeUploadedImage, extractPlaceFromText, identifyPlaceFromCoords } from './services/geminiService';
import { getCurrentPosition } from './services/geoService';
import { Coordinates, LocalEvent, Guide, User, ChatMessage, Place, GroundingSource } from './types';
import { Chat } from '@google/genai';
import L from 'leaflet';

// --- MOCK DATA ---
const MOCK_USER: User = {
  id: 'u1',
  name: 'Alex Traveler',
  avatar: 'https://picsum.photos/seed/alex/100/100'
};

const MOCK_GUIDES: Guide[] = [
  {
    id: 'g1',
    title: 'Hidden Jazz Bars of NYC',
    locationName: 'New York, USA',
    author: { id: 'u2', name: 'Sarah J.', avatar: 'https://picsum.photos/seed/sarah/100/100' },
    coverImage: 'https://picsum.photos/seed/jazz/400/800',
    places: [
      { id: 'p1', name: 'Blue Note', description: 'Legendary jazz club.', imageUrl: 'https://picsum.photos/seed/bluenote/400/600' }
    ],
    createdAt: '2023-10-15',
    status: 'published'
  }
];

// --- COMPONENTS ---

const Header = () => (
  <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-brand-200">
    <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center text-white font-serif font-bold">D</div>
        <span className="font-serif text-xl font-bold tracking-tight text-brand-900">A DAY TODAY</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link to="/create">
          <Button variant="primary" size="sm">
            <span className="mr-2">+</span> Create Guide
          </Button>
        </Link>
        <div className="w-8 h-8 rounded-full bg-brand-200 overflow-hidden border border-brand-300">
          <img src={MOCK_USER.avatar} alt="User" />
        </div>
      </div>
    </div>
  </header>
);

const GuideMap = ({ places }: { places: Place[] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
         zoomControl: false,
         attributionControl: false
      }).setView([20, 0], 2);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstance.current);

      markersRef.current = L.layerGroup().addTo(mapInstance.current);
    }

    // Update markers
    const layerGroup = markersRef.current;
    if (layerGroup) {
        layerGroup.clearLayers();
        
        const validPlaces = places.filter(p => p.coordinates);
        const bounds = L.latLngBounds([]);

        validPlaces.forEach(p => {
            if(!p.coordinates) return;
            const latLng = [p.coordinates.latitude, p.coordinates.longitude] as [number, number];
            
            // Custom Icon
            const icon = L.divIcon({
                className: 'bg-transparent',
                html: `<div class="w-8 h-8 bg-brand-700 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform cursor-pointer">${p.name[0]}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            L.marker(latLng, { icon })
                .bindPopup(`<div class="font-sans text-sm font-bold text-brand-900">${p.name}</div><div class="text-xs text-brand-600">${p.address || ''}</div>`)
                .addTo(layerGroup);
            
            bounds.extend(latLng);
        });

        if (validPlaces.length > 0 && mapInstance.current) {
            mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }
    
    // Invalidate size to handle container resize
    setTimeout(() => {
       mapInstance.current?.invalidateSize();
    }, 100);

  }, [places]);

  if (places.filter(p => p.coordinates).length === 0) return null;

  return (
    <div className="w-full h-64 rounded-xl overflow-hidden shadow-sm border border-brand-200 mb-6 relative z-0">
       <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

const Dashboard = () => {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);
  const [previewGuide, setPreviewGuide] = useState<Guide | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const pos = await getCurrentPosition();
        setCoords(pos);
        const data = await getLocalEvents(pos.latitude, pos.longitude, "your location");
        setEvents(data.events);
        setGroundingSources(data.sources);
      } catch (e) {
        console.error("Loc error", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  return (
    <div className="min-h-screen bg-brand-50 pb-20">
      <Header />
      
      {/* Hero / Location Intel */}
      <div className="bg-white border-b border-brand-200 py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-serif text-4xl md:text-5xl text-brand-900 mb-6">
            Explore {coords ? "Local Gems" : "the World"}
          </h1>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Live Events Card */}
            <div className="col-span-2 bg-brand-100 rounded-xl p-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
               </div>
               <h2 className="font-bold text-lg text-brand-800 mb-4 flex items-center gap-2">
                 <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                 Happening Nearby
               </h2>
               
               {loading ? (
                 <div className="space-y-3">
                   <div className="h-4 bg-brand-200 rounded w-3/4 animate-pulse"></div>
                   <div className="h-4 bg-brand-200 rounded w-1/2 animate-pulse"></div>
                 </div>
               ) : (
                 <ul className="space-y-4 relative z-10">
                   {events.length > 0 ? events.map((ev, i) => (
                     <li key={i} className="bg-white/60 p-3 rounded-lg backdrop-blur-sm">
                       <h3 className="font-bold text-brand-900">{ev.title}</h3>
                       <p className="text-sm text-brand-700 mt-1 line-clamp-2">{ev.description}</p>
                     </li>
                   )) : (
                     <p className="text-brand-600">No events found nearby right now.</p>
                   )}
                 </ul>
               )}

               {/* Grounding Sources */}
               {groundingSources.length > 0 && (
                 <div className="mt-4 pt-4 border-t border-brand-200">
                    <p className="text-xs text-brand-500 font-bold mb-1">Sources (Google Search):</p>
                    <div className="flex flex-wrap gap-2">
                      {groundingSources.map((s, idx) => (
                        <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 underline truncate max-w-[150px]">
                          {s.title}
                        </a>
                      ))}
                    </div>
                 </div>
               )}
            </div>

            {/* User Stat / CTA */}
            <div className="bg-brand-800 text-white rounded-xl p-6 flex flex-col justify-center">
               <h3 className="font-serif text-2xl mb-2">Share Your City</h3>
               <p className="text-brand-200 mb-6 text-sm">Become a local expert. Build a guide in minutes using AI.</p>
               <Link to="/create">
                 <Button variant="secondary" className="w-full">Start Creating</Button>
               </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="font-serif text-3xl mb-8 text-brand-900">Featured Guides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_GUIDES.map(guide => (
            <div key={guide.id} 
                 onClick={() => setPreviewGuide(guide)}
                 className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer border border-brand-100">
              <div className="h-64 overflow-hidden relative">
                <img src={guide.coverImage} alt={guide.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold uppercase tracking-wider text-brand-800">
                  {guide.locationName}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-serif text-xl font-bold text-brand-900 mb-2">{guide.title}</h3>
                <div className="flex items-center gap-2 mt-4">
                   <img src={guide.author.avatar} alt={guide.author.name} className="w-6 h-6 rounded-full" />
                   <span className="text-xs text-brand-500">by {guide.author.name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {previewGuide && <StoryPreview guide={previewGuide} onClose={() => setPreviewGuide(null)} />}
    </div>
  );
};

const GuideCreator = () => {
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [guidePlaces, setGuidePlaces] = useState<Place[]>([]);
  const [guideTitle, setGuideTitle] = useState('Untitled Guide');
  const [showPreview, setShowPreview] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Chat
  useEffect(() => {
    const chat = createGuideChat();
    setChatSession(chat);
    setMessages([{
      id: 'init',
      role: 'model',
      text: "Hi! I'm your AI editor. Where are we exploring today? Upload your photos (even HEIC!) and I'll find the locations automatically.",
      timestamp: Date.now()
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || !chatSession) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await chatSession.sendMessage({ message: userMsg.text });
      
      const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: GroundingSource[] = [];
      
      if (result.candidates?.[0]?.groundingMetadata?.groundingSupports) {
         chunks.forEach(c => {
             if ((c as any).maps?.uri) {
                sources.push({
                   sourceType: 'maps',
                   uri: (c as any).maps.uri,
                   title: (c as any).maps.title || 'Map Location'
                });
             }
         });
      }

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: result.text || '',
        timestamp: Date.now(),
        groundingSources: sources
      };

      setMessages(prev => [...prev, modelMsg]);

      const potentialPlace = await extractPlaceFromText(result.text || '');
      if (potentialPlace) {
         setGuidePlaces(prev => {
             if (prev.find(p => p.name === potentialPlace.name)) return prev;
             return [...prev, potentialPlace];
         });
      }

    } catch (error) {
      console.error("Chat error", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Sorry, I had trouble connecting. Please try again.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePhotoProcessed = async (photo: ProcessedPhoto) => {
    if (!chatSession) return;

    // Display user photo in chat
    const userMsg: ChatMessage = {
      id: photo.id,
      role: 'user',
      text: photo.gps 
        ? `I uploaded a photo taken at Lat: ${photo.gps.latitude}, Lng: ${photo.gps.longitude}.`
        : "I uploaded a photo.",
      image: photo.dataUri,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      let prompt = "I uploaded a photo.";
      
      if (photo.gps) {
        prompt += ` It has GPS coordinates: ${photo.gps.latitude}, ${photo.gps.longitude}. Use your tools to find what is at this location and tell me about it.`;
      } else {
        // If no GPS, ask Gemini to look at the image
        const analysis = await analyzeUploadedImage(photo.dataUri.split(',')[1], photo.mimeType);
        prompt += ` Description: "${analysis}". What looks interesting here?`;
      }

      // Important: Send image data to chat if we need it for context, 
      // but standard Chat doesn't persist image history well in stateful chats without resending.
      // We'll rely on the text context established.
      const result = await chatSession.sendMessage({ message: prompt });
      
      const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: GroundingSource[] = [];
      if (result.candidates?.[0]?.groundingMetadata?.groundingSupports) {
         chunks.forEach(c => {
             if ((c as any).maps?.uri) {
                sources.push({
                   sourceType: 'maps',
                   uri: (c as any).maps.uri,
                   title: (c as any).maps.title || 'Map Location'
                });
             }
         });
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: result.text || '',
        timestamp: Date.now(),
        groundingSources: sources
      }]);

      // Extract Place and associate the image
      const potentialPlace = await extractPlaceFromText(result.text || '');
      if (potentialPlace) {
         potentialPlace.imageUrl = photo.dataUri; // Use the actual photo
         
         // IMPORTANT: Attach GPS from photo if available, so we can map it
         if (photo.gps) {
            potentialPlace.coordinates = photo.gps;
         }

         setGuidePlaces(prev => [...prev, potentialPlace]);
      }

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I got the photo, but had trouble identifying the location.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const currentGuide: Guide = {
      id: 'draft',
      title: guideTitle,
      author: MOCK_USER,
      places: guidePlaces,
      coverImage: guidePlaces[0]?.imageUrl || 'https://picsum.photos/seed/draft/800/600',
      locationName: 'Draft Location',
      createdAt: new Date().toISOString(),
      status: 'draft'
  };

  const publishGuide = () => {
      alert("Guide published to WordPress (Simulated)!");
  };

  return (
    <div className="flex h-screen bg-brand-50 overflow-hidden">
      {/* Sidebar / Chat */}
      <div className="w-full md:w-1/2 lg:w-1/3 flex flex-col border-r border-brand-200 bg-white">
        <div className="p-4 border-b border-brand-200 flex items-center justify-between">
           <Link to="/" className="text-brand-500 hover:text-brand-700 flex items-center gap-1 text-sm font-bold">
             &larr; Exit
           </Link>
           <h2 className="font-serif font-bold text-brand-900">Guide Builder</h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-brand-50/50 no-scrollbar">
           {messages.map(m => (
             <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`max-w-[85%] p-4 rounded-xl shadow-sm text-sm leading-relaxed ${
                 m.role === 'user' 
                 ? 'bg-brand-700 text-white rounded-tr-none' 
                 : 'bg-white text-brand-900 border border-brand-100 rounded-tl-none'
               }`}>
                 {m.image && <img src={m.image} alt="Upload" className="mb-2 rounded-lg max-h-40 object-cover" />}
                 <p className="whitespace-pre-wrap">{m.text}</p>
                 
                 {/* Grounding Citations */}
                 {m.groundingSources && m.groundingSources.length > 0 && (
                   <div className="mt-3 pt-2 border-t border-brand-200/20">
                     <p className="text-[10px] opacity-70 mb-1 uppercase tracking-wider">Sources:</p>
                     <div className="flex flex-col gap-1">
                        {m.groundingSources.map((s, i) => (
                           <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs hover:underline opacity-90">
                             <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                             {s.title || s.uri}
                           </a>
                        ))}
                     </div>
                   </div>
                 )}
               </div>
             </div>
           ))}
           {isTyping && (
             <div className="flex justify-start">
               <div className="bg-white p-3 rounded-xl rounded-tl-none border border-brand-100 flex gap-1">
                 <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"></span>
                 <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce delay-75"></span>
                 <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce delay-150"></span>
               </div>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-brand-200 space-y-3">
          <PhotoUploader onPhotoProcessed={handlePhotoProcessed} />
          
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              className="flex-1 bg-brand-50 border-transparent focus:border-brand-300 focus:bg-white focus:ring-0 rounded-lg px-4 py-2 text-brand-900 font-sans"
              placeholder="Suggest a vibe or ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button onClick={handleSendMessage} disabled={!input.trim() && !isTyping}>
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Right Pane: Live Guide Preview */}
      <div className="hidden md:flex flex-1 flex-col bg-brand-100 p-8 overflow-y-auto">
         <div className="max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between mb-8">
               <input 
                 value={guideTitle} 
                 onChange={(e) => setGuideTitle(e.target.value)}
                 className="bg-transparent border-b-2 border-transparent hover:border-brand-300 focus:border-brand-500 font-serif text-3xl text-brand-900 focus:outline-none w-full mr-4"
               />
               <div className="flex gap-2">
                 <Button variant="outline" onClick={() => setShowPreview(true)} disabled={guidePlaces.length === 0}>
                   Preview AMP
                 </Button>
                 <Button onClick={publishGuide} disabled={guidePlaces.length === 0}>
                   Publish
                 </Button>
               </div>
            </div>

            {/* Map Visualization */}
            <GuideMap places={guidePlaces} />

            {/* Places List */}
            {guidePlaces.length === 0 ? (
              <div className="border-2 border-dashed border-brand-300 rounded-xl p-12 text-center text-brand-500">
                 <p className="font-serif text-xl mb-2">Your guide is empty</p>
                 <p className="text-sm">Chat with the AI or upload photos to start.</p>
              </div>
            ) : (
              <div className="space-y-6">
                 {guidePlaces.map((place, idx) => (
                   <div key={idx} className="bg-white p-4 rounded-xl shadow-sm flex gap-4">
                      {place.imageUrl && (
                        <img src={place.imageUrl} alt={place.name} className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-serif text-xl text-brand-900 flex items-center gap-2">
                           {place.name}
                           {place.coordinates && (
                               <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                           )}
                        </h3>
                        <p className="text-xs text-brand-400 mb-2">{place.address}</p>
                        <p className="text-sm text-brand-700 leading-relaxed">{place.description}</p>
                      </div>
                      <button 
                        onClick={() => setGuidePlaces(prev => prev.filter((_, i) => i !== idx))}
                        className="text-brand-300 hover:text-red-500 self-start"
                      >
                        &times;
                      </button>
                   </div>
                 ))}
              </div>
            )}
         </div>
      </div>
      
      {showPreview && <StoryPreview guide={currentGuide} onClose={() => setShowPreview(false)} />}
    </div>
  );
};


const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<GuideCreator />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
