import React, { useState, useEffect } from 'react';
import { PuzzlePieceIcon, CheckCircleIcon, XCircleIcon, CogIcon } from '@heroicons/react/24/outline';

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  status: 'active' | 'inactive' | 'error';
  config?: Record<string, any>;
  error_message?: string;
  last_executed?: string;
}

export default function PluginManager() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchPlugins();
  }, []);

  const fetchPlugins = async () => {
    try {
      const response = await fetch('/api/plugins');
      if (!response.ok) throw new Error('Failed to fetch plugins');
      const data = await response.json();
      setPlugins(data.plugins);
    } catch (err) {
      setError('Failed to load plugins');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const togglePlugin = async (pluginId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/plugins/${pluginId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) throw new Error('Failed to toggle plugin');

      setPlugins(plugins.map(p =>
        p.id === pluginId ? { ...p, enabled, status: enabled ? 'active' : 'inactive' } : p
      ));
    } catch (err) {
      setError('Failed to toggle plugin');
      console.error(err);
    }
  };

  const updatePluginConfig = async (pluginId: string, config: Record<string, any>) => {
    try {
      const response = await fetch(`/api/plugins/${pluginId}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) throw new Error('Failed to update plugin configuration');

      setPlugins(plugins.map(p =>
        p.id === pluginId ? { ...p, config } : p
      ));
      setSelectedPlugin(null);
    } catch (err) {
      setError('Failed to update plugin configuration');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Plugin Manager
          </h1>
          <p className="text-gray-400 mt-1">Manage and configure system plugins</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Plugin List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plugins.map((plugin) => (
          <div
            key={plugin.id}
            className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center">
                  <PuzzlePieceIcon className="w-5 h-5 mr-2" />
                  {plugin.name}
                </h3>
                <p className="text-sm text-gray-400 mt-1">{plugin.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                {plugin.status === 'active' && (
                  <CheckCircleIcon className="w-5 h-5 text-green-400" />
                )}
                {plugin.status === 'inactive' && (
                  <XCircleIcon className="w-5 h-5 text-gray-400" />
                )}
                {plugin.status === 'error' && (
                  <XCircleIcon className="w-5 h-5 text-red-400" />
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-400">
              <p>Version: {plugin.version}</p>
              <p>Author: {plugin.author}</p>
              {plugin.last_executed && (
                <p>Last executed: {new Date(plugin.last_executed).toLocaleString()}</p>
              )}
            </div>

            {plugin.error_message && (
              <div className="mt-4 text-sm text-red-400">
                Error: {plugin.error_message}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setSelectedPlugin(plugin)}
                className="flex items-center space-x-1 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <CogIcon className="w-4 h-4" />
                <span>Configure</span>
              </button>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={plugin.enabled}
                  onChange={(e) => togglePlugin(plugin.id, e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Configuration Modal */}
      {selectedPlugin && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setSelectedPlugin(null)}
        >
          <div
            className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{selectedPlugin.name} Configuration</h2>
              <button
                onClick={() => setSelectedPlugin(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {selectedPlugin.config && Object.entries(selectedPlugin.config).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-400 mb-1 capitalize">
                    {key.replace(/_/g, ' ')}
                  </label>
                  {typeof value === 'boolean' ? (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={configValues[key] ?? value}
                        onChange={(e) =>
                          setConfigValues({ ...configValues, [key]: e.target.checked })
                        }
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  ) : (
                    <input
                      type={typeof value === 'number' ? 'number' : 'text'}
                      value={configValues[key] ?? value}
                      onChange={(e) =>
                        setConfigValues({
                          ...configValues,
                          [key]: typeof value === 'number' ? Number(e.target.value) : e.target.value,
                        })
                      }
                      className="w-full bg-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setSelectedPlugin(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updatePluginConfig(selectedPlugin.id, configValues)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 