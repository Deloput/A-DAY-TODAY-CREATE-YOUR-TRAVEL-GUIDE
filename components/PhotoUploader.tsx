import React, { useState, useEffect, useCallback } from 'react';
import heic2any from 'heic2any';
import ExifReader from 'exifreader';

export type ProcessedPhoto = {
  id: string;
  dataUri: string;
  gps?: {
    latitude: number;
    longitude: number;
  };
  mimeType: string;
};

type PhotoUploaderProps = {
  onPhotoProcessed: (photo: ProcessedPhoto) => void;
};

type PreviewState = {
  id: string;
  fileName: string;
  previewUrl?: string;
  status: 'processing' | 'success' | 'error';
  error?: string;
  hasGps?: boolean;
};

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({ onPhotoProcessed }) => {
  const [previews, setPreviews] = useState<PreviewState[]>([]);

  useEffect(() => {
    return () => {
      previews.forEach(preview => {
        if (preview.previewUrl) URL.revokeObjectURL(preview.previewUrl);
      });
    };
  }, []);

  const fileToDataUri = (file: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Helper: Convert EXIF Rational (DMS) to Decimal Degrees
  const extractGpsFromTags = (tags: any): { latitude: number; longitude: number } | undefined => {
    try {
      if (!tags || !tags['GPSLatitude'] || !tags['GPSLongitude']) return undefined;

      const latData = tags['GPSLatitude'].value;
      const lonData = tags['GPSLongitude'].value;
      const latRef = tags['GPSLatitudeRef']?.value?.[0] || tags['GPSLatitudeRef']?.description?.[0];
      const lonRef = tags['GPSLongitudeRef']?.value?.[0] || tags['GPSLongitudeRef']?.description?.[0];

      // Helper to convert rational [numerator, denominator] to number
      const toNum = (val: any) => {
        if (Array.isArray(val) && val.length === 2 && val[1] !== 0) {
          return val[0] / val[1];
        }
        return Number(val);
      };

      // Ensure we have at least 3 components (Degrees, Minutes, Seconds)
      if (latData.length < 3 || lonData.length < 3) return undefined;

      const latDeg = toNum(latData[0]);
      const latMin = toNum(latData[1]);
      const latSec = toNum(latData[2]);

      const lonDeg = toNum(lonData[0]);
      const lonMin = toNum(lonData[1]);
      const lonSec = toNum(lonData[2]);

      let latitude = latDeg + latMin / 60.0 + latSec / 3600.0;
      let longitude = lonDeg + lonMin / 60.0 + lonSec / 3600.0;

      // Apply Reference (South or West is negative)
      if (latRef === 'S' || latRef === 's') latitude = -latitude;
      if (lonRef === 'W' || lonRef === 'w') longitude = -longitude;

      if (isNaN(latitude) || isNaN(longitude)) return undefined;

      return { latitude, longitude };
    } catch (error) {
      console.warn("GPS parsing logic error:", error);
      return undefined;
    }
  };

  const processFile = useCallback(async (file: File): Promise<ProcessedPhoto> => {
    let processedBlob: Blob = file;
    let mimeType = file.type;

    // 1. Try to read EXIF from the original file (best for HEIC/JPEG)
    let gps: { latitude: number; longitude: number } | undefined;
    try {
      const tags = await ExifReader.load(file);
      gps = extractGpsFromTags(tags);
    } catch (e) {
      console.warn('Could not read EXIF data from original file', e);
    }

    // 2. Convert HEIC if necessary
    if (file.type.toLowerCase() === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      try {
        const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
        processedBlob = Array.isArray(result) ? result[0] : result;
        mimeType = 'image/jpeg';
      } catch (e) {
        console.error("HEIC conversion failed", e);
        throw new Error("Could not convert HEIC image. Please try a JPG or PNG.");
      }
    }

    // 3. Convert to Data URI for the AI
    const dataUri = await fileToDataUri(processedBlob);

    return {
      id: `${file.name}-${Date.now()}`,
      dataUri,
      gps,
      mimeType
    };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const newFiles = Array.from(event.target.files) as File[];

    const newPreviewPlaceholders: PreviewState[] = newFiles.map(file => ({
      id: `${file.name}-${Math.random()}`,
      fileName: file.name,
      status: 'processing',
    }));

    setPreviews(prev => [...prev, ...newPreviewPlaceholders]);

    for (const file of newFiles) {
      const placeholder = newPreviewPlaceholders.find(p => p.fileName === file.name);
      if(!placeholder) continue;

      try {
        const processedPhoto = await processFile(file);
        
        // Notify parent
        onPhotoProcessed(processedPhoto);
        
        // Create preview blob url
        const response = await fetch(processedPhoto.dataUri);
        const blob = await response.blob();
        const previewUrl = URL.createObjectURL(blob);

        setPreviews(current => current.map(p =>
          p.id === placeholder.id
            ? { ...p, status: 'success', previewUrl, hasGps: !!processedPhoto.gps }
            : p
        ));
      } catch (error: any) {
        console.error('Failed to process file:', file.name, error);
        setPreviews(current => current.map(p =>
          p.id === placeholder.id
            ? { ...p, status: 'error', error: error.message || 'Failed' }
            : p
        ));
      }
    }
    // Reset input
    event.target.value = '';
  };

  const removePhoto = (id: string) => {
    setPreviews(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-brand-300 rounded-xl cursor-pointer bg-brand-50 hover:bg-brand-100 transition-colors group">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-3 text-brand-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="mb-1 text-sm text-brand-700 font-sans">
              <span className="font-bold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-brand-500 font-sans">PNG, JPG, HEIC supported</p>
          </div>
          <input 
            type="file" 
            className="hidden" 
            multiple
            accept="image/png, image/jpeg, image/webp, image/heic, .heic"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {previews.map((preview) => (
            <div key={preview.id} className="relative group aspect-square rounded-lg overflow-hidden bg-brand-200 border border-brand-300">
              {preview.status === 'processing' && (
                <div className="w-full h-full flex flex-col gap-2 items-center justify-center">
                  <svg className="animate-spin h-6 w-6 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-[10px] text-brand-500 font-medium">Processing...</span>
                </div>
              )}
              {preview.status === 'success' && preview.previewUrl && (
                <>
                  <img src={preview.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  {preview.hasGps && (
                    <div className="absolute bottom-1 right-1 bg-brand-800/80 text-white p-1 rounded-full shadow-sm" title="Location found in photo">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                  )}
                </>
              )}
              {preview.status === 'error' && (
                <div className="w-full h-full flex flex-col items-center justify-center text-red-500 p-2 text-center bg-red-50">
                   <span className="text-xs font-bold">{preview.error || 'Error'}</span>
                </div>
              )}
              <button
                onClick={() => removePhoto(preview.id)}
                className="absolute top-1 right-1 bg-white/90 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};