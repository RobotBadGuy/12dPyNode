'use client';

import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  RefreshCw,
  Settings,
} from 'lucide-react';
import {
  uploadFiles,
  getDownloadUrl,
  processFiles,
  getSessionStatus,
  ModelTypeMapping,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProcessingSession {
  session_id: string;
  status: string;
  excel_file: string;
  dwg_ifc_count: number;
}

interface FileDetail {
  filename: string;
  project_folder: string;
  output_path?: string;
}

interface ProcessingResults {
  summary: {
    total_files: number;
    project_folder: string;
  };
  files: string[];
  file_details?: FileDetail[];
  zip_path: string;
}

const PyChainApp = () => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [dwgIfcFiles, setDwgIfcFiles] = useState<File[]>([]);
  const [modelTypes, setModelTypes] = useState<Map<string, 'Model' | 'TIN'>>(
    new Map()
  );
  const [processing, setProcessing] = useState(false);
  const [currentSession, setCurrentSession] =
    useState<ProcessingSession | null>(null);
  const [results, setResults] = useState<ProcessingResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<'excel' | 'dwg' | null>(null);

  // Auto-detect model types when files are uploaded
  useEffect(() => {
    if (dwgIfcFiles.length > 0) {
      const newModelTypes = new Map<string, 'Model' | 'TIN'>();
      dwgIfcFiles.forEach((file) => {
        const filename = file.name;
        const stem = filename.substring(0, filename.lastIndexOf('.')) || filename;
        // Auto-detect: if filename contains '-TR', suggest TIN
        const suggestedType = filename.includes('-TR') ? 'TIN' : 'Model';
        newModelTypes.set(filename, suggestedType);
        newModelTypes.set(stem, suggestedType);
      });
      setModelTypes(newModelTypes);
    }
  }, [dwgIfcFiles]);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'excel' | 'dwg'
  ) => {
    const files = Array.from(e.target.files || []);
    if (type === 'excel') {
      if (files.length > 0) {
        setExcelFile(files[0]);
      }
    } else {
      setDwgIfcFiles(files);
    }
    setError(null);
    setResults(null);
    setCurrentSession(null);
  };

  const handleDragOver = (e: React.DragEvent, type: 'excel' | 'dwg') => {
    e.preventDefault();
    setDragOver(type);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, type: 'excel' | 'dwg') => {
    e.preventDefault();
    setDragOver(null);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter((file) => {
      if (type === 'excel') {
        return file.name.toLowerCase().endsWith('.xlsx');
      } else {
        return (
          file.name.toLowerCase().endsWith('.dwg') ||
          file.name.toLowerCase().endsWith('.dgn') ||
          file.name.toLowerCase().endsWith('.ifc')
        );
      }
    });

    if (validFiles.length > 0) {
      if (type === 'excel') {
        setExcelFile(validFiles[0]);
      } else {
        setDwgIfcFiles(validFiles);
      }
      setError(null);
      setResults(null);
      setCurrentSession(null);
    }
  };

  const updateModelType = (filename: string, modelType: 'Model' | 'TIN') => {
    const newModelTypes = new Map(modelTypes);
    newModelTypes.set(filename, modelType);
    const stem = filename.substring(0, filename.lastIndexOf('.')) || filename;
    newModelTypes.set(stem, modelType);
    setModelTypes(newModelTypes);
  };

  const processFilesAndGenerate = async () => {
    if (!excelFile) {
      setError('Please upload the model_naming.xlsx file');
      return;
    }

    if (dwgIfcFiles.length === 0) {
      setError('Please upload at least one DWG/DGN/IFC file');
      return;
    }

    setProcessing(true);
    setError(null);
    setResults(null);

    try {
      let session = currentSession;
      if (!session) {
        session = await uploadFiles(excelFile, dwgIfcFiles);
        setCurrentSession(session);
      }

      // Build model type mappings
      const modelTypeMappings: ModelTypeMapping[] = dwgIfcFiles.map((file) => ({
        filename: file.name,
        model_type: modelTypes.get(file.name) || 'Model',
      }));

      await processFiles(session.session_id, modelTypeMappings);

      pollForResults(session.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setProcessing(false);
    }
  };

  const pollForResults = async (sessionId: string) => {
    const maxAttempts = 100; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await getSessionStatus(sessionId);

        if (response.status === 'completed') {
          setResults(response.results!);
          setProcessing(false);
        } else if (response.status === 'error') {
          setError(response.error || 'Processing failed');
          setProcessing(false);
        } else if (attempts < maxAttempts) {
          // Still processing, continue polling
          attempts++;
          setTimeout(poll, 3000); // Poll every 3 seconds
        } else {
          setError('Processing timed out');
          setProcessing(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error checking status');
        setProcessing(false);
      }
    };

    poll();
  };

  const downloadResults = () => {
    if (currentSession) {
      window.open(getDownloadUrl(currentSession.session_id), '_blank');
    }
  };

  const resetSession = () => {
    setExcelFile(null);
    setDwgIfcFiles([]);
    setModelTypes(new Map());
    setProcessing(false);
    setCurrentSession(null);
    setResults(null);
    setError(null);
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden'>
      {/* Enhanced Gradient Background with Grid Pattern */}
      <div className='absolute inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900'></div>
        <div
          className='absolute inset-0 opacity-10'
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        ></div>
      </div>

      <div className='relative z-10 p-4 sm:p-6 lg:p-8'>
        <div className='max-w-7xl mx-auto'>
          <div className='max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'>
            {/* Header Section */}
            <div className='text-center mb-16'>
              <h1 className='text-6xl font-bold text-white mb-6'>
                PyChain{' '}
                <span className='bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent'>
                  12d Model Chain Generator
                </span>
              </h1>
              <p className='text-gray-300 text-xl mb-8 max-w-3xl mx-auto'>
                Upload your Excel naming file and DWG/DGN/IFC files to generate
                12d Model chain files
              </p>
            </div>

            {/* Session Status */}
            {currentSession && (
              <div className='mb-8 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl bg-gray-900/95'>
                <div className='p-6'>
                  <div className='flex items-center gap-3'>
                    <div className='w-3 h-3 bg-green-400 rounded-full animate-pulse'></div>
                    <p className='text-sm text-gray-300'>
                      <strong>Session Active:</strong>{' '}
                      {currentSession.session_id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload Cards */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8'>
              {/* Excel File Upload Card */}
              <div className='bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-[1.02]'>
                <div className='p-6'>
                  <div className='flex items-center gap-3 mb-4'>
                    <div className='w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg'>
                      <FileText className='w-5 h-5 text-white' />
                    </div>
                    <div>
                      <h3 className='text-xl font-bold text-white'>
                        Excel Naming File
                      </h3>
                      <p className='text-gray-400 text-sm'>
                        Upload model_naming.xlsx
                      </p>
                    </div>
                  </div>

                  <label className='block cursor-pointer group'>
                    <div
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                        dragOver === 'excel'
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-gray-600/50 group-hover:border-emerald-500/70 group-hover:bg-gray-800/30'
                      }`}
                      onDragOver={(e) => handleDragOver(e, 'excel')}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'excel')}
                    >
                      <div className='w-16 h-16 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg'>
                        <Upload className='text-white w-8 h-8' />
                      </div>
                      <p className='text-white font-semibold mb-2 text-lg'>
                        Drop Excel file here
                      </p>
                      <p className='text-gray-400 mb-6'>or click to browse</p>
                      <Button
                        variant='outline'
                        className='border-gray-600/50 text-gray-300 hover:bg-gray-800/50 hover:border-emerald-500/50 px-6 py-2'
                      >
                        <FileText className='w-4 h-4 mr-2' />
                        Choose File
                      </Button>
                      <input
                        type='file'
                        accept='.xlsx'
                        onChange={(e) => handleFileChange(e, 'excel')}
                        className='hidden'
                        disabled={processing}
                      />
                    </div>
                  </label>

                  {excelFile && (
                    <div className='mt-6'>
                      <div className='flex items-center gap-2 mb-4'>
                        <CheckCircle className='text-green-400 w-5 h-5' />
                        <p className='font-semibold text-white'>
                          {excelFile.name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* DWG/DGN/IFC Files Upload Card */}
              <div className='bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-[1.02]'>
                <div className='p-6'>
                  <div className='flex items-center gap-3 mb-4'>
                    <div className='w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg'>
                      <FileText className='w-5 h-5 text-white' />
                    </div>
                    <div>
                      <h3 className='text-xl font-bold text-white'>
                        DWG/DGN/IFC Files
                      </h3>
                      <p className='text-gray-400 text-sm'>
                        Upload one or more files
                      </p>
                    </div>
                  </div>

                  <label className='block cursor-pointer group'>
                    <div
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                        dragOver === 'dwg'
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-gray-600/50 group-hover:border-indigo-500/70 group-hover:bg-gray-800/30'
                      }`}
                      onDragOver={(e) => handleDragOver(e, 'dwg')}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'dwg')}
                    >
                      <div className='w-16 h-16 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg'>
                        <Upload className='text-white w-8 h-8' />
                      </div>
                      <p className='text-white font-semibold mb-2 text-lg'>
                        Drop files here
                      </p>
                      <p className='text-gray-400 mb-6'>or click to browse</p>
                      <Button
                        variant='outline'
                        className='border-gray-600/50 text-gray-300 hover:bg-gray-800/50 hover:border-indigo-500/50 px-6 py-2'
                      >
                        <FileText className='w-4 h-4 mr-2' />
                        Choose Files
                      </Button>
                      <input
                        type='file'
                        multiple
                        accept='.dwg,.dgn,.ifc'
                        onChange={(e) => handleFileChange(e, 'dwg')}
                        className='hidden'
                        disabled={processing}
                      />
                    </div>
                  </label>

                  {dwgIfcFiles.length > 0 && (
                    <div className='mt-6'>
                      <div className='flex items-center gap-2 mb-4'>
                        <CheckCircle className='text-green-400 w-5 h-5' />
                        <p className='font-semibold text-white'>
                          {dwgIfcFiles.length} file(s) selected
                        </p>
                      </div>
                      <div className='space-y-2 max-h-32 overflow-y-auto'>
                        {dwgIfcFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className='flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50'
                          >
                            <div className='w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center'>
                              <CheckCircle className='text-white w-3 h-3' />
                            </div>
                            <span className='text-sm text-gray-300 font-medium truncate flex-1'>
                              {file.name}
                            </span>
                            <select
                              value={modelTypes.get(file.name) || 'Model'}
                              onChange={(e) =>
                                updateModelType(
                                  file.name,
                                  e.target.value as 'Model' | 'TIN'
                                )
                              }
                              className='text-xs bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500'
                              disabled={processing}
                            >
                              <option value='Model'>Model</option>
                              <option value='TIN'>TIN</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error Display Card */}
            {error && (
              <div className='mb-8 bg-red-900/20 border border-red-500/50 rounded-2xl shadow-2xl'>
                <div className='p-6'>
                  <div className='flex items-center gap-4'>
                    <div className='w-10 h-10 bg-gradient-to-r from-red-400 to-pink-500 rounded-full flex items-center justify-center'>
                      <XCircle className='text-white w-5 h-5' />
                    </div>
                    <div>
                      <h3 className='font-bold text-red-400 mb-1'>
                        Oops! Something went wrong
                      </h3>
                      <p className='text-red-300'>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Process Button Card */}
            <div className='mb-8 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl text-center'>
              <div className='py-8'>
                <Button
                  onClick={processFilesAndGenerate}
                  disabled={
                    processing ||
                    !excelFile ||
                    dwgIfcFiles.length === 0
                  }
                  size='lg'
                  className='bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-lg font-bold px-12 py-4 h-auto disabled:opacity-50 shadow-lg'
                >
                  {processing ? (
                    <>
                      <Loader2 className='w-6 h-6 animate-spin mr-3' />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className='w-6 h-6 mr-3' />
                      Generate Chain Files
                    </>
                  )}
                </Button>

                {(currentSession || results) && (
                  <Button
                    onClick={resetSession}
                    variant='outline'
                    size='lg'
                    className='ml-4 border-gray-600/50 text-gray-300 hover:bg-gray-800/50 px-8 py-4 h-auto'
                  >
                    <RefreshCw className='w-5 h-5 mr-2' />
                    Start Over
                  </Button>
                )}
              </div>
            </div>

            {/* Results Card */}
            {results && (
              <div className='bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl'>
                <div className='p-6'>
                  <div className='text-center mb-8'>
                    <div className='inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mb-4 shadow-lg'>
                      <CheckCircle className='w-8 h-8 text-white' />
                    </div>
                    <h3 className='text-3xl font-bold text-white mb-2'>
                      🎉 Processing Complete!
                    </h3>
                    <p className='text-gray-300 text-lg'>
                      Your chain files have been successfully generated
                    </p>
                  </div>

                  {/* Summary Cards */}
                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8'>
                    <div className='bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center'>
                      <div className='w-10 h-10 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg'>
                        <FileText className='w-5 h-5 text-white' />
                      </div>
                      <p className='text-sm text-gray-400 mb-1'>Total Files</p>
                      <p className='text-2xl font-bold text-blue-400'>
                        {results.summary.total_files}
                      </p>
                    </div>
                    <div className='bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center'>
                      <div className='w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg'>
                        <Settings className='w-5 h-5 text-white' />
                      </div>
                      <p className='text-sm text-gray-400 mb-1'>
                        Project Folder
                      </p>
                      <p className='text-sm font-bold text-purple-400 truncate'>
                        {results.summary.project_folder || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* File List */}
                  {(results.file_details && results.file_details.length > 0) && (
                    <div className='bg-gray-800/50 border border-gray-700/50 rounded-xl mb-6'>
                      <div className='p-6'>
                        <h4 className='text-white text-lg font-bold mb-4'>
                          Generated Chain Files
                        </h4>
                        <div className='space-y-2 max-h-48 overflow-y-auto'>
                          {results.file_details!.map((detail, idx) => (
                            <div
                              key={idx}
                              className='flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg'
                            >
                              <FileText className='w-4 h-4 text-gray-400' />
                              <div className='flex flex-col'>
                                <span className='text-sm text-gray-300'>
                                  {detail.filename}
                                </span>
                                {detail.project_folder && (
                                  <span className='text-xs text-gray-400 break-all'>
                                    {detail.project_folder}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Download Button */}
                  <div className='text-center'>
                    <Button
                      onClick={downloadResults}
                      size='lg'
                      className='bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-lg font-bold px-12 py-4 h-auto shadow-lg'
                    >
                      <Download className='w-6 h-6 mr-3' />
                      Download Chain Files
                      <Badge
                        variant='secondary'
                        className='ml-3 bg-white/20 text-white'
                      >
                        ZIP
                      </Badge>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PyChainApp;

