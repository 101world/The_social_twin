'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, Server, Cloud, RefreshCw, TrendingUp, Activity, AlertTriangle, CheckCircle, Users, BarChart3, Zap, Save, Upload } from 'lucide-react';

interface RunPodConfig {
  id?: string;
  mode: 'image' | 'video' | 'text' | 'image-modify';
  url: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface StableEndpoint {
  id?: string;
  mode: 'image' | 'video' | 'text' | 'image-modify';
  cloudflare_url: string;
  is_active: boolean;
  runpod_endpoints: RunPodEndpoint[];
  created_at?: string;
  updated_at?: string;
}

interface RunPodEndpoint {
  id?: string;
  stable_endpoint_id?: string;
  name: string;
  url: string;
  is_active: boolean;
  priority: number;
  health_status?: 'healthy' | 'unhealthy' | 'unknown';
  last_checked?: string;
  response_time?: number;
  created_at?: string;
  updated_at?: string;
}

interface CloudflareConfig {
  account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket: string;
  r2_public_url: string;
}

interface AnalyticsData {
  userMetrics: {
    totalUsers: number;
    activeUsers: number;
    growthRate: number;
    trend: 'growing' | 'stable' | 'declining';
  };
  generationMetrics: {
    last7Days: number;
    previous7Days: number;
    avgDailyGenerations: number;
    dailyBreakdown: Array<{ date: string; count: number }>;
  };
  scaling: {
    currentPods: number;
    recommendedPods: number;
    needsScaling: boolean;
    scalingUrgency: 'low' | 'medium' | 'high';
  };
  systemHealth: {
    runpodConfigs: number;
    lastUpdated: string;
  };
}

interface ScalingData {
  healthChecks: Array<{
    id: string;
    mode: string;
    url: string;
    isHealthy: boolean;
    responseTime: number;
    error: string | null;
    lastChecked: string;
  }>;
  loadStats: { [url: string]: number };
  recommendations: Array<{
    type: 'critical' | 'warning' | 'info' | 'suggestion';
    message: string;
    action: string;
    affected: string[];
  }>;
  summary: {
    totalPods: number;
    healthyPods: number;
    unhealthyPods: number;
    avgResponseTime: number;
    totalLoad: number;
    optimalPods: number;
  };
}

export default function AdminPage() {
  const [configs, setConfigs] = useState<RunPodConfig[]>([]);
  const [stableEndpoints, setStableEndpoints] = useState<StableEndpoint[]>([]);
  const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig>({
    account_id: '',
    r2_access_key_id: '',
    r2_secret_access_key: '',
    r2_bucket: '',
    r2_public_url: ''
  });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [scaling, setScaling] = useState<ScalingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [accessCode, setAccessCode] = useState('9820571837');
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authError, setAuthError] = useState('');
  
  // New state for endpoint management
  const [endpoints, setEndpoints] = useState({
    textToImage: '',
    imageToImage: '',
    textToVideo: '',
    imageToVideo: ''
  });
  
