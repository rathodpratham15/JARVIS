import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Cog6ToothIcon,
  SpeakerWaveIcon,
  MicrophoneIcon,
  EyeIcon,
  BellIcon,
  SunIcon,
  MoonIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface Settings {
  assistant_mode: string;
  voice_enabled: boolean;
  auto_listen: boolean;
  theme: string;
  notifications: boolean;
  language: string;
  tts_voice: string;
  stt_engine: string;
  auto_save: boolean;
  privacy_mode: boolean;
}

const SettingsManager: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    assistant_mode: 'normal',
    voice_enabled: true,
    auto_listen: false,
    theme: 'dark',
    notifications: true,
    language: 'en',
    tts_voice: 'default',
    stt_engine: 'whisper',
    auto_save: true,
    privacy_mode: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/dashboard/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setHasChanges(false);
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving settings' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const updateSetting = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    const defaultSettings: Settings = {
      assistant_mode: 'normal',
      voice_enabled: true,
      auto_listen: false,
      theme: 'dark',
      notifications: true,
      language: 'en',
      tts_voice: 'default',
      stt_engine: 'whisper',
      auto_save: true,
      privacy_mode: false
    };
    setSettings(defaultSettings);
    setHasChanges(true);
  };

  const SettingSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="border-b border-gray-200 pb-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );

  const ToggleSetting: React.FC<{
    label: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
    icon?: React.ComponentType<any>;
  }> = ({ label, description, value, onChange, icon: Icon }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center space-x-3">
        {Icon && <Icon className="h-5 w-5 text-gray-500" />}
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  const SelectSetting: React.FC<{
    label: string;
    description: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    icon?: React.ComponentType<any>;
  }> = ({ label, description, value, options, onChange, icon: Icon }) => (
    <div className="py-3">
      <div className="flex items-center space-x-3 mb-2">
        {Icon && <Icon className="h-5 w-5 text-gray-500" />}
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <div className="flex items-center space-x-3">
              {hasChanges && (
                <span className="text-sm text-orange-600 font-medium">Unsaved changes</span>
              )}
              <button
                onClick={resetToDefaults}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Reset to Defaults
              </button>
              <button
                onClick={saveSettings}
                disabled={loading || !hasChanges}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${
                message.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <XMarkIcon className="h-5 w-5" />
              )}
              <span>{message.text}</span>
            </motion.div>
          )}

          {/* Assistant Mode */}
          <SettingSection title="Assistant Mode">
            <SelectSetting
              label="Assistant Mode"
              description="Choose how JARVIS should behave"
              value={settings.assistant_mode}
              onChange={(value) => updateSetting('assistant_mode', value)}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'professional', label: 'Professional' },
                { value: 'casual', label: 'Casual' },
                { value: 'creative', label: 'Creative' }
              ]}
            />
          </SettingSection>

          {/* Voice Settings */}
          <SettingSection title="Voice & Audio">
            <ToggleSetting
              label="Voice Recognition"
              description="Enable voice input and commands"
              value={settings.voice_enabled}
              onChange={(value) => updateSetting('voice_enabled', value)}
              icon={MicrophoneIcon}
            />
            
            <ToggleSetting
              label="Auto Listen"
              description="Automatically start listening for voice commands"
              value={settings.auto_listen}
              onChange={(value) => updateSetting('auto_listen', value)}
            />

            <SelectSetting
              label="Speech-to-Text Engine"
              description="Choose the STT service to use"
              value={settings.stt_engine}
              onChange={(value) => updateSetting('stt_engine', value)}
              options={[
                { value: 'whisper', label: 'OpenAI Whisper' },
                { value: 'google', label: 'Google Speech' },
                { value: 'azure', label: 'Azure Speech' }
              ]}
            />

            <SelectSetting
              label="Text-to-Speech Voice"
              description="Choose the TTS voice to use"
              value={settings.tts_voice}
              onChange={(value) => updateSetting('tts_voice', value)}
              icon={SpeakerWaveIcon}
              options={[
                { value: 'default', label: 'Default' },
                { value: 'male', label: 'Male Voice' },
                { value: 'female', label: 'Female Voice' },
                { value: 'custom', label: 'Custom Voice' }
              ]}
            />
          </SettingSection>

          {/* Interface Settings */}
          <SettingSection title="Interface">
            <div className="py-3">
              <div className="flex items-center space-x-3 mb-2">
                <EyeIcon className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">Theme</p>
                  <p className="text-sm text-gray-600">Choose your preferred theme</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => updateSetting('theme', 'light')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                    settings.theme === 'light' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <SunIcon className="h-4 w-4" />
                  <span>Light</span>
                </button>
                <button
                  onClick={() => updateSetting('theme', 'dark')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                    settings.theme === 'dark' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <MoonIcon className="h-4 w-4" />
                  <span>Dark</span>
                </button>
                <button
                  onClick={() => updateSetting('theme', 'auto')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                    settings.theme === 'auto' 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Cog6ToothIcon className="h-4 w-4" />
                  <span>Auto</span>
                </button>
              </div>
            </div>

            <SelectSetting
              label="Language"
              description="Choose your preferred language"
              value={settings.language}
              onChange={(value) => updateSetting('language', value)}
              options={[
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Spanish' },
                { value: 'fr', label: 'French' },
                { value: 'de', label: 'German' },
                { value: 'it', label: 'Italian' },
                { value: 'pt', label: 'Portuguese' }
              ]}
            />
          </SettingSection>

          {/* Notifications & Privacy */}
          <SettingSection title="Notifications & Privacy">
            <ToggleSetting
              label="Notifications"
              description="Enable system notifications"
              value={settings.notifications}
              onChange={(value) => updateSetting('notifications', value)}
              icon={BellIcon}
            />

            <ToggleSetting
              label="Auto Save"
              description="Automatically save conversations and settings"
              value={settings.auto_save}
              onChange={(value) => updateSetting('auto_save', value)}
            />

            <ToggleSetting
              label="Privacy Mode"
              description="Enhanced privacy protection for sensitive data"
              value={settings.privacy_mode}
              onChange={(value) => updateSetting('privacy_mode', value)}
            />
          </SettingSection>

          {/* Advanced Settings */}
          <SettingSection title="Advanced">
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Data Management</h4>
                <div className="flex space-x-3">
                  <button className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600">
                    Clear All Data
                  </button>
                  <button className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    Export Settings
                  </button>
                  <button className="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600">
                    Import Settings
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">System Information</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Version: 1.0.0</p>
                  <p>Last Updated: {new Date().toLocaleDateString()}</p>
                  <p>Storage Used: 2.3 GB</p>
                </div>
              </div>
            </div>
          </SettingSection>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsManager; 