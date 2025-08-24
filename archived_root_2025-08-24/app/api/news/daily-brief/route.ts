import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'my-ai-saas', 'scripts', 'data', 'daily-brief.json');
    
    // Check if cache file exists
    if (!fs.existsSync(dataPath)) {
      // Return enhanced mock data if cache doesn't exist
      return NextResponse.json({
        date: new Date().toISOString().split('T')[0],
        articles: [
          {
            id: "1",
            title: "Breaking: AI Technology Revolutionizes Content Creation",
            snippet: "Revolutionary artificial intelligence tools are transforming how content creators work, with new multimedia extraction capabilities enabling automated video and image processing across social media platforms...",
            url: "https://example.com/ai-tech-news",
            source: "TechCrunch",
            category: "Technology",
            publish_date: new Date().toISOString(),
            image_url: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=200&fit=crop",
            video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            video_thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
            video_platform: "youtube",
            content_full: "The artificial intelligence landscape continues to evolve rapidly, with new breakthrough technologies emerging that promise to revolutionize content creation and multimedia processing. These advances are particularly significant for social media platforms and news organizations looking to automate content extraction and enhancement processes.",
            author: "Sarah Johnson",
            tags: ["AI", "Technology", "Innovation", "Multimedia"]
          },
          {
            id: "2", 
            title: "Global Markets React to Economic Policy Changes",
            snippet: "Stock markets worldwide are responding to new economic policies, with technology sectors leading significant gains while traditional industries face uncertainty amid changing regulatory landscapes...",
            url: "https://example.com/market-news",
            source: "Reuters",
            category: "Business", 
            publish_date: new Date().toISOString(),
            image_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=200&fit=crop",
            content_full: "Financial markets are experiencing significant volatility as investors digest new economic policy announcements. The technology sector has emerged as a clear winner, with several major companies posting strong quarterly results that exceeded analyst expectations.",
            author: "Michael Chen",
            tags: ["Markets", "Economy", "Finance", "Policy"]
          },
          {
            id: "3",
            title: "Scientific Breakthrough in Renewable Energy Storage",
            snippet: "Researchers have developed a new battery technology that could dramatically improve renewable energy storage capacity, potentially solving one of the biggest challenges facing clean energy adoption...",
            url: "https://example.com/science-news", 
            source: "BBC Science",
            category: "Science",
            publish_date: new Date().toISOString(),
            image_url: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=400&h=200&fit=crop",
            video_url: "https://www.youtube.com/watch?v=ScMzIvxBSi4",
            video_thumbnail: "https://img.youtube.com/vi/ScMzIvxBSi4/maxresdefault.jpg", 
            video_platform: "youtube",
            content_full: "A team of international researchers has announced a major breakthrough in battery technology that could revolutionize renewable energy storage. The new solid-state batteries demonstrate unprecedented energy density and longevity, addressing key limitations that have hindered widespread adoption of renewable energy systems.",
            author: "Dr. Emily Watson",
            tags: ["Science", "Energy", "Environment", "Innovation"]
          },
          {
            id: "4",
            title: "Sports Championship Finals Draw Record Viewership",
            snippet: "The championship finals attracted a global audience of over 500 million viewers, making it one of the most-watched sporting events in history with unprecedented social media engagement...",
            url: "https://example.com/sports-news",
            source: "ESPN",
            category: "Sports",
            publish_date: new Date().toISOString(),
            image_url: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=200&fit=crop",
            content_full: "The championship finals concluded with spectacular performances that captivated audiences worldwide. Social media platforms reported record engagement levels, with fans sharing highlights and commentary throughout the event.",
            author: "James Rodriguez",
            tags: ["Sports", "Championship", "Entertainment", "Global"]
          }
        ],
        categories: ["Technology", "Business", "Science", "Sports"],
        total_articles: 4,
        sources: ["TechCrunch", "Reuters", "BBC Science", "ESPN"],
        last_updated: new Date().toISOString(),
        multimedia_count: {
          with_images: 4,
          with_videos: 2
        }
      });
    }

    // Read and return cached data
    const cachedData = fs.readFileSync(dataPath, 'utf-8');
    const dailyBrief = JSON.parse(cachedData);
    
    // Ensure multimedia_count exists for backward compatibility
    if (!dailyBrief.multimedia_count) {
      const articles = dailyBrief.articles || [];
      dailyBrief.multimedia_count = {
        with_images: articles.filter((a: any) => a.image_url).length,
        with_videos: articles.filter((a: any) => a.video_url).length
      };
    }
    
    return NextResponse.json(dailyBrief);
    
  } catch (error) {
    console.error('Error fetching daily brief:', error);
    
    // Return minimal mock data on error
    return NextResponse.json({
      date: new Date().toISOString().split('T')[0],
      articles: [],
      categories: [],
      total_articles: 0,
      sources: [],
      last_updated: new Date().toISOString(),
      multimedia_count: {
        with_images: 0,
        with_videos: 0
      },
      error: "Failed to fetch news data"
    });
  }
}