  // New state for explore content
  const [exploreContent, setExploreContent] = useState<any[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // New state for user lookup
  const [searchUsername, setSearchUsername] = useState('');
  const [userReport, setUserReport] = useState<any>(null);
  const [loadingUserReport, setLoadingUserReport] = useState(false);

  // Check if user entered correct access code
  const ADMIN_CODE = '9820571837';

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode === ADMIN_CODE) {
      setIsAuthenticated(true);
      setAuthError('');
      loadConfigs();
      loadCloudflareConfig();
      loadAnalytics();
      loadScaling();
    } else {
      setAuthError('Invalid access code. Please try again.');
      setAccessCode('');
    }
  };

  useEffect(() => {
    // Auto-authenticate with the correct code
    if (accessCode === ADMIN_CODE && !isAuthenticated) {
      setIsAuthenticated(true);
      loadConfigs();
      loadStableEndpoints();
      loadCloudflareConfig();
      loadAnalytics();
      loadScaling();
      loadEndpoints();
      loadExploreContent();
    }
  }, [accessCode, isAuthenticated]);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadConfigs = async () => {
    try {
      const response = await fetch(`/api/admin/runpod-config?code=${accessCode}`);
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStableEndpoints = async () => {
    try {
      const response = await fetch(`/api/admin/stable-endpoints?code=${accessCode}`);
      if (response.ok) {
        const data = await response.json();
        setStableEndpoints(data.endpoints || []);
      }
    } catch (error) {
      console.error('Failed to load stable endpoints:', error);
    }
  };

  const loadCloudflareConfig = async () => {
    try {
      const response = await fetch(`/api/admin/cloudflare-config?code=${accessCode}`);
      if (response.ok) {
        const data = await response.json();
        setCloudflareConfig(data);
      }
    } catch (error) {
      console.error('Failed to load Cloudflare config:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch(`/api/admin/analytics?code=${accessCode}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const loadScaling = async () => {
    try {
      const response = await fetch(`/api/admin/scaling?code=${accessCode}`);
      if (response.ok) {
        const data = await response.json();
        setScaling(data);
      }
    } catch (error) {
      console.error('Failed to load scaling data:', error);
    }
  };

  const loadEndpoints = async () => {
    try {
      const response = await fetch('/api/admin/endpoints');
      if (response.ok) {
        const data = await response.json();
        setEndpoints(data.endpoints);
      }
    } catch (error) {
      console.error('Failed to load endpoints:', error);
    }
  };

  const loadExploreContent = async () => {
    try {
      const response = await fetch('/api/admin/explore-content');
      if (response.ok) {
        const data = await response.json();
        setExploreContent(data.content);
      }
    } catch (error) {
      console.error('Failed to load explore content:', error);
    }
  };

  const saveConfig = async (config: RunPodConfig) => {
    setSaving(true);
    try {
      const method = config.id ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/runpod-config', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, code: accessCode })
      });

      if (response.ok) {
        setMessage('Configuration saved successfully!');
        loadConfigs();
      } else {
        setMessage('Failed to save configuration');
      }
    } catch (error) {
      setMessage('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const saveStableEndpoint = async (endpoint: StableEndpoint) => {
    setSaving(true);
    try {
      const method = endpoint.id ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/stable-endpoints', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...endpoint, code: accessCode })
      });

      if (response.ok) {
        setMessage('Stable endpoint saved successfully!');
        loadStableEndpoints();
      } else {
        setMessage('Failed to save stable endpoint');
      }
    } catch (error) {
      setMessage('Error saving stable endpoint');
    } finally {
      setSaving(false);
    }
  };

  const addRunPodEndpoint = async (mode: string, runpodEndpoint: Omit<RunPodEndpoint, 'id' | 'stable_endpoint_id'>) => {
    setSaving(true);
    try {
      // Find or create the stable endpoint for this mode
      let stableEndpointId = null;
      const existingEndpoint = stableEndpoints.find(ep => ep.mode === mode);
      
      if (existingEndpoint) {
        stableEndpointId = existingEndpoint.id;
      } else {
        // Create a stable endpoint for this mode if it doesn't exist
        const stableUrls = {
          'image': 'https://pub-102b16bada6e4980b2f8f0a3a630847c.r2.dev/image-generation',
          'video': 'https://pub-102b16bada6e4980b2f8f0a3a630847c.r2.dev/video-generation',
          'image-modify': 'https://pub-102b16bada6e4980b2f8f0a3a630847c.r2.dev/image-modify'
        };

        const response = await fetch('/api/admin/stable-endpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            mode,
            cloudflare_url: stableUrls[mode as keyof typeof stableUrls],
            is_active: true,
            code: accessCode 
          })
        });

        if (response.ok) {
          const newEndpoint = await response.json();
          stableEndpointId = newEndpoint.endpoint.id;
          loadStableEndpoints(); // Refresh the list
        } else {
          throw new Error('Failed to create stable endpoint');
        }
      }

      if (!stableEndpointId) {
        throw new Error('Could not determine stable endpoint ID');
      }

      const response = await fetch('/api/admin/runpod-endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...runpodEndpoint, 
          stable_endpoint_id: stableEndpointId,
          code: accessCode 
        })
      });

      if (response.ok) {
        setMessage('RunPod endpoint added successfully!');
        loadStableEndpoints();
      } else {
        setMessage('Failed to add RunPod endpoint');
      }
    } catch (error) {
      setMessage('Error adding RunPod endpoint');
    } finally {
      setSaving(false);
    }
  };

  const toggleRunPodEndpoint = async (endpointId: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/admin/runpod-endpoints', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: endpointId,
          is_active: !isActive,
          code: accessCode 
        })
      });

      if (response.ok) {
        setMessage('RunPod endpoint updated successfully!');
        loadStableEndpoints();
      }
    } catch (error) {
      setMessage('Error updating RunPod endpoint');
    }
  };

  const deleteRunPodEndpoint = async (endpointId: string) => {
    try {
      const response = await fetch('/api/admin/runpod-endpoints', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: endpointId, code: accessCode })
      });

      if (response.ok) {
        setMessage('RunPod endpoint deleted successfully!');
        loadStableEndpoints();
      }
    } catch (error) {
      setMessage('Error deleting RunPod endpoint');
    }
  };

  const toggleConfig = async (config: RunPodConfig) => {
    const updated = { ...config, is_active: !config.is_active };
    await saveConfig(updated);
  };

  const deleteConfig = async (id: string) => {
    try {
      const response = await fetch('/api/admin/runpod-config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, code: accessCode })
      });

      if (response.ok) {
        setMessage('Configuration deleted successfully!');
        loadConfigs();
      }
    } catch (error) {
      setMessage('Error deleting configuration');
    }
  };

  const saveCloudflareConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/cloudflare-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cloudflareConfig, code: accessCode })
      });

      if (response.ok) {
        setMessage('Cloudflare configuration saved successfully!');
      } else {
        setMessage('Failed to save Cloudflare configuration');
      }
    } catch (error) {
      setMessage('Error saving Cloudflare configuration');
    } finally {
      setSaving(false);
    }
  };

  const testEndpoint = async (url: string) => {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const saveEndpoints = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endpoints)
      });
      
      if (response.ok) {
        setMessage('Endpoints updated successfully!');
      } else {
        throw new Error('Failed to save endpoints');
      }
    } catch (error) {
      setMessage('Error saving endpoints');
    } finally {
      setSaving(false);
    }
  };

  const uploadExploreContent = async () => {
    if (!uploadFile || !uploadTitle) return;
    
    setUploading(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle);
      formData.append('description', uploadDescription);
      
      const response = await fetch('/api/admin/explore-content', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const newContent = await response.json();
        setExploreContent(prev => [...prev, newContent]);
        setUploadFile(null);
        setUploadTitle('');
        setUploadDescription('');
        setMessage('Content uploaded successfully!');
      } else {
        throw new Error('Failed to upload content');
      }
    } catch (error) {
      setMessage('Error uploading content');
    } finally {
      setUploading(false);
    }
  };

  const removeExploreContent = async (contentId: string) => {
    try {
      const response = await fetch(`/api/admin/explore-content?id=${contentId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setExploreContent(prev => prev.filter(item => item.id !== contentId));
        setMessage('Content removed successfully!');
      } else {
        throw new Error('Failed to remove content');
      }
    } catch (error) {
      setMessage('Error removing content');
    }
  };

  const searchUser = async () => {
    if (!searchUsername.trim()) return;
    
    setLoadingUserReport(true);
    try {
      const response = await fetch(`/api/admin/user-report?username=${encodeURIComponent(searchUsername)}&code=${accessCode}`);
      
      if (response.ok) {
        const data = await response.json();
        setUserReport(data);
        setMessage(`User report generated for ${searchUsername}`);
      } else {
        const error = await response.json();
        setMessage(error.message || 'Failed to fetch user report');
        setUserReport(null);
      }
    } catch (error) {
      setMessage('Error fetching user report');
      setUserReport(null);
    } finally {
      setLoadingUserReport(false);
    }
  };

  if (loading && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-8 h-8" />
            Admin Configuration Panel
          </h1>
          <p className="text-gray-600 mt-2">
            Manage RunPod URLs and Cloudflare configurations
          </p>
        </div>

        {message && (
          <Alert className="mb-6">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="scaling" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Auto Scaling
            </TabsTrigger>
            <TabsTrigger value="stable-endpoints" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              RunPod Backends
            </TabsTrigger>
            <TabsTrigger value="runpod" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              RunPod Config
            </TabsTrigger>
            <TabsTrigger value="endpoints" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="explore" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Explore Content
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              User Lookup
            </TabsTrigger>
            <TabsTrigger value="cloudflare" className="flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              Cloudflare
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              System Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* User Metrics Cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.userMetrics.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Registered users
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.userMetrics.activeUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${(analytics?.userMetrics.growthRate || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {analytics?.userMetrics.growthRate || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analytics?.userMetrics.trend || 'stable'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Daily Generations</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics?.generationMetrics.avgDailyGenerations || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Average per day
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Generation Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Generation Trends (Last 30 Days)</CardTitle>
                <CardDescription>
                  Daily generation activity over the past month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  {analytics?.generationMetrics.dailyBreakdown.length ? (
                    <div className="w-full">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Last 7 days: {analytics.generationMetrics.last7Days}</span>
                        <span>Previous 7 days: {analytics.generationMetrics.previous7Days}</span>
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {analytics.generationMetrics.dailyBreakdown.slice(-7).map((day, index) => (
                          <div key={day.date} className="text-center">
                            <div
                              className="bg-blue-500 rounded-t mx-auto"
                              style={{
                                height: `${Math.min((day.count / Math.max(...analytics.generationMetrics.dailyBreakdown.map(d => d.count))) * 100, 100)}px`,
                                width: '20px',
                                minHeight: '4px'
                              }}
                            ></div>
                            <div className="text-xs mt-1">{new Date(day.date).getDate()}</div>
                            <div className="text-xs text-muted-foreground">{day.count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>No data available</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scaling" className="space-y-6">
            {/* Scaling Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Auto Scaling Recommendations
                </CardTitle>
                <CardDescription>
                  AI-powered recommendations based on user growth and system load
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {scaling?.recommendations.map((rec, index) => (
                  <Alert key={index} className={
                    rec.type === 'critical' ? 'border-red-500 bg-red-50' :
                    rec.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                    rec.type === 'info' ? 'border-blue-500 bg-blue-50' :
                    'border-green-500 bg-green-50'
                  }>
                    <div className="flex items-start gap-3">
                      {rec.type === 'critical' && <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />}
                      {rec.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />}
                      {rec.type === 'info' && <Activity className="w-5 h-5 text-blue-500 mt-0.5" />}
                      {rec.type === 'suggestion' && <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />}
                      <div className="flex-1">
                        <div className="font-medium">{rec.message}</div>
                        <div className="text-sm text-muted-foreground mt-1">{rec.action}</div>
                        {rec.affected.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Affected: {rec.affected.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </Alert>
                ))}
                {(!scaling?.recommendations || scaling.recommendations.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p>All systems running optimally!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Health Check Status */}
            <Card>
              <CardHeader>
                <CardTitle>RunPod Health Status</CardTitle>
                <CardDescription>
                  Real-time health monitoring of all RunPod endpoints
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {scaling?.healthChecks.map((check) => (
                    <div key={check.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${check.isHealthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div>
                          <div className="font-medium capitalize">{check.mode}</div>
                          <div className="text-sm text-muted-foreground font-mono">{check.url}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${check.isHealthy ? 'text-green-600' : 'text-red-600'}`}>
                          {check.isHealthy ? 'Healthy' : 'Unhealthy'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {check.responseTime}ms response
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scaling Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Current Pods</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{scaling?.summary.totalPods || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {scaling?.summary.healthyPods || 0} healthy, {scaling?.summary.unhealthyPods || 0} unhealthy
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recommended Pods</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{scaling?.summary.optimalPods || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Based on current load
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Avg Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{scaling?.summary.avgResponseTime || 0}ms</div>
                  <p className="text-xs text-muted-foreground">
                    Across all endpoints
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="stable-endpoints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>RunPod Backend Management</CardTitle>
                <CardDescription>
                  Manage RunPod backends for Image and Video generation under your stable Cloudflare R2 URLs. 
                  Text generation is already configured with a stable Cloudflare worker and doesn't need admin management.
                  The Cloudflare URLs are permanent infrastructure - you can only add/remove RunPod backends for scaling.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Predefined Stable Endpoints */}
                <div className="space-y-6">
                  {/* Image Generation Section */}
                  <PrebuiltEndpointCard
                    mode="image"
                    cloudflareUrl="https://pub-102b16bada6e4980b2f8f0a3a630847c.r2.dev/image-generation"
                    runpodEndpoints={stableEndpoints.find(ep => ep.mode === 'image')?.runpod_endpoints || []}
                    onAddRunPod={addRunPodEndpoint}
                    onToggleRunPod={toggleRunPodEndpoint}
                    onDeleteRunPod={deleteRunPodEndpoint}
                    saving={saving}
                  />

                  {/* Video Generation Section */}
                  <PrebuiltEndpointCard
                    mode="video"
                    cloudflareUrl="https://pub-102b16bada6e4980b2f8f0a3a630847c.r2.dev/video-generation"
                    runpodEndpoints={stableEndpoints.find(ep => ep.mode === 'video')?.runpod_endpoints || []}
                    onAddRunPod={addRunPodEndpoint}
                    onToggleRunPod={toggleRunPodEndpoint}
                    onDeleteRunPod={deleteRunPodEndpoint}
                    saving={saving}
                  />

                  {/* Image Modify Section */}
                  <PrebuiltEndpointCard
                    mode="image-modify"
                    cloudflareUrl="https://pub-102b16bada6e4980b2f8f0a3a630847c.r2.dev/image-modify"
                    runpodEndpoints={stableEndpoints.find(ep => ep.mode === 'image-modify')?.runpod_endpoints || []}
                    onAddRunPod={addRunPodEndpoint}
                    onToggleRunPod={toggleRunPodEndpoint}
                    onDeleteRunPod={deleteRunPodEndpoint}
                    saving={saving}
                  />

                  {/* Text Generation Info (Read-only) */}
                  <Card className="border-2 border-blue-100 bg-gradient-to-r from-blue-25 to-indigo-25 opacity-75">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-3">
                            <span className="text-2xl">📝</span>
                            <div>
                              <div className="capitalize">Text Generation</div>
                              <div className="text-sm font-normal text-muted-foreground">Already Configured with Stable Cloudflare Worker</div>
                            </div>
                          </CardTitle>
                          <CardDescription className="mt-2 font-mono text-blue-700 bg-blue-100 px-3 py-1 rounded-md break-all">
                            Using existing stable Cloudflare worker URL
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                            ✅ Pre-configured
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-6 text-blue-600">
                        <div className="text-sm">Text generation is already configured with a stable Cloudflare worker.</div>
                        <div className="text-xs mt-1">No admin management needed for this endpoint.</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runpod" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>RunPod Endpoint Configuration</CardTitle>
                <CardDescription>
                  Configure URLs for different generation modes. These will be used by the Cloudflare Worker.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Config Form */}
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-lg">Add New Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RunPodConfigForm onSave={saveConfig} saving={saving} />
                  </CardContent>
                </Card>

                {/* Existing Configs */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Active Configurations</h3>
                  {configs.filter(c => c.is_active).map((config) => (
                    <RunPodConfigCard
                      key={config.id}
                      config={config}
                      onToggle={toggleConfig}
                      onDelete={deleteConfig}
                      onTest={testEndpoint}
                    />
                  ))}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Inactive Configurations</h3>
                  {configs.filter(c => !c.is_active).map((config) => (
                    <RunPodConfigCard
                      key={config.id}
                      config={config}
                      onToggle={toggleConfig}
                      onDelete={deleteConfig}
                      onTest={testEndpoint}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Lookup & Reports</CardTitle>
                <CardDescription>
                  Search for any user by username or email to view detailed activity reports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Search Form */}
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="search-username">Username or Email</Label>
                    <Input
                      id="search-username"
                      value={searchUsername}
                      onChange={(e) => setSearchUsername(e.target.value)}
                      placeholder="Enter username or email address"
                      onKeyDown={(e) => e.key === 'Enter' && searchUser()}
                    />
                  </div>
                  <Button 
                    onClick={searchUser} 
                    disabled={!searchUsername.trim() || loadingUserReport}
                    className="px-6"
                  >
                    {loadingUserReport ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                    Search User
                  </Button>
                </div>

                {/* User Report Results */}
                {userReport && (
                  <div className="space-y-6">
                    {/* User Basic Info */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          User Profile: {userReport.user?.username || userReport.user?.email}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{userReport.stats?.totalGenerations || 0}</div>
                            <div className="text-sm text-blue-800">Total Generations</div>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{userReport.stats?.currentCredits || 0}</div>
                            <div className="text-sm text-green-800">Current Credits</div>
                          </div>
                          <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">
                              {userReport.user?.created_at ? Math.floor((Date.now() - new Date(userReport.user.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                            </div>
                            <div className="text-sm text-purple-800">Days Active</div>
                          </div>
                          <div className="text-center p-4 bg-orange-50 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">{userReport.stats?.last7Days || 0}</div>
                            <div className="text-sm text-orange-800">Last 7 Days</div>
                          </div>
                        </div>
                        
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold mb-2">Account Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>User ID:</span>
                                <span className="font-mono">{userReport.user?.id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Email:</span>
                                <span>{userReport.user?.email || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Username:</span>
                                <span>{userReport.user?.username || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Joined:</span>
                                <span>{userReport.user?.created_at ? new Date(userReport.user.created_at).toLocaleDateString() : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-semibold mb-2">Usage Pattern</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Most Used Mode:</span>
                                <span className="capitalize">{userReport.stats?.favoriteMode || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Avg Daily Usage:</span>
                                <span>{userReport.stats?.avgDaily || 0} generations</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Peak Day:</span>
                                <span>{userReport.stats?.peakDay || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Last Activity:</span>
                                <span>{userReport.stats?.lastActivity ? new Date(userReport.stats.lastActivity).toLocaleDateString() : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Recent Activity */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Activity (Last 10 Generations)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {userReport.recentActivity?.length ? (
                          <div className="space-y-3">
                            {userReport.recentActivity.map((activity: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full ${
                                    activity.status === 'completed' ? 'bg-green-500' : 
                                    activity.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                                  }`}></div>
                                  <div>
                                    <div className="font-medium capitalize">{activity.mode} Generation</div>
                                    <div className="text-sm text-gray-600 truncate max-w-md">
                                      {activity.prompt?.substring(0, 60)}...
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">{activity.status}</div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(activity.created_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No recent activity found for this user</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Generation Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Generation Types</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {userReport.generationTypes ? (
                            <div className="space-y-3">
                              {Object.entries(userReport.generationTypes).map(([type, count]: [string, any]) => (
                                <div key={type} className="flex justify-between items-center">
                                  <span className="capitalize">{type}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-blue-500 h-2 rounded-full" 
                                        style={{ width: `${Math.min((count / Math.max(...Object.values(userReport.generationTypes).map(Number))) * 100, 100)}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm font-medium w-8">{count}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">No data available</div>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Credit History</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {userReport.creditHistory?.length ? (
                            <div className="space-y-2">
                              {userReport.creditHistory.slice(0, 5).map((transaction: any, index: number) => (
                                <div key={index} className="flex justify-between items-center text-sm">
                                  <span>{transaction.type}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                                      {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                                    </span>
                                    <span className="text-gray-500 text-xs">
                                      {new Date(transaction.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground">No credit history found</div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!userReport && !loadingUserReport && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Search for User Reports</h3>
                    <p>Enter a username or email address above to generate a detailed user activity report</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cloudflare" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cloudflare Configuration</CardTitle>
                <CardDescription>
                  Manage Cloudflare Worker and R2 settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="account-id">Cloudflare Account ID</Label>
                    <Input
                      id="account-id"
                      value={cloudflareConfig.account_id}
                      onChange={(e) => setCloudflareConfig(prev => ({ ...prev, account_id: e.target.value }))}
                      placeholder="3ff138c0d92e8be71bc0b0ae8078bdf9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="r2-access-key">R2 Access Key ID</Label>
                    <Input
                      id="r2-access-key"
                      value={cloudflareConfig.r2_access_key_id}
                      onChange={(e) => setCloudflareConfig(prev => ({ ...prev, r2_access_key_id: e.target.value }))}
                      placeholder="95e50b675daf79a34ce0defbc8578200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="r2-secret-key">R2 Secret Access Key</Label>
                    <Input
                      id="r2-secret-key"
                      type="password"
                      value={cloudflareConfig.r2_secret_access_key}
                      onChange={(e) => setCloudflareConfig(prev => ({ ...prev, r2_secret_access_key: e.target.value }))}
                      placeholder="c86abfbec5d3caa2e568981194459a34442d61aad15a0460a3fd43315feede98"
                    />
                  </div>
                  <div>
                    <Label htmlFor="r2-bucket">R2 Bucket Name</Label>
                    <Input
                      id="r2-bucket"
                      value={cloudflareConfig.r2_bucket}
                      onChange={(e) => setCloudflareConfig(prev => ({ ...prev, r2_bucket: e.target.value }))}
                      placeholder="the-social-twin-storage"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="r2-public-url">R2 Public URL</Label>
                    <Input
                      id="r2-public-url"
                      value={cloudflareConfig.r2_public_url}
                      onChange={(e) => setCloudflareConfig(prev => ({ ...prev, r2_public_url: e.target.value }))}
                      placeholder="https://ced616f33f6492fd708a8e897b61b953.r2.cloudflarestorage.com"
                    />
                  </div>
                </div>
                <Button onClick={saveCloudflareConfig} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Cloudflare Configuration
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>
                  Overview of your current configuration and system health
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">RunPod Endpoints</h4>
                    <div className="space-y-2">
                      {['image', 'video', 'text', 'image-modify'].map(mode => {
                        const config = configs.find(c => c.mode === mode && c.is_active);
                        return (
                          <div key={mode} className="flex items-center justify-between">
                            <span className="capitalize">{mode}:</span>
                            <span className={`text-sm ${config ? 'text-green-600' : 'text-red-600'}`}>
                              {config ? '✅ Configured' : '❌ Missing'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Cloudflare Status</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span>Account ID:</span>
                        <span className={`text-sm ${cloudflareConfig.account_id ? 'text-green-600' : 'text-red-600'}`}>
                          {cloudflareConfig.account_id ? '✅ Set' : '❌ Missing'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>R2 Access Key:</span>
                        <span className={`text-sm ${cloudflareConfig.r2_access_key_id ? 'text-green-600' : 'text-red-600'}`}>
                          {cloudflareConfig.r2_access_key_id ? '✅ Set' : '❌ Missing'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>R2 Bucket:</span>
                        <span className={`text-sm ${cloudflareConfig.r2_bucket ? 'text-green-600' : 'text-red-600'}`}>
                          {cloudflareConfig.r2_bucket ? '✅ Set' : '❌ Missing'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>R2 Public URL:</span>
                        <span className={`text-sm ${cloudflareConfig.r2_public_url ? 'text-green-600' : 'text-red-600'}`}>
                          {cloudflareConfig.r2_public_url ? '✅ Set' : '❌ Missing'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>RunPod Endpoint Management</CardTitle>
                <CardDescription>
                  Manage and update RunPod endpoints for scaling as your user base grows
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="text-to-image">Text to Image Endpoint</Label>
                    <Input
                      id="text-to-image"
                      value={endpoints.textToImage}
                      onChange={(e) => setEndpoints(prev => ({ ...prev, textToImage: e.target.value }))}
                      placeholder="https://api.runpod.ai/v2/your-endpoint-id/run"
                    />
                  </div>
                  <div>
                    <Label htmlFor="image-to-image">Image to Image Endpoint</Label>
                    <Input
                      id="image-to-image"
                      value={endpoints.imageToImage}
                      onChange={(e) => setEndpoints(prev => ({ ...prev, imageToImage: e.target.value }))}
                      placeholder="https://api.runpod.ai/v2/your-endpoint-id/run"
                    />
                  </div>
                  <div>
                    <Label htmlFor="text-to-video">Text to Video Endpoint</Label>
                    <Input
                      id="text-to-video"
                      value={endpoints.textToVideo}
                      onChange={(e) => setEndpoints(prev => ({ ...prev, textToVideo: e.target.value }))}
                      placeholder="https://api.runpod.ai/v2/your-endpoint-id/run"
                    />
                  </div>
                  <div>
                    <Label htmlFor="image-to-video">Image to Video Endpoint</Label>
                    <Input
                      id="image-to-video"
                      value={endpoints.imageToVideo}
                      onChange={(e) => setEndpoints(prev => ({ ...prev, imageToVideo: e.target.value }))}
                      placeholder="https://api.runpod.ai/v2/your-endpoint-id/run"
                    />
                  </div>
                </div>
                <Button onClick={saveEndpoints} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Update Endpoints
                </Button>
                
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Endpoint Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(endpoints).map(([key, url]) => (
                      <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                          <div className="text-sm text-muted-foreground font-mono truncate">{url || 'Not configured'}</div>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${url ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="explore" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Explore Content Management</CardTitle>
                <CardDescription>
                  Upload and manage content for the explore page to showcase platform capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload New Content */}
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-lg">Upload New Content</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="content-file">Select File</Label>
                      <Input
                        id="content-file"
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="content-title">Title</Label>
                      <Input
                        id="content-title"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Amazing AI Generation"
                      />
                    </div>
                    <div>
                      <Label htmlFor="content-description">Description</Label>
                      <Input
                        id="content-description"
                        value={uploadDescription}
                        onChange={(e) => setUploadDescription(e.target.value)}
                        placeholder="Describe this content..."
                      />
                    </div>
                    <Button 
                      onClick={uploadExploreContent} 
                      disabled={!uploadFile || !uploadTitle || uploading}
                      className="w-full"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      Upload to R2 & Add to Explore
                    </Button>
                  </CardContent>
                </Card>

                {/* Existing Content */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Current Explore Content</h3>
                  {exploreContent.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No content uploaded yet. Add some content to showcase on the explore page!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {exploreContent.map((content: any, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="aspect-square bg-neutral-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                              {content.file_type?.startsWith('video/') ? (
                                <video 
                                  src={content.file_url} 
                                  className="w-full h-full object-cover rounded-lg"
                                  muted
                                  loop
                                  onMouseEnter={(e) => e.currentTarget.play()}
                                  onMouseLeave={(e) => e.currentTarget.pause()}
                                />
                              ) : content.file_type?.startsWith('image/') ? (
                                <img 
                                  src={content.file_url} 
                                  alt={content.title}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <div className="text-muted-foreground">File Preview</div>
                              )}
                            </div>
                            <h4 className="font-medium truncate">{content.title}</h4>
                            <p className="text-sm text-muted-foreground truncate">{content.description}</p>
                            <div className="flex justify-between items-center mt-3">
                              <span className="text-xs text-muted-foreground">
                                {new Date(content.upload_date).toLocaleDateString()}
                              </span>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => removeExploreContent(content.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Component for the RunPod config form
function RunPodConfigForm({ onSave, saving }: { onSave: (config: RunPodConfig) => void; saving: boolean }) {
  const [mode, setMode] = useState<RunPodConfig['mode']>('image');
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ mode, url, is_active: true });
    setUrl('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="mode">Mode</Label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as RunPodConfig['mode'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="image">Image Generation</option>
            <option value="image-modify">Image Modification</option>
            <option value="video">Video Generation</option>
            <option value="text">Text Generation</option>
          </select>
        </div>
        <div>
          <Label htmlFor="url">RunPod URL</Label>
          <Input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-runpod-endpoint.com"
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={saving || !url}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Add Configuration
      </Button>
    </form>
  );
}

// Component for displaying individual RunPod configs
function RunPodConfigCard({
  config,
  onToggle,
  onDelete,
  onTest
}: {
  config: RunPodConfig;
  onToggle: (config: RunPodConfig) => void;
  onDelete: (id: string) => void;
  onTest: (url: string) => Promise<boolean>;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const handleTest = async () => {
    setTesting(true);
    const result = await onTest(config.url);
    setTestResult(result);
    setTesting(false);
  };

  return (
    <Card className={`transition-all ${config.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium capitalize">{config.mode}</span>
              <span className={`px-2 py-1 text-xs rounded-full ${config.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {config.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-gray-600 font-mono break-all">{config.url}</p>
            {config.updated_at && (
              <p className="text-xs text-gray-500 mt-1">
                Updated: {new Date(config.updated_at).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test'}
            </Button>
            {testResult !== null && (
              <span className={`text-sm ${testResult ? 'text-green-600' : 'text-red-600'}`}>
                {testResult ? '✅' : '❌'}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggle(config)}
            >
              {config.is_active ? 'Disable' : 'Enable'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => config.id && onDelete(config.id)}
              className="text-red-600 hover:text-red-800"
            >
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Component for creating new stable endpoints
function StableEndpointForm({ onSave, saving }: { onSave: (endpoint: StableEndpoint) => void; saving: boolean }) {
  const [mode, setMode] = useState<StableEndpoint['mode']>('image');
  const [cloudflareUrl, setCloudflareUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      mode, 
      cloudflare_url: cloudflareUrl, 
      is_active: true,
      runpod_endpoints: []
    });
    setCloudflareUrl('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="stable-mode">Generation Mode</Label>
          <select
            id="stable-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as StableEndpoint['mode'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="image">Image Generation</option>
            <option value="image-modify">Image Modification</option>
            <option value="video">Video Generation</option>
            <option value="text">Text Generation</option>
          </select>
        </div>
        <div>
          <Label htmlFor="cloudflare-url">Stable Cloudflare URL</Label>
          <Input
            id="cloudflare-url"
            value={cloudflareUrl}
            onChange={(e) => setCloudflareUrl(e.target.value)}
            placeholder="https://your-worker.username.workers.dev"
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={saving || !cloudflareUrl}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Create Stable Endpoint
      </Button>
    </form>
  );
}

// Component for managing predefined stable endpoints with RunPod backends
function PrebuiltEndpointCard({
  mode,
  cloudflareUrl,
  runpodEndpoints,
  onAddRunPod,
  onToggleRunPod,
  onDeleteRunPod,
  saving
}: {
  mode: string;
  cloudflareUrl: string;
  runpodEndpoints: RunPodEndpoint[];
  onAddRunPod: (mode: string, runpodEndpoint: Omit<RunPodEndpoint, 'id' | 'stable_endpoint_id'>) => void;
  onToggleRunPod: (endpointId: string, isActive: boolean) => void;
  onDeleteRunPod: (endpointId: string) => void;
  saving: boolean;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEndpointName, setNewEndpointName] = useState('');
  const [newEndpointUrl, setNewEndpointUrl] = useState('');
  const [newEndpointPriority, setNewEndpointPriority] = useState(1);

  const handleAddRunPod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEndpointName || !newEndpointUrl) return;

    onAddRunPod(mode, {
      name: newEndpointName,
      url: newEndpointUrl,
      is_active: true,
      priority: newEndpointPriority
    });

    // Reset form
    setNewEndpointName('');
    setNewEndpointUrl('');
    setNewEndpointPriority(1);
    setShowAddForm(false);
  };

  const activeEndpoints = runpodEndpoints?.filter(ep => ep.is_active) || [];
  const inactiveEndpoints = runpodEndpoints?.filter(ep => !ep.is_active) || [];

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'image': return '🖼️';
      case 'video': return '🎬';
      case 'text': return '📝';
      case 'image-modify': return '🎨';
      default: return '⚡';
    }
  };

  const getModeTitle = (mode: string) => {
    switch (mode) {
      case 'image': return 'Image Generation';
      case 'video': return 'Video Generation';
      case 'text': return 'Text Generation';
      case 'image-modify': return 'Image Modification';
      default: return mode;
    }
  };

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3">
              <span className="text-2xl">{getModeIcon(mode)}</span>
              <div>
                <div className="capitalize">{getModeTitle(mode)}</div>
                <div className="text-sm font-normal text-muted-foreground">Stable Cloudflare Endpoint</div>
              </div>
            </CardTitle>
            <CardDescription className="mt-2 font-mono text-blue-700 bg-blue-100 px-3 py-1 rounded-md break-all">
              {cloudflareUrl}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded-full">
              ✅ Always Active
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-white"
            >
              Add RunPod Backend
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add RunPod Form */}
        {showAddForm && (
          <Card className="border-dashed bg-white">
            <CardContent className="pt-4">
              <form onSubmit={handleAddRunPod} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor={`endpoint-name-${mode}`}>Backend Name</Label>
                    <Input
                      id={`endpoint-name-${mode}`}
                      value={newEndpointName}
                      onChange={(e) => setNewEndpointName(e.target.value)}
                      placeholder="Main GPU Server"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`endpoint-url-${mode}`}>RunPod URL</Label>
                    <Input
                      id={`endpoint-url-${mode}`}
                      value={newEndpointUrl}
                      onChange={(e) => setNewEndpointUrl(e.target.value)}
                      placeholder="https://your-runpod-endpoint.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`endpoint-priority-${mode}`}>Priority (1-10)</Label>
                    <Input
                      id={`endpoint-priority-${mode}`}
                      type="number"
                      min="1"
                      max="10"
                      value={newEndpointPriority}
                      onChange={(e) => setNewEndpointPriority(parseInt(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || !newEndpointName || !newEndpointUrl}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add Backend
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Active RunPod Endpoints */}
        {activeEndpoints.length > 0 && (
          <div>
            <h4 className="font-medium text-green-700 mb-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              Active Backends ({activeEndpoints.length})
            </h4>
            <div className="space-y-2">
              {activeEndpoints.map((runpodEndpoint) => (
                <div key={runpodEndpoint.id} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div>
                      <div className="font-medium">{runpodEndpoint.name}</div>
                      <div className="text-sm text-gray-600 font-mono">{runpodEndpoint.url}</div>
                      <div className="text-xs text-gray-500">Priority: {runpodEndpoint.priority}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {runpodEndpoint.health_status && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        runpodEndpoint.health_status === 'healthy' ? 'bg-green-100 text-green-800' :
                        runpodEndpoint.health_status === 'unhealthy' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {runpodEndpoint.health_status}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runpodEndpoint.id && onToggleRunPod(runpodEndpoint.id, runpodEndpoint.is_active)}
                    >
                      Disable
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runpodEndpoint.id && onDeleteRunPod(runpodEndpoint.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inactive RunPod Endpoints */}
        {inactiveEndpoints.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              Inactive Backends ({inactiveEndpoints.length})
            </h4>
            <div className="space-y-2">
              {inactiveEndpoints.map((runpodEndpoint) => (
                <div key={runpodEndpoint.id} className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                    <div>
                      <div className="font-medium text-gray-600">{runpodEndpoint.name}</div>
                      <div className="text-sm text-gray-500 font-mono">{runpodEndpoint.url}</div>
                      <div className="text-xs text-gray-400">Priority: {runpodEndpoint.priority}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runpodEndpoint.id && onToggleRunPod(runpodEndpoint.id, runpodEndpoint.is_active)}
                    >
                      Enable
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runpodEndpoint.id && onDeleteRunPod(runpodEndpoint.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No backends message */}
        {(!runpodEndpoints || runpodEndpoints.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No RunPod backends configured for {getModeTitle(mode)}</p>
            <p className="text-sm">Add your first backend to start routing traffic through the stable Cloudflare URL</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
