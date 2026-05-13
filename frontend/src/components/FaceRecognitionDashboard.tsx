import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

interface Person {
  name: string;
  age?: number;
  gender?: string;
  profession?: string;
  additional_data?: Record<string, any>;
}

interface RecognitionResult {
  success: boolean;
  person?: Person;
  confidence?: number;
  formatted_result?: string;
  processing_time?: number;
  error?: string;
}

interface SystemStats {
  total_people: number;
  successful_matches: number;
  failed_matches: number;
  average_processing_time: number;
  tolerance: number;
  tts_enabled: boolean;
}

const FaceRecognitionDashboard: React.FC = () => {
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [imagesFolder, setImagesFolder] = useState('');
  const [tolerance, setTolerance] = useState(0.6);
  const [processingStatus, setProcessingStatus] = useState('');
  const [testImages, setTestImages] = useState<File[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const testImagesInputRef = useRef<HTMLInputElement>(null);

  // Load system statistics on component mount
  useEffect(() => {
    loadSystemStats();
  }, []);

  const loadSystemStats = async () => {
    try {
      const response = await axios.get('/api/face/statistics');
      setSystemStats(response.data.statistics);
    } catch (error) {
      console.error('Failed to load system statistics:', error);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      setExcelFile(file);
    } else {
      alert('Please upload a valid Excel file (.xlsx)');
    }
  };

  const handleTestImagesUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => 
      file.type.startsWith('image/') && 
      ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)
    );
    setTestImages(imageFiles);
  };

  const processExcelData = async () => {
    if (!excelFile) {
      alert('Please select an Excel file first');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Processing Excel file...');

    const formData = new FormData();
    formData.append('excel_file', excelFile);
    if (imagesFolder) {
      formData.append('images_folder', imagesFolder);
    }
    formData.append('tolerance', tolerance.toString());

    try {
      const response = await axios.post('/api/face/process-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setProcessingStatus(`✅ ${response.data.message}`);
        setSystemStats(response.data.statistics);
        alert('Excel file processed successfully!');
      } else {
        setProcessingStatus('❌ Failed to process Excel file');
        alert('Failed to process Excel file');
      }
    } catch (error) {
      console.error('Error processing Excel file:', error);
      setProcessingStatus('❌ Error processing Excel file');
      alert('Error processing Excel file');
    } finally {
      setIsProcessing(false);
    }
  };

  const recognizeFace = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      alert('Please select an image first');
      return;
    }

    setIsProcessing(true);
    setRecognitionResult(null);

    const formData = new FormData();
    formData.append('image', fileInputRef.current.files[0]);

    try {
      const response = await axios.post('/api/face/identify', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setRecognitionResult(response.data);
      
      if (response.data.success) {
        // Speak the result if TTS is available
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(response.data.formatted_result);
          speechSynthesis.speak(utterance);
        }
      }
    } catch (error) {
      console.error('Error recognizing face:', error);
      setRecognitionResult({
        success: false,
        error: 'Failed to recognize face'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const batchTestRecognition = async () => {
    if (testImages.length === 0) {
      alert('Please select test images first');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Testing recognition on multiple images...');

    const results: RecognitionResult[] = [];
    let successCount = 0;

    for (let i = 0; i < testImages.length; i++) {
      const image = testImages[i];
      setProcessingStatus(`Testing image ${i + 1}/${testImages.length}: ${image.name}`);

      const formData = new FormData();
      formData.append('image', image);

      try {
        const response = await axios.post('/api/face/identify', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        results.push(response.data);
        if (response.data.success) {
          successCount++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error testing image ${image.name}:`, error);
        results.push({
          success: false,
          error: `Failed to process ${image.name}`
        });
      }
    }

    setProcessingStatus(`✅ Batch test completed: ${successCount}/${testImages.length} successful`);
    setIsProcessing(false);

    // Show batch results
    const resultText = results.map((result, index) => 
      `${index + 1}. ${testImages[index].name}: ${result.success ? 
        `✅ ${result.formatted_result}` : 
        `❌ ${result.error}`
      }`
    ).join('\n');

    alert(`Batch Test Results:\n\n${resultText}`);
  };

  const exportFaceData = async () => {
    try {
      const response = await axios.post('/api/face/export');
      if (response.data.success) {
        alert('Face data exported successfully!');
      } else {
        alert('Failed to export face data');
      }
    } catch (error) {
      console.error('Error exporting face data:', error);
      alert('Error exporting face data');
    }
  };

  const clearResults = () => {
    setRecognitionResult(null);
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">🤖 Face Recognition System</h2>
      
      {/* System Statistics */}
      {systemStats && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-800">System Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{systemStats.total_people}</div>
              <div className="text-sm text-gray-600">Total People</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{systemStats.successful_matches}</div>
              <div className="text-sm text-gray-600">Successful Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{systemStats.failed_matches}</div>
              <div className="text-sm text-gray-600">Failed Matches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{systemStats.tolerance}</div>
              <div className="text-sm text-gray-600">Tolerance</div>
            </div>
          </div>
        </div>
      )}

      {/* Excel Data Processing */}
      <div className="mb-8 p-4 bg-green-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-green-800">📊 Step 1: Process Excel Data</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Excel File (people_data.xlsx)
            </label>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Required columns: Name, Image. Optional: Age, Gender, Profession, etc.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Images Folder Path (optional)
            </label>
            <input
              type="text"
              value={imagesFolder}
              onChange={(e) => setImagesFolder(e.target.value)}
              placeholder="e.g., data/faces/images/"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              If images are in a different folder, specify the path here
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tolerance Level: {tolerance}
            </label>
            <input
              type="range"
              min="0.4"
              max="0.8"
              step="0.1"
              value={tolerance}
              onChange={(e) => setTolerance(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Strict (0.4)</span>
              <span>Balanced (0.6)</span>
              <span>Relaxed (0.8)</span>
            </div>
          </div>

          <button
            onClick={processExcelData}
            disabled={isProcessing || !excelFile}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Process Excel Data'}
          </button>

          {processingStatus && (
            <div className="p-3 bg-blue-100 rounded-md">
              <p className="text-sm text-blue-800">{processingStatus}</p>
            </div>
          )}
        </div>
      </div>

      {/* Face Recognition */}
      <div className="mb-8 p-4 bg-purple-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-purple-800">🔍 Step 2: Test Face Recognition</h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Test Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
            
            {uploadedImage && (
              <div className="mt-4">
                <img
                  src={uploadedImage}
                  alt="Uploaded"
                  className="w-full h-48 object-cover rounded-md border"
                />
              </div>
            )}

            <button
              onClick={recognizeFace}
              disabled={isProcessing || !fileInputRef.current?.files?.[0]}
              className="w-full mt-4 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Recognizing...' : 'Recognize Face'}
            </button>
          </div>

          {/* Results */}
          <div>
            <h4 className="text-md font-semibold mb-3 text-gray-800">Recognition Results</h4>
            
            {recognitionResult ? (
              <div className="p-4 bg-white rounded-md border">
                {recognitionResult.success ? (
                  <div>
                    <div className="text-green-600 font-semibold mb-2">✅ Person Identified</div>
                    <div className="space-y-2">
                      <p><strong>Name:</strong> {recognitionResult.person?.name}</p>
                      {recognitionResult.person?.age && (
                        <p><strong>Age:</strong> {recognitionResult.person.age}</p>
                      )}
                      {recognitionResult.person?.gender && (
                        <p><strong>Gender:</strong> {recognitionResult.person.gender}</p>
                      )}
                      {recognitionResult.person?.profession && (
                        <p><strong>Profession:</strong> {recognitionResult.person.profession}</p>
                      )}
                      <p><strong>Confidence:</strong> {(recognitionResult.confidence! * 100).toFixed(1)}%</p>
                      <p><strong>Processing Time:</strong> {recognitionResult.processing_time?.toFixed(3)}s</p>
                      <div className="mt-3 p-2 bg-gray-50 rounded">
                        <p className="text-sm font-medium">Formatted Result:</p>
                        <p className="text-sm">{recognitionResult.formatted_result}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-red-600 font-semibold mb-2">❌ No Match Found</div>
                    <p><strong>Error:</strong> {recognitionResult.error}</p>
                    {recognitionResult.confidence && (
                      <p><strong>Best Confidence:</strong> {(recognitionResult.confidence * 100).toFixed(1)}%</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-md border-dashed border-2 text-center text-gray-500">
                Upload an image and click "Recognize Face" to see results
              </div>
            )}

            {recognitionResult && (
              <button
                onClick={clearResults}
                className="w-full mt-3 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                Clear Results
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Batch Testing */}
      <div className="mb-8 p-4 bg-orange-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-orange-800">🧪 Step 3: Batch Testing (Optional)</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Multiple Test Images
            </label>
            <input
              ref={testImagesInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleTestImagesUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
            />
            {testImages.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Selected {testImages.length} images: {testImages.map(img => img.name).join(', ')}
              </p>
            )}
          </div>

          <button
            onClick={batchTestRecognition}
            disabled={isProcessing || testImages.length === 0}
            className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Testing...' : `Test ${testImages.length} Images`}
          </button>
        </div>
      </div>

      {/* Utilities */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">🛠️ Utilities</h3>
        
        <div className="flex gap-4">
          <button
            onClick={exportFaceData}
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Export Face Data
          </button>
          
          <button
            onClick={loadSystemStats}
            className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
          >
            Refresh Statistics
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 text-yellow-800">📋 Testing Instructions</h3>
        
        <div className="space-y-2 text-sm text-gray-700">
          <p><strong>1. Prepare Excel File:</strong> Create people_data.xlsx with columns: Name, Image (required), Age, Gender, Profession (optional)</p>
          <p><strong>2. Add Face Images:</strong> Place high-quality face images in a folder, update paths in Excel</p>
          <p><strong>3. Process Data:</strong> Upload Excel file and click "Process Excel Data"</p>
          <p><strong>4. Test Recognition:</strong> Upload test images and click "Recognize Face"</p>
          <p><strong>5. Batch Test:</strong> Upload multiple images for comprehensive testing</p>
        </div>
      </div>
    </div>
  );
};

export default FaceRecognitionDashboard; 