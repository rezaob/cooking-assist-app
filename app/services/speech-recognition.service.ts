import { Http, File, knownFolders, isAndroid, isIOS, Application } from '@nativescript/core';

export class SpeechRecognitionService {
    private isListening: boolean = false;
    private audioEngine: AVAudioEngine;
    private recognitionRequest: SFSpeechAudioBufferRecognitionRequest;
    private recognitionTask: SFSpeechRecognitionTask;
    private audioSession: AVAudioSession;
    private speechRecognizer: SFSpeechRecognizer;
    private lastPartialResult: string = '';
    private noSpeechTimer: any;
    private inputNode: AVAudioInputNode;

    constructor() {
        if (isIOS) {
            this.initializeIOS();
        }
    }

    private initializeIOS() {
        try {
            this.audioEngine = AVAudioEngine.new();
            this.audioSession = AVAudioSession.sharedInstance();
            this.speechRecognizer = SFSpeechRecognizer.alloc().initWithLocale(NSLocale.alloc().initWithLocaleIdentifier('en-US'));
            this.inputNode = this.audioEngine.inputNode;
            
            if (!this.speechRecognizer.available) {
                throw new Error('Speech recognition not available');
            }
        } catch (error) {
            console.error('Failed to initialize iOS speech recognition:', error);
        }
    }

    private configureAudioSession(): boolean {
        if (!isIOS) return false;

        try {
            // Reset audio session
            this.audioSession.setActiveWithOptionsError(false, 0);
            
            // Configure audio session
            this.audioSession.setModeError(AVAudioSessionModeMeasurement);
            this.audioSession.setCategoryWithOptionsError(
                AVAudioSessionCategoryPlayAndRecord,
                AVAudioSessionCategoryOptions.DefaultToSpeaker |
                AVAudioSessionCategoryOptions.AllowBluetooth |
                AVAudioSessionCategoryOptions.MixWithOthers
            );
            
            // Set preferred sample rate and I/O buffer duration
            this.audioSession.setPreferredSampleRateError(44100);
            this.audioSession.setPreferredIOBufferDurationError(0.005);
            
            // Activate the session
            this.audioSession.setActiveWithOptionsError(true, 0);
            
            return true;
        } catch (err) {
            console.error('Audio session configuration error:', err);
            return false;
        }
    }

    async startListening(): Promise<string> {
        if (this.isListening) {
            return;
        }

        try {
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) {
                throw new Error('Required permissions not granted');
            }

            this.isListening = true;
            console.log('Starting to listen...');

            if (isIOS) {
                if (!this.configureAudioSession()) {
                    throw new Error('Failed to configure audio session');
                }
                return await this.startIOSSpeechRecognition();
            } else if (isAndroid) {
                return await this.startAndroidSpeechRecognition();
            }

            throw new Error('Platform not supported');
        } catch (error) {
            console.error('Recording error:', error);
            this.isListening = false;
            throw error;
        }
    }

    private async startIOSSpeechRecognition(): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                // Stop any existing tasks
                this.stopRecording();
                
                // Create and configure recognition request
                this.recognitionRequest = SFSpeechAudioBufferRecognitionRequest.new();
                this.recognitionRequest.shouldReportPartialResults = true;

                // Configure audio engine and input node
                const recordingFormat = this.inputNode.outputFormatForBus(0);
                
                // Remove any existing tap before installing a new one
                this.inputNode.removeTapOnBus(0);
                
                this.inputNode.installTapOnBusBufferSizeFormatBlock(
                    0,
                    1024,
                    recordingFormat,
                    (buffer: AVAudioPCMBuffer, when: AVAudioTime) => {
                        this.recognitionRequest?.appendAudioPCMBuffer(buffer);
                    }
                );

                // Prepare and start audio engine
                this.audioEngine.prepare();

                // Start recognition task
                this.recognitionTask = this.speechRecognizer.recognitionTaskWithRequestResultHandler(
                    this.recognitionRequest,
                    (result: SFSpeechRecognitionResult, error: NSError) => {
                        let isFinal = false;

                        if (result) {
                            const transcript = result.bestTranscription.formattedString;
                            console.log('Speech result:', transcript);
                            this.lastPartialResult = transcript;
                            isFinal = result.isFinal;
                            
                            if (isFinal) {
                                this.stopRecording();
                                resolve(transcript);
                            }
                        }

                        if (error) {
                            console.error('Recognition error:', error);
                            this.stopRecording();
                            reject(error.localizedDescription);
                        }
                    }
                );

                // Start audio engine
                const startError = new interop.Reference();
                this.audioEngine.startAndReturnError(startError);
                
                if (startError.value) {
                    throw new Error('Failed to start audio engine');
                }

                // Set timeout for no speech
                this.resetNoSpeechTimer(() => {
                    if (this.lastPartialResult) {
                        this.stopRecording();
                        resolve(this.lastPartialResult);
                    } else {
                        reject(new Error('No speech detected'));
                    }
                });

            } catch (error) {
                console.error('iOS speech recognition error:', error);
                this.stopRecording();
                reject(error);
            }
        });
    }

    private resetNoSpeechTimer(callback: () => void) {
        if (this.noSpeechTimer) {
            clearTimeout(this.noSpeechTimer);
        }
        this.noSpeechTimer = setTimeout(callback, 5000); // Increased timeout to 5 seconds
    }

    private async startAndroidSpeechRecognition(): Promise<string> {
        throw new Error('Android speech recognition not implemented');
    }

    private async requestPermissions(): Promise<boolean> {
        if (isIOS) {
            try {
                const micPermission = await new Promise<boolean>((resolve) => {
                    AVAudioSession.sharedInstance().requestRecordPermission((granted) => {
                        resolve(granted);
                    });
                });

                if (!micPermission) {
                    console.log('Microphone permission denied');
                    return false;
                }

                const speechPermission = await new Promise<boolean>((resolve) => {
                    SFSpeechRecognizer.requestAuthorization((status) => {
                        resolve(status === SFSpeechRecognizerAuthorizationStatus.Authorized);
                    });
                });

                if (!speechPermission) {
                    console.log('Speech recognition permission denied');
                    return false;
                }

                console.log('All permissions granted');
                return true;
            } catch (error) {
                console.error('Permission request error:', error);
                return false;
            }
        }

        return true;
    }

    private stopRecording(): void {
        this.isListening = false;
        
        if (this.noSpeechTimer) {
            clearTimeout(this.noSpeechTimer);
            this.noSpeechTimer = null;
        }
        
        if (isIOS) {
            if (this.audioEngine?.running) {
                this.audioEngine.stop();
                if (this.inputNode) {
                    this.inputNode.removeTapOnBus(0);
                }
            }
            
            this.recognitionRequest?.endAudio();
            this.recognitionRequest = null;
            
            this.recognitionTask?.cancel();
            this.recognitionTask = null;

            try {
                this.audioSession?.setActiveWithOptionsError(
                    false,
                    AVAudioSessionSetActiveOptions.NotifyOthersOnDeactivation
                );
            } catch (error) {
                console.error('Error deactivating audio session:', error);
            }
        }
        
        this.lastPartialResult = '';
    }
}