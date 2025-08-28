'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Image, Video, Wand2, ArrowRight } from 'lucide-react';

// Generation types and their credit costs
const GENERATION_TYPES = {
  'text-to-image': { name: 'Text to Image', credits: 15, workflow: 'Flux', icon: Image },
  'image-to-image': { name: 'Image to Image', credits: 20, workflow: 'Flux Kontext', icon: ArrowRight },
  'text-to-video': { name: 'Text to Video', credits: 50, workflow: 'Wan 2.2', icon: Video },
  'image-to-video': { name: 'Image to Video', credits: 75, workflow: 'Image to Video', icon: Video },
} as const;

type GenerationType = keyof typeof GENERATION_TYPES;

export default function GeneratePage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<GenerationType>('text-to-image');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  
  // Form states
  const [prompt, setPrompt] = useState('');
  const [inputImage, setInputImage] = useState<File | null>(null);
  const [inputImagePreview, setInputImagePreview] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInputImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setInputImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!user) return;
    
    setIsGenerating(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('type', activeTab);
      formData.append('prompt', prompt);
      formData.append('userId', user.id);
      
      if (inputImage && (activeTab === 'image-to-image' || activeTab === 'image-to-video')) {
        formData.append('inputImage', inputImage);
      }

      const response = await fetch('/api/generation/create', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data.outputUrl);
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const isFormValid = () => {
    if (!prompt.trim()) return false;
    if ((activeTab === 'image-to-image' || activeTab === 'image-to-video') && !inputImage) return false;
    return true;
  };

  const renderGenerationForm = () => {
    const type = GENERATION_TYPES[activeTab];
    const Icon = type.icon;
    const needsImage = activeTab === 'image-to-image' || activeTab === 'image-to-video';

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {type.name}
          </CardTitle>
          <CardDescription>
            Uses {type.workflow} • Costs {type.credits} credits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Prompt Input */}
          <div>
            <Label htmlFor="prompt">
              {activeTab.includes('video') ? 'Video Description' : 'Image Description'}
            </Label>
            <Textarea
              id="prompt"
              placeholder={
                activeTab === 'text-to-image' 
                  ? 'Describe the image you want to generate...'
                  : activeTab === 'image-to-image'
                  ? 'Describe how you want to transform the image...'
                  : activeTab === 'text-to-video'
                  ? 'Describe the video you want to create...'
                  : 'Describe the video transformation...'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Image Upload (for image-to-image and image-to-video) */}
          {needsImage && (
            <div>
              <Label htmlFor="inputImage">Input Image</Label>
              <Input
                id="inputImage"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="mt-1"
              />
              {inputImagePreview && (
                <div className="mt-2">
                  <img
                    src={inputImagePreview}
                    alt="Input preview"
                    className="max-w-full h-40 object-cover rounded border"
                  />
                </div>
              )}
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!isFormValid() || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate ({type.credits} credits)
              </>
            )}
          </Button>

          {/* Result Display */}
          {result && (
            <div className="mt-6">
              <Label>Generated Result</Label>
              <div className="mt-2 p-4 border rounded-lg bg-gray-50">
                {activeTab.includes('video') ? (
                  <video
                    src={result}
                    controls
                    className="max-w-full h-auto rounded"
                    style={{ maxHeight: '400px' }}
                  />
                ) : (
                  <img
                    src={result}
                    alt="Generated image"
                    className="max-w-full h-auto rounded"
                    style={{ maxHeight: '400px' }}
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-600">Please sign in to use the generation tools.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎨 AI Generation Studio
          </h1>
          <p className="text-lg text-gray-600">
            Create images and videos with state-of-the-art AI models
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as GenerationType)}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6">
            {Object.entries(GENERATION_TYPES).map(([key, type]) => {
              const Icon = type.icon;
              return (
                <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{type.name}</span>
                  <span className="sm:hidden">{type.name.split(' ')[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {Object.keys(GENERATION_TYPES).map((type) => (
            <TabsContent key={type} value={type}>
              {renderGenerationForm()}
            </TabsContent>
          ))}
        </Tabs>

        {/* Workflow Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>🔧 AI Workflows</CardTitle>
            <CardDescription>
              Each generation type uses specialized AI models for optimal results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(GENERATION_TYPES).map(([key, type]) => {
                const Icon = type.icon;
                return (
                  <div key={key} className="text-center p-4 bg-gray-50 rounded-lg">
                    <Icon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <h3 className="font-semibold text-sm">{type.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{type.workflow}</p>
                    <p className="text-xs font-medium text-gray-700 mt-1">{type.credits} credits</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
