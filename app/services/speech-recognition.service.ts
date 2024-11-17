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
            // Deactivate session first
            this.audioSession.setActiveWithOptionsError(false, AVAudioSessionSetActiveOptions.NotifyOthersOnDeactivation);

            // Configure category and mode
            this.audioSession.setCategoryWithOptionsError(
                AVAudioSessionCategoryPlayAndRecord,
                AVAudioSessionCategoryOptions.DefaultToSpeaker |
                AVAudioSessionCategoryOptions.AllowBluetooth
            );

            // Set mode
            this.audioSession.setModeError(AVAudioSessionModeMeasurement);

            // Activate session
            this.audioSession.setActiveWithOptionsError(true, 0);

            return true;
        } catch (err) {
            console.error('Audio session configuration error:', err);
            return false;
        }
    }

    async startListening(): Promise<string> {
        if (this.isListening) return;

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
                // Create recognition request
                this.recognitionRequest = SFSpeechAudioBufferRecognitionRequest.new();
                this.recognitionRequest.shouldReportPartialResults = true;

                // Configure audio engine
                const inputNode = this.audioEngine.inputNode;
                const recordingFormat = inputNode.outputFormatForBus(0);
                
                inputNode.installTapOnBusBufferSizeFormatBlock(
                    0,
                    4096,
                    recordingFormat,
                    (buffer: AVAudioPCMBuffer, when: AVAudioTime) => {
                        this.recognitionRequest?.appendAudioPCMBuffer(buffer);
                    }
                );

                this.audioEngine.prepare();

                // Start recognition task
                this.recognitionTask = this.speechRecognizer.recognitionTaskWithRequestResultHandler(
                    this.recognitionRequest,
                    (result: SFSpeechRecognitionResult, error: NSError) => {
                        if (result) {
                            const transcript = result.bestTranscription.formattedString;
                            console.log('Speech result:', transcript);
                            this.lastPartialResult = transcript;
                            
                            if (result.isFinal) {
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

                const startError = new interop.Reference();
                const success = this.audioEngine.startAndReturnError(startError);
                
                if (!success) {
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
        this.noSpeechTimer = setTimeout(callback, 3000);
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
                this.audioEngine.inputNode?.removeTapOnBus(0);
                this.audioEngine.reset();
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