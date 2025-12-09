
import React, { useState } from 'react';
import { Guide } from '../types';

interface StoryPreviewProps {
  guide: Guide;
  onClose: () => void;
}

export const StoryPreview: React.FC<StoryPreviewProps> = ({ guide, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Construct pages from guide data
  const pages = [
    { type: 'cover', data: guide },
    ...guide.places.map(p => ({ type: 'place', data: p })),
    { type: 'end', data: guide }
  ];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < pages.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const currentPage = pages[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md h-[80vh] bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800">
        
        {/* Progress Bar */}
        <div className="absolute top-4 left-0 right-0 flex gap-1 px-2 z-20">
          {pages.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${idx <= currentIndex ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-30 text-white/80 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Content Layer */}
        <div className="absolute inset-0 z-10" onClick={handleNext}>
           {/* Left Tap Zone */}
           <div className="absolute left-0 top-0 bottom-0 w-1/3 z-20" onClick={handlePrev} />
           
           {currentPage.type === 'cover' && (
             <div className="h-full w-full relative">
                <img 
                  src={(currentPage.data as Guide).coverImage} 
                  alt="Cover" 
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
                <div className="absolute bottom-12 left-6 right-6 text-white">
                  <span className="text-brand-300 uppercase tracking-widest text-xs font-bold mb-2 block">City Guide</span>
                  <h1 className="font-serif text-4xl mb-4 leading-tight">{(currentPage.data as Guide).title}</h1>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold">
                       {(currentPage.data as Guide).author.name[0]}
                    </div>
                    <span className="text-sm font-sans">by {(currentPage.data as Guide).author.name}</span>
                  </div>
                </div>
             </div>
           )}

           {currentPage.type === 'place' && (
             <div className="h-full w-full relative bg-brand-900">
                <div className="h-3/5 relative group">
                   <img 
                    src={(currentPage.data as any).imageUrl} 
                    alt="Place" 
                    className="w-full h-full object-cover"
                   />
                   <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent" />
                   
                   {/* Mini Map Overlay if Coordinates exist */}
                   {(currentPage.data as any).coordinates && (
                       <div className="absolute bottom-4 right-4 w-24 h-24 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-gray-200">
                           <iframe
                               width="100%"
                               height="100%"
                               frameBorder="0"
                               style={{border:0}}
                               src={`https://maps.google.com/maps?q=${(currentPage.data as any).coordinates.latitude},${(currentPage.data as any).coordinates.longitude}&z=15&output=embed`}
                               allowFullScreen
                           ></iframe>
                       </div>
                   )}
                </div>
                <div className="h-2/5 p-6 text-white bg-brand-900 relative">
                   <div className="absolute -top-16 right-6 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg text-brand-900">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                   </div>
                   <h2 className="font-serif text-2xl mb-2">{(currentPage.data as any).name}</h2>
                   <p className="font-sans text-brand-100 text-sm leading-relaxed mb-4">
                     {(currentPage.data as any).description}
                   </p>
                   {(currentPage.data as any).address && (
                     <div className="text-xs text-brand-300 flex items-start gap-2">
                       <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                       {(currentPage.data as any).address}
                     </div>
                   )}
                </div>
             </div>
           )}

           {currentPage.type === 'end' && (
             <div className="h-full w-full relative bg-brand-800 flex flex-col items-center justify-center text-center p-8 text-white">
                <h2 className="font-serif text-3xl mb-4">The End</h2>
                <p className="text-brand-200 mb-8">Thanks for exploring with us.</p>
                <div className="animate-bounce">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                </div>
                <p className="text-xs mt-8 text-white/50">Swipe to close</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
