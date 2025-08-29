'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, Server, Cloud, RefreshCw, TrendingUp, Activity, AlertTriangle, CheckCircle, Users, BarChart3, Zap, Save } from 'lucide-react';

interface RunPodConfig {
  id?: string;
  mode: 'image' | 'video' | 'text' | 'image-modify';
  url: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CloudflareConfig {
  worker_url: string;
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
  const [cloudflareConfig, setCloudflareConfig] = useState<CloudflareConfig>({
    worker_url: '',
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
      loadCloudflareConfig();
      loadAnalytics();
      loadScaling();
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="scaling" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Auto Scaling
            </TabsTrigger>
            <TabsTrigger value="runpod" className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              RunPod Config
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
                    <Label htmlFor="worker-url">Worker URL</Label>
                    <Input
                      id="worker-url"
                      value={cloudflareConfig.worker_url}
                      onChange={(e) => setCloudflareConfig(prev => ({ ...prev, worker_url: e.target.value }))}
                      placeholder="https://your-worker.workers.dev"
                    />
                  </div>
                  <div>
                    <Label htmlFor="r2-bucket">R2 Bucket Name</Label>
                    <Input
                      id="r2-bucket"
                      value={cloudflareConfig.r2_bucket}
                      onChange={(e) => setCloudflareConfig(prev => ({ ...prev, r2_bucket: e.target.value }))}
                      placeholder="your-bucket-name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="r2-public-url">R2 Public URL</Label>
                    <Input
                      id="r2-public-url"
                      value={cloudflareConfig.r2_public_url}
                      onChange={(e) => setCloudflareConfig(prev => ({ ...prev, r2_public_url: e.target.value }))}
                      placeholder="https://your-account.r2.cloudflarestorage.com"
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
                        <span>Worker URL:</span>
                        <span className={`text-sm ${cloudflareConfig.worker_url ? 'text-green-600' : 'text-red-600'}`}>
                          {cloudflareConfig.worker_url ? '✅ Set' : '❌ Missing'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>R2 Bucket:</span>
                        <span className={`text-sm ${cloudflareConfig.r2_bucket ? 'text-green-600' : 'text-red-600'}`}>
                          {cloudflareConfig.r2_bucket ? '✅ Set' : '❌ Missing'}
                        </span>
                      </div>
                    </div>
                  </div>
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
