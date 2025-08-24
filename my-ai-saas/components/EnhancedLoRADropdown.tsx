"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface LoRAInfo {
  name: string;
  filename: string;
  type: 'character' | 'style' | 'concept' | 'other';
  thumbnail?: string;
  description?: string;
  tags?: string[];
  strength_recommended?: number;
}

interface LoRAGrouped {
  character: LoRAInfo[];
  style: LoRAInfo[];
  concept: LoRAInfo[];
  other: LoRAInfo[];
}

interface EnhancedLoRADropdownProps {
  value: string;
  onChange: (value: string, strength?: number) => void;
  className?: string;
}

export default function EnhancedLoRADropdown({ value, onChange, className }: EnhancedLoRADropdownProps) {
  const [loras, setLoras] = useState<LoRAGrouped | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredLora, setHoveredLora] = useState<LoRAInfo | null>(null);
  const [activeTab, setActiveTab] = useState<keyof LoRAGrouped>('character');

  useEffect(() => {
    async function loadLoRAs() {
      try {
        const response = await fetch('/api/runpod/discover-loras');
        const data = await response.json();
        
        if (data.success) {
          setLoras(data.loras);
        } else {
          console.error('Failed to load LoRAs:', data.error);
        }
      } catch (error) {
        console.error('LoRA loading error:', error);
      } finally {
        setLoading(false);
      }
    }

    loadLoRAs();
  }, []);

  const handleSelect = (lora: LoRAInfo) => {
    onChange(lora.filename, lora.strength_recommended);
    setIsOpen(false);
  };

  const getCurrentLoRA = () => {
    if (!loras || !value) return null;
    
    const allLoras = [
      ...loras.character,
      ...loras.style,
      ...loras.concept,
      ...loras.other
    ];
    
    return allLoras.find(l => l.filename === value || l.name === value);
  };

  const currentLora = getCurrentLoRA();

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <Button variant="outline" disabled className="w-full justify-between">
          Loading LoRAs...
          <span className="ml-2">⏳</span>
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Dropdown Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between text-left"
      >
        <span className="flex items-center gap-2">
          {currentLora?.thumbnail && (
            <img 
              src={currentLora.thumbnail} 
              alt={currentLora.name}
              className="w-4 h-4 rounded object-cover"
            />
          )}
          {currentLora?.name || value || 'Select LoRA'}
        </span>
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </Button>

      {/* Dropdown Menu */}
      {isOpen && loras && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* None Option */}
          <div
            className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b"
            onClick={() => handleSelect({ name: 'None', filename: '', type: 'other' })}
          >
            <div className="font-medium">None</div>
            <div className="text-xs text-gray-500">No LoRA applied</div>
          </div>

          {/* Tabs */}
          <div className="flex border-b bg-gray-50">
            {(['character', 'style', 'concept', 'other'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 py-1 text-xs font-medium capitalize ${
                  activeTab === tab 
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab} ({loras[tab].length})
              </button>
            ))}
          </div>

          {/* LoRA List */}
          <div className="max-h-48 overflow-y-auto">
            {loras[activeTab].map((lora) => (
              <div
                key={lora.filename}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-start gap-3"
                onClick={() => handleSelect(lora)}
                onMouseEnter={() => setHoveredLora(lora)}
                onMouseLeave={() => setHoveredLora(null)}
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded overflow-hidden">
                  {lora.thumbnail ? (
                    <img 
                      src={lora.thumbnail} 
                      alt={lora.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                      {lora.name[0]}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{lora.name}</div>
                  <div className="text-xs text-gray-500 truncate">{lora.filename}</div>
                  {lora.description && (
                    <div className="text-xs text-gray-400 truncate">{lora.description}</div>
                  )}
                </div>

                {/* Strength */}
                {lora.strength_recommended && (
                  <div className="flex-shrink-0 text-xs text-blue-600 font-medium">
                    {lora.strength_recommended}
                  </div>
                )}
              </div>
            ))}

            {loras[activeTab].length === 0 && (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                No {activeTab} LoRAs found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      {hoveredLora && hoveredLora.description && (
        <div className="absolute z-60 left-full ml-2 top-0 bg-black text-white text-xs rounded px-2 py-1 max-w-xs">
          <div className="font-medium">{hoveredLora.name}</div>
          <div className="opacity-90">{hoveredLora.description}</div>
          {hoveredLora.tags && (
            <div className="mt-1 opacity-75">
              Tags: {hoveredLora.tags.join(', ')}
            </div>
          )}
          {hoveredLora.strength_recommended && (
            <div className="mt-1 text-blue-300">
              Recommended: {hoveredLora.strength_recommended}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
