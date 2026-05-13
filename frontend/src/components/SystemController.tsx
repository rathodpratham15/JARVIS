import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, CheckSquare, Square, AlertTriangle } from 'lucide-react';

interface SystemAction {
  action_id: string;
  action_type: string;
  target: string;
  parameters: Record<string, unknown>;
  timestamp: string;
  user_id: string;
}

interface ActionHistoryItem {
  action_id: string;
  action_type: string;
  target: string;
  timestamp: string;
  status: string;
  error_message?: string;
}

interface SystemInfo {
  platform: string;
  platform_version: string;
  architecture: string;
  processor: string;
  python_version: string;
  user_home: string;
  current_working_dir: string;
}

const SystemController: React.FC = () => {
  const [applications, setApplications] = useState<string[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState<SystemAction[]>([]);
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalActions, setTotalActions] = useState(0);
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const actionsPerPage = 10;

  // Form states
  const [appName, setAppName] = useState('');
  const [appArgs, setAppArgs] = useState('');
  const [fileAction, setFileAction] = useState('move');
  const [filePath, setFilePath] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [messagePlatform, setMessagePlatform] = useState('whatsapp');
  const [messageRecipient, setMessageRecipient] = useState('');
  const [messageText, setMessageText] = useState('');

  // Confirmation dialog states
  const [showAppConfirm, setShowAppConfirm] = useState(false);
  const [pendingAppAction, setPendingAppAction] = useState<{name: string, args: string[]} | null>(null);
  const [showFileConfirm, setShowFileConfirm] = useState(false);
  const [pendingFileAction, setPendingFileAction] = useState<{action: string, path: string, targetPath?: string} | null>(null);
  const [showMessageConfirm, setShowMessageConfirm] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{platform: string, to: string, message: string} | null>(null);

  const loadData = useCallback(async () => {
    try {
      // Load applications
      const appsResponse = await fetch('/api/system/applications');
      if (appsResponse.ok) {
        const appsData = await appsResponse.json();
        setApplications(appsData.applications || []);
      }

      // Load system info
      const infoResponse = await fetch('/api/system/info');
      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        setSystemInfo(infoData.info);
      }

      // Load pending confirmations
      const confirmationsResponse = await fetch('/api/system/pending-confirmations');
      if (confirmationsResponse.ok) {
        const confirmationsData = await confirmationsResponse.json();
        setPendingConfirmations(confirmationsData.confirmations || []);
      }

      // Load action history
      const offset = (currentPage - 1) * actionsPerPage;
      const historyResponse = await fetch(`/api/system/action-history?limit=${actionsPerPage}&offset=${offset}`);
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setActionHistory(historyData.history || []);
        setTotalActions(historyData.total || 0);
      } else {
        console.warn('Failed to load action history:', historyResponse.status, historyResponse.statusText);
        // Set empty state but don't show error message for initial load failures
        setActionHistory([]);
        setTotalActions(0);
      }
    } catch (error) {
      console.error('Error loading system data:', error);
      // Only set message if it's a user-initiated action, not automatic refresh
      if (message === '') {
        setMessage('Note: Unable to connect to backend server. Please ensure it\'s running on port 8000.');
      }
    }
  }, [currentPage, actionsPerPage]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [loadData]);

  const openApplication = async () => {
    if (!appName.trim()) {
      setMessage('Please enter an application name');
      return;
    }

    const args = appArgs.trim() ? appArgs.split(' ').filter(arg => arg.trim()) : [];
    
    // Show confirmation dialog instead of directly executing
    setPendingAppAction({ name: appName, args });
    setShowAppConfirm(true);
  };

  const confirmAndOpenApplication = async () => {
    if (!pendingAppAction) return;
    
    setLoading(true);
    setShowAppConfirm(false);
    
    try {
      const response = await fetch('/api/system/open-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pendingAppAction.name,
          args: pendingAppAction.args,
          user_id: 'web_user',
          session_id: `web_session_${Date.now()}`
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`Application opened: ${data.result}`);
        setAppName('');
        setAppArgs('');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
      setPendingAppAction(null);
    }
  };

  const cancelAppAction = () => {
    setShowAppConfirm(false);
    setPendingAppAction(null);
  };

  const controlFiles = async () => {
    if (!filePath.trim()) {
      setMessage('Please enter a file path');
      return;
    }

    if ((fileAction === 'move' || fileAction === 'copy' || fileAction === 'rename') && !targetPath.trim()) {
      setMessage('Please enter a target path');
      return;
    }

    // Show confirmation dialog instead of directly executing
    setPendingFileAction({
      action: fileAction,
      path: filePath,
      targetPath: (fileAction === 'move' || fileAction === 'copy' || fileAction === 'rename') ? targetPath : undefined
    });
    setShowFileConfirm(true);
  };

  const confirmAndControlFiles = async () => {
    if (!pendingFileAction) return;
    
    setLoading(true);
    setShowFileConfirm(false);
    
    try {
      const response = await fetch('/api/system/control-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pendingFileAction.action,
          path: pendingFileAction.path,
          target_path: pendingFileAction.targetPath || undefined,
          user_id: 'web_user',
          session_id: `web_session_${Date.now()}`
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`File action completed: ${data.result}`);
        setFilePath('');
        setTargetPath('');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
      setPendingFileAction(null);
    }
  };

  const cancelFileAction = () => {
    setShowFileConfirm(false);
    setPendingFileAction(null);
  };

  const sendMessage = async () => {
    if (!messageRecipient.trim() || !messageText.trim()) {
      setMessage('Please enter recipient and message');
      return;
    }

    // Show confirmation dialog instead of directly executing
    setPendingMessage({
      platform: messagePlatform,
      to: messageRecipient,
      message: messageText
    });
    setShowMessageConfirm(true);
  };

  const confirmAndSendMessage = async () => {
    if (!pendingMessage) return;
    
    setLoading(true);
    setShowMessageConfirm(false);
    
    try {
      const response = await fetch('/api/system/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: pendingMessage.platform,
          to: pendingMessage.to,
          message: pendingMessage.message,
          user_id: 'web_user',
          session_id: `web_session_${Date.now()}`
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`Message sent: ${data.result}`);
        setMessageRecipient('');
        setMessageText('');
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
      setPendingMessage(null);
    }
  };

  const cancelMessage = () => {
    setShowMessageConfirm(false);
    setPendingMessage(null);
  };

  const confirmAction = async (actionId: string, confirmed: boolean) => {
    try {
      const response = await fetch('/api/system/confirm-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: actionId,
          confirmed: confirmed
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessage(data.message);
        loadData(); // Refresh data
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    }
  };

  const deleteAction = async (actionId: string) => {
    try {
      const response = await fetch(`/api/system/action-history/${actionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setMessage('Action deleted successfully');
        loadData(); // Refresh data
        setSelectedActions(prev => {
          const newSet = new Set(prev);
          newSet.delete(actionId);
          return newSet;
        });
      } else {
        setMessage(`Error: ${data.error || 'Failed to delete action'}`);
      }
    } catch (error) {
      console.error('Delete action error:', error);
      if (error instanceof Error && error.message.includes('404')) {
        setMessage('Error: API endpoint not found. Please ensure the backend server is running on port 8000.');
      } else {
        setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      }
    }
    setShowDeleteConfirm(null);
  };

  const deleteBulkActions = async () => {
    if (selectedActions.size === 0) return;

    try {
      const response = await fetch('/api/system/action-history/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_ids: Array.from(selectedActions)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        const deletedCount = data.deleted_count || selectedActions.size;
        setMessage(`${deletedCount} actions deleted successfully`);
        loadData(); // Refresh data
        setSelectedActions(new Set());
      } else {
        setMessage(`Error: ${data.error || 'Failed to delete actions'}`);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      if (error instanceof Error && error.message.includes('404')) {
        setMessage('Error: API endpoint not found. Please ensure the backend server is running on port 8000.');
      } else {
        setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      }
    }
    setShowBulkDeleteConfirm(false);
  };

  const toggleActionSelection = (actionId: string) => {
    setSelectedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(actionId)) {
        newSet.delete(actionId);
      } else {
        newSet.add(actionId);
      }
      return newSet;
    });
  };

  const selectAllActions = () => {
    if (selectedActions.size === actionHistory.length) {
      setSelectedActions(new Set());
    } else {
      setSelectedActions(new Set(actionHistory.map(action => action.action_id)));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'executing': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">System Control</h1>
          <p className="text-muted-foreground">
            Monitor and manage system components, applications, and actions.
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg border ${
              message.includes('Error') 
                ? 'bg-destructive/10 text-destructive border-destructive/20' 
                : 'bg-green-100 text-green-800 border-green-200'
            }`}
          >
            {message}
          </motion.div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="applications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="files">File Control</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="confirmations">Confirmations</TabsTrigger>
            <TabsTrigger value="history">Action History</TabsTrigger>
            <TabsTrigger value="system">System Info</TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Open Application</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="appName">Application Name</Label>
                    <Input
                      id="appName"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="e.g., notepad, calculator, chrome"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="appArgs">Arguments (optional)</Label>
                    <Input
                      id="appArgs"
                      value={appArgs}
                      onChange={(e) => setAppArgs(e.target.value)}
                      placeholder="e.g., file.txt"
                    />
                  </div>
                </div>
                <Button onClick={openApplication} disabled={loading}>
                  {loading ? 'Opening...' : 'Confirm and Open'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {applications.map((app) => (
                    <Button
                      key={app}
                      variant="outline"
                      size="sm"
                      onClick={() => setAppName(app)}
                      className="justify-start"
                    >
                      {app}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* File Control Tab */}
          <TabsContent value="files" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>File Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fileAction">Action</Label>
                    <Select value={fileAction} onValueChange={setFileAction}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="move">Move</SelectItem>
                        <SelectItem value="copy">Copy</SelectItem>
                        <SelectItem value="rename">Rename</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filePath">Source Path</Label>
                    <Input
                      id="filePath"
                      value={filePath}
                      onChange={(e) => setFilePath(e.target.value)}
                      placeholder="e.g., /path/to/file.txt"
                    />
                  </div>
                  {(fileAction === 'move' || fileAction === 'copy' || fileAction === 'rename') && (
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="targetPath">Target Path</Label>
                      <Input
                        id="targetPath"
                        value={targetPath}
                        onChange={(e) => setTargetPath(e.target.value)}
                        placeholder="e.g., /path/to/new/location.txt"
                      />
                    </div>
                  )}
                </div>
                <Button onClick={controlFiles} disabled={loading} variant="destructive">
                  {loading ? 'Processing...' : `Confirm ${fileAction}`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="messagePlatform">Platform</Label>
                    <Select value={messagePlatform} onValueChange={setMessagePlatform}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="slack">Slack</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="messageRecipient">Recipient</Label>
                    <Input
                      id="messageRecipient"
                      value={messageRecipient}
                      onChange={(e) => setMessageRecipient(e.target.value)}
                      placeholder="e.g., +1234567890 or user@example.com"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="messageText">Message</Label>
                    <Textarea
                      id="messageText"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Enter your message..."
                      rows={4}
                    />
                  </div>
                </div>
                <Button onClick={sendMessage} disabled={loading}>
                  {loading ? 'Sending...' : 'Confirm and Send'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Confirmations Tab */}
          <TabsContent value="confirmations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Confirmations</CardTitle>
              </CardHeader>
              <CardContent>
                {pendingConfirmations.length === 0 ? (
                  <p className="text-muted-foreground">No pending confirmations</p>
                ) : (
                  <div className="space-y-4">
                    {pendingConfirmations.map((confirmation) => (
                      <Card key={confirmation.action_id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="space-y-2">
                              <h4 className="font-medium">
                                {confirmation.action_type.replace('_', ' ').toUpperCase()}
                              </h4>
                              <p className="text-sm text-muted-foreground">Target: {confirmation.target}</p>
                              <p className="text-sm text-muted-foreground">
                                Time: {new Date(confirmation.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => confirmAction(confirmation.action_id, true)}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => confirmAction(confirmation.action_id, false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                          <Separator />
                          <div className="mt-4">
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {JSON.stringify(confirmation.parameters, null, 2)}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Action History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Action History</CardTitle>
                  <div className="flex items-center space-x-4">
                    {actionHistory.length > 0 && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={selectAllActions}
                            className="flex items-center space-x-2"
                          >
                            {selectedActions.size === actionHistory.length ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                            <span>
                              {selectedActions.size === actionHistory.length ? 'Deselect All' : 'Select All'}
                            </span>
                          </Button>
                          {selectedActions.size > 0 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setShowBulkDeleteConfirm(true)}
                              className="flex items-center space-x-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Delete Selected ({selectedActions.size})</span>
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {totalActions > 0 && (
                        <>
                          Showing {((currentPage - 1) * actionsPerPage) + 1}-{Math.min(currentPage * actionsPerPage, totalActions)} of {totalActions} actions
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {actionHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No action history available</p>
                  ) : (
                    <>
                      {actionHistory.map((action, index) => (
                        <Card key={index} className={selectedActions.has(action.action_id) ? 'ring-2 ring-blue-500' : ''}>
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                              <div className="flex items-start space-x-3">
                                <button
                                  onClick={() => toggleActionSelection(action.action_id)}
                                  className="mt-1 text-gray-400 hover:text-blue-600"
                                >
                                  {selectedActions.has(action.action_id) ? (
                                    <CheckSquare className="h-5 w-5 text-blue-600" />
                                  ) : (
                                    <Square className="h-5 w-5" />
                                  )}
                                </button>
                                <div className="space-y-2">
                                  <h4 className="font-medium">
                                    {action.action_type.replace('_', ' ').toUpperCase()}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">Target: {action.target}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Time: {new Date(action.timestamp).toLocaleString()}
                                  </p>
                                  <Badge className={getStatusColor(action.status)}>
                                    {action.status}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDeleteConfirm(action.action_id)}
                                className="text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            {action.error_message && (
                              <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md ml-8">
                                <p className="text-sm">Error: {action.error_message}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      
                      {/* Pagination Controls */}
                      {totalActions > actionsPerPage && (
                        <div className="flex items-center justify-between pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground">Page</span>
                            <span className="text-sm font-medium">{currentPage}</span>
                            <span className="text-sm text-muted-foreground">of</span>
                            <span className="text-sm font-medium">{Math.ceil(totalActions / actionsPerPage)}</span>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            disabled={currentPage >= Math.ceil(totalActions / actionsPerPage)}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Info Tab */}
          <TabsContent value="system" className="space-y-6">
            {systemInfo && (
              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Platform</Label>
                        <p className="text-sm text-muted-foreground">{systemInfo.platform}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Version</Label>
                        <p className="text-sm text-muted-foreground">{systemInfo.platform_version}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Architecture</Label>
                        <p className="text-sm text-muted-foreground">{systemInfo.architecture}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Processor</Label>
                        <p className="text-sm text-muted-foreground">{systemInfo.processor}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Python Version</Label>
                        <p className="text-sm text-muted-foreground">{systemInfo.python_version}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">User Home</Label>
                        <p className="text-sm text-muted-foreground">{systemInfo.user_home}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Working Directory</Label>
                        <p className="text-sm text-muted-foreground">{systemInfo.current_working_dir}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Delete Confirmation Dialogs */}
        {showDeleteConfirm && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-[99999]" style={{ minHeight: '100vh', minWidth: '100vw' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg p-6 max-w-md mx-4"
            >
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-semibold">Delete Action</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this action? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteAction(showDeleteConfirm)}
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
        
        {showBulkDeleteConfirm && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-[99999]" style={{ minHeight: '100vh', minWidth: '100vw' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg p-6 max-w-md mx-4"
            >
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-semibold">Delete Multiple Actions</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete {selectedActions.size} selected actions? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={deleteBulkActions}
                >
                  Delete {selectedActions.size} Actions
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Application Confirmation Dialog */}
        {showAppConfirm && pendingAppAction && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-[99999]" style={{ minHeight: '100vh', minWidth: '100vw' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg p-6 max-w-md mx-4"
            >
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-semibold">Confirm Application Execution</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to open the application <strong>{pendingAppAction.name}</strong> with arguments: <strong>{pendingAppAction.args.join(' ')}</strong>?
              </p>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={cancelAppAction}>
                  Cancel
                </Button>
                <Button onClick={confirmAndOpenApplication} disabled={loading}>
                  {loading ? 'Opening...' : 'Confirm and Open'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* File Confirmation Dialog */}
        {showFileConfirm && pendingFileAction && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-[99999]" style={{ minHeight: '100vh', minWidth: '100vw' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg p-6 max-w-md mx-4"
            >
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-semibold">Confirm File Action</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to perform the file action <strong>{pendingFileAction.action.replace('_', ' ').toUpperCase()}</strong> on <strong>{pendingFileAction.path}</strong>?
                {pendingFileAction.targetPath && (
                  <>
                    <br />
                    Target path: <strong>{pendingFileAction.targetPath}</strong>
                  </>
                )}
              </p>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={cancelFileAction}>
                  Cancel
                </Button>
                <Button onClick={confirmAndControlFiles} disabled={loading}>
                  {loading ? 'Processing...' : 'Confirm and Execute'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Message Confirmation Dialog */}
        {showMessageConfirm && pendingMessage && (
          <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-[99999]" style={{ minHeight: '100vh', minWidth: '100vw' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-lg p-6 max-w-md mx-4"
            >
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-blue-600" />
                <h3 className="text-lg font-semibold">Confirm Message Sending</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to send a message to <strong>{pendingMessage.to}</strong> via <strong>{pendingMessage.platform.toUpperCase()}</strong>?
                <br />
                Message: <strong>{pendingMessage.message}</strong>
              </p>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={cancelMessage}>
                  Cancel
                </Button>
                <Button onClick={confirmAndSendMessage} disabled={loading}>
                  {loading ? 'Sending...' : 'Confirm and Send'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SystemController; 